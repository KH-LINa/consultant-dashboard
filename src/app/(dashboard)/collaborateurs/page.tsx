import { createClient } from '@/lib/supabase/server'
import { CollaborateursManager } from '@/components/collaborateurs/collaborateurs-manager'

export default async function CollaborateursPage() {
  const supabase = await createClient()

  const [
    { data: collaborateurs },
    { data: resources },
    { data: assignments },
    { data: missions },
    { data: projects },
    { data: tasks },
  ] = await Promise.all([
    supabase.from('collaborateurs').select('*').order('nom'),
    supabase.from('resources').select('*').order('nom'),
    supabase.from('resource_assignments').select('*'),
    supabase.from('missions').select('id, titre, statut, responsable_id'),
    supabase.from('projects').select('id, titre, statut, responsable_id'),
    supabase.from('project_tasks').select('id, statut, responsable_id'),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Collaborateurs</h1>
        <p className="text-gray-500 mt-1">
          Toutes les personnes pouvant être responsables d&apos;une mission, d&apos;un projet ou
          d&apos;une tâche — qu&apos;elles soient affectées à un projet en cours ou non. Distinct
          des Ressources (suivi d&apos;heures/coût facturé) : un collaborateur peut être lié à une
          ressource, sans que ce soit obligatoire.
        </p>
      </div>
      <CollaborateursManager
        collaborateurs={collaborateurs ?? []}
        resources={resources ?? []}
        assignments={assignments ?? []}
        missions={missions ?? []}
        projects={projects ?? []}
        tasks={tasks ?? []}
      />
    </div>
  )
}
