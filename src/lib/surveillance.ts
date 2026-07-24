import type {
  Project, ProjectPhase, ProjectTask, ProjectMilestone, TaskDependency, PhaseDependency,
} from '@/lib/types'
import { findDependencyConflicts } from '@/lib/gantt-deps'

/**
 * Détection des alertes de planning (retards, échéances proches, conflits
 * de dépendances) — fonctions PURES, sans accès réseau, utilisées par le
 * cron /api/cron/surveillance-planning. Séparées du handler pour rester
 * testables unitairement (même convention que lib/gantt-deps.ts).
 */

function joursDepuis(iso: string, auj: string): number {
  return Math.round(
    (new Date(auj + 'T00:00:00').getTime() - new Date(iso + 'T00:00:00').getTime()) / 86400000
  )
}

export interface AlerteProjet {
  projet: Project
  tachesEnRetard: (ProjectTask & { joursRetard: number })[]
  jalonsEnRetard: (ProjectMilestone & { joursRetard: number })[]
  jalonsProches: ProjectMilestone[]
  conflitsTaches: { predTitre: string; succTitre: string }[]
  conflitsPhases: { predTitre: string; succTitre: string }[]
}

/** Nombre total d'items signalés dans une AlerteProjet (0 = rien à signaler). */
export function nbAlertes(a: AlerteProjet): number {
  return a.tachesEnRetard.length + a.jalonsEnRetard.length + a.jalonsProches.length
    + a.conflitsTaches.length + a.conflitsPhases.length
}

/**
 * Alertes d'UN projet. `auj`/`horizonProche` en ISO local (YYYY-MM-DD).
 * Retard = date passée et statut pas encore "fait"/"atteint" (le statut
 * affiché — même manuel — n'est pas fiable seul, cf. le même choix pour
 * nbEnRetard côté Gantt et phaseStatus côté phases).
 */
export function alertesProjet(
  projet: Project,
  tachesProjet: ProjectTask[],
  phasesProjet: ProjectPhase[],
  milestonesProjet: ProjectMilestone[],
  taskDepsProjet: TaskDependency[],
  phaseDepsProjet: PhaseDependency[],
  auj: string,
  horizonProche: string,
  feries: Set<string>
): AlerteProjet {
  const tachesEnRetard = tachesProjet
    .filter((t) => t.date_fin && t.date_fin < auj && t.statut !== 'fait')
    .map((t) => ({ ...t, joursRetard: joursDepuis(t.date_fin!, auj) }))
    .sort((a, b) => b.joursRetard - a.joursRetard)

  const jalonsEnRetard = milestonesProjet
    .filter((m) => m.date_echeance && m.date_echeance < auj && m.statut !== 'atteint')
    .map((m) => ({ ...m, joursRetard: joursDepuis(m.date_echeance!, auj) }))
    .sort((a, b) => b.joursRetard - a.joursRetard)

  const jalonsProches = milestonesProjet
    .filter((m) => m.date_echeance && m.date_echeance >= auj && m.date_echeance <= horizonProche && m.statut !== 'atteint')
    .sort((a, b) => a.date_echeance!.localeCompare(b.date_echeance!))

  const conflitsTaches = findDependencyConflicts(tachesProjet, taskDepsProjet, feries)
    .map((c) => ({ predTitre: c.predecessor.titre, succTitre: c.successor.titre }))
  const conflitsPhases = findDependencyConflicts(phasesProjet, phaseDepsProjet, feries)
    .map((c) => ({ predTitre: c.predecessor.titre, succTitre: c.successor.titre }))

  return { projet, tachesEnRetard, jalonsEnRetard, jalonsProches, conflitsTaches, conflitsPhases }
}

/**
 * Alertes de TOUS les projets fournis, ne conservant que ceux ayant au
 * moins une alerte (un projet sans rien à signaler n'apparaît pas).
 */
export function alertesTousProjets(
  projects: Project[],
  tasks: ProjectTask[],
  phases: ProjectPhase[],
  milestones: ProjectMilestone[],
  taskDeps: TaskDependency[],
  phaseDeps: PhaseDependency[],
  auj: string,
  horizonProche: string,
  feries: Set<string>
): AlerteProjet[] {
  const out: AlerteProjet[] = []
  for (const projet of projects) {
    const tachesProjet = tasks.filter((t) => t.project_id === projet.id)
    const phasesProjet = phases.filter((p) => p.project_id === projet.id)
    const milestonesProjet = milestones.filter((m) => m.project_id === projet.id)
    const taskIdsProjet = new Set(tachesProjet.map((t) => t.id))
    const phaseIdsProjet = new Set(phasesProjet.map((p) => p.id))
    const taskDepsProjet = taskDeps.filter((d) => taskIdsProjet.has(d.predecessor_id) && taskIdsProjet.has(d.successor_id))
    const phaseDepsProjet = phaseDeps.filter((d) => phaseIdsProjet.has(d.predecessor_id) && phaseIdsProjet.has(d.successor_id))

    const alerte = alertesProjet(
      projet, tachesProjet, phasesProjet, milestonesProjet, taskDepsProjet, phaseDepsProjet,
      auj, horizonProche, feries
    )
    if (nbAlertes(alerte) > 0) out.push(alerte)
  }
  return out
}
