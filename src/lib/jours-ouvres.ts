/**
 * Jours ouvrés et jours fériés français — fonctions pures, sans dépendance.
 *
 * Convention de dates : chaînes ISO locales "YYYY-MM-DD" (comme partout dans
 * le module Projets — voir toLocalISO dans gantt-deps.ts). Les calculs
 * passent par Date à midi UTC pour éviter tout glissement de fuseau.
 *
 * Semaine ouvrée : lundi→vendredi (pas de paramétrage horaire — le planning
 * du dashboard est à la maille jour, pas heure).
 */

function d(iso: string): Date {
  return new Date(iso + 'T12:00:00Z')
}

function iso(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/**
 * Dimanche de Pâques pour une année donnée — algorithme de Meeus/Butcher
 * (grégorien, exact pour toute année ≥ 1583). C'est la clé des fêtes mobiles
 * françaises : lundi de Pâques (+1), Ascension (+39), lundi de Pentecôte (+50).
 */
export function datePaques(annee: number): string {
  const a = annee % 19
  const b = Math.floor(annee / 100)
  const c = annee % 100
  const e = Math.floor(b / 4)
  const f = b % 4
  const g = Math.floor((b + 8) / 25)
  const h = Math.floor((b - g + 1) / 3)
  const i = (19 * a + b - e - h + 15) % 30
  const k = Math.floor(c / 4)
  const l = c % 4
  const m = (32 + 2 * f + 2 * k - i - l) % 7
  const n = Math.floor((a + 11 * i + 22 * m) / 451)
  const mois = Math.floor((i + m - 7 * n + 114) / 31) // 3 = mars, 4 = avril
  const jour = ((i + m - 7 * n + 114) % 31) + 1
  return `${annee}-${String(mois).padStart(2, '0')}-${String(jour).padStart(2, '0')}`
}

function plusJours(isoDate: string, jours: number): string {
  const date = d(isoDate)
  date.setUTCDate(date.getUTCDate() + jours)
  return iso(date)
}

export interface JourFerie {
  date: string
  nom: string
}

/** Les 11 jours fériés légaux français (métropole) pour une année. */
export function feriesFrance(annee: number): JourFerie[] {
  const paques = datePaques(annee)
  return [
    { date: `${annee}-01-01`, nom: 'Jour de l’an' },
    { date: plusJours(paques, 1), nom: 'Lundi de Pâques' },
    { date: `${annee}-05-01`, nom: 'Fête du Travail' },
    { date: `${annee}-05-08`, nom: 'Victoire 1945' },
    { date: plusJours(paques, 39), nom: 'Ascension' },
    { date: plusJours(paques, 50), nom: 'Lundi de Pentecôte' },
    { date: `${annee}-07-14`, nom: 'Fête nationale' },
    { date: `${annee}-08-15`, nom: 'Assomption' },
    { date: `${annee}-11-01`, nom: 'Toussaint' },
    { date: `${annee}-11-11`, nom: 'Armistice 1918' },
    { date: `${annee}-12-25`, nom: 'Noël' },
  ]
}

/**
 * Ensemble des dates fériées couvrant une plage d'années — précalculé une
 * fois par rendu du Gantt (l'année en cours ± 2 couvre tout planning réel).
 */
export function feriesSet(anneeDebut: number, anneeFin: number): Set<string> {
  const s = new Set<string>()
  for (let a = anneeDebut; a <= anneeFin; a++) {
    for (const f of feriesFrance(a)) s.add(f.date)
  }
  return s
}

/**
 * Fériés couvrant largement tout planning affiché : année précédente → +3 ans.
 * À mémoïser côté composant (useMemo) — le calcul est trivial mais inutile à
 * refaire à chaque rendu.
 */
export function feriesCourants(): Set<string> {
  const annee = new Date().getFullYear()
  return feriesSet(annee - 1, annee + 3)
}

export function estWeekend(isoDate: string): boolean {
  const j = d(isoDate).getUTCDay()
  return j === 0 || j === 6
}

export function estJourOuvre(isoDate: string, feries: Set<string>): boolean {
  return !estWeekend(isoDate) && !feries.has(isoDate)
}

/** Premier jour ouvré ≥ la date donnée. */
export function prochainJourOuvre(isoDate: string, feries: Set<string>): string {
  let cur = isoDate
  while (!estJourOuvre(cur, feries)) cur = plusJours(cur, 1)
  return cur
}

/** Dernier jour ouvré ≤ la date donnée. */
export function precedentJourOuvre(isoDate: string, feries: Set<string>): string {
  let cur = isoDate
  while (!estJourOuvre(cur, feries)) cur = plusJours(cur, -1)
  return cur
}

/**
 * Avance de `n` jours ouvrés à partir d'un jour ouvré (n = 0 → la date
 * elle-même, recalée au jour ouvré suivant si besoin). n < 0 recule.
 */
export function addJoursOuvres(isoDate: string, n: number, feries: Set<string>): string {
  let cur = n >= 0 ? prochainJourOuvre(isoDate, feries) : precedentJourOuvre(isoDate, feries)
  const pas = n >= 0 ? 1 : -1
  let restants = Math.abs(n)
  while (restants > 0) {
    cur = plusJours(cur, pas)
    if (estJourOuvre(cur, feries)) restants--
  }
  return cur
}

/** Nombre de jours ouvrés entre deux dates INCLUSES (0 si plage vide). */
export function joursOuvresEntre(debut: string, fin: string, feries: Set<string>): number {
  if (fin < debut) return 0
  let n = 0
  let cur = debut
  while (cur <= fin) {
    if (estJourOuvre(cur, feries)) n++
    cur = plusJours(cur, 1)
  }
  return n
}
