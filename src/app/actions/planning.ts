'use server'

import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { createClient } from '@/lib/supabase/server'

/**
 * Actions IA de Cadence en dehors de la génération de planning elle-même
 * (voir /api/projets/generer-planning et lib/planning-ia.ts) — ici, la
 * VÉRIFICATION de cohérence entre un planning déjà généré et le devis qui
 * lui a servi de source. Même garde-fou "signale, ne modifie jamais" que
 * verifyContract (Exact) dans app/actions/contracts.ts.
 */

export type VerifyPhasesResult = { ok: true; alertes: string[] } | { ok: false; error: string }

const VerificationSchema = z.object({
  remarques: z
    .array(z.string())
    .describe('Écarts matériels et vérifiables entre les phases du planning et le devis actuel ; tableau VIDE si tout est cohérent'),
})

const SYSTEM_PROMPT_VERIFICATION = `Tu es Cadence, l'assistant de planification d'un consultant IA/Lean indépendant français. Ton rôle ici est de VÉRIFIER, pas de générer : comparer les phases d'un planning déjà en place aux lignes du devis actuel, et signaler les écarts — jamais reconstruire ni modifier le planning toi-même.

Signale UNIQUEMENT des écarts matériels et vérifiables :
- une prestation présente dans le devis actuel sans phase correspondante dans le planning
- une phase du planning qui ne correspond plus à aucune ligne du devis actuel (ligne supprimée ou fortement modifiée depuis la génération du planning)
- un intitulé de phase manifestement incohérent avec la ligne de devis qu'elle est censée couvrir

NE signale JAMAIS un simple réordonnancement des phases, une reformulation légitime d'un titre, ou le fait que le planning soit plus détaillé que le devis (c'est normal : une ligne de devis devient une phase, elle-même détaillée en tâches). Si tout est cohérent, renvoie une liste vide. Réponds en français uniquement.`

/**
 * Vérifie le planning (phases) du projet lié à un devis, s'il en existe un.
 * Retourne alertes: [] (sans appel IA) si aucun projet ou aucune phase
 * n'existe encore — rien à comparer.
 */
export async function verifyProjectPhases(quoteId: string): Promise<VerifyPhasesResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non autorisé' }

  const { data: quote } = await supabase.from('quotes').select('*').eq('id', quoteId).single()
  if (!quote) return { ok: false, error: 'Devis introuvable' }

  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('quote_id', quoteId)
    .maybeSingle()
  if (!project) return { ok: true, alertes: [] }

  const { data: phases } = await supabase
    .from('project_phases')
    .select('titre, ordre')
    .eq('project_id', project.id)
    .order('ordre')
  if (!phases || phases.length === 0) return { ok: true, alertes: [] }

  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, error: 'ANTHROPIC_API_KEY non configurée côté serveur.' }
  }

  const client = new Anthropic()
  const lignesTxt = (quote.lignes ?? [])
    .map((l: { description: string; quantite: number }, i: number) => `${i + 1}. ${l.description} (quantité : ${l.quantite})`)
    .join('\n')
  const phasesTxt = phases.map((p: { titre: string }, i: number) => `${i + 1}. ${p.titre}`).join('\n')

  try {
    const response = await client.messages.parse({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      system: [{ type: 'text', text: SYSTEM_PROMPT_VERIFICATION, cache_control: { type: 'ephemeral' } }],
      messages: [{
        role: 'user',
        content: `Devis actuel — ${quote.titre} :\n${lignesTxt || '(aucune ligne)'}\n\nPhases actuelles du planning :\n${phasesTxt}`,
      }],
      output_config: { format: zodOutputFormat(VerificationSchema) },
    })
    if (!response.parsed_output) {
      return { ok: false, error: "Cadence n'a pas pu vérifier le planning. Réessayez." }
    }
    return { ok: true, alertes: response.parsed_output.remarques }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur inconnue'
    return { ok: false, error: `Erreur Cadence : ${msg}` }
  }
}
