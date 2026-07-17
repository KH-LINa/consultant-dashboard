import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Plus, Briefcase } from 'lucide-react'
import { MissionCard } from '@/components/missions/mission-card'
import type { MissionStatus } from '@/lib/types'

const COLUMNS: { statut: MissionStatus; label: string; color: string; dot: string }[] = [
  { statut: 'a_demarrer', label: 'À démarrer', color: 'border-gray-300', dot: 'bg-gray-400' },
  { statut: 'en_cours', label: 'En cours', color: 'border-blue-400', dot: 'bg-blue-500' },
  { statut: 'en_pause', label: 'En pause', color: 'border-orange-400', dot: 'bg-orange-500' },
  { statut: 'terminee', label: 'Terminées', color: 'border-green-400', dot: 'bg-green-500' },
]

export default async function MissionsPage() {
  const supabase = await createClient()

  const [{ data: missions }, { data: tasks }] = await Promise.all([
    supabase.from('missions').select('*, contact:contacts(nom, entreprise)').order('created_at', { ascending: false }),
    supabase.from('mission_tasks').select('mission_id, done, temps_passe'),
  ])

  const list = missions ?? []
  const allTasks = tasks ?? []

  function taskStats(missionId: string) {
    const t = allTasks.filter((x) => x.mission_id === missionId)
    return {
      total: t.length,
      done: t.filter((x) => x.done).length,
      heures: t.reduce((s, x) => s + (Number(x.temps_passe) || 0), 0),
    }
  }

  const actives = list.filter((m) => m.statut !== 'annulee')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Missions</h1>
          <p className="text-gray-500 mt-1">{actives.length} mission(s) active(s)</p>
        </div>
        <Button asChild>
          <Link href="/missions/nouvelle"><Plus className="h-4 w-4 mr-2" />Nouvelle mission</Link>
        </Button>
      </div>

      {actives.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <Briefcase className="h-10 w-10 mx-auto text-gray-300 mb-3" />
          Aucune mission. Créez votre première mission ou démarrez-en une depuis un devis signé.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {COLUMNS.map((col) => {
            const colMissions = list.filter((m) => m.statut === col.statut)
            return (
              <div key={col.statut} className={`rounded-lg border-t-2 ${col.color} bg-gray-50/50 p-3`}>
                <div className="flex items-center gap-2 mb-3 px-1">
                  <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                  <span className="text-sm font-semibold text-gray-700">{col.label}</span>
                  <span className="text-xs text-gray-400">({colMissions.length})</span>
                </div>
                <div className="space-y-3">
                  {colMissions.map((m: any) => {
                    const st = taskStats(m.id)
                    return (
                      <MissionCard
                        key={m.id}
                        id={m.id}
                        titre={m.titre}
                        contactNom={m.contact?.nom}
                        budgetHt={Number(m.budget_ht) || 0}
                        total={st.total}
                        done={st.done}
                        heures={st.heures}
                      />
                    )
                  })}
                  {colMissions.length === 0 && (
                    <p className="text-xs text-gray-300 text-center py-4">—</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
