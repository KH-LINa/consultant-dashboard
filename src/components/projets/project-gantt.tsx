'use client'

/**
 * ProjectGantt — Gantt interactif de la page projet.
 *
 * CHOIX DE BIBLIOTHÈQUE : `gantt-task-react` (MIT, open source).
 * Raison : elle satisfait tous les critères obligatoires nativement —
 *   barres avec dates début/fin, flèches de dépendances fin→début, jalons en
 *   losange, glisser-déposer, barres de progression (0–100 %), groupes (phases).
 * Elle est légère, sans dépendance commerciale, et déjà éprouvée dans ce projet.
 * Importée dynamiquement (ssr:false) car elle accède au DOM au montage.
 *
 * Données : chargées dans le Server Component parent (page.tsx) et passées en props.
 * Mutations : via Server Actions (app/actions/gantt.ts), avec optimistic update
 *   + rollback et toast d'erreur.
 */

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import type { Task as GanttTask } from 'gantt-task-react'
import 'gantt-task-react/dist/index.css'
import { createClient } from '@/lib/supabase/client'
import type {
  ProjectPhase, ProjectMilestone, ProjectTask, TaskDependency, Collaborateur, ProjectTaskStatus,
} from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  GanttChartSquare, AlertTriangle, Plus, Route, Network,
  Maximize2, Minimize2, Printer, ZoomIn, ZoomOut,
} from 'lucide-react'
import { GanttTooltip } from '@/components/projets/gantt-tooltip'
import { PertView } from '@/components/projets/pert-view'
import {
  findDependencyConflicts, toLocalISO, computeCriticalPath, completionRate,
} from '@/lib/gantt-deps'
import {
  updateTaskDates, updateMilestoneDate, updatePhaseWithTasks, updateTaskProgress,
} from '@/app/actions/gantt'
import { toast } from 'sonner'

const Gantt = dynamic(() => import('gantt-task-react').then((m) => m.Gantt), { ssr: false })

type VM = 'Day' | 'Week' | 'Month'

// Couleurs des barres de tâches selon le statut (cf. prompt)
const STATUT_COLOR: Record<ProjectTaskStatus, string> = {
  a_faire: '#9ca3af',  // gris
  en_cours: '#3b82f6', // bleu
  fait: '#22c55e',     // vert
  bloque: '#ef4444',   // rouge
}

interface ProjectGanttProps {
  projectId: string
  phases: ProjectPhase[]
  tasks: ProjectTask[]
  milestones: ProjectMilestone[]
  dependencies: TaskDependency[]
  collaborateurs: Collaborateur[]
}

function toDate(d: string | null): Date | null {
  if (!d) return null
  const dt = new Date(d + 'T00:00:00')
  return isNaN(dt.getTime()) ? null : dt
}
// Formatage en date LOCALE : toISOString() convertit en UTC et ferait
// reculer d'un jour toute date à minuit dans un fuseau à l'est de Greenwich
// (ex. France) — le drag & drop enregistrerait la veille de ce qui est affiché.
function toISO(d: Date): string {
  return toLocalISO(d)
}
function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + days)
  return toLocalISO(d)
}
function diffDays(a: string, b: string): number {
  return Math.round((new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 86400000)
}
function initials(nom: string): string {
  return nom.split(/\s+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}

export function ProjectGantt({
  projectId, phases, tasks, milestones, dependencies, collaborateurs,
}: ProjectGanttProps) {
  const router = useRouter()
  const [viewMode, setViewMode] = useState<VM>('Week')
  const [selectedMilestone, setSelectedMilestone] = useState<ProjectMilestone | null>(null)
  const [showCritical, setShowCritical] = useState(false)
  const [view, setView] = useState<'gantt' | 'pert'>('gantt')
  const [zoom, setZoom] = useState(1) // facteur de largeur des colonnes (0.5 → 2)
  const [fullscreen, setFullscreen] = useState(false)

  // Échap quitte le plein écran
  useEffect(() => {
    if (!fullscreen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFullscreen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fullscreen])

  // Formulaire d'ajout rapide de tâche
  const NONE = '__none__'
  const [newTitre, setNewTitre] = useState('')
  const [newPhase, setNewPhase] = useState<string>(NONE)
  const [newDebut, setNewDebut] = useState(() => toLocalISO(new Date()))
  const [newFin, setNewFin] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 4); return toLocalISO(d)
  })
  const [adding, setAdding] = useState(false)

  // États locaux (optimistic update)
  const [localPhases, setLocalPhases] = useState(phases)
  const [localTasks, setLocalTasks] = useState(tasks)
  const [localMilestones, setLocalMilestones] = useState(milestones)

  // Resynchronise l'état local quand les données serveur changent
  // (router.refresh() après une édition dans un autre panneau, ajout de tâche…) —
  // sans cela le Gantt resterait figé sur les données du premier rendu.
  useEffect(() => { setLocalPhases(phases) }, [phases])
  useEffect(() => { setLocalTasks(tasks) }, [tasks])
  useEffect(() => { setLocalMilestones(milestones) }, [milestones])

  const collabById = useMemo(
    () => Object.fromEntries(collaborateurs.map((c) => [c.id, c])),
    [collaborateurs]
  )

  // Conflits de dépendances : successeur qui commence avant la fin de son prérequis
  const conflicts = useMemo(
    () => findDependencyConflicts(localTasks, dependencies),
    [localTasks, dependencies]
  )
  const conflictTaskIds = useMemo(
    () => new Set(conflicts.map((c) => c.successor.id)),
    [conflicts]
  )

  // Chemin critique (CPM) : tâches sans marge — les retarder retarde le projet
  const criticalIds = useMemo(
    () => computeCriticalPath(localTasks, dependencies),
    [localTasks, dependencies]
  )

  // Taux de réalisation global (pondéré par la durée des tâches)
  const realisation = useMemo(() => completionRate(localTasks), [localTasks])

  // Construction des lignes du Gantt en ORDRE CHRONOLOGIQUE :
  // chaque « bloc » (phase + ses tâches, tâche isolée, jalon) est daté puis
  // trié — un jalon s'insère donc à sa place dans le temps au lieu d'être
  // empilé en bas de la liste.
  const ganttTasks: GanttTask[] = useMemo(() => {
    type Block = { start: string; prio: number; items: GanttTask[] }
    const blocks: Block[] = []
    const phasesAvecDates = localPhases.filter((p) => toDate(p.date_debut) && toDate(p.date_fin))
    const phaseIdsDates = new Set(phasesAvecDates.map((p) => p.id))

    for (const p of phasesAvecDates) {
      const items: GanttTask[] = [{
        id: `phase_${p.id}`,
        name: p.titre,
        start: toDate(p.date_debut)!,
        end: toDate(p.date_fin)!,
        type: 'project',
        // Progression de la phase = réalisation pondérée de ses tâches
        progress: completionRate(localTasks, p.id),
        hideChildren: false,
        styles: { backgroundColor: p.couleur, progressColor: shade(p.couleur), backgroundSelectedColor: p.couleur },
      }]
      // tâches de la phase, triées par date de début
      const enfants = localTasks
        .filter((t) => t.phase_id === p.id && toDate(t.date_debut) && toDate(t.date_fin))
        .sort((a, b) => a.date_debut!.localeCompare(b.date_debut!))
      for (const t of enfants) items.push(buildTaskBar(t, `phase_${p.id}`))
      blocks.push({ start: p.date_debut!, prio: 0, items })
    }

    // tâches sans phase (ou phase sans dates) → bloc individuel
    for (const t of localTasks) {
      if (t.phase_id && phaseIdsDates.has(t.phase_id)) continue
      if (!toDate(t.date_debut) || !toDate(t.date_fin)) continue
      blocks.push({ start: t.date_debut!, prio: 0, items: [buildTaskBar(t, undefined)] })
    }

    // jalons → bloc individuel, inséré chronologiquement
    // (prio 1 : à date égale, le jalon s'affiche après la tâche qu'il conclut)
    for (const m of localMilestones) {
      const d = toDate(m.date_echeance)
      if (!d) continue
      blocks.push({
        start: m.date_echeance!,
        prio: 1,
        items: [{
          id: `ms_${m.id}`,
          name: m.titre,
          start: d, end: d,
          type: 'milestone',
          progress: 0,
          styles: { backgroundColor: '#f59e0b', backgroundSelectedColor: '#d97706' },
        }],
      })
    }

    blocks.sort((a, b) => a.start.localeCompare(b.start) || a.prio - b.prio)
    return blocks.flatMap((b) => b.items)

    function buildTaskBar(t: ProjectTask, project: string | undefined): GanttTask {
      const resp = t.responsable_id ? collabById[t.responsable_id] : null
      // Mode chemin critique : critiques en rouge, le reste estompé
      const color = showCritical
        ? (criticalIds.has(t.id) ? '#dc2626' : '#cbd5e1')
        : (STATUT_COLOR[t.statut] ?? '#3b82f6')
      const deps = dependencies.filter((d) => d.successor_id === t.id).map((d) => `task_${d.predecessor_id}`)
      const baseName = resp ? `[${initials(resp.nom)}] ${t.titre}` : t.titre
      return {
        id: `task_${t.id}`,
        name: conflictTaskIds.has(t.id) ? `⚠ ${baseName}` : baseName,
        start: toDate(t.date_debut)!,
        end: toDate(t.date_fin)!,
        type: 'task',
        progress: t.avancement ?? 0,
        project,
        dependencies: deps,
        styles: {
          backgroundColor: color,
          progressColor: shade(color),
          backgroundSelectedColor: color,
        },
      }
    }
  }, [localPhases, localTasks, localMilestones, dependencies, collabById, conflictTaskIds, showCritical, criticalIds])

  // --- Handlers (optimistic + rollback) ---
  async function handleDateChange(task: GanttTask) {
    const m = task.id.match(/^(phase|task|ms)_(.+)$/)
    if (!m) return
    const [, kind, id] = m
    const newDebut = toISO(task.start)
    const newFin = toISO(task.end)

    if (kind === 'task') {
      const prev = localTasks
      const updated = localTasks.map((t) => (t.id === id ? { ...t, date_debut: newDebut, date_fin: newFin } : t))
      setLocalTasks(updated)
      // Avertit (sans bloquer) si le déplacement viole une dépendance,
      // que la tâche déplacée soit successeur ou prérequis.
      const broken = findDependencyConflicts(updated, dependencies)
        .filter((c) => c.successor.id === id || c.predecessor.id === id)
      if (broken.length > 0) {
        const c = broken[0]
        toast.warning(
          `Dépendance violée : « ${c.successor.titre} » démarre avant la fin de « ${c.predecessor.titre} ». Voir le panneau Dépendances pour recaler.`
        )
      }
      const res = await updateTaskDates(id, newDebut, newFin, projectId)
      if (!res.ok) { setLocalTasks(prev); toast.error('Échec de la mise à jour de la tâche') }
    } else if (kind === 'phase') {
      const phase = localPhases.find((p) => p.id === id)
      const delta = phase?.date_debut ? diffDays(phase.date_debut, newDebut) : 0
      const prevP = localPhases, prevT = localTasks
      setLocalPhases((ps) => ps.map((p) => (p.id === id ? { ...p, date_debut: newDebut, date_fin: newFin } : p)))
      if (delta !== 0) {
        setLocalTasks((ts) => ts.map((t) => (t.phase_id === id
          ? {
              ...t,
              date_debut: t.date_debut ? addDays(t.date_debut, delta) : t.date_debut,
              date_fin: t.date_fin ? addDays(t.date_fin, delta) : t.date_fin,
            }
          : t)))
      }
      const res = await updatePhaseWithTasks(id, newDebut, newFin, projectId)
      if (!res.ok) { setLocalPhases(prevP); setLocalTasks(prevT); toast.error('Échec du déplacement de la phase') }
    } else if (kind === 'ms') {
      const prev = localMilestones
      setLocalMilestones((ms) => ms.map((x) => (x.id === id ? { ...x, date_echeance: newDebut } : x)))
      const res = await updateMilestoneDate(id, newDebut, projectId)
      if (!res.ok) { setLocalMilestones(prev); toast.error('Échec de la mise à jour du jalon') }
    }
  }

  async function handleProgressChange(task: GanttTask) {
    if (!task.id.startsWith('task_')) return
    const id = task.id.replace('task_', '')
    const prev = localTasks
    setLocalTasks((ts) => ts.map((t) => (t.id === id ? { ...t, avancement: Math.round(task.progress) } : t)))
    const res = await updateTaskProgress(id, task.progress, projectId)
    if (!res.ok) { setLocalTasks(prev); toast.error('Échec de la mise à jour de l\'avancement') }
  }

  function handleClick(task: GanttTask) {
    if (task.id.startsWith('ms_')) {
      const id = task.id.replace('ms_', '')
      const ms = localMilestones.find((m) => m.id === id)
      if (ms) setSelectedMilestone(ms)
    }
  }

  // Ajout rapide d'une tâche directement depuis le Gantt
  async function addTask(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitre.trim()) return
    if (newFin < newDebut) { toast.error('La date de fin doit être après le début'); return }
    setAdding(true)
    const supabase = createClient()
    const { error } = await supabase.from('project_tasks').insert({
      project_id: projectId,
      titre: newTitre.trim(),
      phase_id: newPhase === NONE ? null : newPhase,
      date_debut: newDebut,
      date_fin: newFin,
      ordre: localTasks.length,
    })
    setAdding(false)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Tâche ajoutée au planning')
      setNewTitre('')
      router.refresh()
    }
  }

  const vide = ganttTasks.length === 0

  return (
    <div className={fullscreen ? 'fixed inset-0 z-50 bg-white overflow-auto p-4' : ''}>
    {/* Styles d'impression : seul le planning est imprimé, en paysage */}
    <style>{`
      @media print {
        @page { size: landscape; margin: 10mm; }
        body * { visibility: hidden !important; }
        .gantt-print-area, .gantt-print-area * { visibility: visible !important; }
        .gantt-print-area { position: absolute !important; left: 0; top: 0; width: 100%; overflow: visible !important; }
        .gantt-print-area .overflow-x-auto, .gantt-print-area .overflow-auto { overflow: visible !important; }
      }
    `}</style>
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3 flex-wrap gap-2">
        <CardTitle className="text-base flex items-center gap-2">
          <GanttChartSquare className="h-4 w-4 text-[#534AB7]" />
          Planning (Gantt)
          {localTasks.length > 0 && (
            <span className="text-xs font-medium text-[#534AB7] bg-[#EEEBFA] px-2 py-0.5 rounded-full">
              Réalisation : {realisation} %
            </span>
          )}
          {conflicts.length > 0 && (
            <span className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
              <AlertTriangle className="h-3 w-3" />
              {conflicts.length} conflit{conflicts.length > 1 ? 's' : ''}
            </span>
          )}
        </CardTitle>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Bascule Gantt / PERT */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            <button onClick={() => setView('gantt')}
              className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-md transition-colors ${
                view === 'gantt' ? 'bg-white shadow-sm font-medium' : 'text-gray-500 hover:text-gray-800'
              }`}>
              <GanttChartSquare className="h-3.5 w-3.5" />
              Gantt
            </button>
            <button onClick={() => setView('pert')}
              className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-md transition-colors ${
                view === 'pert' ? 'bg-white shadow-sm font-medium' : 'text-gray-500 hover:text-gray-800'
              }`}>
              <Network className="h-3.5 w-3.5" />
              PERT
            </button>
          </div>

          {view === 'gantt' && (
            <>
              <button
                onClick={() => setShowCritical((v) => !v)}
                title="Met en rouge les tâches sans marge : les retarder retarde la fin du projet"
                className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
                  showCritical
                    ? 'bg-red-50 border-red-300 text-red-700 font-medium'
                    : 'border-gray-200 text-gray-500 hover:text-gray-800'
                }`}
              >
                <Route className="h-3.5 w-3.5" />
                Chemin critique
              </button>
              <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                {([['Jour', 'Day'], ['Semaine', 'Week'], ['Mois', 'Month']] as const).map(([label, mode]) => (
                  <button key={label} onClick={() => setViewMode(mode)}
                    className={`text-xs px-2.5 py-1 rounded-md transition-colors ${
                      viewMode === mode ? 'bg-white shadow-sm font-medium' : 'text-gray-500 hover:text-gray-800'
                    }`}>
                    {label}
                  </button>
                ))}
              </div>
              {/* Curseur de largeur des colonnes */}
              <div className="flex items-center gap-1.5 px-2" title="Largeur des colonnes">
                <ZoomOut className="h-3.5 w-3.5 text-gray-400" />
                <input
                  type="range" min="50" max="200" step="10"
                  value={Math.round(zoom * 100)}
                  onChange={(e) => setZoom(Number(e.target.value) / 100)}
                  className="w-24 accent-[#534AB7]"
                  aria-label="Largeur des colonnes du Gantt"
                />
                <ZoomIn className="h-3.5 w-3.5 text-gray-400" />
              </div>
            </>
          )}

          <button
            onClick={() => window.print()}
            title="Imprimer le planning (format paysage)"
            className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:text-gray-800 transition-colors"
          >
            <Printer className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setFullscreen((v) => !v)}
            title={fullscreen ? 'Quitter le plein écran (Échap)' : 'Agrandir pour une meilleure lecture'}
            className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:text-gray-800 transition-colors"
          >
            {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </CardHeader>
      <CardContent>
        {view === 'pert' ? (
          <div className="gantt-print-area">
            <PertView tasks={localTasks} dependencies={dependencies} />
          </div>
        ) : vide ? (
          <p className="text-sm text-gray-400 py-8 text-center">
            Ajoutez des dates (début/fin) à vos phases, tâches ou jalons pour afficher le planning.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto border rounded-lg gantt-print-area">
              <Gantt
                tasks={ganttTasks}
                /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                viewMode={viewMode as any}
                locale="fr"
                onDateChange={handleDateChange}
                onProgressChange={handleProgressChange}
                onClick={handleClick}
                listCellWidth="220px"
                columnWidth={Math.round((viewMode === 'Month' ? 200 : viewMode === 'Week' ? 140 : 60) * zoom)}
                barCornerRadius={4}
                todayColor="rgba(83,74,183,0.10)"
              />
            </div>
            {conflicts.length > 0 && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs font-medium text-amber-700 flex items-center gap-1.5 mb-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Conflits de dépendances (⚠ dans le Gantt)
                </p>
                <ul className="text-xs text-amber-700 space-y-0.5 pl-5 list-disc">
                  {conflicts.map((c) => (
                    <li key={c.dep.id}>
                      « {c.successor.titre} » démarre avant la fin de « {c.predecessor.titre} » —
                      recalage proposé dans le panneau Dépendances ci-dessous.
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-500">
              {showCritical ? (
                <>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#dc2626]" />Critique (aucune marge)</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#cbd5e1]" />Avec marge</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rotate-45 bg-[#f59e0b]" />Jalon</span>
                </>
              ) : (
                <>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#9ca3af]" />À faire</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#3b82f6]" />En cours</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#22c55e]" />Fait</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#ef4444]" />Bloqué</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rotate-45 bg-[#f59e0b]" />Jalon</span>
                </>
              )}
              <span className="ml-auto">Glissez une barre = sauvegarde auto · clic sur un jalon = détails.</span>
            </div>
          </>
        )}

        {/* Ajout rapide d'une tâche, directement dans le planning */}
        <form onSubmit={addTask} className="flex flex-wrap items-end gap-2 mt-3 pt-3 border-t">
          <div className="flex-1 min-w-[180px]">
            <label className="text-xs text-gray-500">Nouvelle tâche</label>
            <Input value={newTitre} onChange={(e) => setNewTitre(e.target.value)}
              placeholder="ex: Cadrage des besoins" className="h-9" />
          </div>
          <div className="w-40">
            <label className="text-xs text-gray-500">Phase</label>
            <Select value={newPhase} onValueChange={(v) => setNewPhase(v ?? NONE)}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="— Aucune —" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>— Aucune phase —</SelectItem>
                {localPhases.map((p) => <SelectItem key={p.id} value={p.id}>{p.titre}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-gray-500">Début</label>
            <Input type="date" value={newDebut} onChange={(e) => setNewDebut(e.target.value)} className="h-9 text-xs" />
          </div>
          <div>
            <label className="text-xs text-gray-500">Fin</label>
            <Input type="date" value={newFin} onChange={(e) => setNewFin(e.target.value)} className="h-9 text-xs" />
          </div>
          <Button type="submit" size="sm" disabled={adding || !newTitre.trim()} className="h-9">
            <Plus className="h-4 w-4 mr-1" />
            Ajouter
          </Button>
        </form>
      </CardContent>

      <GanttTooltip milestone={selectedMilestone} onClose={() => setSelectedMilestone(null)} />
    </Card>
    </div>
  )
}

// Assombrit légèrement une couleur hex pour la barre de progression
function shade(hex: string): string {
  const m = hex.replace('#', '')
  const num = parseInt(m, 16)
  const r = Math.max(0, ((num >> 16) & 255) - 30)
  const g = Math.max(0, ((num >> 8) & 255) - 30)
  const b = Math.max(0, (num & 255) - 30)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}
