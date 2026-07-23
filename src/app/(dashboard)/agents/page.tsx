import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { AgentRun } from '@/lib/types'
import { AgentConsole } from '@/components/agents/agent-console'
import { RunsHistory } from '@/components/agents/runs-history'

export const dynamic = 'force-dynamic'

export default async function AgentsPage() {
  const supabase = await createClient()
  const [{ data: runs }, { count: nbActifs }] = await Promise.all([
    supabase
      .from('agent_runs')
      .select('id, demande, agents_appeles, resultat, tokens_input, tokens_output, duree_ms, statut, erreur, created_at')
      .order('created_at', { ascending: false })
      .limit(20),
    supabase.from('agents').select('id', { count: 'exact', head: true }).eq('actif', true),
  ])

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Agents</h1>
        <p className="text-gray-500 mt-1">
          Orchestrateur et sous-agents spécialisés — {nbActifs ?? 0} agent{(nbActifs ?? 0) > 1 ? 's' : ''} actif
          {(nbActifs ?? 0) > 1 ? 's' : ''} ·{' '}
          <Link href="/parametres" className="text-[#534AB7] underline">
            configurer les agents
          </Link>
        </p>
      </div>
      <AgentConsole />
      <RunsHistory runs={(runs ?? []) as AgentRun[]} />
    </div>
  )
}
