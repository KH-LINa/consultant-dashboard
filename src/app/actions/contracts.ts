'use server'

import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { createClient } from '@/lib/supabase/server'
import { getSettings } from '@/lib/settings'
import { revalidatePath } from 'next/cache'

type ActionResult = { ok: true } | { ok: false; error: string }
type GenerateResult = { ok: true; contractId: string; existing?: boolean } | { ok: false; error: string }
type VerifyResult = { ok: true; alertes: string[] } | { ok: false; error: string }

const ContractVariablesSchema = z.object({
  objet_mission: z.string().describe('Description de la mission en 2 à 4 phrases, ton professionnel'),
  livrables: z.string().describe('Liste des livrables attendus, séparés par des tirets ou virgules, concis'),
  delai: z.string().describe('Délai d\'exécution (ex : « 3 semaines », « 2 mois »)'),
})

const VerificationSchema = z.object({
  remarques: z
    .array(z.string())
    .describe('Écarts matériels et vérifiables entre le contrat et le devis actuel ; tableau VIDE si tout est cohérent'),
})

const SYSTEM_PROMPT_VERIFICATION = `Tu es Exact, l'assistant qui vérifie la fidélité d'un contrat de prestation de services déjà rédigé, en le comparant au devis qui lui a servi de source. Ton rôle est strictement borné : signaler les écarts, jamais réécrire ni proposer de nouveau texte.

Compare le CONTENU DU CONTRAT fourni aux LIGNES DU DEVIS ACTUEL (le devis a pu être modifié depuis la génération du contrat — c'est précisément ce qu'il faut détecter). Signale UNIQUEMENT des écarts matériels et vérifiables :
- une prestation présente dans le devis absente du contrat, ou l'inverse
- un objet de mission qui ne correspond plus à ce que décrivent les lignes du devis
- des livrables incohérents avec le devis

NE signale JAMAIS un simple choix de style, une tournure de phrase, ou une reformulation légitime du même contenu. Si tout est cohérent, renvoie une liste vide — un contrat correct n'a pas besoin d'être signalé pour rien. Réponds en français uniquement.`

const SYSTEM_PROMPT = `Tu es Exact, l'assistant qui prépare les parties variables d'un contrat de prestation de services pour un consultant IA indépendant français. Ton rôle est strictement borné : rester fidèle au devis et au template fourni, jamais inventer ou improviser au-delà de ce qui t'est demandé.

À partir des infos du devis, génère UNIQUEMENT :
- objet_mission : description de la mission (2-4 phrases professionnelles, sans mention de montant)
- livrables : liste concise des livrables (tirets ou virgules)
- delai : durée d'exécution courte et précise

NE PAS rédiger de clauses juridiques — ce n'est jamais ton rôle, le template s'en charge. Réponds en français uniquement.`

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
      return { ok: false, error: "Exact n'a pas pu générer les parties variables du contrat." }
    }
    aiVars = response.parsed_output
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur inconnue'
    return { ok: false, error: `Erreur Exact : ${msg}` }
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

  // Numéro séquentiel CTR-YYYY-XXXX.
  // Base : plus grand numéro VISIBLE de l'année. (L'ancien comptage de lignes
  // se trompait dès qu'un contrat était supprimé ou archivé : le numéro
  // recalculé entrait en collision avec un numéro déjà attribué.)
  const year = new Date().getFullYear()
  const { data: dernier } = await supabase
    .from('contracts')
    .select('numero')
    .like('numero', `CTR-${year}-%`)
    .order('numero', { ascending: false })
    .limit(1)
    .maybeSingle()

  const parsed = dernier ? parseInt(dernier.numero.slice(-4), 10) : 0
  const base = Number.isNaN(parsed) ? 0 : parsed

  // La contrainte d'unicité est globale alors que la RLS restreint la lecture :
  // un numéro invisible pour cette session peut encore exister. En cas de
  // collision (code 23505), on réessaie au numéro suivant.
  let newContract: { id: string } | null = null
  let insertError: { message: string; code?: string } | null = null
  for (let essai = 0; essai < 10; essai++) {
    const numero = `CTR-${year}-${String(base + 1 + essai).padStart(4, '0')}`
    const { data, error } = await supabase
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
    if (!error && data) { newContract = data; insertError = null; break }
    insertError = error
    if (error?.code !== '23505') break
  }

  if (insertError || !newContract) {
    return { ok: false, error: insertError?.message ?? 'Erreur lors de la création du contrat' }
  }

  revalidatePath('/contrats')
  revalidatePath(`/devis/${quoteId}`)
  return { ok: true, contractId: newContract.id }
}

/**
 * Vérification NON bloquante (voir SYSTEM_PROMPT_VERIFICATION) : Exact relit
 * un contrat déjà généré et signale les écarts avec le devis source, sans
 * jamais réécrire ni modifier quoi que ce soit — même garde-fou "signale
 * seulement" que le reste de l'app (indisponibilités, conflits de dépendances...).
 * Utile surtout après une édition manuelle du contrat (ContractEditor) ou une
 * modification du devis après coup.
 */
export async function verifyContract(contractId: string): Promise<VerifyResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non autorisé' }

  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, error: 'ANTHROPIC_API_KEY non configurée côté serveur.' }
  }

  const { data: contract } = await supabase
    .from('contracts')
    .select('*, quote:quotes(*), template:contract_templates(offre)')
    .eq('id', contractId)
    .single()

  if (!contract) return { ok: false, error: 'Contrat introuvable' }
  if (!contract.quote) return { ok: false, error: 'Devis source introuvable' }

  const alertes: string[] = []

  // --- Vérifications déterministes (aucun appel IA nécessaire) ---
  const placeholderMatches: string[] = contract.contenu.match(/\{\{\w+\}\}/g) ?? []
  const placeholders = Array.from(new Set(placeholderMatches))
  if (placeholders.length > 0) {
    alertes.push(`Variable(s) jamais remplacée(s) dans le texte : ${placeholders.join(', ')}`)
  }

  if (Number(contract.montant_ht) !== Number(contract.quote.montant_ht)) {
    alertes.push(
      `Le montant du devis a changé depuis la génération du contrat (contrat : ${Number(contract.montant_ht).toLocaleString('fr-FR')} €, devis actuel : ${Number(contract.quote.montant_ht).toLocaleString('fr-FR')} €).`
    )
  }

  const offreTemplateActuelle = contract.quote.offre === 'solution_globale' ? 'solution_centralisee' : contract.quote.offre
  if (contract.template && contract.template.offre !== offreTemplateActuelle) {
    alertes.push(
      `Le type d'offre du devis a changé depuis la génération du contrat (contrat basé sur "${contract.template.offre}", devis actuel "${contract.quote.offre}").`
    )
  }

  // --- Vérification IA (Exact) : cohérence de fond avec les lignes du devis ---
  const client = new Anthropic()
  const lignesTxt = (contract.quote.lignes ?? [])
    .map((l: { description: string; quantite: number }, i: number) => `${i + 1}. ${l.description} (quantité : ${l.quantite})`)
    .join('\n')

  try {
    const response = await client.messages.parse({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      system: [{ type: 'text', text: SYSTEM_PROMPT_VERIFICATION, cache_control: { type: 'ephemeral' } }],
      messages: [{
        role: 'user',
        content: `Devis actuel — ${contract.quote.titre} :\n${lignesTxt || '(aucune ligne)'}\n\nContenu du contrat à vérifier :\n${contract.contenu}`,
      }],
      output_config: { format: zodOutputFormat(VerificationSchema) },
    })
    if (response.parsed_output) {
      alertes.push(...response.parsed_output.remarques)
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur inconnue'
    return { ok: false, error: `Erreur Exact : ${msg}` }
  }

  return { ok: true, alertes }
}

const CorrectionSchema = z.object({
  contenu: z.string().describe("Texte INTÉGRAL et corrigé du contrat, dans son ensemble — jamais un extrait ni un résumé des changements"),
})

const SYSTEM_PROMPT_CORRECTION = `Tu es Exact, l'assistant qui corrige un contrat de prestation de services à partir d'une liste précise de points signalés lors d'une vérification. Ton rôle est strictement borné :
- Corrige UNIQUEMENT les points listés, rien d'autre — ne change ni le style, ni la mise en forme, ni une clause non concernée par ces points.
- Base-toi sur le devis actuel fourni pour corriger les montants, prestations ou livrables incohérents.
- Si un point concerne une variable {{...}} jamais remplacée : NE L'INVENTE PAS, laisse-la telle quelle — un humain doit la compléter, ce n'est pas ton rôle.
- Renvoie le texte INTÉGRAL du contrat, corrections incluses, jamais un extrait ni un résumé des changements.

Réponds en français uniquement.`

/**
 * Propose une correction du contrat à partir des points signalés par
 * verifyContract ci-dessus — ne modifie RIEN en base : renvoie un texte
 * proposé que l'appelant affiche dans l'éditeur pour relecture, la
 * sauvegarde restant une action manuelle explicite (updateContractContent).
 */
export async function correctContract(
  contractId: string, alertes: string[]
): Promise<{ ok: true; contenu: string } | { ok: false; error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non autorisé' }

  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, error: 'ANTHROPIC_API_KEY non configurée côté serveur.' }
  }
  if (alertes.length === 0) return { ok: false, error: 'Aucun point à corriger.' }

  const { data: contract } = await supabase
    .from('contracts')
    .select('*, quote:quotes(*)')
    .eq('id', contractId)
    .single()

  if (!contract) return { ok: false, error: 'Contrat introuvable' }
  if (!contract.quote) return { ok: false, error: 'Devis source introuvable' }

  const client = new Anthropic()
  const lignesTxt = (contract.quote.lignes ?? [])
    .map((l: { description: string; quantite: number; prix_unitaire: number }, i: number) =>
      `${i + 1}. ${l.description} (quantité : ${l.quantite}, prix unitaire : ${l.prix_unitaire} €)`)
    .join('\n')
  const alertesTxt = alertes.map((a) => `- ${a}`).join('\n')

  try {
    const response = await client.messages.parse({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      system: [{ type: 'text', text: SYSTEM_PROMPT_CORRECTION, cache_control: { type: 'ephemeral' } }],
      messages: [{
        role: 'user',
        content: `Devis actuel — ${contract.quote.titre} :\n${lignesTxt || '(aucune ligne)'}\nMontant HT actuel : ${contract.quote.montant_ht} €\n\nPoints à corriger :\n${alertesTxt}\n\nContrat actuel :\n${contract.contenu}`,
      }],
      output_config: { format: zodOutputFormat(CorrectionSchema) },
    })
    if (!response.parsed_output) {
      return { ok: false, error: "Exact n'a pas pu proposer de correction. Réessayez." }
    }
    return { ok: true, contenu: response.parsed_output.contenu }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur inconnue'
    return { ok: false, error: `Erreur Exact : ${msg}` }
  }
}

export async function updateContractContent(id: string, contenu: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non autorisé' }

  // Le montant du contrat est resynchronisé sur celui du devis source à
  // chaque sauvegarde — qu'elle suive une édition manuelle ou une
  // correction proposée par Exact, un contrat ne doit jamais afficher un
  // montant différent de son devis.
  const payload: { contenu: string; montant_ht?: number } = { contenu }
  const { data: contract } = await supabase.from('contracts').select('quote_id').eq('id', id).single()
  if (contract?.quote_id) {
    const { data: quote } = await supabase.from('quotes').select('montant_ht').eq('id', contract.quote_id).single()
    if (quote) payload.montant_ht = quote.montant_ht
  }

  const { error } = await supabase
    .from('contracts')
    .update(payload)
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
