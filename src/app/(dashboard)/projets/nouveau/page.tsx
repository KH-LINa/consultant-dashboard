import { createClient } from '@/lib/supabase/server'
import { ProjectForm } from '@/components/projets/project-form'

export default async function NouveauProjetPage({
  searchParams,
}: {
  searchParams: { contact_id?: string }
}) {
  const supabase = await createClient()
  const [{ data: contacts }, { data: collaborateurs }] = await Promise.all([
    supabase.from('contacts').select('id, nom, entreprise').order('nom'),
    supabase.from('collaborateurs').select('*').order('nom'),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Nouveau projet</h1>
        <p className="text-gray-500 mt-1">Dates, jalons et planning de votre engagement client</p>
      </div>
      <ProjectForm
        contacts={contacts ?? []}
        collaborateurs={collaborateurs ?? []}
        defaultContactId={searchParams.contact_id}
      />
    </div>
  )
}
