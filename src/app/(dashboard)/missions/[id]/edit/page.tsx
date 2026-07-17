import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MissionForm } from '@/components/missions/mission-form'

export default async function EditMissionPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const [{ data: mission }, { data: contacts }, { data: collaborateurs }] = await Promise.all([
    supabase.from('missions').select('*').eq('id', params.id).single(),
    supabase.from('contacts').select('id, nom, entreprise').order('nom'),
    supabase.from('collaborateurs').select('*').order('nom'),
  ])

  if (!mission) notFound()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Modifier la mission</h1>
        <p className="text-gray-500 mt-1">{mission.titre}</p>
      </div>
      <MissionForm contacts={contacts ?? []} mission={mission} collaborateurs={collaborateurs ?? []} />
    </div>
  )
}
