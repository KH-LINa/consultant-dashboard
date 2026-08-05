import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, clientId } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

// Modèle Claude (famille Sonnet 4). Modifiable ici si besoin.
const MODEL = 'claude-sonnet-4-6'

// Schéma de la proposition de devis générée par l'IA
const DevisGenereSchema = z.object({
  titre: z.string().describe('Titre court et professionnel du devis'),
  offre: z
    .enum(['consulting', 'automatisation', 'solution_globale'])
    .describe(
      "Type d'offre : consulting (conseil/audit/formation), automatisation (workflows/scripts/intégrations), solution_globale (projet complet de bout en bout)"
    ),
  lignes: z
    .array(
      z.object({
        description: z.string().describe('Description de la prestation'),
        quantite: z.number().describe('Quantité (jours, forfaits, unités)'),
        prix_unitaire: z.number().describe('Prix unitaire HT en euros'),
      })
    )
    .describe('Lignes de prestation détaillées avec montants'),
})

const SYSTEM_PROMPT = `Tu es Franc, l'assistant de rédaction de devis d'un consultant IA indépendant français. Ton rôle : préparer une proposition de devis claire, réaliste et honnête — jamais gonflée pour impressionner, jamais en-dessous pour décrocher la mission à tout prix.

À partir d'une description libre du besoin client, tu proposes un devis structuré et réaliste :
- un TITRE clair et professionnel
- le TYPE D'OFFRE le plus adapté parmi : consulting, automatisation, solution_globale
- des LIGNES DE PRESTATION détaillées avec quantités et prix unitaires HT cohérents

Règles de tarification (TJM de lancement de l'agence, tous types de prestations confondus) :
- Taux journalier moyen (TJM) : 450 à 500 € HT/jour — tarif de lancement, sans track record encore construit, à remonter progressivement une fois des missions références obtenues
- Décompose en lignes lisibles (cadrage, conception, développement, recette, formation, etc.)
- Reste réaliste : si le besoin est flou, propose une phase de cadrage courte
- Montants en euros HT, sans TVA (statut juridique en cours de finalisation — ne pas mentionner de régime de TVA spécifique)

Réponds uniquement avec la structure demandée, en français.`

export async function POST(request: NextRequest) {
  // Auth : réservé à l'admin connecté
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  // Anti-abus : max 15 générations IA / minute par utilisateur (coût Anthropic)
  const rl = await checkRateLimit({
    prefix: 'ai-devis', identifier: clientId(request, user.id), max: 15, windowSec: 60,
  })
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Trop de générations en peu de temps. Réessayez dans une minute.' },
      { status: 429 }
    )
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'Clé ANTHROPIC_API_KEY non configurée côté serveur.' },
      { status: 500 }
    )
  }

  let description = ''
  try {
    const body = await request.json()
    description = (body.description ?? '').toString().trim()
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 })
  }

  if (!description) {
    return NextResponse.json(
      { error: 'Veuillez décrire le besoin du client.' },
      { status: 400 }
    )
  }

  const client = new Anthropic() // lit ANTHROPIC_API_KEY depuis l'environnement

  try {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 4000,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: `Voici le besoin exprimé par le client :\n\n${description}\n\nGénère une proposition de devis structurée.`,
        },
      ],
      output_config: {
        format: zodOutputFormat(DevisGenereSchema),
      },
    })

    const proposition = response.parsed_output
    if (!proposition) {
      return NextResponse.json(
        { error: "Franc n'a pas pu générer de proposition. Réessayez." },
        { status: 502 }
      )
    }

    return NextResponse.json({ proposition })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    return NextResponse.json(
      { error: `Erreur lors de la génération : ${message}` },
      { status: 500 }
    )
  }
}
