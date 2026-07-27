import type { QuoteLine } from '@/lib/types'
import { toLocalISO } from '@/lib/gantt-deps'
import { addJoursOuvres, feriesCourants, prochainJourOuvre } from '@/lib/jours-ouvres'

/**
 * Génération de planning (phases + tâches) à partir des lignes d'un devis —
 * partagée entre la création de projet (create-project-button.tsx) et la
 * régénération manuelle depuis un projet existant (project-gantt.tsx).
 *
 * "Cadence" est le nom donné à cet assistant IA côté interface (bouton,
 * toasts) — voir le system prompt de /api/projets/generer-planning.
 */

export interface PlanningTache {
  titre: string
  duree_jours_ouvres: number
}

export interface PlanningPhase {
  titre: string
  taches: PlanningTache[]
}

export interface PhaseInsert {
  project_id: string
  titre: string
  date_debut: string
  date_fin: string
  couleur: string
  ordre: number
}

export interface TaskInsert {
  project_id: string
  phase_id: string | null
  titre: string
  date_debut: string
  date_fin: string
  ordre: number
}

// Couleurs cycliques pour distinguer les phases auto-générées dans le Gantt
// (même défaut que project_phases.couleur pour la première).
export const PALETTE = ['#93c5fd', '#a5b4fc', '#c4b5fd', '#f0abfc', '#fda4af', '#fdba74']

// Durée par défaut quand la quantité ne représente probablement pas un
// nombre de jours (voir buildPhasesFromLignes) : suffisamment courte pour
// rester un premier jet, assez longue pour ne pas produire une phase d'un
// seul jour à chaque ligne facturée au forfait.
const DUREE_PAR_DEFAUT_JOURS = 3

// Ébauche déterministe (repli) : une phase par ligne de devis, enchaînées à
// partir du prochain jour ouvré, sans détail par tâche. Utilisée quand la
// génération IA échoue ou n'est pas configurée.
//
// Dates en jours OUVRÉS (weekends + fériés français exclus), pour rester
// cohérent avec la colonne "Durée" du Gantt (joursOuvresEntre, voir
// gantt-task-list.tsx) — sans ça, une phase "1 j" pouvait démarrer un samedi
// et s'étaler sur 3 jours calendaires, décalant toute la suite du planning.
export function buildPhasesFromLignes(projectId: string, lignes: QuoteLine[]): PhaseInsert[] {
  const feries = feriesCourants()
  let debut = prochainJourOuvre(toLocalISO(new Date()), feries)
  return lignes.map((l, i) => {
    const dureeJours = l.quantite >= 2 ? Math.min(20, Math.round(l.quantite)) : DUREE_PAR_DEFAUT_JOURS
    const fin = addJoursOuvres(debut, dureeJours - 1, feries)
    const phase = {
      project_id: projectId,
      titre: l.description || `Phase ${i + 1}`,
      date_debut: debut,
      date_fin: fin,
      couleur: PALETTE[i % PALETTE.length],
      ordre: i,
    }
    debut = addJoursOuvres(fin, 1, feries)
    return phase
  })
}

// Construit phases + tâches à partir du planning proposé par l'IA
// (/api/projets/generer-planning) : le modèle ne propose que des durées en
// jours ouvrés par tâche, jamais de dates — tout le chaînage calendaire
// (phases entre elles, tâches dans leur phase) reste déterministe côté code.
export function buildPhasesAndTasksFromPlanning(
  projectId: string,
  phasesIA: PlanningPhase[],
  lignes: QuoteLine[]
): { phases: PhaseInsert[]; tachesParPhase: Omit<TaskInsert, 'phase_id'>[][] } {
  const feries = feriesCourants()
  let debutPhase = prochainJourOuvre(toLocalISO(new Date()), feries)
  const phases: PhaseInsert[] = []
  const tachesParPhase: Omit<TaskInsert, 'phase_id'>[][] = []

  phasesIA.forEach((p, i) => {
    let debutTache = debutPhase
    const taches = p.taches.map((t, j) => {
      const finTache = addJoursOuvres(debutTache, Math.max(1, t.duree_jours_ouvres) - 1, feries)
      const tache = {
        project_id: projectId,
        titre: t.titre,
        date_debut: debutTache,
        date_fin: finTache,
        ordre: j,
      }
      debutTache = addJoursOuvres(finTache, 1, feries)
      return tache
    })
    const finPhase = taches[taches.length - 1].date_fin
    phases.push({
      project_id: projectId,
      titre: p.titre || lignes[i]?.description || `Phase ${i + 1}`,
      date_debut: debutPhase,
      date_fin: finPhase,
      couleur: PALETTE[i % PALETTE.length],
      ordre: i,
    })
    tachesParPhase.push(taches)
    debutPhase = addJoursOuvres(finPhase, 1, feries)
  })

  return { phases, tachesParPhase }
}

// Reconstruit les tâches d'UNE SEULE phase existante à partir des tâches
// proposées par l'IA, chaînées en jours ouvrés depuis la date de début
// actuelle de la phase (elle-même inchangée). Utilisé par la régénération
// sélective (Cadence : choisir les phases à régénérer, project-gantt.tsx) —
// contrairement à buildPhasesAndTasksFromPlanning, ne touche jamais aux
// autres phases du projet.
export function buildTasksForPhase(
  projectId: string, phaseId: string, dateDebutPhase: string, taches: PlanningTache[]
): { tasks: TaskInsert[]; dateFin: string } {
  const feries = feriesCourants()
  let debutTache = prochainJourOuvre(dateDebutPhase, feries)
  const tasks: TaskInsert[] = taches.map((t, j) => {
    const finTache = addJoursOuvres(debutTache, Math.max(1, t.duree_jours_ouvres) - 1, feries)
    const task = {
      project_id: projectId,
      phase_id: phaseId,
      titre: t.titre,
      date_debut: debutTache,
      date_fin: finTache,
      ordre: j,
    }
    debutTache = addJoursOuvres(finTache, 1, feries)
    return task
  })
  const dateFin = tasks[tasks.length - 1]?.date_fin ?? dateDebutPhase
  return { tasks, dateFin }
}

// Appelle Cadence (l'assistant IA de planification) pour proposer un
// découpage phases + tâches. Retourne null si l'API n'est pas configurée, en
// erreur, ou renvoie une réponse incohérente — jamais d'exception : à
// l'appelant de décider du repli (ébauche déterministe, ou abandon sans
// toucher aux données existantes selon le contexte).
export async function fetchPlanningIA(
  titre: string, lignes: QuoteLine[], consignes?: string
): Promise<PlanningPhase[] | null> {
  try {
    const res = await fetch('/api/projets/generer-planning', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titre, lignes, consignes }),
    })
    if (!res.ok) return null
    const { planning } = await res.json()
    if (!planning?.phases?.length) return null
    return planning.phases as PlanningPhase[]
  } catch {
    return null
  }
}
