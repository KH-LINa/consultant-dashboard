import { createClient } from '@/lib/supabase/server'
import { getSettings } from '@/lib/settings'
import { SettingsForm } from '@/components/parametres/settings-form'

export default async function ParametresPage() {
  const settings = await getSettings()
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Paramètres</h1>
        <p className="text-gray-500 mt-1">Informations utilisées dans vos PDF et emails</p>
      </div>
      <SettingsForm settings={settings} />
    </div>
  )
}
