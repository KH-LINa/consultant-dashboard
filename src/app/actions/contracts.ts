'use server'

import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { createClient } from '@/lib/supabase/server'
import { getSettings } from '@/lib/settings'
import { revalidatePath } from 'next/cache'

type ActionResult = { ok: true } | { ok: false; error: string }
type GenerateResult = { ok: true; contractId: string; existing?: boolean } | { ok: false; error: string }

const ContractVariablesSchema = z.object({
  objet_mission: z.string().describe('Description de la mission en 2 à 4 phrases, ton professionnel'),
  livrables: z.string().describe('Liste des livrables attendus, séparés par des tirets ou virgules, concis'),
  delai: z.string().describe('Délai d\'exécution (ex : « 3 semaines », « 2 mois »)'),
})

const SYSTEM_PROMPT = `Tu rédiges les parties variables d'un contrat de prestation de services pour un consultant IA indépendant français.
À partir des infos du devis, génère UNIQUEMENT :
- objet_mission : description de la mission (2-4 phrases professionnelles, sans mention de montant)
- livrables : liste concise des livrables (tirets ou virgules)
- delai : durée d'exécution courte et précise

NE PAS rédiger de clauses juridiques. Réponds en français uniquement.`

function replaceVariables(
  template: string,
  vars: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`)
}

export async function generateContract(quoteId: string): Promise<GenerateResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non autorisé' }

  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, error: 'ANTHROPIC_API_KEY non configurée côté serveur.' }
  }

  // Idempotence : retourne le contrat existant si déjà généré
  const { data: existing } = await supabase
    .from('contracts')
    .select('id')
    .eq('quote_id', quoteId)
    .neq('statut', 'archive')
    .maybeSingle()

  if (existing) {
    return { ok: true, contractId: existing.id, existing: true }
  }

  // Récupérer le devis
  const { data: quote } = await supabase
    .from('quotes')
    .select('*')
    .eq('id', quoteId)
    .single()

  if (!quote) return { ok: false, error: 'Devis introuvable' }
  if (quote.statut !== 'signé') return { ok: false, error: 'Le devis doit être accepté (signé) pour générer un contrat' }

  // Récupérer le contact
  const { data: contact } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', quote.contact_id)
    .single()

  if (!contact) return { ok: false, error: 'Contact introuvable' }

  // Sélectionner le template correspondant à l'offre
  const offreTemplate = quote.offre === 'solution_globale' ? 'solution_centralisee' : quote.offre
  const { data: template } = await supabase
    .from('contract_templates')
    .select('*')
    .eq('offre', offreTemplate)
    .eq('actif', true)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!template) {
    return { ok: false, error: `Aucun template actif trouvé pour l'offre "${offreTemplate}"` }
  }

  // Récupérer les paramètres du consultant
  const settings = await getSettings()

  // Appel Claude : génération des parties variables
  const client = new Anthropic()
  let aiVars: { objet_mission: string; livrables: string; delai: string }

  try {
    const response = await client.messages.parse({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{
        role: 'user',
        content: `Devis à contractualiser :
- Titre : ${quote.titre}
- Type d'offre : ${quote.offre}
- Montant HT : ${quote.montant_ht} €
- Client : ${contact.nom}${contact.entreprise ? `, ${contact.entreprise}` : ''}

Génère l'objet_mission, les livrables et le délai pour ce contrat.`,
      }],
      output_config: { format: zodOutputFormat(ContractVariablesSchema) },
    })

    if (!response.parsed_output) {
      return { ok: false, error: "L'IA n'a pas pu générer les parties variables du contrat." }
    }
    aiVars = response.parsed_output
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur inconnue'
    return { ok: false, error: `Erreur IA : ${msg}` }
  }

  // Remplacement de toutes les variables {{...}}
  const today = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
  const vars: Record<string, string> = {
    prestataire_nom:     settings.consultant_nom,
    prestataire_adresse: settings.consultant_adresse || '[Adresse du prestataire]',
    prestataire_siret:   settings.consultant_siret,
    client_nom:          contact.nom + (contact.entreprise ? ` (${contact.entreprise})` : ''),
    client_adresse:      '[Adresse du client — à compléter]',
    client_siret:        '[SIRET client — à compléter]',
    objet_mission:       aiVars.objet_mission,
    livrables:           aiVars.livrables,
    delai:               aiVars.delai,
    montant_ht:          quote.montant_ht.toLocaleString('fr-FR'),
    modalites_paiement:  'Acompte de 30 % à la commande, solde à réception des livrables',
    date_signature:      today,
    ville_signature:     '[Ville — à compléter]',
  }

  const contenuFinal = replaceVariables(template.contenu, vars)

  // Numéro séquentiel CTR-YYYY-XXXX
  const year = new Date().getFullYear()
  const { count } = await supabase
    .from('contracts')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', `${year}-01-01`)

  const numero = `CTR-${year}-${String((count ?? 0) + 1).padStart(4, '0')}`

  // Insertion en base
  const { data: newContract, error: insertError } = await supabase
    .from('contracts')
    .insert({
      quote_id:    quoteId,
      contact_id:  contact.id,
      template_id: template.id,
      numero,
      contenu:     contenuFinal,
      statut:      'brouillon',
      montant_ht:  quote.montant_ht,
    })
    .select('id')
    .single()

  if (insertError || !newContract) {
    return { ok: false, error: insertError?.message ?? 'Erreur lors de la création du contrat' }
  }

  revalidatePath('/contrats')
  revalidatePath(`/devis/${quoteId}`)
  return { ok: true, contractId: newContract.id }
}

export async function updateContractContent(id: string, contenu: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non autorisé' }

  const { error } = await supabase
    .from('contracts')
    .update({ contenu })
    .eq('id', id)

  if (error) return { ok: false, error: error.message }
  revalidatePath(`/contrats/${id}`)
  return { ok: true }
}

export async function markContractSigned(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non autorisé' }

  const { error } = await supabase
    .from('contracts')
    .update({ statut: 'signe', signed_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { ok: false, error: error.message }
  revalidatePath(`/contrats/${id}`)
  revalidatePath('/contrats')
  return { ok: true }
}

export async function archiveContract(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non autorisé' }

  const { error } = await supabase
    .from('contracts')
    .update({ statut: 'archive' })
    .eq('id', id)

  if (error) return { ok: false, error: error.message }
  revalidatePath(`/contrats/${id}`)
  revalidatePath('/contrats')
  return { ok: true }
}
