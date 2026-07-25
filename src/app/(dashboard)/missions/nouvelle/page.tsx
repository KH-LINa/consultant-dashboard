import { createClient } from '@/lib/supabase/server'
import { MissionForm } from '@/components/missions/mission-form'

export default async function NouvelleMissionPage({
  searchParams,
}: {
  searchParams: { contact_id?: string; project_id?: string }
}) {
  const supabase = await createClient()
  const [{ data: contacts }, { data: collaborateurs }, { data: projects }] = await Promise.all([
    supabase.from('contacts').select('id, nom, entreprise').order('nom'),
    supabase.from('collaborateurs').select('*').order('nom'),
    supabase.from('projects').select('id, titre, contact_id').order('titre'),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Nouvelle mission</h1>
        <p className="text-gray-500 mt-1">Pilotez le delivery pour un client</p>
      </div>
      <MissionForm
        contacts={contacts ?? []}
        projects={projects ?? []}
        defaultContactId={searchParams.contact_id}
        defaultProjectId={searchParams.project_id}
        collaborateurs={collaborateurs ?? []}
      />
    </div>
  )
}
