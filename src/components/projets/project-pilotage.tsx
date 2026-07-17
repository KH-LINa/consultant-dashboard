import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ProjectTask, ProjectMilestone, Collaborateur } from '@/lib/types'
import {
  CheckCircle2, Flag, AlertTriangle, CalendarClock, Users,
} from 'lucide-react'

interface ProjectPilotageProps {
  tasks: ProjectTask[]
  milestones: ProjectMilestone[]
  collaborateurs: Collaborateur[]
}

function parseDate(d: string | null): Date | null {
  if (!d) return null
  const dt = new Date(d + 'T00:00:00')
  return isNaN(dt.getTime()) ? null : dt
}

export function ProjectPilotage({ tasks, milestones, collaborateurs }: ProjectPilotageProps) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // --- Tâches ---
  const tasksFait = tasks.filter((t) => t.statut === 'fait').length
  const tasksRetard = tasks.filter((t) => {
    const f = parseDate(t.date_fin)
    return f && f < today && t.statut !== 'fait'
  })

  // --- Jalons ---
  const jalonsAtteints = milestones.filter((m) => m.statut === 'atteint').length
  const jalonsRetard = milestones.filter((m) => {
    const e = parseDate(m.date_echeance)
    return e && e < today && m.statut !== 'atteint'
  })

  // --- Prochaine échéance (jalon à venir non atteint) ---
  const prochains = milestones
    .filter((m) => m.statut !== 'atteint' && parseDate(m.date_echeance) && parseDate(m.date_echeance)! >= today)
    .sort((a, b) => parseDate(a.date_echeance)!.getTime() - parseDate(b.date_echeance)!.getTime())
  const prochainJalon = prochains[0] ?? null
  const joursRestants = prochainJalon
    ? Math.ceil((parseDate(prochainJalon.date_echeance)!.getTime() - today.getTime()) / 86400000)
    : null

  // --- Charge par collaborateur ---
  const charge = collaborateurs
    .map((c) => {
      const ts = tasks.filter((t) => t.responsable_id === c.id)
      return {
        collaborateur: c,
        total: ts.length,
        fait: ts.filter((t) => t.statut === 'fait').length,
        retard: ts.filter((t) => {
          const f = parseDate(t.date_fin)
          return f && f < today && t.statut !== 'fait'
        }).length,
      }
    })
    .filter((x) => x.total > 0)

  const totalRetards = tasksRetard.length + jalonsRetard.length

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <div className="p-2 bg-green-50 rounded-lg"><CheckCircle2 className="h-4 w-4 text-green-500" /></div>
            <div>
              <p className="text-xs text-gray-500">Tâches terminées</p>
              <p className="text-lg font-bold">{tasksFait}/{tasks.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <div className="p-2 bg-amber-50 rounded-lg"><Flag className="h-4 w-4 text-amber-500" /></div>
            <div>
              <p className="text-xs text-gray-500">Jalons atteints</p>
              <p className="text-lg font-bold">{jalonsAtteints}/{milestones.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg"><CalendarClock className="h-4 w-4 text-blue-500" /></div>
            <div>
              <p className="text-xs text-gray-500">Prochaine échéance</p>
              {prochainJalon ? (
                <p className="text-sm font-bold">
                  {prochainJalon.titre} · J{joursRestants! >= 0 ? `-${joursRestants}` : `+${-joursRestants!}`}
                </p>
              ) : (
                <p className="text-sm font-bold text-gray-400">—</p>
              )}
            </div>
          </CardContent>
        </Card>
        <Card className={totalRetards > 0 ? 'border-red-200 bg-red-50/40' : ''}>
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <div className={`p-2 rounded-lg ${totalRetards > 0 ? 'bg-red-100' : 'bg-gray-50'}`}>
              <AlertTriangle className={`h-4 w-4 ${totalRetards > 0 ? 'text-red-500' : 'text-gray-400'}`} />
            </div>
            <div>
              <p className="text-xs text-gray-500">En retard</p>
              <p className={`text-lg font-bold ${totalRetards > 0 ? 'text-red-600' : ''}`}>{totalRetards}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alertes de retard */}
      {totalRetards > 0 && (
        <Card className="border-l-4 border-l-red-400">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-4 w-4" />
              Alertes de retard ({totalRetards})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {jalonsRetard.map((m) => (
              <div key={m.id} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
                <span className="flex items-center gap-2"><Flag className="h-3.5 w-3.5 text-amber-500" />Jalon : {m.titre}</span>
                <span className="text-red-600 font-medium">échéance {parseDate(m.date_echeance)!.toLocaleDateString('fr-FR')}</span>
              </div>
            ))}
            {tasksRetard.map((t) => (
              <div key={t.id} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
                <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-400" />Tâche : {t.titre}</span>
                <span className="text-red-600 font-medium">fin prévue {parseDate(t.date_fin)!.toLocaleDateString('fr-FR')}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Charge par collaborateur */}
      {charge.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" />
              Charge par collaborateur
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {charge.map(({ collaborateur: c, total, fait, retard }) => {
              const pct = total > 0 ? (fait / total) * 100 : 0
              return (
                <div key={c.id} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 font-medium">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: c.couleur }} />
                      {c.nom}
                    </span>
                    <span className="text-xs text-gray-500">
                      {fait}/{total} terminées
                      {retard > 0 && <span className="text-red-600 font-medium"> · {retard} en retard</span>}
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, background: c.couleur }} />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
