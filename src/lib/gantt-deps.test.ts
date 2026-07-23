import { describe, it, expect } from 'vitest'
import {
  wouldCreateCycle, findDependencyConflicts, computeCriticalPath,
} from './gantt-deps'
import { feriesSet } from './jours-ouvres'
import type { ProjectTask, TaskDependency, DependencyType } from './types'

const feries = feriesSet(2026, 2026)

// Fabrique une tâche datée minimale
function tache(id: string, debut: string, fin: string): ProjectTask {
  return {
    id, project_id: 'p', phase_id: null, parent_task_id: null, responsable_id: null,
    titre: id, date_debut: debut, date_fin: fin, statut: 'a_faire', avancement: 0,
    ordre: 0, created_at: '', completed_at: null,
  }
}

function dep(pred: string, succ: string, type: DependencyType = 'FS', lag = 0): TaskDependency {
  return { id: `${pred}-${succ}`, predecessor_id: pred, successor_id: succ, type, lag_days: lag, created_at: '' }
}

describe('wouldCreateCycle', () => {
  it('détecte une auto-dépendance', () => {
    expect(wouldCreateCycle([], 'a', 'a')).toBe(true)
  })

  it('détecte un cycle direct A→B puis B→A', () => {
    const deps = [{ predecessor_id: 'a', successor_id: 'b' }]
    expect(wouldCreateCycle(deps, 'b', 'a')).toBe(true)
  })

  it('détecte un cycle en chaîne A→B→C puis C→A', () => {
    const deps = [
      { predecessor_id: 'a', successor_id: 'b' },
      { predecessor_id: 'b', successor_id: 'c' },
    ]
    expect(wouldCreateCycle(deps, 'c', 'a')).toBe(true)
  })

  it('autorise une dépendance sans cycle', () => {
    const deps = [{ predecessor_id: 'a', successor_id: 'b' }]
    expect(wouldCreateCycle(deps, 'b', 'c')).toBe(false)
  })
})

describe('findDependencyConflicts (typé + jours ouvrés)', () => {
  it('FS : successeur démarrant avant la fin du prérequis = conflit', () => {
    const tasks = [tache('a', '2026-07-06', '2026-07-10'), tache('b', '2026-07-08', '2026-07-09')]
    const conflicts = findDependencyConflicts(tasks, [dep('a', 'b', 'FS')], feries)
    expect(conflicts).toHaveLength(1)
    // recalage proposé : démarre après la fin de A (vendredi 10 → toléré le jour même)
    expect(conflicts[0].suggestedStart).toBe('2026-07-10')
  })

  it('FS sans conflit : successeur démarre le jour de fin du prérequis', () => {
    const tasks = [tache('a', '2026-07-06', '2026-07-10'), tache('b', '2026-07-10', '2026-07-13')]
    expect(findDependencyConflicts(tasks, [dep('a', 'b', 'FS')], feries)).toHaveLength(0)
  })

  it('FS avec lag ouvré : le successeur doit démarrer lag jours ouvrés après la fin', () => {
    // A finit vendredi 10 ; lag 1 jour ouvré → contrainte début ≥ lundi 13
    const tasks = [tache('a', '2026-07-06', '2026-07-10'), tache('b', '2026-07-10', '2026-07-13')]
    const conflicts = findDependencyConflicts(tasks, [dep('a', 'b', 'FS', 1)], feries)
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0].suggestedStart).toBe('2026-07-13')
  })

  it('SS : les deux tâches doivent démarrer en même temps (ou après)', () => {
    // A démarre lundi 6 ; B démarre vendredi 3 (avant) → conflit
    const tasks = [tache('a', '2026-07-06', '2026-07-08'), tache('b', '2026-07-03', '2026-07-07')]
    const conflicts = findDependencyConflicts(tasks, [dep('a', 'b', 'SS')], feries)
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0].suggestedStart).toBe('2026-07-06')
  })

  it('FF : le successeur ne peut pas finir avant le prérequis', () => {
    // A finit vendredi 10 ; B finit mercredi 8 (avant) → conflit
    const tasks = [tache('a', '2026-07-06', '2026-07-10'), tache('b', '2026-07-06', '2026-07-08')]
    const conflicts = findDependencyConflicts(tasks, [dep('a', 'b', 'FF')], feries)
    expect(conflicts).toHaveLength(1)
  })

  it('ignore une dépendance dont une tâche n’a pas de dates', () => {
    const tasks = [tache('a', '2026-07-06', '2026-07-10'), { ...tache('b', '2026-07-08', '2026-07-09'), date_debut: null }]
    expect(findDependencyConflicts(tasks, [dep('a', 'b')], feries)).toHaveLength(0)
  })
})

describe('computeCriticalPath (typé)', () => {
  it('chaîne FS : toutes les tâches sont critiques (aucune marge)', () => {
    const tasks = [
      tache('a', '2026-07-06', '2026-07-07'),
      tache('b', '2026-07-08', '2026-07-09'),
      tache('c', '2026-07-10', '2026-07-13'),
    ]
    const deps = [dep('a', 'b'), dep('b', 'c')]
    const critiques = computeCriticalPath(tasks, deps)
    expect(critiques.has('a')).toBe(true)
    expect(critiques.has('b')).toBe(true)
    expect(critiques.has('c')).toBe(true)
  })

  it('une tâche feuille courte a de la marge (non critique)', () => {
    // a → c (longue, sur le chemin critique) et a → b (feuille courte, sans
    // successeur) : b peut glisser sans retarder la fin du projet → marge.
    const tasks = [
      tache('a', '2026-07-06', '2026-07-06'), // 1 j
      tache('b', '2026-07-07', '2026-07-07'), // 1 j, feuille
      tache('c', '2026-07-08', '2026-07-15'), // longue
    ]
    const deps = [dep('a', 'c'), dep('a', 'b')]
    const critiques = computeCriticalPath(tasks, deps)
    expect(critiques.has('a')).toBe(true)  // racine
    expect(critiques.has('c')).toBe(true)  // chemin le plus long
    expect(critiques.has('b')).toBe(false) // marge
  })
})
