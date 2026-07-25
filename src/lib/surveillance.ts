import type {
  Project, ProjectPhase, ProjectTask, ProjectMilestone, TaskDependency, PhaseDependency,
  Collaborateur, Resource, ResourceAssignment,
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

/**
 * Double-réservation d'un collaborateur OU d'une ressource (module
 * Ressources) sur des périodes qui se chevauchent, sur DEUX PROJETS
 * DIFFÉRENTS (un chevauchement entre deux tâches du MÊME projet n'est pas
 * signalé ici — ce n'est pas le scénario visé : deux chantiers en même temps).
 * Granularité JOUR uniquement : ni les tâches ni les affectations de
 * ressources n'enregistrent d'heure précise, seulement des dates — un
 * chevauchement de jours ne veut donc pas forcément dire un chevauchement
 * d'heures dans la journée, juste une période commune à surveiller.
 */
export interface ConflitRessource {
  nom: string
  type: 'collaborateur' | 'ressource'
  a: { projetId: string; projetTitre: string; itemTitre: string; debut: string; fin: string }
  b: { projetId: string; projetTitre: string; itemTitre: string; debut: string; fin: string }
}

function seChevauchent(debutA: string, finA: string, debutB: string, finB: string): boolean {
  return debutA <= finB && debutB <= finA
}

/** Un même collaborateur responsable de tâches datées qui se chevauchent sur 2 projets différents. */
export function conflitsCollaborateurs(
  tasks: ProjectTask[],
  projects: Project[],
  collaborateurs: Collaborateur[]
): ConflitRessource[] {
  const projetById = new Map(projects.map((p) => [p.id, p]))
  const collabById = new Map(collaborateurs.map((c) => [c.id, c]))
  const parCollab = new Map<string, ProjectTask[]>()
  for (const t of tasks) {
    if (!t.responsable_id || !t.date_debut || !t.date_fin) continue
    if (!parCollab.has(t.responsable_id)) parCollab.set(t.responsable_id, [])
    parCollab.get(t.responsable_id)!.push(t)
  }

  const out: ConflitRessource[] = []
  for (const [collabId, taches] of Array.from(parCollab.entries())) {
    const nom = collabById.get(collabId)?.nom ?? '?'
    for (let i = 0; i < taches.length; i++) {
      for (let j = i + 1; j < taches.length; j++) {
        const ta = taches[i], tb = taches[j]
        if (ta.project_id === tb.project_id) continue
        if (!seChevauchent(ta.date_debut!, ta.date_fin!, tb.date_debut!, tb.date_fin!)) continue
        const pa = projetById.get(ta.project_id), pb = projetById.get(tb.project_id)
        if (!pa || !pb) continue
        out.push({
          nom, type: 'collaborateur',
          a: { projetId: pa.id, projetTitre: pa.titre, itemTitre: ta.titre, debut: ta.date_debut!, fin: ta.date_fin! },
          b: { projetId: pb.id, projetTitre: pb.titre, itemTitre: tb.titre, debut: tb.date_debut!, fin: tb.date_fin! },
        })
      }
    }
  }
  return out
}

/**
 * Une même ressource (module Ressources) affectée à des tâches datées qui
 * se chevauchent sur 2 projets différents. Ne couvre que les affectations
 * liées à une tâche précise (task_id) : une affectation au niveau du projet
 * entier n'a pas de date propre, donc pas de chevauchement calculable.
 */
export function conflitsRessourcesModule(
  assignments: ResourceAssignment[],
  tasks: ProjectTask[],
  projects: Project[],
  resources: Resource[]
): ConflitRessource[] {
  const taskById = new Map(tasks.map((t) => [t.id, t]))
  const projetById = new Map(projects.map((p) => [p.id, p]))
  const resourceById = new Map(resources.map((r) => [r.id, r]))
  const parRessource = new Map<string, ProjectTask[]>()
  for (const a of assignments) {
    if (!a.task_id) continue
    const task = taskById.get(a.task_id)
    if (!task || !task.date_debut || !task.date_fin) continue
    if (!parRessource.has(a.resource_id)) parRessource.set(a.resource_id, [])
    parRessource.get(a.resource_id)!.push(task)
  }

  const out: ConflitRessource[] = []
  for (const [resourceId, taches] of Array.from(parRessource.entries())) {
    const nom = resourceById.get(resourceId)?.nom ?? '?'
    for (let i = 0; i < taches.length; i++) {
      for (let j = i + 1; j < taches.length; j++) {
        const ta = taches[i], tb = taches[j]
        if (ta.project_id === tb.project_id) continue
        if (!seChevauchent(ta.date_debut!, ta.date_fin!, tb.date_debut!, tb.date_fin!)) continue
        const pa = projetById.get(ta.project_id), pb = projetById.get(tb.project_id)
        if (!pa || !pb) continue
        out.push({
          nom, type: 'ressource',
          a: { projetId: pa.id, projetTitre: pa.titre, itemTitre: ta.titre, debut: ta.date_debut!, fin: ta.date_fin! },
          b: { projetId: pb.id, projetTitre: pb.titre, itemTitre: tb.titre, debut: tb.date_debut!, fin: tb.date_fin! },
        })
      }
    }
  }
  return out
}
