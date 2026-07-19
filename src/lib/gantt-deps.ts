import type { ProjectTask, TaskDependency } from '@/lib/types'

/**
 * Utilitaires de vérification des dépendances entre tâches (Gantt).
 * Fonctions pures, sans accès réseau — utilisées par le Gantt et le
 * gestionnaire de dépendances pour valider avant insertion et signaler
 * les incohérences de planning.
 */

/**
 * Vrai si ajouter la dépendance pred→succ créerait un cycle,
 * c'est-à-dire s'il existe déjà un chemin succ →* pred.
 */
export function wouldCreateCycle(
  deps: Pick<TaskDependency, 'predecessor_id' | 'successor_id'>[],
  predId: string,
  succId: string
): boolean {
  if (predId === succId) return true
  const next = new Map<string, string[]>()
  for (const d of deps) {
    const arr = next.get(d.predecessor_id)
    if (arr) arr.push(d.successor_id)
    else next.set(d.predecessor_id, [d.successor_id])
  }
  const stack = [succId]
  const seen = new Set<string>()
  while (stack.length) {
    const cur = stack.pop()!
    if (cur === predId) return true
    if (seen.has(cur)) continue
    seen.add(cur)
    const outs = next.get(cur)
    if (outs) stack.push(...outs)
  }
  return false
}

export interface DependencyConflict {
  dep: TaskDependency
  predecessor: ProjectTask
  successor: ProjectTask
  /** Recalage proposé pour la tâche successeur (durée conservée). */
  suggestedStart: string
  suggestedEnd: string
}

/** Formate en YYYY-MM-DD en date LOCALE (toISOString convertirait en UTC
 *  et ferait reculer d'un jour les fuseaux à l'est de Greenwich). */
export function toLocalISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return toLocalISO(d)
}

function diffDays(a: string, b: string): number {
  return Math.round(
    (new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 86400000
  )
}

/**
 * Conflits de planning : la tâche successeur commence avant la fin de son
 * prérequis (chevauchement réel ; démarrer le jour de fin du prérequis est toléré).
 * Ne considère que les dépendances dont les deux tâches ont des dates.
 */
export function findDependencyConflicts(
  tasks: ProjectTask[],
  deps: TaskDependency[]
): DependencyConflict[] {
  const byId = new Map(tasks.map((t) => [t.id, t]))
  const out: DependencyConflict[] = []
  for (const dep of deps) {
    const pred = byId.get(dep.predecessor_id)
    const succ = byId.get(dep.successor_id)
    if (!pred?.date_fin || !succ?.date_debut || !succ.date_fin) continue
    if (succ.date_debut < pred.date_fin) {
      const duree = Math.max(0, diffDays(succ.date_debut, succ.date_fin))
      out.push({
        dep,
        predecessor: pred,
        successor: succ,
        suggestedStart: pred.date_fin,
        suggestedEnd: addDays(pred.date_fin, duree),
      })
    }
  }
  return out
}

/**
 * Dépendances non traçables dans le Gantt : au moins une des deux tâches
 * n'a pas de dates (la flèche ne peut pas être dessinée).
 */
export function findUntrackedDependencies(
  tasks: ProjectTask[],
  deps: TaskDependency[]
): TaskDependency[] {
  const byId = new Map(tasks.map((t) => [t.id, t]))
  return deps.filter((dep) => {
    const pred = byId.get(dep.predecessor_id)
    const succ = byId.get(dep.successor_id)
    if (!pred || !succ) return false
    return !pred.date_debut || !pred.date_fin || !succ.date_debut || !succ.date_fin
  })
}
