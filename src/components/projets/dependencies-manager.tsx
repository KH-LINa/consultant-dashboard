'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { ProjectTask, TaskDependency, DependencyType } from '@/lib/types'
import {
  wouldCreateCycle, findDependencyConflicts, findUntrackedDependencies,
} from '@/lib/gantt-deps'
import { feriesCourants } from '@/lib/jours-ouvres'
import { updateTaskDates } from '@/app/actions/gantt'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Link2, Trash2, ArrowRight, AlertTriangle, CalendarOff, Wand2 } from 'lucide-react'
import { toast } from 'sonner'

interface DependenciesManagerProps {
  projectId: string
  tasks: ProjectTask[]
  dependencies: TaskDependency[]
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

const NONE_TASK = '__none__'

// Libellés français des types MS Project (FD/DD/FF/DF)
const TYPE_LABEL: Record<DependencyType, string> = {
  FS: 'Fin → Début (FD)',
  SS: 'Début → Début (DD)',
  FF: 'Fin → Fin (FF)',
  SF: 'Début → Fin (DF)',
}
const TYPE_COURT: Record<DependencyType, string> = { FS: 'FD', SS: 'DD', FF: 'FF', SF: 'DF' }

export function DependenciesManager({ projectId, tasks, dependencies }: DependenciesManagerProps) {
  const router = useRouter()
  const supabase = createClient()
  // NONE_TASK (et non '') : la valeur réinitialisée doit correspondre à un
  // SelectItem existant, sinon le composant Select perd la correspondance
  // interne entre valeur et item et cesse de réagir aux sélections suivantes —
  // une seule dépendance pouvait alors être créée par chargement de page.
  const [pred, setPred] = useState(NONE_TASK)
  const [succ, setSucc] = useState(NONE_TASK)
  const [type, setType] = useState<DependencyType>('FS')
  const [lag, setLag] = useState('')
  const [recalage, setRecalage] = useState<string | null>(null) // dep.id en cours de recalage

  const titreById = Object.fromEntries(tasks.map((t) => [t.id, t.titre]))

  // Vérifications de cohérence (recalculées à chaque rendu — données légères)
  const feries = useMemo(() => feriesCourants(), [])
  const conflicts = useMemo(() => findDependencyConflicts(tasks, dependencies, feries), [tasks, dependencies, feries])
  const conflictByDepId = useMemo(() => new Map(conflicts.map((c) => [c.dep.id, c])), [conflicts])
  const untracked = useMemo(
    () => new Set(findUntrackedDependencies(tasks, dependencies).map((d) => d.id)),
    [tasks, dependencies]
  )

  async function addDependency() {
    if (pred === NONE_TASK || succ === NONE_TASK) { toast.error('Sélectionnez les deux tâches'); return }
    if (pred === succ) { toast.error('Une tâche ne peut pas dépendre d\'elle-même'); return }
    // Anti-cycle : refuse si un chemin succ →* pred existe déjà
    if (wouldCreateCycle(dependencies, pred, succ)) {
      toast.error(
        `Impossible : « ${titreById[succ]} » précède déjà « ${titreById[pred]} » (directement ou en chaîne). Cette dépendance créerait une boucle.`
      )
      return
    }
    const { error } = await supabase.from('task_dependencies').insert({
      predecessor_id: pred, successor_id: succ, type, lag_days: parseInt(lag) || 0,
    })
    if (error) {
      toast.error(error.message.includes('duplicate') ? 'Cette dépendance existe déjà' : error.message)
    } else {
      toast.success('Dépendance ajoutée')
      setPred(NONE_TASK); setSucc(NONE_TASK); setType('FS'); setLag('')
      router.refresh()
    }
  }

  async function remove(id: string) {
    const { error } = await supabase.from('task_dependencies').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('Dépendance supprimée'); router.refresh() }
  }

  /** Recale la tâche successeur juste après la fin de son prérequis (durée conservée). */
  async function recaler(depId: string) {
    const c = conflictByDepId.get(depId)
    if (!c) return
    setRecalage(depId)
    const res = await updateTaskDates(c.successor.id, c.suggestedStart, c.suggestedEnd, projectId)
    setRecalage(null)
    if (res.ok) {
      toast.success(`« ${c.successor.titre} » recalée au ${fmtDate(c.suggestedStart)}`)
      router.refresh()
    } else {
      toast.error('Échec du recalage')
    }
  }

  if (tasks.length < 2) {
    return null // pas de dépendances possibles avec moins de 2 tâches
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Link2 className="h-4 w-4 text-cyan-600" />
          Dépendances entre tâches ({dependencies.length})
          {conflicts.length > 0 && (
            <span className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
              <AlertTriangle className="h-3 w-3" />
              {conflicts.length} conflit{conflicts.length > 1 ? 's' : ''} de dates
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {dependencies.length > 0 && (
          <div className="space-y-1">
            {dependencies.map((d) => {
              const conflict = conflictByDepId.get(d.id)
              const sansDates = untracked.has(d.id)
              return (
                <div key={d.id} className={`rounded-lg p-2 group ${conflict ? 'bg-amber-50' : 'hover:bg-gray-50'}`}>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium">{titreById[d.predecessor_id] ?? '?'}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-gray-400" />
                    <span className="font-medium">{titreById[d.successor_id] ?? '?'}</span>
                    <span className="text-[10px] font-medium text-cyan-700 bg-cyan-50 px-1.5 py-0.5 rounded"
                      title={TYPE_LABEL[d.type ?? 'FS']}>
                      {TYPE_COURT[d.type ?? 'FS']}
                      {(d.lag_days ?? 0) !== 0 && ` ${d.lag_days > 0 ? '+' : ''}${d.lag_days} j`}
                    </span>
                    {sansDates && (
                      <span className="flex items-center gap-1 text-xs text-gray-400" title="Une des deux tâches n'a pas de dates : la flèche n'apparaît pas dans le Gantt">
                        <CalendarOff className="h-3 w-3" />
                        dates manquantes
                      </span>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => remove(d.id)}
                      className="ml-auto h-7 w-7 p-0 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {conflict && (
                    <div className="flex items-center gap-2 mt-1.5 pl-1 text-xs text-amber-700">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        « {conflict.successor.titre} » démarre le {fmtDate(conflict.successor.date_debut)},
                        avant la fin de « {conflict.predecessor.titre} » ({fmtDate(conflict.predecessor.date_fin)}).
                      </span>
                      <Button
                        variant="outline" size="sm" disabled={recalage === d.id}
                        onClick={() => recaler(d.id)}
                        className="ml-auto h-6 px-2 text-xs border-amber-300 text-amber-700 hover:bg-amber-100 shrink-0"
                      >
                        <Wand2 className="h-3 w-3 mr-1" />
                        {recalage === d.id ? 'Recalage…' : `Recaler au ${fmtDate(conflict.suggestedStart)}`}
                      </Button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div className="flex items-end gap-2 pt-2 border-t">
          <div className="flex-1">
            <label className="text-xs text-gray-500">D'abord (prérequis)</label>
            <Select value={pred} onValueChange={(v) => setPred(v ?? NONE_TASK)}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Tâche prérequise" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_TASK}>— Tâche prérequise —</SelectItem>
                {tasks.map((t) => <SelectItem key={t.id} value={t.id}>{t.titre}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <ArrowRight className="h-4 w-4 text-gray-400 mb-2.5" />
          <div className="flex-1">
            <label className="text-xs text-gray-500">Ensuite (dépend de)</label>
            <Select value={succ} onValueChange={(v) => setSucc(v ?? NONE_TASK)}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Tâche suivante" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_TASK}>— Tâche suivante —</SelectItem>
                {tasks.map((t) => <SelectItem key={t.id} value={t.id}>{t.titre}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="w-44">
            <label className="text-xs text-gray-500">Type de lien</label>
            <Select value={type} onValueChange={(v) => setType((v as DependencyType) ?? 'FS')}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue>{(v: string) => TYPE_LABEL[v as DependencyType] ?? 'Type'}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(TYPE_LABEL) as DependencyType[]).map((t) => (
                  <SelectItem key={t} value={t}>{TYPE_LABEL[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-24">
            <label className="text-xs text-gray-500" title="Délai (positif) ou avance (négatif) en jours ouvrés">Délai (j)</label>
            <Input type="number" step="1" className="h-9 text-xs" value={lag}
              onChange={(e) => setLag(e.target.value)} placeholder="0" />
          </div>
          <Button size="sm" onClick={addDependency} className="h-9">Lier</Button>
        </div>
        <p className="text-xs text-gray-400">
          Types de lien façon MS Project : FD (la suivante démarre après la fin du prérequis, défaut),
          DD (démarrages liés), FF (fins liées), DF (fin liée au démarrage). Délai en jours ouvrés,
          négatif pour une avance (chevauchement). Les boucles (A → B → A) sont refusées automatiquement.
        </p>
      </CardContent>
    </Card>
  )
}
