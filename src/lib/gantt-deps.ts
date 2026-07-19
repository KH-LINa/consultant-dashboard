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
 * Chemin critique (méthode CPM) sur le graphe de dépendances des tâches datées.
 * Durées en jours pleins (début et fin inclus). Passe avant (ES/EF) puis passe
 * arrière (LS/LF) en ordre topologique ; une tâche est critique si sa marge
 * (LS − ES) est nulle : la retarder retarde la fin du projet.
 * Les cycles éventuels (théoriquement impossibles, refusés à l'insertion)
 * sont ignorés par sécurité.
 */
export function computeCriticalPath(
  tasks: ProjectTask[],
  deps: TaskDependency[]
): Set<string> {
  const dated = tasks.filter((t) => t.date_debut && t.date_fin)
  if (dated.length === 0) return new Set()
  const ids = new Set(dated.map((t) => t.id))
  const dur = new Map<string, number>(
    dated.map((t) => [t.id, Math.max(1, diffDays(t.date_debut!, t.date_fin!) + 1)])
  )

  // Graphe restreint aux tâches datées
  const succs = new Map<string, string[]>()
  const preds = new Map<string, string[]>()
  const indeg = new Map<string, number>(dated.map((t) => [t.id, 0]))
  for (const d of deps) {
    if (!ids.has(d.predecessor_id) || !ids.has(d.successor_id)) continue
    if (!succs.has(d.predecessor_id)) succs.set(d.predecessor_id, [])
    succs.get(d.predecessor_id)!.push(d.successor_id)
    if (!preds.has(d.successor_id)) preds.set(d.successor_id, [])
    preds.get(d.successor_id)!.push(d.predecessor_id)
    indeg.set(d.successor_id, (indeg.get(d.successor_id) ?? 0) + 1)
  }

  // Tri topologique (Kahn) — les nœuds pris dans un cycle sont écartés
  const order: string[] = []
  const queue = dated.filter((t) => (indeg.get(t.id) ?? 0) === 0).map((t) => t.id)
  const indegWork = new Map(indeg)
  while (queue.length) {
    const id = queue.shift()!
    order.push(id)
    for (const s of succs.get(id) ?? []) {
      const v = (indegWork.get(s) ?? 0) - 1
      indegWork.set(s, v)
      if (v === 0) queue.push(s)
    }
  }

  // Passe avant : ES / EF
  const es = new Map<string, number>()
  const ef = new Map<string, number>()
  for (const id of order) {
    const start = Math.max(0, ...(preds.get(id) ?? []).map((p) => ef.get(p) ?? 0))
    es.set(id, start)
    ef.set(id, start + dur.get(id)!)
  }
  const projectLength = Math.max(0, ...order.map((id) => ef.get(id)!))

  // Passe arrière : LS / LF
  const ls = new Map<string, number>()
  const lf = new Map<string, number>()
  for (let i = order.length - 1; i >= 0; i--) {
    const id = order[i]
    const end = Math.min(projectLength, ...(succs.get(id) ?? []).map((s) => ls.get(s) ?? projectLength))
    lf.set(id, end)
    ls.set(id, end - dur.get(id)!)
  }

  return new Set(order.filter((id) => ls.get(id) === es.get(id)))
}

/**
 * Taux de réalisation (0–100) : moyenne des avancements pondérée par la durée
 * des tâches (les tâches sans dates comptent pour 1 jour). `phaseId` restreint
 * aux tâches de cette phase ; sans argument, tout le projet.
 */
export function completionRate(tasks: ProjectTask[], phaseId?: string): number {
  const scope = phaseId ? tasks.filter((t) => t.phase_id === phaseId) : tasks
  if (scope.length === 0) return 0
  let poids = 0
  let somme = 0
  for (const t of scope) {
    const w = t.date_debut && t.date_fin
      ? Math.max(1, diffDays(t.date_debut, t.date_fin) + 1)
      : 1
    poids += w
    somme += w * (t.avancement ?? 0)
  }
  return poids === 0 ? 0 : Math.round(somme / poids)
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
