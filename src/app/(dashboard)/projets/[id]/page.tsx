import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { CollaborateursManager } from '@/components/projets/collaborateurs-manager'
import { PhasesManager } from '@/components/projets/phases-manager'
import { MilestonesManager } from '@/components/projets/milestones-manager'
import { TasksManager } from '@/components/projets/tasks-manager'
import { CreateMissionButton } from '@/components/projets/create-mission-button'
import { ProjectResponsableSelect } from '@/components/projets/project-responsable-select'
import { ProjectGantt } from '@/components/projets/project-gantt'
import { DependenciesManager } from '@/components/projets/dependencies-manager'
import { ProjectPilotage } from '@/components/projets/project-pilotage'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FolderKanban, FileText } from 'lucide-react'
import type { ProjectStatus } from '@/lib/types'

const statutLabel: Record<ProjectStatus, { label: string; cls: string }> = {
  a_demarrer: { label: 'À démarrer', cls: 'bg-gray-100 text-gray-600' },
  en_cours: { label: 'En cours', cls: 'bg-blue-100 text-blue-700' },
  en_pause: { label: 'En pause', cls: 'bg-orange-100 text-orange-700' },
  termine: { label: 'Terminé', cls: 'bg-green-100 text-green-700' },
  annule: { label: 'Annulé', cls: 'bg-red-100 text-red-700' },
}

export default async function ProjetDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()

  const [
    { data: project },
    { data: collaborateurs },
    { data: phases },
    { data: milestones },
    { data: tasks },
    { data: missions },
  ] = await Promise.all([
    supabase.from('projects').select('*, contact:contacts(nom, entreprise), responsable:collaborateurs(nom, couleur)').eq('id', params.id).single(),
    supabase.from('collaborateurs').select('*').order('nom'),
    supabase.from('project_phases').select('*').eq('project_id', params.id).order('ordre'),
    supabase.from('project_milestones').select('*').eq('project_id', params.id).order('date_echeance'),
    supabase.from('project_tasks').select('*').eq('project_id', params.id).order('ordre'),
    supabase.from('missions').select('id, titre, statut').eq('project_id', params.id).order('created_at', { ascending: false }),
  ])

  if (!project) notFound()

  // Dépendances entre les tâches de ce projet
  const taskIds = (tasks ?? []).map((t) => t.id)
  const { data: dependencies } = taskIds.length
    ? await supabase.from('task_dependencies').select('*').in('predecessor_id', taskIds)
    : { data: [] }

  const st = statutLabel[project.statut as ProjectStatus]

  // Avancement global = moyenne de l'avancement des tâches
  const tasksList = tasks ?? []
  const phasesList = phases ?? []
  const milestonesList = milestones ?? []
  const avancement = tasksList.length > 0
    ? Math.round(tasksList.reduce((s, t) => s + (t.avancement || 0), 0) / tasksList.length)
    : 0

  // Fenêtre de dates du projet, calculée depuis le planning réel
  // (phases + jalons + tâches + dates propres du projet)
  const debuts = [
    project.date_debut,
    ...phasesList.map((p) => p.date_debut),
    ...tasksList.map((t) => t.date_debut),
    ...milestonesList.map((m) => m.date_echeance),
  ].filter(Boolean) as string[]
  const fins = [
    project.date_fin_prevue,
    ...phasesList.map((p) => p.date_fin),
    ...tasksList.map((t) => t.date_fin),
    ...milestonesList.map((m) => m.date_echeance),
  ].filter(Boolean) as string[]
  const projetDateDebut = debuts.length ? debuts.sort()[0] : null
  const projetDateFin = fins.length ? fins.sort()[fins.length - 1] : null

  return (
    <div className="space-y-6">
      <div>
        <Link href="/projets" className="text-sm text-gray-400 hover:text-gray-600">← Projets</Link>
        <div className="flex items-center gap-3 mt-1">
          <h1 className="text-3xl font-bold text-gray-900">{project.titre}</h1>
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${st.cls}`}>{st.label}</span>
        </div>
        <p className="text-gray-500 mt-1">
          {project.contact?.nom}{project.contact?.entreprise ? ` — ${project.contact.entreprise}` : ''}
        </p>
        <div className="mt-2">
          <ProjectResponsableSelect
            projectId={project.id}
            responsableId={project.responsable_id ?? null}
            collaborateurs={collaborateurs ?? []}
          />
        </div>
      </div>

      {/* Avancement global */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Avancement global</span>
            <span className="text-sm font-bold">{avancement}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2.5">
            <div className="h-2.5 rounded-full bg-blue-500 transition-all" style={{ width: `${avancement}%` }} />
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Moyenne de l'avancement des {tasksList.length} tâche(s).
          </p>
          {(projetDateDebut || projetDateFin) && (
            <p className="text-xs text-gray-500 mt-2 pt-2 border-t">
              📅 Période du projet (calculée depuis les phases, jalons et tâches) :{' '}
              <span className="font-medium">
                {projetDateDebut ? new Date(projetDateDebut).toLocaleDateString('fr-FR') : '—'}
              </span>{' → '}
              <span className="font-medium">
                {projetDateFin ? new Date(projetDateFin).toLocaleDateString('fr-FR') : '—'}
              </span>
            </p>
          )}
        </CardContent>
      </Card>

      {/* Pilotage : KPIs, alertes retard, charge par collaborateur */}
      <ProjectPilotage
        tasks={tasksList}
        milestones={milestonesList}
        collaborateurs={collaborateurs ?? []}
      />

      {/* Planning Gantt interactif */}
      <ProjectGantt
        projectId={project.id}
        projectTitre={project.titre}
        phases={phasesList}
        tasks={tasksList}
        milestones={milestonesList}
        dependencies={dependencies ?? []}
        collaborateurs={collaborateurs ?? []}
      />

      <CollaborateursManager collaborateurs={collaborateurs ?? []} />
      <PhasesManager projectId={project.id} phases={phases ?? []} />
      <MilestonesManager projectId={project.id} milestones={milestones ?? []} />
      <TasksManager
        projectId={project.id}
        tasks={tasksList}
        phases={phases ?? []}
        collaborateurs={collaborateurs ?? []}
      />
      <DependenciesManager projectId={project.id} tasks={tasksList} dependencies={dependencies ?? []} />

      {/* Missions rattachées (exécution + temps) */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FolderKanban className="h-4 w-4 text-purple-500" />
            Missions rattachées ({missions?.length ?? 0})
          </CardTitle>
          <CreateMissionButton
            projectId={project.id}
            contactId={project.contact_id}
            projetTitre={project.titre}
            collaborateurs={collaborateurs ?? []}
            milestones={milestonesList}
            defaultDateDebut={projetDateDebut}
            defaultDateFin={projetDateFin}
            defaultResponsableId={project.responsable_id}
          />
        </CardHeader>
        <CardContent>
          {missions && missions.length > 0 ? (
            <div className="space-y-1">
              {missions.map((m) => (
                <Link key={m.id} href={`/missions/${m.id}`}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50">
                  <span className="text-sm font-medium flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 text-gray-400" />{m.titre}
                  </span>
                  <span className="text-xs text-gray-400">{m.statut}</span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 py-2">
              Aucune mission. Les missions servent à l'exécution détaillée (tâches du quotidien + temps passé).
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
