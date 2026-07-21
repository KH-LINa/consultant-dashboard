import { createClient } from '@/lib/supabase/server'
import { getSettings } from '@/lib/settings'
import { SettingsForm } from '@/components/parametres/settings-form'
import { AgentsSettings } from '@/components/parametres/agents-settings'
import type { AgentConfig } from '@/lib/types'

export default async function ParametresPage() {
  const supabase = await createClient()
  const [settings, { data: agents }] = await Promise.all([
    getSettings(),
    supabase.from('agents').select('*').order('slug'),
  ])
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Paramètres</h1>
        <p className="text-gray-500 mt-1">Informations utilisées dans vos PDF et emails</p>
      </div>
      <SettingsForm settings={settings} />
      <AgentsSettings agents={(agents ?? []) as AgentConfig[]} />
    </div>
  )
}
