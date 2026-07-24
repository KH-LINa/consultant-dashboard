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

import { useCallback, useEffect, useMemo, useState } from 'react'
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
  Maximize2, Minimize2, Printer, ZoomIn, ZoomOut, Download, Search, X,
} from 'lucide-react'
import { GanttTooltip } from '@/components/projets/gantt-tooltip'
import { PertView } from '@/components/projets/pert-view'
import { useResizableColumns, createTaskListComponents } from '@/components/projets/gantt-task-list'
import {
  findDependencyConflicts, toLocalISO, computeCriticalPath, completionRate,
} from '@/lib/gantt-deps'
import {
  feriesCourants, prochainJourOuvre, precedentJourOuvre, addJoursOuvres, joursOuvresEntre, estJourOuvre,
} from '@/lib/jours-ouvres'
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

const STATUT_LABEL: Record<ProjectTaskStatus, string> = {
  a_faire: 'À faire',
  en_cours: 'En cours',
  fait: 'Fait',
  bloque: 'Bloqué',
}

const STATUT_BADGE: Record<ProjectTaskStatus, string> = {
  a_faire: 'bg-gray-100 text-gray-600',
  en_cours: 'bg-blue-100 text-blue-700',
  fait: 'bg-green-100 text-green-700',
  bloque: 'bg-red-100 text-red-700',
}

function fmtTooltipDate(d: Date): string {
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

interface ProjectGanttProps {
  projectId: string
  projectTitre: string
  phases: ProjectPhase[]
  tasks: ProjectTask[]
  milestones: ProjectMilestone[]
  dependencies: TaskDependency[]
  collaborateurs: Collaborateur[]
  // Coût total du projet (affectations de ressources) — null si aucune
  coutTotal?: number | null
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
  projectId, projectTitre, phases, tasks, milestones, dependencies, collaborateurs, coutTotal,
}: ProjectGanttProps) {
  const router = useRouter()
  const [viewMode, setViewMode] = useState<VM>('Week')
  const [selectedMilestone, setSelectedMilestone] = useState<ProjectMilestone | null>(null)
  const [showCritical, setShowCritical] = useState(false)
  const [view, setView] = useState<'gantt' | 'pert'>('gantt')
  const [zoom, setZoom] = useState(1) // facteur de largeur des colonnes (0.5 → 2)
  const [fullscreen, setFullscreen] = useState(false)

  // Colonnes de la liste (Tâche / Début / Fin) redimensionnables par glisser
  const { widths: colWidths, startResize } = useResizableColumns()

  // Phases repliées (le triangle ▶/▼ de la liste replie/déplie leurs tâches)
  const [collapsedPhases, setCollapsedPhases] = useState<Set<string>>(new Set())
  function togglePhase(ganttId: string) {
    setCollapsedPhases((prev) => {
      const next = new Set(prev)
      if (next.has(ganttId)) next.delete(ganttId)
      else next.add(ganttId)
      return next
    })
  }

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
  // Récurrence de l'ajout rapide : 'none' | 'weekly' | 'monthly', × N occurrences
  const [newRecurrence, setNewRecurrence] = useState<'none' | 'weekly' | 'monthly'>('none')
  const [newOccurrences, setNewOccurrences] = useState('4')
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

  // Jours fériés France (année passée → +3 ans) : planification en jours ouvrés
  const feries = useMemo(() => feriesCourants(), [])

  // Conflits de dépendances : contrainte du lien (type + lag) non respectée
  const conflicts = useMemo(
    () => findDependencyConflicts(localTasks, dependencies, feries),
    [localTasks, dependencies, feries]
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

  // Filtres et recherche (n'affectent que l'affichage — jamais les calculs
  // globaux : réalisation, conflits et chemin critique restent sur tout le projet)
  const [recherche, setRecherche] = useState('')
  const [filtreResp, setFiltreResp] = useState(NONE)
  const [filtreStatut, setFiltreStatut] = useState(NONE)
  const filtresActifs = recherche.trim() !== '' || filtreResp !== NONE || filtreStatut !== NONE

  const tachesAffichees = useMemo(() => {
    if (!filtresActifs) return localTasks
    const q = recherche.trim().toLowerCase()
    const gardees = new Set(
      localTasks
        .filter((t) =>
          (!q || t.titre.toLowerCase().includes(q)) &&
          (filtreResp === NONE || t.responsable_id === filtreResp) &&
          (filtreStatut === NONE || t.statut === filtreStatut)
        )
        .map((t) => t.id)
    )
    // Les ancêtres d'une sous-tâche gardée restent visibles (sinon la ligne
    // parente manquerait et l'imbrication du Gantt serait cassée).
    const byId = new Map(localTasks.map((t) => [t.id, t]))
    for (const id of Array.from(gardees)) {
      let cur = byId.get(id)?.parent_task_id
      while (cur && !gardees.has(cur)) { gardees.add(cur); cur = byId.get(cur)?.parent_task_id }
    }
    return localTasks.filter((t) => gardees.has(t.id))
  }, [localTasks, recherche, filtreResp, filtreStatut, filtresActifs])

  // Indicateurs clés du projet
  const finPrevue = useMemo(() => {
    const fins = [
      ...localPhases.map((p) => p.date_fin),
      ...localTasks.map((t) => t.date_fin),
      ...localMilestones.map((mi) => mi.date_echeance),
    ].filter(Boolean) as string[]
    return fins.length > 0 ? fins.reduce((a, b) => (a > b ? a : b)) : null
  }, [localPhases, localTasks, localMilestones])

  const nbEnRetard = useMemo(() => {
    const auj = toLocalISO(new Date())
    return localTasks.filter((t) => t.date_fin && t.date_fin < auj && t.statut !== 'fait').length
  }, [localTasks])

  // Construction des lignes du Gantt en ORDRE CHRONOLOGIQUE :
  // chaque « bloc » (phase + ses tâches, tâche isolée, jalon) est daté puis
  // trié — un jalon s'insère donc à sa place dans le temps au lieu d'être
  // empilé en bas de la liste.
  const ganttTasks: GanttTask[] = useMemo(() => {
    type Block = { start: string; prio: number; items: GanttTask[] }
    const blocks: Block[] = []
    const phasesAvecDates = localPhases.filter((p) => toDate(p.date_debut) && toDate(p.date_fin))
    const phaseIdsDates = new Set(phasesAvecDates.map((p) => p.id))
    // Tâches ayant des sous-tâches : leur barre devient type 'project' (bracket
    // + expander ▼/▶) pour les imbriquer visuellement, comme une phase le fait
    // pour ses tâches.
    const aDesSousTaches = new Set(tachesAffichees.filter((t) => t.parent_task_id).map((t) => t.parent_task_id!))
    const idsAffiches = new Set(tachesAffichees.map((t) => t.id))

    for (const p of phasesAvecDates) {
      // La barre de la phase doit toujours couvrir ses tâches (et leurs
      // sous-tâches, qui héritent du même phase_id) : sinon un ajout de tâche
      // dépassant la date de fin de la phase laisserait un résumé trop court.
      const [debutPhase, finPhase] = enveloppeDates(p.date_debut!, p.date_fin!, p.id, 'phase')
      const items: GanttTask[] = [{
        id: `phase_${p.id}`,
        name: p.titre,
        start: debutPhase,
        end: finPhase,
        type: 'project',
        // Progression de la phase = réalisation pondérée de ses tâches
        progress: completionRate(localTasks, p.id),
        hideChildren: collapsedPhases.has(`phase_${p.id}`),
        styles: { backgroundColor: p.couleur, progressColor: shade(p.couleur), backgroundSelectedColor: p.couleur },
      }]
      // tâches de premier niveau de la phase (pas les sous-tâches, imbriquées
      // via buildTaskEtSousTaches), triées par date de début
      const enfants = tachesAffichees
        .filter((t) => t.phase_id === p.id && !t.parent_task_id && toDate(t.date_debut) && toDate(t.date_fin))
        .sort((a, b) => a.date_debut!.localeCompare(b.date_debut!))
      for (const t of enfants) items.push(...buildTaskEtSousTaches(t, `phase_${p.id}`))
      blocks.push({ start: toISO(debutPhase), prio: 0, items })
    }

    // tâches de premier niveau sans phase (ou phase sans dates) → bloc individuel
    for (const t of tachesAffichees) {
      if (t.parent_task_id) continue
      if (t.phase_id && phaseIdsDates.has(t.phase_id)) continue
      if (!toDate(t.date_debut) || !toDate(t.date_fin)) continue
      blocks.push({ start: t.date_debut!, prio: 0, items: buildTaskEtSousTaches(t, undefined) })
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
    const lignes = blocks.flatMap((b) => b.items)

    // Ligne récapitulative du projet (cf. MS Project) : une barre unique en
    // tête, couvrant tout le planning, avec l'avancement global. Purement
    // visuelle : pas repliable, pas déplaçable (aucun préfixe phase|task|ms
    // reconnu par les handlers).
    if (lignes.length > 0) {
      const debutProjet = new Date(Math.min(...lignes.map((l) => l.start.getTime())))
      const finProjet = new Date(Math.max(...lignes.map((l) => l.end.getTime())))
      lignes.unshift({
        id: 'projet_global',
        name: projectTitre,
        start: debutProjet,
        end: finProjet,
        type: 'project',
        progress: realisation,
        isDisabled: true,
        styles: { backgroundColor: '#534AB7', progressColor: '#3d3591', backgroundSelectedColor: '#534AB7' },
      })
    }
    return lignes

    // Enveloppe [début, fin] d'une phase (via phase_id, hérité par toute la
    // descendance) ou d'une tâche parente (via la chaîne parent_task_id) :
    // ne rétrécit jamais en dessous de ses propres dates, mais s'étend pour
    // couvrir toute tâche/sous-tâche qui dépasserait — sinon la barre résumé
    // afficherait une fin antérieure à des tâches qu'elle est censée englober.
    function tousDescendantsDe(taskId: string): ProjectTask[] {
      const directs = tachesAffichees.filter((c) => c.parent_task_id === taskId)
      return directs.flatMap((c) => [c, ...tousDescendantsDe(c.id)])
    }
    function enveloppeDates(debutBase: string, finBase: string, id: string, kind: 'phase' | 'task'): [Date, Date] {
      const membres = (kind === 'phase'
        ? tachesAffichees.filter((t) => t.phase_id === id)
        : tousDescendantsDe(id)
      ).filter((t) => toDate(t.date_debut) && toDate(t.date_fin))
      let debut = debutBase
      let fin = finBase
      for (const t of membres) {
        if (t.date_debut! < debut) debut = t.date_debut!
        if (t.date_fin! > fin) fin = t.date_fin!
      }
      return [toDate(debut)!, toDate(fin)!]
    }

    function buildTaskBar(t: ProjectTask, project: string | undefined): GanttTask {
      const resp = t.responsable_id ? collabById[t.responsable_id] : null
      // Mode chemin critique : critiques en rouge, le reste estompé
      const color = showCritical
        ? (criticalIds.has(t.id) ? '#dc2626' : '#cbd5e1')
        : (STATUT_COLOR[t.statut] ?? '#3b82f6')
      // Flèches limitées aux prédécesseurs visibles (une flèche vers une ligne
      // masquée par un filtre ferait planter le rendu de la lib)
      const deps = dependencies
        .filter((d) => d.successor_id === t.id && idsAffiches.has(d.predecessor_id))
        .map((d) => `task_${d.predecessor_id}`)
      const baseName = resp ? `[${initials(resp.nom)}] ${t.titre}` : t.titre
      const aDesEnfants = aDesSousTaches.has(t.id)
      const [debut, fin] = aDesEnfants
        ? enveloppeDates(t.date_debut!, t.date_fin!, t.id, 'task')
        : [toDate(t.date_debut)!, toDate(t.date_fin)!]
      return {
        id: `task_${t.id}`,
        name: conflictTaskIds.has(t.id) ? `⚠ ${baseName}` : baseName,
        start: debut,
        end: fin,
        type: aDesEnfants ? 'project' : 'task',
        hideChildren: aDesEnfants ? collapsedPhases.has(`task_${t.id}`) : undefined,
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

    // Barre de la tâche suivie de ses sous-tâches datées (triées par date de
    // début), imbriquées juste en dessous — même principe que phase → tâches.
    function buildTaskEtSousTaches(t: ProjectTask, project: string | undefined): GanttTask[] {
      const bar = buildTaskBar(t, project)
      const sousTaches = tachesAffichees
        .filter((c) => c.parent_task_id === t.id && toDate(c.date_debut) && toDate(c.date_fin))
        .sort((a, b) => a.date_debut!.localeCompare(b.date_debut!))
      return [bar, ...sousTaches.flatMap((c) => buildTaskEtSousTaches(c, `task_${t.id}`))]
    }
  }, [localPhases, localTasks, tachesAffichees, localMilestones, dependencies, collabById, conflictTaskIds, showCritical, criticalIds, collapsedPhases, projectTitre, realisation])

  // Numérotation hiérarchique WBS (1, 1.1, 1.1.1…) façon MS Project, déduite
  // de l'ordre d'affichage et du champ project (parent) de chaque ligne.
  // La ligne récapitulative du projet n'est pas numérotée.
  const wbsById = useMemo(() => {
    const compteurs = new Map<string, number>()
    const wbs = new Map<string, string>()
    for (const l of ganttTasks) {
      if (l.id === 'projet_global') continue
      const parent = l.project && wbs.has(l.project) ? l.project : ''
      const n = (compteurs.get(parent) ?? 0) + 1
      compteurs.set(parent, n)
      wbs.set(l.id, parent ? `${wbs.get(parent)}.${n}` : `${n}`)
    }
    return wbs
  }, [ganttTasks])

  // Info-bulle au survol : la lib n'expose que {name, start, end, progress} par
  // défaut (et en anglais) — on reconstitue les tâches/phases/jalons d'origine
  // par id pour afficher statut et responsable en français.
  const taskById = useMemo(() => new Map(localTasks.map((t) => [t.id, t])), [localTasks])
  const milestoneById = useMemo(() => new Map(localMilestones.map((m) => [m.id, m])), [localMilestones])

  // Titre RÉEL d'une ligne du Gantt (par opposition à son nom décoré affiché,
  // ex. "[XX] Titre" pour un responsable, "⚠ Titre" en cas de conflit) —
  // utilisé pour l'édition directe du titre dans la liste de gauche.
  const titreReel = useCallback((ganttId: string) => {
    if (ganttId === 'projet_global') return projectTitre
    const m = ganttId.match(/^(phase|task|ms)_(.+)$/)
    if (!m) return ''
    const [, kind, id] = m
    if (kind === 'phase') return localPhases.find((p) => p.id === id)?.titre ?? ''
    if (kind === 'task') return taskById.get(id)?.titre ?? ''
    return milestoneById.get(id)?.titre ?? ''
  }, [localPhases, taskById, milestoneById, projectTitre])

  const handleRename = useCallback(async (ganttId: string, nouveauTitre: string) => {
    const supabase = createClient()
    // La ligne récapitulative renomme le projet lui-même
    if (ganttId === 'projet_global') {
      const { error } = await supabase.from('projects').update({ titre: nouveauTitre }).eq('id', projectId)
      if (error) toast.error(`Échec du renommage : ${error.message}`)
      else router.refresh()
      return
    }
    const m = ganttId.match(/^(phase|task|ms)_(.+)$/)
    if (!m) return
    const [, kind, id] = m
    const table = kind === 'phase' ? 'project_phases' : kind === 'task' ? 'project_tasks' : 'project_milestones'
    const { error } = await supabase.from(table).update({ titre: nouveauTitre }).eq('id', id)
    if (error) toast.error(`Échec du renommage : ${error.message}`)
    else router.refresh()
  }, [router, projectId])

  // « + » par ligne : sur une phase, ajoute une tâche de premier niveau ;
  // sur une tâche, ajoute une SOUS-TÂCHE (parent_task_id) imbriquée dessous
  // dans le Gantt. Chaînée après la dernière sous-tâche/tâche existante du
  // même parent — pas de nouvelle page, juste un raccourci depuis le Gantt.
  const handleAjouterTache = useCallback(async (ganttId: string) => {
    const m = ganttId.match(/^(phase|task)_(.+)$/)
    if (!m) return
    const [, kind, id] = m

    const parentTaskId = kind === 'task' ? id : null
    const parent = parentTaskId ? taskById.get(parentTaskId) : null
    const phaseId = kind === 'phase' ? id : (parent?.phase_id ?? null)

    // Fratrie : les sous-tâches d'un même parent, ou les tâches de premier
    // niveau d'une même phase.
    const fratrie = parentTaskId
      ? localTasks.filter((t) => t.parent_task_id === parentTaskId && t.date_fin)
      : localTasks.filter((t) => t.phase_id === phaseId && !t.parent_task_id && t.date_fin)
    const dernierFin = fratrie.length > 0
      ? fratrie.reduce((max, t) => (t.date_fin! > max ? t.date_fin! : max), fratrie[0].date_fin!)
      : null

    // Dates en jours ouvrés : démarre le jour ouvré suivant la fratrie, dure
    // 2 jours ouvrés (week-ends et fériés sautés).
    let debut: string
    if (dernierFin) {
      debut = addJoursOuvres(dernierFin, 1, feries)
    } else if (parent?.date_debut) {
      debut = prochainJourOuvre(parent.date_debut, feries)
    } else {
      const phase = phaseId ? localPhases.find((p) => p.id === phaseId) : null
      debut = prochainJourOuvre(phase?.date_debut ?? toLocalISO(new Date()), feries)
    }
    const fin = addJoursOuvres(debut, 1, feries)

    const supabase = createClient()
    const { error } = await supabase.from('project_tasks').insert({
      project_id: projectId,
      titre: parentTaskId ? 'Nouvelle sous-tâche' : 'Nouvelle tâche',
      phase_id: phaseId,
      parent_task_id: parentTaskId,
      date_debut: debut,
      date_fin: fin,
      ordre: localTasks.length,
    })
    if (error) toast.error(`Échec de l'ajout : ${error.message}`)
    else router.refresh()
  }, [taskById, localTasks, localPhases, projectId, router, feries])

  // Fractionner une tâche-feuille : la lib gantt-task-react ne sait pas dessiner
  // une barre à trou, on modélise donc le fractionnement par 2 sous-tâches
  // (segments de travail) sous une barre récapitulative qui couvre toute la
  // période — la pause apparaît comme l'espace vide entre les deux segments.
  const handleFractionner = useCallback(async (ganttId: string) => {
    const id = ganttId.replace('task_', '')
    const t = taskById.get(id)
    if (!t?.date_debut || !t.date_fin) { toast.error('La tâche doit avoir des dates pour être fractionnée'); return }
    if (localTasks.some((c) => c.parent_task_id === id)) {
      toast.info('Cette tâche a déjà des segments (ou sous-tâches).'); return
    }
    const dureeOuvree = Math.max(2, joursOuvresEntre(t.date_debut, t.date_fin, feries))
    const moitie = Math.ceil(dureeOuvree / 2)
    // Segment 1 : première moitié, à partir du début actuel
    const seg1Debut = prochainJourOuvre(t.date_debut, feries)
    const seg1Fin = addJoursOuvres(seg1Debut, moitie - 1, feries)
    // Segment 2 : après une pause d'un jour ouvré, le reste de la durée
    const seg2Debut = addJoursOuvres(seg1Fin, 2, feries)
    const seg2Fin = addJoursOuvres(seg2Debut, (dureeOuvree - moitie) - 1, feries)

    const supabase = createClient()
    const { error: errSeg } = await supabase.from('project_tasks').insert([
      { project_id: projectId, parent_task_id: id, phase_id: t.phase_id, titre: 'Segment 1',
        date_debut: seg1Debut, date_fin: seg1Fin, ordre: 0 },
      { project_id: projectId, parent_task_id: id, phase_id: t.phase_id, titre: 'Segment 2',
        date_debut: seg2Debut, date_fin: seg2Fin, ordre: 1 },
    ])
    if (errSeg) { toast.error(`Échec du fractionnement : ${errSeg.message}`); return }
    // Étend la tâche parente pour couvrir la pause + le 2e segment
    const res = await updateTaskDates(id, seg1Debut, seg2Fin, projectId)
    if (!res.ok) toast.error('Segments créés, mais l\'enveloppe parente n\'a pas pu être étendue.')
    else toast.success('Tâche fractionnée en deux segments')
    router.refresh()
  }, [taskById, localTasks, projectId, router, feries])

  // Supprime une tâche ou sous-tâche directement depuis le Gantt. La cascade
  // (sous-tâches) est gérée côté DB (parent_task_id ON DELETE CASCADE) ; on
  // retire aussi toute la descendance de l'état local pour un rendu immédiat.
  const handleSupprimerTache = useCallback(async (ganttId: string) => {
    const id = ganttId.replace('task_', '')
    if (!taskById.has(id)) return

    function idsASupprimer(parentId: string): string[] {
      const enfants = localTasks.filter((c) => c.parent_task_id === parentId)
      return [parentId, ...enfants.flatMap((c) => idsASupprimer(c.id))]
    }
    const aSupprimer = new Set(idsASupprimer(id))

    const prev = localTasks
    setLocalTasks((ts) => ts.filter((x) => !aSupprimer.has(x.id)))
    const supabase = createClient()
    const { error } = await supabase.from('project_tasks').delete().eq('id', id)
    if (error) { setLocalTasks(prev); toast.error(`Échec de la suppression : ${error.message}`); return }
    toast.success(aSupprimer.size > 1
      ? `Tâche supprimée avec ${aSupprimer.size - 1} sous-tâche${aSupprimer.size > 2 ? 's' : ''}`
      : 'Tâche supprimée')
    router.refresh()
  }, [taskById, localTasks, router])

  const wbsDe = useCallback((ganttId: string) => wbsById.get(ganttId) ?? '', [wbsById])

  // Largeur de colonne du Gantt (partagée entre la prop columnWidth et le
  // calcul du fond des jours non ouvrés).
  const columnWidth = Math.round((viewMode === 'Month' ? 200 : viewMode === 'Week' ? 140 : 60) * zoom)

  // Grisage des week-ends et fériés (vue Jour uniquement — en Semaine/Mois une
  // colonne couvre plusieurs jours). gantt-task-react n'expose pas le style de
  // ses colonnes : on réplique son calcul de plage interne (vue Day : départ =
  // min(start) − preStepsCount(=1) jour, fin = max(end) + 19 jours) et on
  // peint un dégradé à bandes sur le conteneur du SVG, les lignes de la grille
  // étant rendues translucides par le <style> ci-dessous.
  const fondJoursNonOuvres = useMemo(() => {
    if (viewMode !== 'Day' || ganttTasks.length === 0) return null
    const minStart = new Date(Math.min(...ganttTasks.map((t) => t.start.getTime())))
    const maxEnd = new Date(Math.max(...ganttTasks.map((t) => t.end.getTime())))
    const debut = new Date(minStart); debut.setHours(0, 0, 0, 0); debut.setDate(debut.getDate() - 1)
    const fin = new Date(maxEnd); fin.setHours(0, 0, 0, 0); fin.setDate(fin.getDate() + 19)
    const segments: string[] = ['transparent 0px']
    const cur = new Date(debut)
    for (let i = 0; cur <= fin && i < 1000; i++, cur.setDate(cur.getDate() + 1)) {
      if (!estJourOuvre(toLocalISO(cur), feries)) {
        segments.push(`transparent ${i * columnWidth}px`)
        segments.push(`rgba(148,163,184,0.18) ${i * columnWidth}px ${(i + 1) * columnWidth}px`)
        segments.push(`transparent ${(i + 1) * columnWidth}px`)
      }
    }
    return `linear-gradient(to right, ${segments.join(', ')})`
  }, [viewMode, ganttTasks, columnWidth, feries])

  const { Header: TaskListHeader, Table: TaskListTable } = useMemo(
    () => createTaskListComponents(colWidths, startResize, titreReel, handleRename, handleAjouterTache, handleFractionner, handleSupprimerTache, wbsDe, feries),
    [colWidths, startResize, titreReel, handleRename, handleAjouterTache, handleFractionner, handleSupprimerTache, wbsDe, feries]
  )

  const TooltipContent = useMemo(() => {
    const Comp: React.FC<{ task: GanttTask; fontSize: string; fontFamily: string }> = ({ task, fontSize, fontFamily }) => {
      const m = task.id.match(/^(phase|task|ms)_(.+)$/)
      const kind = m?.[1]
      const id = m?.[2]
      const style = { fontFamily, fontSize }
      const box = 'rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg max-w-[240px]'

      if (kind === 'ms') {
        const ms = id ? milestoneById.get(id) : undefined
        return (
          <div style={style} className={box}>
            <p className="font-semibold text-gray-800 flex items-center gap-1">
              <span className="text-amber-500">◆</span>{task.name}
            </p>
            <p className="text-gray-500 mt-0.5">Échéance : {fmtTooltipDate(task.start)}</p>
            {ms?.livrable && <p className="text-gray-500">Livrable : {ms.livrable}</p>}
          </div>
        )
      }

      if (kind === 'phase') {
        return (
          <div style={style} className={box}>
            <p className="font-semibold text-gray-800">{task.name}</p>
            <p className="text-gray-500 mt-0.5">{fmtTooltipDate(task.start)} → {fmtTooltipDate(task.end)}</p>
            <p className="text-gray-500">Avancement : {Math.round(task.progress)} %</p>
          </div>
        )
      }

      const t = id ? taskById.get(id) : undefined
      const resp = t?.responsable_id ? collabById[t.responsable_id] : null
      return (
        <div style={style} className={box}>
          <p className="font-semibold text-gray-800">{t?.titre ?? task.name}</p>
          <p className="text-gray-500 mt-0.5">{fmtTooltipDate(task.start)} → {fmtTooltipDate(task.end)}</p>
          <p className="text-gray-500">Avancement : {Math.round(task.progress)} %</p>
          {t && (
            <p className="mt-1">
              <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${STATUT_BADGE[t.statut]}`}>
                {STATUT_LABEL[t.statut]}
              </span>
            </p>
          )}
          {resp && <p className="text-gray-500 mt-0.5">Responsable : {resp.nom}</p>}
        </div>
      )
    }
    return Comp
  }, [taskById, milestoneById, collabById])

  // --- Handlers (optimistic + rollback) ---
  async function handleDateChange(task: GanttTask) {
    const m = task.id.match(/^(phase|task|ms)_(.+)$/)
    if (!m) return
    const [, kind, id] = m
    let newDebut = toISO(task.start)
    let newFin = toISO(task.end)

    if (kind === 'task') {
      const avant = taskById.get(id)
      // Planification en jours ouvrés : un drag qui atterrit sur un week-end
      // ou un férié est recalé. Déplacement (durée calendaire inchangée) :
      // début recalé au jour ouvré suivant, durée OUVRÉE d'origine conservée.
      // Redimensionnement : chaque bord est recalé indépendamment.
      const estDeplacement = avant?.date_debut && avant.date_fin &&
        diffDays(newDebut, newFin) === diffDays(avant.date_debut, avant.date_fin)
      if (estDeplacement && avant?.date_debut && avant.date_fin) {
        const dureeOuvree = Math.max(1, joursOuvresEntre(avant.date_debut, avant.date_fin, feries))
        newDebut = prochainJourOuvre(newDebut, feries)
        newFin = addJoursOuvres(newDebut, dureeOuvree - 1, feries)
      } else {
        newDebut = prochainJourOuvre(newDebut, feries)
        newFin = precedentJourOuvre(newFin, feries)
        if (newFin < newDebut) newFin = newDebut
      }

      const prev = localTasks
      let updated = localTasks.map((t) => (t.id === id ? { ...t, date_debut: newDebut, date_fin: newFin } : t))

      // Recalage AUTOMATIQUE en cascade des successeurs : si la tâche déplacée
      // est prérequis d'autres tâches dont la contrainte (type + lag) n'est
      // plus respectée, celles-ci sont décalées (durée ouvrée conservée), et
      // ainsi de suite le long de la chaîne. La tâche déplacée elle-même n'est
      // jamais re-déplacée (pas de retour en arrière surprise) : si c'est ELLE
      // qui viole une contrainte en tant que successeur, on avertit seulement.
      const deplacees = new Set([id])
      const recalees: { id: string; debut: string; fin: string; titre: string }[] = []
      for (let garde = 0; garde < 25; garde++) {
        const aRecaler = findDependencyConflicts(updated, dependencies, feries)
          .find((c) => deplacees.has(c.predecessor.id) && !deplacees.has(c.successor.id))
        if (!aRecaler) break
        updated = updated.map((t) => (t.id === aRecaler.successor.id
          ? { ...t, date_debut: aRecaler.suggestedStart, date_fin: aRecaler.suggestedEnd }
          : t))
        deplacees.add(aRecaler.successor.id)
        recalees.push({
          id: aRecaler.successor.id,
          debut: aRecaler.suggestedStart,
          fin: aRecaler.suggestedEnd,
          titre: aRecaler.successor.titre,
        })
      }
      setLocalTasks(updated)

      const brokenAmont = findDependencyConflicts(updated, dependencies, feries)
        .filter((c) => c.successor.id === id)
      if (brokenAmont.length > 0) {
        const c = brokenAmont[0]
        toast.warning(
          `Dépendance violée : « ${c.successor.titre} » démarre avant la contrainte de « ${c.predecessor.titre} ». Voir le panneau Dépendances pour recaler.`
        )
      }

      const res = await updateTaskDates(id, newDebut, newFin, projectId)
      if (!res.ok) { setLocalTasks(prev); toast.error('Échec de la mise à jour de la tâche'); return }
      let echecRecalage = false
      for (const r of recalees) {
        const resR = await updateTaskDates(r.id, r.debut, r.fin, projectId)
        if (!resR.ok) echecRecalage = true
      }
      if (echecRecalage) {
        toast.error('Certains successeurs n\'ont pas pu être recalés — rechargez la page.')
      } else if (recalees.length > 0) {
        toast.info(
          recalees.length === 1
            ? `« ${recalees[0].titre} » recalée automatiquement (dépendance).`
            : `${recalees.length} tâches successeurs recalées automatiquement.`
        )
      }
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

    // Récurrence : on matérialise N occurrences comme de vraies tâches datées
    // (chaque semaine ou chaque mois), recalées sur des jours ouvrés — chacune
    // se comporte ensuite comme une tâche normale (drag, dépendances, coût…).
    const n = newRecurrence === 'none' ? 1 : Math.max(1, Math.min(52, parseInt(newOccurrences) || 1))
    // serie_id commun à toutes les occurrences : permet de les gérer comme un
    // groupe (suppression de toute la série) sans dupliquer la logique de tâche.
    const serieId = n > 1 ? crypto.randomUUID() : null
    const dureeCalendaire = diffDays(newDebut, newFin)
    const lignes = []
    for (let i = 0; i < n; i++) {
      // Décalage de l'occurrence : i semaines ou i mois après la première
      let debut = newDebut
      if (newRecurrence === 'weekly') debut = addDays(newDebut, 7 * i)
      else if (newRecurrence === 'monthly') {
        const d = new Date(newDebut + 'T00:00:00'); d.setMonth(d.getMonth() + i); debut = toLocalISO(d)
      }
      debut = prochainJourOuvre(debut, feries)
      const fin = precedentJourOuvre(addDays(debut, dureeCalendaire), feries)
      lignes.push({
        project_id: projectId,
        titre: n > 1 ? `${newTitre.trim()} (${i + 1}/${n})` : newTitre.trim(),
        phase_id: newPhase === NONE ? null : newPhase,
        date_debut: debut,
        date_fin: fin < debut ? debut : fin,
        ordre: localTasks.length + i,
        serie_id: serieId,
      })
    }

    const { error } = await supabase.from('project_tasks').insert(lignes)
    setAdding(false)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success(n > 1 ? `${n} occurrences ajoutées au planning` : 'Tâche ajoutée au planning')
      setNewTitre('')
      router.refresh()
    }
  }

  // Export CSV (compatible Excel : BOM UTF-8 + séparateur point-virgule)
  function exporterCSV() {
    const lignes: string[][] = [['N°', 'Tâche', 'Durée (j ouvrés)', 'Début', 'Fin', 'Avancement %', 'Statut', 'Responsable']]
    for (const l of ganttTasks) {
      if (l.id === 'projet_global') continue
      const m = l.id.match(/^(phase|task|ms)_(.+)$/)
      const t = m?.[1] === 'task' ? taskById.get(m[2]) : undefined
      lignes.push([
        wbsById.get(l.id) ?? '',
        titreReel(l.id),
        l.type === 'milestone' ? '' : String(joursOuvresEntre(toISO(l.start), toISO(l.end), feries)),
        toISO(l.start),
        l.type === 'milestone' ? '' : toISO(l.end),
        t ? String(t.avancement ?? 0) : String(Math.round(l.progress)),
        t ? STATUT_LABEL[t.statut] : l.type === 'milestone' ? 'Jalon' : 'Phase',
        t?.responsable_id ? collabById[t.responsable_id]?.nom ?? '' : '',
      ])
    }
    const csv = '﻿' + lignes.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(';')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    const slug = projectTitre.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'projet'
    a.download = `planning-${slug}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // « vide » = aucune donnée datée du tout (indépendant des filtres) : sinon un
  // filtre sans résultat afficherait « ajoutez des dates » au lieu de la barre.
  const vide = useMemo(() => {
    const aDate = (a: string | null, b: string | null) => !!toDate(a) && !!toDate(b)
    return !localPhases.some((p) => aDate(p.date_debut, p.date_fin))
      && !localTasks.some((t) => aDate(t.date_debut, t.date_fin))
      && !localMilestones.some((mi) => !!toDate(mi.date_echeance))
  }, [localPhases, localTasks, localMilestones])

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
      /* Grisage des jours non ouvrés (vue Jour) : les lignes de grille de
         gantt-task-react (rects SVG opaques, classes hachées stables car la
         version de la lib est verrouillée) deviennent translucides pour
         laisser voir le dégradé peint sur leur conteneur (_2B2zv). */
      ${fondJoursNonOuvres ? `
      .gantt-print-area ._2B2zv { background-image: ${fondJoursNonOuvres}; background-repeat: no-repeat; }
      .gantt-print-area ._2dZTy { fill: transparent; }
      .gantt-print-area ._2dZTy:nth-child(even) { fill: rgba(0,0,0,0.025); }
      ` : ''}
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
          {finPrevue && (
            <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
              Fin prévue : {new Date(finPrevue + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
          )}
          {nbEnRetard > 0 && (
            <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
              {nbEnRetard} en retard
            </span>
          )}
          {(coutTotal ?? 0) > 0 && (
            <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
              Coût : {(coutTotal as number).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
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
            onClick={exporterCSV}
            title="Exporter le planning en CSV (Excel)"
            className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:text-gray-800 transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
          </button>
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
            {/* Barre de filtres et recherche (n'affecte que l'affichage) */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <div className="relative">
                <Search className="h-3.5 w-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <Input
                  value={recherche}
                  onChange={(e) => setRecherche(e.target.value)}
                  placeholder="Rechercher une tâche…"
                  className="h-9 w-56 pl-8 text-sm"
                />
              </div>
              <Select value={filtreResp} onValueChange={(v) => setFiltreResp(v ?? NONE)}>
                <SelectTrigger className="h-9 text-xs w-40">
                  <SelectValue>
                    {(v: string) => (v === NONE ? 'Tous les responsables' : collabById[v]?.nom ?? 'Responsable')}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Tous les responsables</SelectItem>
                  {collaborateurs.map((c) => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filtreStatut} onValueChange={(v) => setFiltreStatut(v ?? NONE)}>
                <SelectTrigger className="h-9 text-xs w-36">
                  <SelectValue>
                    {(v: string) => (v === NONE ? 'Tous les statuts' : STATUT_LABEL[v as ProjectTaskStatus] ?? 'Statut')}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Tous les statuts</SelectItem>
                  {(Object.keys(STATUT_LABEL) as ProjectTaskStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>{STATUT_LABEL[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {filtresActifs && (
                <button
                  onClick={() => { setRecherche(''); setFiltreResp(NONE); setFiltreStatut(NONE) }}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 px-2 py-1"
                >
                  <X className="h-3.5 w-3.5" />
                  Réinitialiser
                </button>
              )}
            </div>
            {ganttTasks.length === 0 ? (
              <p className="text-sm text-gray-400 py-6 text-center">
                Aucune tâche ne correspond aux filtres.
              </p>
            ) : (
              <div className="overflow-x-auto border rounded-lg gantt-print-area">
                <Gantt
                  tasks={ganttTasks}
                  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                  viewMode={viewMode as any}
                  locale="fr"
                  onDateChange={handleDateChange}
                  onProgressChange={handleProgressChange}
                  onClick={handleClick}
                  onExpanderClick={(t) => togglePhase(t.id)}
                  TaskListHeader={TaskListHeader}
                  TaskListTable={TaskListTable}
                  TooltipContent={TooltipContent}
                  listCellWidth="220px"
                  columnWidth={columnWidth}
                  barCornerRadius={4}
                  todayColor="rgba(83,74,183,0.10)"
                />
              </div>
            )}
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
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="— Aucune —">
                  {(v: string) => (v === NONE ? '— Aucune phase —' : localPhases.find((p) => p.id === v)?.titre ?? '— Aucune —')}
                </SelectValue>
              </SelectTrigger>
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
          <div className="w-36">
            <label className="text-xs text-gray-500">Répéter</label>
            <Select value={newRecurrence} onValueChange={(v) => setNewRecurrence((v as 'none' | 'weekly' | 'monthly') ?? 'none')}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue>
                  {(v: string) => v === 'weekly' ? 'Chaque semaine' : v === 'monthly' ? 'Chaque mois' : 'Non'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Non</SelectItem>
                <SelectItem value="weekly">Chaque semaine</SelectItem>
                <SelectItem value="monthly">Chaque mois</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {newRecurrence !== 'none' && (
            <div className="w-20">
              <label className="text-xs text-gray-500" title="Nombre d'occurrences">× fois</label>
              <Input type="number" min="1" max="52" value={newOccurrences}
                onChange={(e) => setNewOccurrences(e.target.value)} className="h-9 text-xs" />
            </div>
          )}
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
