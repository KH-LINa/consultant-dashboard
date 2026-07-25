import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getSettings } from '@/lib/settings'
import { SettingsForm } from '@/components/parametres/settings-form'
import { Card, CardContent } from '@/components/ui/card'
import { Users, ChevronRight } from 'lucide-react'

export default async function ParametresPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = user
    ? await supabase.from('profiles').select('role').eq('id', user.id).single()
    : { data: null }

  const settings = await getSettings()
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Paramètres</h1>
        <p className="text-gray-500 mt-1">Informations utilisées dans vos PDF et emails</p>
      </div>
      {profile?.role === 'admin' && (
        <Link href="/parametres/utilisateurs">
          <Card className="hover:border-blue-300 transition-colors">
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-medium text-gray-900">Utilisateurs</p>
                  <p className="text-sm text-gray-500">Inviter des comptes Admin, Manager ou Collaborateur</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-400" />
            </CardContent>
          </Card>
        </Link>
      )}
      <SettingsForm settings={settings} />
    </div>
  )
}
