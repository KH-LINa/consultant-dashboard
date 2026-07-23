import type { ProjectTask, TaskDependency, DependencyType } from '@/lib/types'
import { addJoursOuvres, joursOuvresEntre } from '@/lib/jours-ouvres'

/**
 * Utilitaires de vérification des dépendances entre tâches (Gantt).
 * Fonctions pures, sans accès réseau — utilisées par le Gantt et le
 * gestionnaire de dépendances pour valider avant insertion et signaler
 * les incohérences de planning.
 *
 * Les dépendances portent un type MS Project (FS/SS/FF/SF) et un délai
 * (lag) en jours ouvrés — voir contrainteDep() pour la sémantique exacte.
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
 * Contrainte imposée par une dépendance, en fonction de son type :
 * - FS (fin→début, défaut) : le successeur ne démarre pas avant la fin du
 *   prérequis + lag (lag 0 = démarrer le jour même de la fin est toléré,
 *   comportement historique du module).
 * - SS (début→début) : le successeur ne démarre pas avant le début du
 *   prérequis + lag.
 * - FF (fin→fin) : le successeur ne finit pas avant la fin du prérequis + lag.
 * - SF (début→fin) : le successeur ne finit pas avant le début du prérequis + lag.
 * Le lag est compté en jours ouvrés (fériés France + week-ends exclus).
 */
function contrainteDep(
  type: DependencyType,
  pred: ProjectTask,
  feries: Set<string>,
  lag: number
): { champ: 'debut' | 'fin'; min: string } | null {
  if (!pred.date_debut || !pred.date_fin) return null
  switch (type) {
    case 'FS': return { champ: 'debut', min: addJoursOuvres(pred.date_fin, lag, feries) }
    case 'SS': return { champ: 'debut', min: addJoursOuvres(pred.date_debut, lag, feries) }
    case 'FF': return { champ: 'fin', min: addJoursOuvres(pred.date_fin, lag, feries) }
    case 'SF': return { champ: 'fin', min: addJoursOuvres(pred.date_debut, lag, feries) }
  }
}

/**
 * Conflits de planning : la contrainte de la dépendance (selon son type et
 * son lag) n'est pas respectée par le successeur. Le recalage proposé
 * conserve la durée OUVRÉE de la tâche successeur.
 * Ne considère que les dépendances dont les deux tâches ont des dates.
 */
export function findDependencyConflicts(
  tasks: ProjectTask[],
  deps: TaskDependency[],
  feries: Set<string>
): DependencyConflict[] {
  const byId = new Map(tasks.map((t) => [t.id, t]))
  const out: DependencyConflict[] = []
  for (const dep of deps) {
    const pred = byId.get(dep.predecessor_id)
    const succ = byId.get(dep.successor_id)
    if (!pred?.date_fin || !pred.date_debut || !succ?.date_debut || !succ.date_fin) continue
    const c = contrainteDep(dep.type ?? 'FS', pred, feries, dep.lag_days ?? 0)
    if (!c) continue
    const valeur = c.champ === 'debut' ? succ.date_debut : succ.date_fin
    if (valeur < c.min) {
      const dureeOuvree = Math.max(1, joursOuvresEntre(succ.date_debut, succ.date_fin, feries))
      const suggestedStart = c.champ === 'debut'
        ? c.min
        : addJoursOuvres(c.min, -(dureeOuvree - 1), feries)
      out.push({
        dep,
        predecessor: pred,
        successor: succ,
        suggestedStart,
        suggestedEnd: addJoursOuvres(suggestedStart, dureeOuvree - 1, feries),
      })
    }
  }
  return out
}

export interface CpmResult {
  /** Ordre topologique des tâches datées (les cycles éventuels sont écartés). */
  order: string[]
  /** Early start / early finish / late start / late finish, en jours relatifs. */
  es: Map<string, number>
  ef: Map<string, number>
  ls: Map<string, number>
  lf: Map<string, number>
  /** Marge (LS − ES) par tâche ; 0 = critique. */
  slack: Map<string, number>
  /** Durée par tâche (jours pleins) et longueur totale du projet. */
  dur: Map<string, number>
  projectLength: number
  /** Profondeur topologique (rang de colonne pour un diagramme PERT). */
  depth: Map<string, number>
}

/**
 * Analyse CPM complète sur le graphe de dépendances des tâches datées.
 * Durées en jours pleins (début et fin inclus). Passe avant (ES/EF) puis passe
 * arrière (LS/LF) en ordre topologique ; une tâche est critique si sa marge
 * (LS − ES) est nulle : la retarder retarde la fin du projet.
 * Les cycles éventuels (théoriquement impossibles, refusés à l'insertion)
 * sont ignorés par sécurité.
 */
export function computeCpm(tasks: ProjectTask[], deps: TaskDependency[]): CpmResult {
  const empty: CpmResult = {
    order: [], es: new Map(), ef: new Map(), ls: new Map(), lf: new Map(),
    slack: new Map(), dur: new Map(), projectLength: 0, depth: new Map(),
  }
  const dated = tasks.filter((t) => t.date_debut && t.date_fin)
  if (dated.length === 0) return empty
  const ids = new Set(dated.map((t) => t.id))
  const dur = new Map<string, number>(
    dated.map((t) => [t.id, Math.max(1, diffDays(t.date_debut!, t.date_fin!) + 1)])
  )

  // Graphe restreint aux tâches datées — on conserve la dépendance complète
  // (type + lag) sur chaque arête pour appliquer la bonne contrainte CPM.
  type Arete = { autre: string; type: DependencyType; lag: number }
  const succs = new Map<string, Arete[]>()
  const preds = new Map<string, Arete[]>()
  const indeg = new Map<string, number>(dated.map((t) => [t.id, 0]))
  for (const d of deps) {
    if (!ids.has(d.predecessor_id) || !ids.has(d.successor_id)) continue
    const type = d.type ?? 'FS'
    const lag = d.lag_days ?? 0
    if (!succs.has(d.predecessor_id)) succs.set(d.predecessor_id, [])
    succs.get(d.predecessor_id)!.push({ autre: d.successor_id, type, lag })
    if (!preds.has(d.successor_id)) preds.set(d.successor_id, [])
    preds.get(d.successor_id)!.push({ autre: d.predecessor_id, type, lag })
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
      const v = (indegWork.get(s.autre) ?? 0) - 1
      indegWork.set(s.autre, v)
      if (v === 0) queue.push(s.autre)
    }
  }

  // Passe avant : ES / EF. Contrainte selon le type du lien (prédécesseur p,
  // successeur courant) : FS → ES ≥ EF_p + lag ; SS → ES ≥ ES_p + lag ;
  // FF → EF ≥ EF_p + lag ; SF → EF ≥ ES_p + lag.
  const es = new Map<string, number>()
  const ef = new Map<string, number>()
  for (const id of order) {
    const duree = dur.get(id)!
    let start = 0
    for (const a of preds.get(id) ?? []) {
      const esP = es.get(a.autre) ?? 0
      const efP = ef.get(a.autre) ?? 0
      let minStart: number
      switch (a.type) {
        case 'FS': minStart = efP + a.lag; break
        case 'SS': minStart = esP + a.lag; break
        case 'FF': minStart = efP + a.lag - duree; break
        case 'SF': minStart = esP + a.lag - duree; break
      }
      if (minStart > start) start = minStart
    }
    es.set(id, start)
    ef.set(id, start + duree)
  }
  const projectLength = Math.max(0, ...order.map((id) => ef.get(id)!))

  // Passe arrière : LS / LF (contraintes symétriques de la passe avant)
  const ls = new Map<string, number>()
  const lf = new Map<string, number>()
  for (let i = order.length - 1; i >= 0; i--) {
    const id = order[i]
    const duree = dur.get(id)!
    let end = projectLength
    for (const a of succs.get(id) ?? []) {
      const lsS = ls.get(a.autre) ?? projectLength
      const lfS = lf.get(a.autre) ?? projectLength
      let maxEnd: number
      switch (a.type) {
        case 'FS': maxEnd = lsS - a.lag; break
        case 'SS': maxEnd = lsS - a.lag + duree; break
        case 'FF': maxEnd = lfS - a.lag; break
        case 'SF': maxEnd = lfS - a.lag + duree; break
      }
      if (maxEnd < end) end = maxEnd
    }
    lf.set(id, end)
    ls.set(id, end - duree)
  }

  // Marges + profondeur topologique (colonnes d'un diagramme PERT)
  const slack = new Map<string, number>()
  const depth = new Map<string, number>()
  for (const id of order) {
    slack.set(id, (ls.get(id) ?? 0) - (es.get(id) ?? 0))
    depth.set(id, Math.max(-1, ...(preds.get(id) ?? []).map((p) => depth.get(p.autre) ?? -1)) + 1)
  }

  return { order, es, ef, ls, lf, slack, dur, projectLength, depth }
}

/** Identifiants des tâches critiques (marge nulle) — voir computeCpm. */
export function computeCriticalPath(
  tasks: ProjectTask[],
  deps: TaskDependency[]
): Set<string> {
  const cpm = computeCpm(tasks, deps)
  return new Set(cpm.order.filter((id) => cpm.slack.get(id) === 0))
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
