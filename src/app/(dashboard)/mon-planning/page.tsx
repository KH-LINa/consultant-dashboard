import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MonPlanningView } from '@/components/planning/mon-planning-view'
import { Card, CardContent } from '@/components/ui/card'
import { CalendarDays } from 'lucide-react'
import type { ProjectTask, Mission, ResourceAssignment } from '@/lib/types'

export default async function MonPlanningPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role, nom, collaborateur_id, resource_id').eq('id', user.id).single()

  if (!profile?.collaborateur_id && !profile?.resource_id) {
    return (
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Mon planning</h1>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <CalendarDays className="h-10 w-10 text-gray-300" />
            <p className="text-gray-500 font-medium">Votre compte n&apos;est pas encore rattaché à une fiche collaborateur ou ressource</p>
            <p className="text-sm text-gray-400 max-w-sm">
              Aucune tâche ne peut être affichée tant qu&apos;un administrateur n&apos;a pas lié votre compte à
              une fiche{profile?.role === 'admin' ? (
                <> depuis <Link href="/parametres/utilisateurs" className="text-blue-600 hover:underline">Paramètres → Utilisateurs</Link></>
              ) : '.'}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const [{ data: tasks }, { data: missions }, { data: assignments }] = await Promise.all([
    profile.collaborateur_id
      ? supabase
          .from('project_tasks')
          .select('*, project:projects(id, titre)')
          .eq('responsable_id', profile.collaborateur_id)
          .order('date_fin', { ascending: true, nullsFirst: false })
      : Promise.resolve({ data: [] }),
    profile.collaborateur_id
      ? supabase
          .from('missions')
          .select('*, contact:contacts(nom, entreprise)')
          .eq('responsable_id', profile.collaborateur_id)
          .order('date_fin_prevue', { ascending: true, nullsFirst: false })
      : Promise.resolve({ data: [] }),
    profile.resource_id
      ? supabase
          .from('resource_assignments')
          .select('*, project:projects(id, titre)')
          .eq('resource_id', profile.resource_id)
      : Promise.resolve({ data: [] }),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Mon planning</h1>
        <p className="text-gray-500 mt-1">Bonjour {profile.nom} — vos tâches et missions, tous projets confondus</p>
      </div>
      <MonPlanningView
        tasks={(tasks ?? []) as (ProjectTask & { project: { id: string; titre: string } | null })[]}
        missions={(missions ?? []) as Mission[]}
        assignments={(assignments ?? []) as ResourceAssignment[]}
      />
    </div>
  )
}
