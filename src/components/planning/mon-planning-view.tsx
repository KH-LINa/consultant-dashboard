'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { ProjectTask, ProjectTaskStatus, Mission, ResourceAssignment } from '@/lib/types'
import { estWeekend, feriesCourants } from '@/lib/jours-ouvres'
import { toLocalISO } from '@/lib/gantt-deps'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ChevronLeft, ChevronRight, ListChecks, FolderKanban, HardHat } from 'lucide-react'
import { toast } from 'sonner'

const STATUT_LABEL: Record<ProjectTaskStatus, string> = {
  a_faire: 'À faire', en_cours: 'En cours', fait: 'Fait', bloque: 'Bloqué',
}
const STATUT_BADGE: Record<ProjectTaskStatus, string> = {
  a_faire: 'bg-gray-100 text-gray-600',
  en_cours: 'bg-blue-100 text-blue-700',
  fait: 'bg-green-100 text-green-700',
  bloque: 'bg-red-100 text-red-700',
}
const STATUT_DOT: Record<ProjectTaskStatus, string> = {
  a_faire: '#9ca3af', en_cours: '#3b82f6', fait: '#22c55e', bloque: '#ef4444',
}

const JOURS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

type TacheAvecProjet = ProjectTask & { project: { titre: string } | null }

function fmt(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'
}

function euros(n: number): string {
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
}

export function MonPlanningView({
  tasks, missions, assignments,
}: {
  tasks: TacheAvecProjet[]
  missions: Mission[]
  assignments: ResourceAssignment[]
}) {
  const router = useRouter()
  const supabase = createClient()
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d })
  const feries = useMemo(() => feriesCourants(), [])

  const cellules = useMemo(() => {
    const annee = cursor.getFullYear()
    const mois = cursor.getMonth()
    const premier = new Date(annee, mois, 1)
    const dernier = new Date(annee, mois + 1, 0)
    const decalage = (premier.getDay() + 6) % 7
    const out: (Date | null)[] = Array(decalage).fill(null)
    for (let jour = 1; jour <= dernier.getDate(); jour++) out.push(new Date(annee, mois, jour))
    return out
  }, [cursor])

  function tachesDuJour(d: Date): TacheAvecProjet[] {
    const iso = toLocalISO(d)
    return tasks.filter((t) => t.date_debut && t.date_fin && t.date_debut <= iso && iso <= t.date_fin)
  }

  async function update(id: string, field: string, value: string | number | null) {
    const { error } = await supabase.from('project_tasks').update({ [field]: value }).eq('id', id)
    if (error) toast.error(error.message); else router.refresh()
  }

  async function updateStatut(id: string, statut: ProjectTaskStatus, avancementActuel: number) {
    const payload: { statut: ProjectTaskStatus; avancement?: number } = { statut }
    if (statut === 'fait' && avancementActuel !== 100) payload.avancement = 100
    const { error } = await supabase.from('project_tasks').update(payload).eq('id', id)
    if (error) toast.error(error.message); else router.refresh()
  }

  const aujourdHui = toLocalISO(new Date())
  const tachesTriees = [...tasks].sort((a, b) => (a.date_fin ?? '9999').localeCompare(b.date_fin ?? '9999'))

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <Card className="h-fit">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <button type="button" onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))}
              className="p-1 rounded hover:bg-gray-100 text-gray-500">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <CardTitle className="text-sm capitalize">
              {cursor.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
            </CardTitle>
            <button type="button" onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))}
              className="p-1 rounded hover:bg-gray-100 text-gray-500">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1">
            {JOURS.map((j, i) => (
              <div key={i} className="text-center text-[11px] text-gray-400 font-medium py-1">{j}</div>
            ))}
            {cellules.map((d, i) => {
              if (!d) return <div key={i} />
              const iso = toLocalISO(d)
              const dujour = tachesDuJour(d)
              const nonOuvre = estWeekend(iso) || feries.has(iso)
              return (
                <div
                  key={i}
                  title={dujour.map((t) => t.titre).join(', ') || undefined}
                  className="aspect-square rounded p-0.5 flex flex-col items-center justify-start text-[11px]"
                  style={{
                    background: iso === aujourdHui ? '#eef2ff' : nonOuvre ? '#f1f5f9' : 'transparent',
                    color: nonOuvre ? '#94a3b8' : '#374151',
                  }}
                >
                  <span className={iso === aujourdHui ? 'font-bold text-blue-700' : ''}>{d.getDate()}</span>
                  {dujour.length > 0 && (
                    <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center">
                      {dujour.slice(0, 3).map((t) => (
                        <span key={t.id} className="w-1.5 h-1.5 rounded-full" style={{ background: STATUT_DOT[t.statut] }} />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-green-600" />
              Mes tâches ({tasks.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {tachesTriees.map((t) => {
              const enRetard = t.date_fin && t.date_fin < aujourdHui && t.statut !== 'fait'
              return (
                <div key={t.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{t.titre}</p>
                      {t.project?.titre && (
                        <p className="text-xs text-gray-400 truncate">{t.project.titre}</p>
                      )}
                    </div>
                    <span className={`text-xs whitespace-nowrap ${enRetard ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
                      {fmt(t.date_debut)} → {fmt(t.date_fin)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={t.statut} onValueChange={(v) => updateStatut(t.id, v as ProjectTaskStatus, t.avancement)}>
                      <SelectTrigger className="h-8 w-32">
                        <SelectValue>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${STATUT_BADGE[t.statut]}`}>{STATUT_LABEL[t.statut]}</span>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(STATUT_LABEL) as ProjectTaskStatus[]).map((s) => (
                          <SelectItem key={s} value={s}>{STATUT_LABEL[s]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-1 ml-auto">
                      <Input type="number" min="0" max="100" className="h-8 w-16 text-xs text-right"
                        key={`av-${t.id}-${t.avancement}`}
                        defaultValue={t.avancement}
                        onBlur={(e) => {
                          const v = Math.max(0, Math.min(100, parseInt(e.target.value) || 0))
                          if (v !== t.avancement) update(t.id, 'avancement', v)
                        }} />
                      <span className="text-xs text-gray-400">%</span>
                    </div>
                  </div>
                </div>
              )
            })}
            {tasks.length === 0 && (
              <p className="text-sm text-gray-400 py-6 text-center">Aucune tâche assignée pour le moment.</p>
            )}
          </CardContent>
        </Card>

        {missions.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FolderKanban className="h-4 w-4 text-blue-600" />
                Mes missions ({missions.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {missions.map((m) => (
                <div key={m.id} className="border rounded-lg p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{m.titre}</p>
                    {m.contact?.nom && <p className="text-xs text-gray-400 truncate">{m.contact.nom}</p>}
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap">
                    {fmt(m.date_debut)} → {fmt(m.date_fin_prevue)}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {assignments.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <HardHat className="h-4 w-4 text-[#534AB7]" />
                Mes affectations ressource ({assignments.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {assignments.map((a) => (
                <div key={a.id} className="border rounded-lg p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{a.project?.titre ?? 'Projet supprimé'}</p>
                    {a.task?.titre && <p className="text-xs text-gray-400 truncate">→ {a.task.titre}</p>}
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap flex items-center gap-3">
                    {a.heures > 0 && <span>{a.heures} h</span>}
                    {a.budget > 0 && <span>{euros(a.budget)}</span>}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
