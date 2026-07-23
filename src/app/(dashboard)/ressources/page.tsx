import { createClient } from '@/lib/supabase/server'
import { ResourcesManager } from '@/components/ressources/resources-manager'

export default async function RessourcesPage() {
  const supabase = await createClient()

  const [{ data: resources }, { data: assignments }, { data: projects }] = await Promise.all([
    supabase.from('resources').select('*').order('created_at'),
    supabase
      .from('resource_assignments')
      .select('*, project:projects(id, titre), task:project_tasks(id, titre)')
      .order('created_at'),
    supabase.from('projects').select('id, titre').order('created_at', { ascending: false }),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Ressources</h1>
        <p className="text-gray-500 mt-1">
          Ressources humaines et matérielles, affectées aux projets en heures ou en budget
        </p>
      </div>
      <ResourcesManager
        resources={resources ?? []}
        assignments={assignments ?? []}
        projects={projects ?? []}
      />
    </div>
  )
}
