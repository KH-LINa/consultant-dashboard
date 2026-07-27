import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, clientId } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

// Modèle Claude (famille Sonnet 4). Modifiable ici si besoin.
const MODEL = 'claude-sonnet-4-6'

// Schéma du planning généré par l'IA : une phase par ligne de devis, chacune
// détaillée en quelques tâches concrètes. Les DATES ne sont jamais générées
// par le modèle (peu fiable pour de l'arithmétique calendaire) — seulement
// des durées en jours ouvrés, chaînées côté code via lib/jours-ouvres.ts.
const PlanningGenereSchema = z.object({
  phases: z
    .array(
      z.object({
        titre: z.string().describe('Titre de la phase, repris ou reformulé depuis la ligne de devis correspondante'),
        taches: z
          .array(
            z.object({
              titre: z.string().describe('Titre concret et actionnable de la tâche'),
              duree_jours_ouvres: z
                .number()
                .int()
                .min(1)
                .max(15)
                .describe('Durée de la tâche en jours ouvrés (weekends et fériés déjà exclus, ne pas en tenir compte)'),
            })
          )
          .min(2)
          .max(5)
          .describe('2 à 5 tâches concrètes qui composent la phase, dans leur ordre d\'exécution'),
      })
    )
    .describe('Une phase par ligne de devis, dans le même ordre que les lignes fournies'),
})

const SYSTEM_PROMPT = `Tu es Cadence, l'assistant de planification d'un consultant IA/Lean indépendant français. Ton rôle : préparer le planning prévisionnel d'une mission, à la création du projet ou à la demande explicite d'une régénération.

À partir du titre de la mission et des lignes du devis signé, tu proposes un planning réaliste :
- UNE PHASE PAR LIGNE DE DEVIS, dans le même ordre, avec un titre clair (repris ou reformulé depuis la description de la ligne).
- Pour CHAQUE PHASE, 2 à 5 TÂCHES concrètes et actionnables qui la composent (pas des reformulations vagues du titre de la phase).
- Pour CHAQUE TÂCHE, une durée en JOURS OUVRÉS (jour de travail effectif, weekends et fériés déjà exclus par le système — n'y pense pas).

Contexte à respecter :
- Le consultant travaille SEUL (pas d'équipe) : les tâches d'une même phase s'enchaînent séquentiellement, jamais en parallèle. Ne propose donc pas un total de jours par phase disproportionné par rapport à ce qu'une personne seule peut raisonnablement faire.
- La quantité indiquée sur une ligne de devis est un indice de durée SEULEMENT si elle est cohérente avec des jours de mission (≥ 2) ; une quantité de 1 signifie généralement "un forfait", pas "un jour" — dans ce cas, réparti les tâches sur une durée courte et réaliste (2 à 4 jours ouvrés au total pour la phase).
- Reste réaliste et évite le remplissage : une tâche vague ("Suivi", "Divers") n'est jamais une bonne réponse — chaque tâche doit correspondre à un livrable ou une action identifiable.
- Vocabulaire cohérent avec une mission de conseil Lean & IA industrielle (diagnostic terrain, ateliers, formation, développement, recette, restitution, documentation...).

Réponds uniquement avec la structure demandée, en français.`

export async function POST(request: NextRequest) {
  // Auth : réservé aux utilisateurs connectés (staff)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  // Anti-abus : max 15 générations IA / minute par utilisateur (coût Anthropic)
  const rl = await checkRateLimit({
    prefix: 'ai-planning', identifier: clientId(request, user.id), max: 15, windowSec: 60,
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

  let titre = ''
  let lignes: { description: string; quantite: number; prix_unitaire: number }[] = []
  try {
    const body = await request.json()
    titre = (body.titre ?? '').toString().trim()
    lignes = Array.isArray(body.lignes) ? body.lignes : []
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 })
  }

  if (!titre || lignes.length === 0) {
    return NextResponse.json(
      { error: 'Titre de mission et lignes de devis requis.' },
      { status: 400 }
    )
  }

  const client = new Anthropic() // lit ANTHROPIC_API_KEY depuis l'environnement

  const lignesTxt = lignes
    .map((l, i) => `${i + 1}. ${l.description} (quantité : ${l.quantite})`)
    .join('\n')

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
          content: `Mission : ${titre}\n\nLignes du devis signé :\n${lignesTxt}\n\nGénère le planning prévisionnel (phases + tâches).`,
        },
      ],
      output_config: {
        format: zodOutputFormat(PlanningGenereSchema),
      },
    })

    const planning = response.parsed_output
    if (!planning || planning.phases.length !== lignes.length) {
      return NextResponse.json(
        { error: "L'IA n'a pas pu générer un planning cohérent. Réessayez." },
        { status: 502 }
      )
    }

    return NextResponse.json({ planning })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    return NextResponse.json(
      { error: `Erreur lors de la génération : ${message}` },
      { status: 500 }
    )
  }
}
