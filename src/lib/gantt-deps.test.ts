import { describe, it, expect } from 'vitest'
import {
  wouldCreateCycle, findDependencyConflicts, computeCriticalPath, projectCompletionRate, phaseStatus,
} from './gantt-deps'
import { feriesSet } from './jours-ouvres'
import type { ProjectTask, ProjectPhase, ProjectTaskStatus, TaskDependency, DependencyType } from './types'

const feries = feriesSet(2026, 2026)

// Fabrique une tâche datée minimale
function tache(
  id: string, debut: string, fin: string, phaseId: string | null = null,
  avancement = 0, statut: ProjectTaskStatus = 'a_faire'
): ProjectTask {
  return {
    id, project_id: 'p', phase_id: phaseId, parent_task_id: null, responsable_id: null,
    titre: id, date_debut: debut, date_fin: fin, heure_debut: null, heure_fin: null, statut, avancement,
    ordre: 0, created_at: '', serie_id: null,
  }
}

function phase(id: string, debut: string, fin: string): ProjectPhase {
  return { id, project_id: 'p', titre: id, date_debut: debut, date_fin: fin, couleur: '#000', ordre: 0, created_at: '' }
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

describe('projectCompletionRate', () => {
  it('une phase sans aucune tâche compte pour 0 % sur toute sa durée (ne doit pas être ignorée)', () => {
    // Phase 1 (8 j) : 2 tâches terminées à 100 %. Phase 2 (12 j) : aucune
    // tâche créée — doit tirer la moyenne vers le bas, pas être invisible.
    const phases = [phase('ph1', '2026-07-01', '2026-07-08'), phase('ph2', '2026-07-09', '2026-07-20')]
    const tasks = [
      tache('t1', '2026-07-01', '2026-07-04', 'ph1', 100),
      tache('t2', '2026-07-05', '2026-07-08', 'ph1', 100),
    ]
    const taux = projectCompletionRate(tasks, phases)
    // Naïvement (moyenne des 2 tâches) on obtiendrait 100 % ; pondéré par la
    // durée des phases (8 j à 100 %, 12 j à 0 % sur 20 j au total) → 40 %.
    expect(taux).toBe(40)
  })

  it('toutes les phases à 100 % → 100 %', () => {
    const phases = [phase('ph1', '2026-07-01', '2026-07-05')]
    const tasks = [tache('t1', '2026-07-01', '2026-07-05', 'ph1', 100)]
    expect(projectCompletionRate(tasks, phases)).toBe(100)
  })

  it('sans aucune phase, retombe sur la moyenne pondérée des tâches', () => {
    const tasks = [tache('t1', '2026-07-01', '2026-07-02', null, 100), tache('t2', '2026-07-03', '2026-07-04', null, 0)]
    expect(projectCompletionRate(tasks, [])).toBe(50)
  })

  it('tâche hors phase comptée individuellement, pondérée par sa propre durée', () => {
    const phases = [phase('ph1', '2026-07-01', '2026-07-02')] // 2 j, 1 tâche à 100 %
    const tasks = [
      tache('t1', '2026-07-01', '2026-07-02', 'ph1', 100),
      tache('t2', '2026-07-03', '2026-07-12', null, 0), // 10 j hors phase, 0 %
    ]
    // Poids : 2 j (phase à 100 %) + 10 j (tâche hors phase à 0 %) = 12 j → 200/12 ≈ 17 %
    expect(projectCompletionRate(tasks, phases)).toBe(17)
  })
})

describe('phaseStatus (auto-calculé, aucun champ modifiable en base)', () => {
  it('aucune tâche → à faire', () => {
    expect(phaseStatus([], 'ph1')).toBe('a_faire')
  })

  it('toutes les tâches à faire, 0 % → à faire', () => {
    const tasks = [tache('t1', '2026-07-01', '2026-07-02', 'ph1')]
    expect(phaseStatus(tasks, 'ph1')).toBe('a_faire')
  })

  it('toutes les tâches faites → fait', () => {
    const tasks = [
      tache('t1', '2026-07-01', '2026-07-02', 'ph1', 100, 'fait'),
      tache('t2', '2026-07-03', '2026-07-04', 'ph1', 100, 'fait'),
    ]
    expect(phaseStatus(tasks, 'ph1')).toBe('fait')
  })

  it('une tâche faite, une non → en cours', () => {
    const tasks = [
      tache('t1', '2026-07-01', '2026-07-02', 'ph1', 100, 'fait'),
      tache('t2', '2026-07-03', '2026-07-04', 'ph1', 0, 'a_faire'),
    ]
    expect(phaseStatus(tasks, 'ph1')).toBe('en_cours')
  })

  it('une tâche bloquée prime sur les autres statuts', () => {
    const tasks = [
      tache('t1', '2026-07-01', '2026-07-02', 'ph1', 100, 'fait'),
      tache('t2', '2026-07-03', '2026-07-04', 'ph1', 0, 'bloque'),
    ]
    expect(phaseStatus(tasks, 'ph1')).toBe('bloque')
  })

  it('ignore les tâches des autres phases', () => {
    const tasks = [tache('t1', '2026-07-01', '2026-07-02', 'autre-phase', 100, 'fait')]
    expect(phaseStatus(tasks, 'ph1')).toBe('a_faire')
  })

  it('avancement à 100 % compte comme fait même si le statut est resté "en cours" (libellé non mis à jour)', () => {
    // Cas réel rencontré : une tâche à 100 % d'avancement dont le statut
    // n'a pas été basculé sur "Fait" ne doit pas empêcher la phase
    // d'apparaître comme terminée (verte).
    const tasks = [
      tache('t1', '2026-07-01', '2026-07-02', 'ph1', 100, 'fait'),
      tache('t2', '2026-07-03', '2026-07-04', 'ph1', 100, 'en_cours'),
    ]
    expect(phaseStatus(tasks, 'ph1')).toBe('fait')
  })
})

describe('findDependencyConflicts appliqué aux PHASES (même logique générique que les tâches)', () => {
  it('détecte un conflit FD entre deux phases', () => {
    const phases = [phase('ph1', '2026-07-06', '2026-07-10'), phase('ph2', '2026-07-08', '2026-07-15')]
    const dep = { id: 'd1', predecessor_id: 'ph1', successor_id: 'ph2', type: 'FS' as DependencyType, lag_days: 0, created_at: '' }
    const conflicts = findDependencyConflicts(phases, [dep], feries)
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0].suggestedStart).toBe('2026-07-10')
  })

  it('aucun conflit quand la phase suivante démarre après la fin du prérequis', () => {
    const phases = [phase('ph1', '2026-07-06', '2026-07-10'), phase('ph2', '2026-07-13', '2026-07-20')]
    const dep = { id: 'd1', predecessor_id: 'ph1', successor_id: 'ph2', type: 'FS' as DependencyType, lag_days: 0, created_at: '' }
    expect(findDependencyConflicts(phases, [dep], feries)).toHaveLength(0)
  })
})
