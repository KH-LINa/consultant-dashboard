'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { ProjectPhase, PhaseDependency, DependencyType } from '@/lib/types'
import {
  wouldCreateCycle, findDependencyConflicts, findUntrackedDependencies,
} from '@/lib/gantt-deps'
import { feriesCourants } from '@/lib/jours-ouvres'
import { updatePhaseWithTasks } from '@/app/actions/gantt'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Link2, Trash2, ArrowRight, AlertTriangle, CalendarOff, Wand2 } from 'lucide-react'
import { toast } from 'sonner'

interface PhaseDependenciesManagerProps {
  projectId: string
  phases: ProjectPhase[]
  dependencies: PhaseDependency[]
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

const NONE_PHASE = '__none__'

// Libellés français des types MS Project (FD/DD/FF/DF)
const TYPE_LABEL: Record<DependencyType, string> = {
  FS: 'Fin → Début (FD)',
  SS: 'Début → Début (DD)',
  FF: 'Fin → Fin (FF)',
  SF: 'Début → Fin (DF)',
}
const TYPE_COURT: Record<DependencyType, string> = { FS: 'FD', SS: 'DD', FF: 'FF', SF: 'DF' }

export function PhaseDependenciesManager({ projectId, phases, dependencies }: PhaseDependenciesManagerProps) {
  const router = useRouter()
  const supabase = createClient()
  // NONE_PHASE (et non '') : la valeur réinitialisée doit correspondre à un
  // SelectItem existant — voir le même choix dans DependenciesManager.
  const [pred, setPred] = useState(NONE_PHASE)
  const [succ, setSucc] = useState(NONE_PHASE)
  const [type, setType] = useState<DependencyType>('FS')
  const [lag, setLag] = useState('')
  const [recalage, setRecalage] = useState<string | null>(null) // dep.id en cours de recalage

  const titreById = Object.fromEntries(phases.map((p) => [p.id, p.titre]))

  const feries = useMemo(() => feriesCourants(), [])
  const conflicts = useMemo(() => findDependencyConflicts(phases, dependencies, feries), [phases, dependencies, feries])
  const conflictByDepId = useMemo(() => new Map(conflicts.map((c) => [c.dep.id, c])), [conflicts])
  const untracked = useMemo(
    () => new Set(findUntrackedDependencies(phases, dependencies).map((d) => d.id)),
    [phases, dependencies]
  )

  async function addDependency() {
    if (pred === NONE_PHASE || succ === NONE_PHASE) { toast.error('Sélectionnez les deux phases'); return }
    if (pred === succ) { toast.error('Une phase ne peut pas dépendre d\'elle-même'); return }
    if (wouldCreateCycle(dependencies, pred, succ)) {
      toast.error(
        `Impossible : « ${titreById[succ]} » précède déjà « ${titreById[pred]} » (directement ou en chaîne). Cette dépendance créerait une boucle.`
      )
      return
    }
    const { error } = await supabase.from('phase_dependencies').insert({
      predecessor_id: pred, successor_id: succ, type, lag_days: parseInt(lag) || 0,
    })
    if (error) {
      toast.error(error.message.includes('duplicate') ? 'Cette dépendance existe déjà' : error.message)
    } else {
      toast.success('Dépendance ajoutée')
      setPred(NONE_PHASE); setSucc(NONE_PHASE); setType('FS'); setLag('')
      router.refresh()
    }
  }

  async function remove(id: string) {
    const { error } = await supabase.from('phase_dependencies').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('Dépendance supprimée'); router.refresh() }
  }

  /** Recale la phase successeur juste après la fin de son prérequis (durée
   *  conservée) ; propage aussi le décalage à ses tâches (updatePhaseWithTasks). */
  async function recaler(depId: string) {
    const c = conflictByDepId.get(depId)
    if (!c) return
    setRecalage(depId)
    const res = await updatePhaseWithTasks(c.successor.id, c.suggestedStart, c.suggestedEnd, projectId)
    setRecalage(null)
    if (res.ok) {
      toast.success(`« ${c.successor.titre} » recalée au ${fmtDate(c.suggestedStart)}`)
      router.refresh()
    } else {
      toast.error('Échec du recalage')
    }
  }

  if (phases.length < 2) {
    return null // pas de dépendances possibles avec moins de 2 phases
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Link2 className="h-4 w-4 text-indigo-600" />
          Dépendances entre phases ({dependencies.length})
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
                    <span className="text-[10px] font-medium text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded"
                      title={TYPE_LABEL[d.type ?? 'FS']}>
                      {TYPE_COURT[d.type ?? 'FS']}
                      {(d.lag_days ?? 0) !== 0 && ` ${d.lag_days > 0 ? '+' : ''}${d.lag_days} j`}
                    </span>
                    {sansDates && (
                      <span className="flex items-center gap-1 text-xs text-gray-400" title="Une des deux phases n'a pas de dates : la contrainte ne peut pas être vérifiée">
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
            <label className="text-xs text-gray-500">D'abord (prérequise)</label>
            <Select value={pred} onValueChange={(v) => setPred(v ?? NONE_PHASE)}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Phase prérequise">
                  {(v: string) => (v === NONE_PHASE ? '— Phase prérequise —' : titreById[v] ?? 'Phase prérequise')}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_PHASE}>— Phase prérequise —</SelectItem>
                {phases.map((p) => <SelectItem key={p.id} value={p.id}>{p.titre}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <ArrowRight className="h-4 w-4 text-gray-400 mb-2.5" />
          <div className="flex-1">
            <label className="text-xs text-gray-500">Ensuite (dépend de)</label>
            <Select value={succ} onValueChange={(v) => setSucc(v ?? NONE_PHASE)}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Phase suivante">
                  {(v: string) => (v === NONE_PHASE ? '— Phase suivante —' : titreById[v] ?? 'Phase suivante')}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_PHASE}>— Phase suivante —</SelectItem>
                {phases.map((p) => <SelectItem key={p.id} value={p.id}>{p.titre}</SelectItem>)}
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
          Types de lien façon MS Project : FD (la phase suivante démarre après la fin du prérequis, défaut),
          DD (démarrages liés), FF (fins liées), DF (fin liée au démarrage). Délai en jours ouvrés,
          négatif pour une avance (chevauchement). Les boucles (A → B → A) sont refusées automatiquement.
        </p>
      </CardContent>
    </Card>
  )
}
