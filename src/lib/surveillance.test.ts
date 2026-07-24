import { describe, it, expect } from 'vitest'
import { alertesProjet, alertesTousProjets, nbAlertes } from './surveillance'
import { feriesSet } from './jours-ouvres'
import type {
  Project, ProjectTask, ProjectPhase, ProjectMilestone, TaskDependency, PhaseDependency,
} from './types'

const feries = feriesSet(2026, 2026)
const AUJ = '2026-07-24' // vendredi
const DANS3J = '2026-07-27'

function projet(id: string, statut: Project['statut'] = 'en_cours'): Project {
  return { id, quote_id: null, contact_id: 'c1', titre: `Projet ${id}`, statut, date_debut: null, date_fin_prevue: null, created_at: '' }
}

function tache(
  id: string, dateFin: string | null, statut: ProjectTask['statut'] = 'a_faire', projectId = 'p1'
): ProjectTask {
  return {
    id, project_id: projectId, phase_id: null, parent_task_id: null, responsable_id: null,
    titre: id, date_debut: dateFin, date_fin: dateFin, statut, avancement: 0, ordre: 0, created_at: '', serie_id: null,
  }
}

function jalon(
  id: string, dateEcheance: string | null, statut: ProjectMilestone['statut'] = 'a_faire', projectId = 'p1'
): ProjectMilestone {
  return { id, project_id: projectId, titre: id, date_echeance: dateEcheance, statut, livrable: null, ordre: 0, created_at: '' }
}

function phase(id: string, debut: string, fin: string, projectId = 'p1'): ProjectPhase {
  return { id, project_id: projectId, titre: id, date_debut: debut, date_fin: fin, couleur: '#000', ordre: 0, created_at: '' }
}

describe('alertesProjet', () => {
  it('aucune alerte quand tout est à jour', () => {
    const a = alertesProjet(
      projet('p1'), [tache('t1', '2026-08-01')], [], [], [], [], AUJ, DANS3J, feries
    )
    expect(nbAlertes(a)).toBe(0)
  })

  it('détecte une tâche en retard (statut pas fait, date passée)', () => {
    const a = alertesProjet(
      projet('p1'), [tache('t1', '2026-07-20', 'en_cours')], [], [], [], [], AUJ, DANS3J, feries
    )
    expect(a.tachesEnRetard).toHaveLength(1)
    expect(a.tachesEnRetard[0].joursRetard).toBe(4)
  })

  it('une tâche en retard mais déjà "fait" ne compte pas', () => {
    const a = alertesProjet(
      projet('p1'), [tache('t1', '2026-07-20', 'fait')], [], [], [], [], AUJ, DANS3J, feries
    )
    expect(a.tachesEnRetard).toHaveLength(0)
  })

  it('détecte un jalon en retard (statut pas atteint, date passée)', () => {
    const a = alertesProjet(
      projet('p1'), [], [], [jalon('m1', '2026-07-22', 'a_faire')], [], [], AUJ, DANS3J, feries
    )
    expect(a.jalonsEnRetard).toHaveLength(1)
    expect(a.jalonsEnRetard[0].joursRetard).toBe(2)
  })

  it('détecte un jalon proche (dans les 3 jours, pas encore atteint)', () => {
    const a = alertesProjet(
      projet('p1'), [], [], [jalon('m1', '2026-07-26', 'a_faire')], [], [], AUJ, DANS3J, feries
    )
    expect(a.jalonsProches).toHaveLength(1)
  })

  it('un jalon proche mais déjà atteint ne compte pas', () => {
    const a = alertesProjet(
      projet('p1'), [], [], [jalon('m1', '2026-07-26', 'atteint')], [], [], AUJ, DANS3J, feries
    )
    expect(a.jalonsProches).toHaveLength(0)
  })

  it('détecte un conflit de dépendance entre tâches', () => {
    const tasks = [tache('a', '2026-07-24'), tache('b', '2026-07-23')]
    const deps: TaskDependency[] = [{ id: 'd1', predecessor_id: 'a', successor_id: 'b', type: 'FS', lag_days: 0, created_at: '' }]
    const a = alertesProjet(projet('p1'), tasks, [], [], deps, [], AUJ, DANS3J, feries)
    expect(a.conflitsTaches).toHaveLength(1)
  })

  it('détecte un conflit de dépendance entre phases', () => {
    const phases = [phase('ph1', '2026-07-20', '2026-07-24'), phase('ph2', '2026-07-22', '2026-07-28')]
    const deps: PhaseDependency[] = [{ id: 'd1', predecessor_id: 'ph1', successor_id: 'ph2', type: 'FS', lag_days: 0, created_at: '' }]
    const a = alertesProjet(projet('p1'), [], phases, [], [], deps, AUJ, DANS3J, feries)
    expect(a.conflitsPhases).toHaveLength(1)
  })
})

describe('alertesTousProjets', () => {
  it('ne garde que les projets ayant au moins une alerte', () => {
    const projects = [projet('p1'), projet('p2')]
    const tasks = [
      tache('t1', '2026-07-20', 'en_cours', 'p1'), // en retard
      tache('t2', '2026-08-15', 'a_faire', 'p2'),  // à jour
    ]
    const result = alertesTousProjets(projects, tasks, [], [], [], [], AUJ, DANS3J, feries)
    expect(result).toHaveLength(1)
    expect(result[0].projet.id).toBe('p1')
  })

  it('les dépendances et tâches d\'un autre projet ne polluent pas le calcul', () => {
    const projects = [projet('p1'), projet('p2')]
    const tasks = [
      tache('a', '2026-07-24', 'a_faire', 'p1'), tache('b', '2026-07-23', 'a_faire', 'p1'),
      tache('c', '2026-07-24', 'a_faire', 'p2'), tache('d', '2026-07-23', 'a_faire', 'p2'),
    ]
    // Un lien croisé entre projets (ne devrait matcher aucun des deux, faute de tâches communes)
    const deps: TaskDependency[] = [
      { id: 'd1', predecessor_id: 'a', successor_id: 'b', type: 'FS', lag_days: 0, created_at: '' },
      { id: 'd2', predecessor_id: 'c', successor_id: 'd', type: 'FS', lag_days: 0, created_at: '' },
    ]
    const result = alertesTousProjets(projects, tasks, [], [], deps, [], AUJ, DANS3J, feries)
    expect(result).toHaveLength(2)
    expect(result.find((r) => r.projet.id === 'p1')!.conflitsTaches).toHaveLength(1)
    expect(result.find((r) => r.projet.id === 'p2')!.conflitsTaches).toHaveLength(1)
  })

  it('aucun projet actif → tableau vide', () => {
    expect(alertesTousProjets([], [], [], [], [], [], AUJ, DANS3J, feries)).toHaveLength(0)
  })
})
