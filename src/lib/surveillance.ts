import type {
  Project, ProjectPhase, ProjectTask, ProjectMilestone, TaskDependency, PhaseDependency,
  Collaborateur, Resource, ResourceAssignment, ResourceUnavailability, ResourceUnavailabilityMotif,
  ProjectTaskStatus,
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
 *
 * Granularité : quand les DEUX tâches sont sur un seul et même jour (pas
 * une plage de plusieurs jours) ET ont chacune une heure de début ET de fin
 * renseignées, le chevauchement est vérifié à l'heure près. Dans tous les
 * autres cas (tâche sur plusieurs jours, ou heure manquante d'un côté ou de
 * l'autre), on reste au jour entier : pas d'heure précisée = tâche traitée
 * comme occupant toute la journée, donc un chevauchement de jours suffit.
 */
export interface ConflitRessource {
  nom: string
  type: 'collaborateur' | 'ressource'
  a: { projetId: string; projetTitre: string; itemTitre: string; debut: string; fin: string; heureDebut: string | null; heureFin: string | null }
  b: { projetId: string; projetTitre: string; itemTitre: string; debut: string; fin: string; heureDebut: string | null; heureFin: string | null }
}

function seChevauchent(debutA: string, finA: string, debutB: string, finB: string): boolean {
  return debutA <= finB && debutB <= finA
}

/** Vrai si deux tâches se chevauchent, affiné à l'heure quand c'est possible (voir ConflitRessource ci-dessus). */
function tachesSeChevauchent(a: ProjectTask, b: ProjectTask): boolean {
  if (!seChevauchent(a.date_debut!, a.date_fin!, b.date_debut!, b.date_fin!)) return false

  const memeJourUnique = a.date_debut === a.date_fin && b.date_debut === b.date_fin && a.date_debut === b.date_debut
  if (memeJourUnique && a.heure_debut && a.heure_fin && b.heure_debut && b.heure_fin) {
    return a.heure_debut < b.heure_fin && b.heure_debut < a.heure_fin
  }
  return true
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
        if (!tachesSeChevauchent(ta, tb)) continue
        const pa = projetById.get(ta.project_id), pb = projetById.get(tb.project_id)
        if (!pa || !pb) continue
        out.push({
          nom, type: 'collaborateur',
          a: { projetId: pa.id, projetTitre: pa.titre, itemTitre: ta.titre, debut: ta.date_debut!, fin: ta.date_fin!, heureDebut: ta.heure_debut, heureFin: ta.heure_fin },
          b: { projetId: pb.id, projetTitre: pb.titre, itemTitre: tb.titre, debut: tb.date_debut!, fin: tb.date_fin!, heureDebut: tb.heure_debut, heureFin: tb.heure_fin },
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
        if (!tachesSeChevauchent(ta, tb)) continue
        const pa = projetById.get(ta.project_id), pb = projetById.get(tb.project_id)
        if (!pa || !pb) continue
        out.push({
          nom, type: 'ressource',
          a: { projetId: pa.id, projetTitre: pa.titre, itemTitre: ta.titre, debut: ta.date_debut!, fin: ta.date_fin!, heureDebut: ta.heure_debut, heureFin: ta.heure_fin },
          b: { projetId: pb.id, projetTitre: pb.titre, itemTitre: tb.titre, debut: tb.date_debut!, fin: tb.date_fin!, heureDebut: tb.heure_debut, heureFin: tb.heure_fin },
        })
      }
    }
  }
  return out
}

/**
 * Une ressource (module Ressources) affectée à une tâche datée dont la
 * période chevauche une période où elle est marquée indisponible (calendrier
 * du module Ressources — voir resource-calendar.tsx). Ne couvre que les
 * affectations liées à une tâche précise (task_id) : une affectation au
 * niveau du projet entier n'a pas de date propre, donc pas de chevauchement
 * calculable.
 */
export interface ConflitIndisponibilite {
  ressourceNom: string
  motif: ResourceUnavailabilityMotif
  indispoDebut: string
  indispoFin: string
  projetId: string
  projetTitre: string
  tacheTitre: string
  tacheDebut: string
  tacheFin: string
}

export function conflitsIndisponibilite(
  assignments: ResourceAssignment[],
  tasks: ProjectTask[],
  resources: Resource[],
  unavailabilities: ResourceUnavailability[],
  projects: Project[]
): ConflitIndisponibilite[] {
  const taskById = new Map(tasks.map((t) => [t.id, t]))
  const resourceById = new Map(resources.map((r) => [r.id, r]))
  const projetById = new Map(projects.map((p) => [p.id, p]))
  const indispoByResource = new Map<string, ResourceUnavailability[]>()
  for (const u of unavailabilities) {
    if (!indispoByResource.has(u.resource_id)) indispoByResource.set(u.resource_id, [])
    indispoByResource.get(u.resource_id)!.push(u)
  }

  const out: ConflitIndisponibilite[] = []
  for (const a of assignments) {
    if (!a.task_id) continue
    const task = taskById.get(a.task_id)
    if (!task || !task.date_debut || !task.date_fin) continue
    const indispos = indispoByResource.get(a.resource_id) ?? []
    for (const u of indispos) {
      if (!seChevauchent(task.date_debut, task.date_fin, u.date_debut, u.date_fin)) continue
      const resource = resourceById.get(a.resource_id)
      const projet = projetById.get(task.project_id)
      if (!resource || !projet) continue
      out.push({
        ressourceNom: resource.nom,
        motif: u.motif,
        indispoDebut: u.date_debut,
        indispoFin: u.date_fin,
        projetId: projet.id,
        projetTitre: projet.titre,
        tacheTitre: task.titre,
        tacheDebut: task.date_debut,
        tacheFin: task.date_fin,
      })
    }
  }
  return out
}

/**
 * Récap des affectations d'UNE ressource humaine (module Ressources), pour
 * l'email de rappel qui lui est envoyé directement (voir email ci-dessous).
 * Une affectation liée à une tâche déjà "fait" est omise (rien à rappeler) ;
 * une affectation au niveau du projet entier (sans task_id) est toujours
 * incluse, faute de statut propre pour savoir si elle est terminée.
 */
export interface RecapItem {
  projetId: string
  projetTitre: string
  tacheTitre: string | null
  tacheDebut: string | null
  tacheFin: string | null
  tacheStatut: ProjectTaskStatus | null
  heures: number
  budget: number
}

export interface RecapRessource {
  resourceId: string
  resourceNom: string
  resourceEmail: string
  items: RecapItem[]
}

/**
 * Un récap par ressource humaine ayant un email renseigné et au moins une
 * affectation à signaler (parmi les projets actifs fournis). `projects` doit
 * déjà être filtré aux projets actifs par l'appelant (même convention que
 * alertesTousProjets), pour ne pas relancer sur un projet clôturé.
 */
export function recapsRessources(
  resources: Resource[],
  assignments: ResourceAssignment[],
  tasks: ProjectTask[],
  projects: Project[]
): RecapRessource[] {
  const taskById = new Map(tasks.map((t) => [t.id, t]))
  const projetById = new Map(projects.map((p) => [p.id, p]))

  const out: RecapRessource[] = []
  for (const r of resources) {
    if (r.type !== 'humain' || !r.email) continue

    const items: RecapItem[] = []
    for (const a of assignments) {
      if (a.resource_id !== r.id) continue
      const projet = projetById.get(a.project_id)
      if (!projet) continue // projet non actif ou introuvable
      const tache = a.task_id ? taskById.get(a.task_id) : undefined
      if (tache && tache.statut === 'fait') continue // déjà terminée, rien à rappeler
      items.push({
        projetId: projet.id,
        projetTitre: projet.titre,
        tacheTitre: tache?.titre ?? null,
        tacheDebut: tache?.date_debut ?? null,
        tacheFin: tache?.date_fin ?? null,
        tacheStatut: tache?.statut ?? null,
        heures: a.heures,
        budget: a.budget,
      })
    }
    if (items.length === 0) continue

    out.push({ resourceId: r.id, resourceNom: r.nom, resourceEmail: r.email, items })
  }
  return out
}
