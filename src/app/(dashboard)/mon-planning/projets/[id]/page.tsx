import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { phaseStatus, projectCompletionRate } from '@/lib/gantt-deps'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollToTache } from '@/components/planning/scroll-to-tache'
import { ArrowLeft, Flag, Link2 } from 'lucide-react'
import type {
  ProjectStatus, ProjectTaskStatus, MilestoneStatus, DependencyType,
  Project, ProjectPhase, ProjectTask, ProjectMilestone, TaskDependency, PhaseDependency, Collaborateur,
} from '@/lib/types'

const PROJECT_STATUT_LABEL: Record<ProjectStatus, { label: string; cls: string }> = {
  a_demarrer: { label: 'À démarrer', cls: 'bg-gray-100 text-gray-600' },
  en_cours: { label: 'En cours', cls: 'bg-blue-100 text-blue-700' },
  en_pause: { label: 'En pause', cls: 'bg-orange-100 text-orange-700' },
  termine: { label: 'Terminé', cls: 'bg-green-100 text-green-700' },
  annule: { label: 'Annulé', cls: 'bg-red-100 text-red-700' },
}
const TASK_STATUT_LABEL: Record<ProjectTaskStatus, string> = {
  a_faire: 'À faire', en_cours: 'En cours', fait: 'Fait', bloque: 'Bloqué',
}
const TASK_STATUT_BADGE: Record<ProjectTaskStatus, string> = {
  a_faire: 'bg-gray-100 text-gray-600',
  en_cours: 'bg-blue-100 text-blue-700',
  fait: 'bg-green-100 text-green-700',
  bloque: 'bg-red-100 text-red-700',
}
const MILESTONE_STATUT_LABEL: Record<MilestoneStatus, { label: string; cls: string }> = {
  a_faire: { label: 'À faire', cls: 'bg-gray-100 text-gray-600' },
  atteint: { label: 'Atteint', cls: 'bg-green-100 text-green-700' },
  en_retard: { label: 'En retard', cls: 'bg-red-100 text-red-700' },
}
const DEP_TYPE_LABEL: Record<DependencyType, string> = {
  FS: 'Fin → Début', SS: 'Début → Début', FF: 'Fin → Fin', SF: 'Début → Fin',
}

function fmt(iso: string | null): string {
  return iso ? new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
}

export default async function ProjetLectureSeulePage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // La RLS ne renvoie ce projet que s'il concerne réellement ce collaborateur
  // (tâche, mission ou affectation ressource) — sinon il n'existe simplement
  // pas pour cette requête, d'où le notFound() ci-dessous.
  const { data: project } = await supabase.from('projects').select('*').eq('id', params.id).single()
  if (!project) notFound()

  const [{ data: phasesData }, { data: tasksData }, { data: milestonesData }, { data: collaborateursData }] = await Promise.all([
    supabase.from('project_phases').select('*').eq('project_id', params.id).order('ordre'),
    supabase.from('project_tasks').select('*').eq('project_id', params.id).order('ordre'),
    supabase.from('project_milestones').select('*').eq('project_id', params.id).order('date_echeance'),
    supabase.from('collaborateurs').select('*'),
  ])

  const phases = (phasesData ?? []) as ProjectPhase[]
  const tasks = (tasksData ?? []) as ProjectTask[]
  const milestones = (milestonesData ?? []) as ProjectMilestone[]
  const collaborateurs = (collaborateursData ?? []) as Collaborateur[]
  const collabById = Object.fromEntries(collaborateurs.map((c) => [c.id, c]))

  const taskIds = tasks.map((t) => t.id)
  const phaseIds = phases.map((p) => p.id)
  const [{ data: taskDepsData }, { data: phaseDepsData }] = await Promise.all([
    taskIds.length ? supabase.from('task_dependencies').select('*').in('predecessor_id', taskIds) : Promise.resolve({ data: [] }),
    phaseIds.length ? supabase.from('phase_dependencies').select('*').in('predecessor_id', phaseIds) : Promise.resolve({ data: [] }),
  ])
  const taskDeps = (taskDepsData ?? []) as TaskDependency[]
  const phaseDeps = (phaseDepsData ?? []) as PhaseDependency[]

  const taskById = Object.fromEntries(tasks.map((t) => [t.id, t]))
  const phaseById = Object.fromEntries(phases.map((p) => [p.id, p]))
  const tasksParPhase = new Map<string | null, ProjectTask[]>()
  for (const t of tasks) {
    const key = t.phase_id
    if (!tasksParPhase.has(key)) tasksParPhase.set(key, [])
    tasksParPhase.get(key)!.push(t)
  }

  const st = PROJECT_STATUT_LABEL[project.statut as ProjectStatus]
  const avancement = projectCompletionRate(tasks, phases)

  return (
    <div className="space-y-6 max-w-4xl">
      <ScrollToTache />
      <div>
        <Link href="/mon-planning" className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1 mb-2">
          <ArrowLeft className="h-3.5 w-3.5" />
          Mon planning
        </Link>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-3xl font-bold text-gray-900">{project.titre}</h1>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${st.cls}`}>{st.label}</span>
        </div>
        <p className="text-gray-500 mt-1 text-sm">
          {fmt(project.date_debut)} → {fmt(project.date_fin_prevue)} · lecture seule
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Avancement global</span>
            <span className="text-sm font-bold">{avancement}%</span>
          </div>
          <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-2.5 rounded-full bg-blue-500 transition-all" style={{ width: `${avancement}%` }} />
          </div>
        </CardContent>
      </Card>

      {phases.map((phase) => {
        const statut = phaseStatus(tasks, phase.id)
        const tachesPhase = tasksParPhase.get(phase.id) ?? []
        return (
          <Card key={phase.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: phase.couleur }} />
                  {phase.titre}
                </CardTitle>
                <span className={`text-xs px-2 py-0.5 rounded-full ${TASK_STATUT_BADGE[statut]}`}>{TASK_STATUT_LABEL[statut]}</span>
              </div>
              <p className="text-xs text-gray-400">{fmt(phase.date_debut)} → {fmt(phase.date_fin)}</p>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {tachesPhase.length === 0 && <p className="text-xs text-gray-400">Aucune tâche.</p>}
              {tachesPhase.map((t) => (
                <div key={t.id} id={`tache-${t.id}`} className="border rounded-lg p-2.5 flex items-center gap-3 text-sm transition-colors">
                  <span className="flex-1 min-w-0 truncate">{t.titre}</span>
                  {t.responsable_id && collabById[t.responsable_id] && (
                    <span className="text-xs text-gray-400 whitespace-nowrap flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full" style={{ background: collabById[t.responsable_id].couleur }} />
                      {collabById[t.responsable_id].nom}
                    </span>
                  )}
                  <span className="text-xs text-gray-400 whitespace-nowrap">{fmt(t.date_debut)} → {fmt(t.date_fin)}</span>
                  <span className="text-xs text-gray-500 w-9 text-right">{t.avancement}%</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${TASK_STATUT_BADGE[t.statut]}`}>{TASK_STATUT_LABEL[t.statut]}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )
      })}

      {(tasksParPhase.get(null) ?? []).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Tâches sans phase</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {(tasksParPhase.get(null) ?? []).map((t) => (
              <div key={t.id} id={`tache-${t.id}`} className="border rounded-lg p-2.5 flex items-center gap-3 text-sm transition-colors">
                <span className="flex-1 min-w-0 truncate">{t.titre}</span>
                {t.responsable_id && collabById[t.responsable_id] && (
                  <span className="text-xs text-gray-400 whitespace-nowrap">{collabById[t.responsable_id].nom}</span>
                )}
                <span className="text-xs text-gray-400 whitespace-nowrap">{fmt(t.date_debut)} → {fmt(t.date_fin)}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${TASK_STATUT_BADGE[t.statut]}`}>{TASK_STATUT_LABEL[t.statut]}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {milestones.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Flag className="h-4 w-4 text-amber-500" />
              Jalons ({milestones.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {milestones.map((m) => {
              const mst = MILESTONE_STATUT_LABEL[m.statut]
              return (
                <div key={m.id} className="border rounded-lg p-2.5 flex items-center justify-between gap-2 text-sm">
                  <span className="truncate">{m.titre}</span>
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    {m.responsable_id && collabById[m.responsable_id] && (
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full" style={{ background: collabById[m.responsable_id].couleur }} />
                        {collabById[m.responsable_id].nom}
                      </span>
                    )}
                    <span className="text-xs text-gray-400">{fmt(m.date_echeance)}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${mst.cls}`}>{mst.label}</span>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {(taskDeps.length > 0 || phaseDeps.length > 0) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Link2 className="h-4 w-4 text-gray-400" />
              Dépendances
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm text-gray-600">
            {taskDeps.map((d) => (
              <p key={d.id}>
                « {taskById[d.successor_id]?.titre ?? '?'} » — {DEP_TYPE_LABEL[d.type]} de « {taskById[d.predecessor_id]?.titre ?? '?'} »
                {d.lag_days !== 0 && <span className="text-gray-400"> ({d.lag_days > 0 ? '+' : ''}{d.lag_days} j)</span>}
              </p>
            ))}
            {phaseDeps.map((d) => (
              <p key={d.id}>
                Phase « {phaseById[d.successor_id]?.titre ?? '?'} » — {DEP_TYPE_LABEL[d.type]} de « {phaseById[d.predecessor_id]?.titre ?? '?'} »
                {d.lag_days !== 0 && <span className="text-gray-400"> ({d.lag_days > 0 ? '+' : ''}{d.lag_days} j)</span>}
              </p>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
