import type { MaturityAssessment, NiveauMaturite, Recommandation } from '@/lib/types'

// Les 6 leviers de la grille de diagnostic de maturité IA — voir
// 01-methodologie/grille-diagnostic-maturite-ia.md côté base de
// connaissances Yndra. Champ = colonne correspondante sur
// maturity_assessments.
export const LEVIERS: { champ: keyof Pick<
  MaturityAssessment,
  'niveau_strategie' | 'niveau_organisation' | 'niveau_personnel' | 'niveau_offre' | 'niveau_technologie' | 'niveau_environnement'
>; label: string }[] = [
  { champ: 'niveau_strategie', label: 'Stratégie' },
  { champ: 'niveau_organisation', label: 'Organisation' },
  { champ: 'niveau_personnel', label: 'Personnel' },
  { champ: 'niveau_offre', label: 'Offre' },
  { champ: 'niveau_technologie', label: 'Technologie et innovation' },
  { champ: 'niveau_environnement', label: 'Environnement' },
]

// Volontairement SANS notation punitive (principe explicite de la source) —
// des couleurs neutres/informatives, pas un rouge "échec".
export const NIVEAU_CONFIG: Record<NiveauMaturite, { label: string; description: string; cls: string; dot: string }> = {
  sait_faire: {
    label: 'Sait faire', description: 'Compétence acquise et déployée',
    cls: 'bg-green-100 text-green-700', dot: 'bg-green-500',
  },
  partiel: {
    label: 'Angle mort', description: 'Croit savoir faire — à vérifier',
    cls: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500',
  },
  ignore: {
    label: 'À combler', description: 'Lacune identifiée avant d\'investir',
    cls: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400',
  },
}

export const RECOMMANDATION_CONFIG: Record<Recommandation, { label: string; cls: string }> = {
  go: { label: 'Go', cls: 'bg-green-100 text-green-700' },
  go_conditionnel: { label: 'Go conditionnel', cls: 'bg-amber-100 text-amber-700' },
  no_go: { label: 'No-go', cls: 'bg-gray-200 text-gray-700' },
}

// Score indicatif (0-100) pour un affichage synthétique uniquement — jamais
// montré comme LA mesure de la grille (voir "sans notation punitive"
// ci-dessus), seulement comme repère visuel rapide au survol/tri.
const POINTS: Record<NiveauMaturite, number> = { ignore: 0, partiel: 0.5, sait_faire: 1 }
export function scoreIndicatif(a: MaturityAssessment): number {
  const total = LEVIERS.reduce((s, { champ }) => s + POINTS[a[champ]], 0)
  return Math.round((total / LEVIERS.length) * 100)
}
