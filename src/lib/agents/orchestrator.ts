import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { getSettings, type ConsultantSettings } from '@/lib/settings'

/**
 * Orchestrateur du module Agents (pattern orchestrateur-workers).
 *
 * Appel 1 (routage) : Claude reçoit la liste des sous-agents actifs et décide,
 * via l'outil `appeler_sous_agents`, lesquels appeler et avec quelle instruction.
 * S'il manque une information indispensable, il répond en texte (questions) sans
 * appeler d'outil.
 *
 * Exécution : les sous-agents demandés tournent en parallèle (Promise.all),
 * chacun avec son system_prompt (variables {{consultant_*}} injectées) et son modèle.
 *
 * Appel 2 (synthèse) : les résultats repartent à l'orchestrateur en tool_result
 * pour assemblage. Économie de tokens : si un seul sous-agent a répondu avec
 * succès, sa sortie est retournée directement sans appel de synthèse.
 *
 * Chaque run est tracé dans agent_runs (tokens, durée, statut, erreurs).
 */

const ORCHESTRATOR_MODEL = 'claude-sonnet-4-6'
const ORCHESTRATOR_MAX_TOKENS = 8192

export interface AgentRow {
  id: string
  slug: string
  nom: string
  description: string | null
  system_prompt: string
  model: string
  max_tokens: number
  actif: boolean
}

export interface AppelSousAgent {
  slug: string
  instruction: string
}

export interface ResultatSousAgent extends AppelSousAgent {
  nom: string
  statut: 'succes' | 'erreur'
  sortie?: string
  erreur?: string
}

export interface OrchestrationResultat {
  /** 'questions' : l'orchestrateur demande des précisions, aucun sous-agent appelé */
  type: 'questions' | 'resultat'
  contenu: string
  agents_appeles: ResultatSousAgent[]
  tokens_input: number
  tokens_output: number
  duree_ms: number
  run_id: string | null
}

// Valeurs par défaut de src/lib/settings.ts : ce sont des placeholders de
// démonstration, pas de vraies coordonnées — on les traite comme absentes.
const VALEURS_SENTINELLES = new Set(['Votre Nom', '000 000 000 00000', 'contact@votre-domaine.fr'])

const VARIABLES_CONSULTANT: Array<{ variable: string; cle: keyof ConsultantSettings; libelle: string }> = [
  { variable: 'consultant_nom', cle: 'consultant_nom', libelle: 'nom du consultant' },
  { variable: 'consultant_email', cle: 'consultant_email', libelle: 'email du consultant' },
  { variable: 'consultant_telephone', cle: 'consultant_telephone', libelle: 'téléphone du consultant' },
  { variable: 'consultant_siret', cle: 'consultant_siret', libelle: 'SIRET du consultant' },
  { variable: 'consultant_adresse', cle: 'consultant_adresse', libelle: 'adresse du consultant' },
]

/** Remplace {{consultant_*}} par les valeurs de la table settings, ou un placeholder visible. */
export function injecterVariablesConsultant(texte: string, settings: ConsultantSettings): string {
  let resultat = texte
  for (const { variable, cle, libelle } of VARIABLES_CONSULTANT) {
    const brut = (settings[cle] ?? '').trim()
    const valeur = brut && !VALEURS_SENTINELLES.has(brut) ? brut : `[À COMPLÉTER : ${libelle}]`
    resultat = resultat.split(`{{${variable}}}`).join(valeur)
  }
  return resultat
}

const OUTIL_APPELER_SOUS_AGENTS: Anthropic.Tool = {
  name: 'appeler_sous_agents',
  description:
    "Appelle un ou plusieurs sous-agents spécialisés en parallèle. À utiliser dès que la demande contient assez d'informations pour produire le ou les livrables demandés.",
  input_schema: {
    type: 'object',
    properties: {
      appels: {
        type: 'array',
        description: 'Un appel par sous-agent nécessaire',
        items: {
          type: 'object',
          properties: {
            slug: { type: 'string', description: 'Slug du sous-agent, parmi la liste fournie dans le system prompt' },
            instruction: {
              type: 'string',
              description:
                'Instruction ciblée pour ce sous-agent : ce qu’il doit produire, avec les informations utiles de la demande',
            },
          },
          required: ['slug', 'instruction'],
        },
      },
    },
    required: ['appels'],
  },
}

function systemOrchestrateur(agents: AgentRow[]): string {
  const liste = agents.map((a) => `- ${a.slug} : ${a.description ?? a.nom}`).join('\n')
  return `Tu es l'orchestrateur du module Agents du dashboard i·a·infinity (conseil Lean & IA industrielle).

Ton rôle : analyser la demande du consultant et décider quels sous-agents spécialisés appeler via l'outil appeler_sous_agents, avec une instruction ciblée pour chacun.

Sous-agents actifs disponibles :
${liste}

Règles :
- Appelle uniquement les sous-agents strictement nécessaires à la demande (un seul si elle est simple).
- Chaque instruction précise ce que le sous-agent doit produire et reprend les informations utiles de la demande (client, contexte, contraintes). Le sous-agent recevra aussi la demande initiale en contexte.
- S'il manque une information indispensable pour produire un livrable correct, ne devine pas et n'appelle AUCUN outil : réponds en texte avec les questions précises à poser à l'utilisateur.
- N'invente jamais de données ; les sous-agents utilisent des placeholders [À COMPLÉTER : …] pour ce qui manque.

Lors de la synthèse (après réception des résultats des sous-agents) :
- Assemble une réponse finale cohérente en markdown, avec une section par livrable.
- Restitue les livrables sans les réécrire ni les résumer (le JSON de agent-planning est repris tel quel dans un bloc de code).
- Si un sous-agent a échoué, signale-le clairement au début de la réponse.`
}

class SousAgentInconnuError extends Error {}

async function executerSousAgent(
  anthropic: Anthropic,
  appel: AppelSousAgent,
  agentsParSlug: Map<string, AgentRow>,
  settings: ConsultantSettings,
  demande: string
): Promise<{ resultat: ResultatSousAgent; tokens_input: number; tokens_output: number }> {
  const agent = agentsParSlug.get(appel.slug)
  if (!agent) {
    return {
      resultat: { ...appel, nom: appel.slug, statut: 'erreur', erreur: `Sous-agent inconnu ou inactif : ${appel.slug}` },
      tokens_input: 0,
      tokens_output: 0,
    }
  }

  try {
    const reponse = await anthropic.messages.create({
      model: agent.model,
      max_tokens: agent.max_tokens,
      system: injecterVariablesConsultant(agent.system_prompt, settings),
      messages: [
        {
          role: 'user',
          content: `${appel.instruction}\n\n---\nDemande initiale de l'utilisateur (contexte) :\n${demande}`,
        },
      ],
    })
    const sortie = reponse.content
      .filter((bloc): bloc is Anthropic.TextBlock => bloc.type === 'text')
      .map((bloc) => bloc.text)
      .join('\n')
      .trim()
    return {
      resultat: { ...appel, nom: agent.nom, statut: 'succes', sortie },
      tokens_input: reponse.usage.input_tokens,
      tokens_output: reponse.usage.output_tokens,
    }
  } catch (err) {
    // Un échec individuel n'annule pas le run : il est signalé dans la synthèse et loggé.
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    return {
      resultat: { ...appel, nom: agent.nom, statut: 'erreur', erreur: message },
      tokens_input: 0,
      tokens_output: 0,
    }
  }
}

export async function orchestrer(demande: string): Promise<OrchestrationResultat> {
  const debut = Date.now()
  const supabase = await createClient()

  const [agentsQuery, settings] = await Promise.all([
    supabase
      .from('agents')
      .select('id, slug, nom, description, system_prompt, model, max_tokens, actif')
      .eq('actif', true)
      .order('slug'),
    getSettings(),
  ])

  if (agentsQuery.error) {
    throw new Error(`Chargement des agents impossible : ${agentsQuery.error.message}`)
  }
  const agents = (agentsQuery.data ?? []) as AgentRow[]
  if (agents.length === 0) {
    throw new Error('Aucun sous-agent actif. Exécutez la migration supabase-agents-migration.sql ou activez des agents dans les paramètres.')
  }
  const agentsParSlug = new Map(agents.map((a) => [a.slug, a]))

  const anthropic = new Anthropic()
  let tokensInput = 0
  let tokensOutput = 0

  async function enregistrerRun(champs: {
    agents_appeles: ResultatSousAgent[]
    resultat: string | null
    statut: 'succes' | 'erreur'
    erreur?: string | null
  }): Promise<string | null> {
    // Traçabilité : jamais bloquant pour la réponse à l'utilisateur.
    const { data } = await supabase
      .from('agent_runs')
      .insert({
        demande,
        agents_appeles: champs.agents_appeles.map(({ slug, nom, instruction, statut, erreur }) => ({
          slug,
          nom,
          instruction,
          statut,
          ...(erreur ? { erreur } : {}),
        })),
        resultat: champs.resultat,
        tokens_input: tokensInput,
        tokens_output: tokensOutput,
        duree_ms: Date.now() - debut,
        statut: champs.statut,
        erreur: champs.erreur ?? null,
      })
      .select('id')
      .single()
    return data?.id ?? null
  }

  try {
    // ── Appel 1 : routage ────────────────────────────────────────────────
    const messagesRoutage: Anthropic.MessageParam[] = [{ role: 'user', content: demande }]
    const routage = await anthropic.messages.create({
      model: ORCHESTRATOR_MODEL,
      max_tokens: ORCHESTRATOR_MAX_TOKENS,
      system: systemOrchestrateur(agents),
      tools: [OUTIL_APPELER_SOUS_AGENTS],
      messages: messagesRoutage,
    })
    tokensInput += routage.usage.input_tokens
    tokensOutput += routage.usage.output_tokens

    const blocOutil = routage.content.find(
      (bloc): bloc is Anthropic.ToolUseBlock => bloc.type === 'tool_use' && bloc.name === 'appeler_sous_agents'
    )

    // Pas d'appel d'outil : l'orchestrateur pose des questions à l'utilisateur.
    if (!blocOutil) {
      const questions = routage.content
        .filter((bloc): bloc is Anthropic.TextBlock => bloc.type === 'text')
        .map((bloc) => bloc.text)
        .join('\n')
        .trim()
      const runId = await enregistrerRun({ agents_appeles: [], resultat: questions, statut: 'succes' })
      return {
        type: 'questions',
        contenu: questions,
        agents_appeles: [],
        tokens_input: tokensInput,
        tokens_output: tokensOutput,
        duree_ms: Date.now() - debut,
        run_id: runId,
      }
    }

    const entree = blocOutil.input as { appels?: AppelSousAgent[] }
    const appels = (entree.appels ?? []).filter(
      (a): a is AppelSousAgent => typeof a?.slug === 'string' && typeof a?.instruction === 'string'
    )
    if (appels.length === 0) {
      throw new SousAgentInconnuError("L'orchestrateur n'a demandé aucun appel de sous-agent valide.")
    }

    // ── Exécution : sous-agents en parallèle ─────────────────────────────
    const executions = await Promise.all(
      appels.map((appel) => executerSousAgent(anthropic, appel, agentsParSlug, settings, demande))
    )
    const resultats = executions.map((e) => e.resultat)
    for (const e of executions) {
      tokensInput += e.tokens_input
      tokensOutput += e.tokens_output
    }

    const succes = resultats.filter((r) => r.statut === 'succes')
    const statutRun: 'succes' | 'erreur' = succes.length > 0 ? 'succes' : 'erreur'
    const erreursTexte =
      resultats
        .filter((r) => r.statut === 'erreur')
        .map((r) => `${r.slug} : ${r.erreur}`)
        .join(' | ') || null

    // ── Sortie directe : un seul sous-agent, pas d'appel de synthèse ─────
    if (resultats.length === 1) {
      const seul = resultats[0]
      const contenu =
        seul.statut === 'succes'
          ? seul.sortie ?? ''
          : `⚠️ Le sous-agent ${seul.slug} a échoué : ${seul.erreur}`
      const runId = await enregistrerRun({
        agents_appeles: resultats,
        resultat: contenu,
        statut: statutRun,
        erreur: erreursTexte,
      })
      return {
        type: 'resultat',
        contenu,
        agents_appeles: resultats,
        tokens_input: tokensInput,
        tokens_output: tokensOutput,
        duree_ms: Date.now() - debut,
        run_id: runId,
      }
    }

    // ── Appel 2 : synthèse (tool_result renvoyé à l'orchestrateur) ───────
    const contenuToolResult = JSON.stringify(
      resultats.map(({ slug, nom, statut, sortie, erreur }) => ({ slug, nom, statut, sortie, erreur })),
      null,
      2
    )
    const synthese = await anthropic.messages.create({
      model: ORCHESTRATOR_MODEL,
      max_tokens: ORCHESTRATOR_MAX_TOKENS,
      system: systemOrchestrateur(agents),
      tools: [OUTIL_APPELER_SOUS_AGENTS],
      messages: [
        ...messagesRoutage,
        { role: 'assistant', content: routage.content },
        {
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: blocOutil.id, content: contenuToolResult }],
        },
      ],
    })
    tokensInput += synthese.usage.input_tokens
    tokensOutput += synthese.usage.output_tokens

    const contenu = synthese.content
      .filter((bloc): bloc is Anthropic.TextBlock => bloc.type === 'text')
      .map((bloc) => bloc.text)
      .join('\n')
      .trim()

    const runId = await enregistrerRun({
      agents_appeles: resultats,
      resultat: contenu,
      statut: statutRun,
      erreur: erreursTexte,
    })

    return {
      type: 'resultat',
      contenu,
      agents_appeles: resultats,
      tokens_input: tokensInput,
      tokens_output: tokensOutput,
      duree_ms: Date.now() - debut,
      run_id: runId,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    await enregistrerRun({ agents_appeles: [], resultat: null, statut: 'erreur', erreur: message })
    throw err
  }
}
