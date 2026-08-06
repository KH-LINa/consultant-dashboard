import type { NiveauMaturite, Recommandation } from '@/lib/types'
import { LEVIERS } from '@/lib/maturite'

/**
 * Test d'auto-évaluation public (site vitrine) — mêmes 18 questions que la
 * grille de diagnostic de maturité IA (voir
 * 01-methodologie/grille-diagnostic-maturite-ia.md côté base de
 * connaissances Yndra : 9 questions confirmées par la source externe
 * — Michaël Tartar/DIMM.UP, Techniques de l'Ingénieur — + 9 rédigées par
 * l'agence dans le même esprit), simplement adressées à la 2e personne
 * pour une auto-évaluation directe plutôt qu'un audit mené par un tiers.
 * Aucune question inventée pour arrondir un compte : la grille source fait
 * déjà 18 questions (3 par levier), on la reprend telle quelle.
 */

export type LevierChamp = typeof LEVIERS[number]['champ']

export interface QuestionTest {
  levier: LevierChamp
  texte: string
}

export const QUESTIONS_TEST: QuestionTest[] = [
  // Stratégie (source)
  { levier: 'niveau_strategie', texte: "L'IA envisagée répond-elle à un objectif industriel clair et mesurable (arrêts machine, taux de rebut, énergie, sécurité, cadence, qualité…) ?" },
  { levier: 'niveau_strategie', texte: 'Ce projet s\'inscrit-il dans votre feuille de route de performance globale ?' },
  { levier: 'niveau_strategie', texte: 'Savez-vous déjà comment sa réussite sera évaluée (gains, qualité, sécurité, image) ?' },
  // Organisation (source)
  { levier: 'niveau_organisation', texte: 'Une personne est-elle clairement désignée pour piloter le projet ?' },
  { levier: 'niveau_organisation', texte: 'Cette personne rend-elle des comptes à un décideur identifié ?' },
  { levier: 'niveau_organisation', texte: 'Existe-t-il une gouvernance claire pour prioriser les cas d\'usage IA ?' },
  // Personnel (source)
  { levier: 'niveau_personnel', texte: 'Vos équipes comprennent-elles les principes de base de l\'IA ?' },
  { levier: 'niveau_personnel', texte: 'Ont-elles été formées à ses limites autant qu\'à ses promesses ?' },
  { levier: 'niveau_personnel', texte: 'Sont-elles impliquées dans la conception du projet, pas seulement informées après coup ?' },
  // Offre (agence)
  { levier: 'niveau_offre', texte: 'Le cas d\'usage cible-t-il un irritant réellement ressenti sur le terrain, plutôt qu\'une opportunité théorique vue depuis un bureau ?' },
  { levier: 'niveau_offre', texte: 'La valeur créée est-elle mesurable concrètement (euros économisés, temps gagné, qualité perçue) ?' },
  { levier: 'niveau_offre', texte: 'Le gain visé justifie-t-il le coût total dans la durée — développement, intégration ET maintenance, pas seulement un premier essai ?' },
  // Technologie et innovation (agence)
  { levier: 'niveau_technologie', texte: 'Les données nécessaires existent-elles, sont-elles accessibles et suffisamment fiables ?' },
  { levier: 'niveau_technologie', texte: 'La solution pourrait-elle s\'intégrer à vos systèmes existants (MES, SCADA, ERP) sans les fragiliser ?' },
  { levier: 'niveau_technologie', texte: 'Savez-vous déjà qui maintiendrait la solution techniquement, une fois le prestataire parti ?' },
  // Environnement (agence)
  { levier: 'niveau_environnement', texte: 'Le projet respecte-t-il les contraintes réglementaires applicables (RGPD, AI Act, normes sectorielles) ?' },
  { levier: 'niveau_environnement', texte: 'Les partenaires externes impliqués (fournisseurs de données, intégrateurs, éditeurs) sont-ils fiables et engagés dans la durée ?' },
  { levier: 'niveau_environnement', texte: 'L\'évolution de votre marché rend-elle ce projet plus urgent, ou au contraire prématuré ?' },
]

export const REPONSES_OPTIONS: { valeur: NiveauMaturite; label: string }[] = [
  { valeur: 'sait_faire', label: 'Oui, clairement' },
  { valeur: 'partiel', label: 'En partie / je crois que oui' },
  { valeur: 'ignore', label: 'Pas encore' },
]

const POINTS: Record<NiveauMaturite, number> = { ignore: 0, partiel: 0.5, sait_faire: 1 }

// Agrège les 3 réponses d'un levier en un seul niveau — seuils propres à ce
// test (pas une valeur sourcée), assumés comme tels : une moyenne ≥ 0,75
// (proche de 3 réponses "oui") vaut "sait faire", ≥ 0,35 "partiel", sinon
// "à combler".
function niveauLevier(reponses: NiveauMaturite[]): NiveauMaturite {
  const moyenne = reponses.reduce((s, r) => s + POINTS[r], 0) / reponses.length
  if (moyenne >= 0.75) return 'sait_faire'
  if (moyenne >= 0.35) return 'partiel'
  return 'ignore'
}

function calculerRecommandation(score: number, niveaux: Record<LevierChamp, NiveauMaturite>): Recommandation {
  const nbIgnore = Object.values(niveaux).filter((n) => n === 'ignore').length
  if (score >= 70 && nbIgnore === 0) return 'go'
  if (score >= 40 && nbIgnore <= 2) return 'go_conditionnel'
  return 'no_go'
}

export interface ResultatTest {
  niveaux: Record<LevierChamp, NiveauMaturite>
  score: number
  recommandation: Recommandation
}

// `reponses` : une valeur par question, dans l'ordre de QUESTIONS_TEST.
export function calculerResultat(reponses: NiveauMaturite[]): ResultatTest {
  const niveaux = {} as Record<LevierChamp, NiveauMaturite>
  for (const { champ } of LEVIERS) {
    const reponsesDuLevier = QUESTIONS_TEST
      .map((q, i) => ({ q, i }))
      .filter(({ q }) => q.levier === champ)
      .map(({ i }) => reponses[i])
    niveaux[champ] = niveauLevier(reponsesDuLevier)
  }
  const score = Math.round(
    (LEVIERS.reduce((s, { champ }) => s + POINTS[niveaux[champ]], 0) / LEVIERS.length) * 100
  )
  return { niveaux, score, recommandation: calculerRecommandation(score, niveaux) }
}

// Palier affiché au prospect — vocabulaire volontairement différent de
// RECOMMANDATION_CONFIG (réservé à l'usage interne/admin) : "No-go" sonne
// comme un verdict définitif pour quelqu'un qui vient de passer un test en
// 5 minutes, alors que le principe même de la grille source est de ne
// jamais sanctionner (voir maturite.ts, NIVEAU_CONFIG).
export const PALIER_PUBLIC: Record<Recommandation, { titre: string; texte: string }> = {
  go: {
    titre: 'Vous êtes prêts à explorer l\'IA',
    texte: 'Les fondamentaux essentiels semblent en place. Un cadrage rapide permettrait d\'identifier les premiers cas d\'usage à fort potentiel.',
  },
  go_conditionnel: {
    titre: 'Une étape de préparation est recommandée avant l\'IA',
    texte: 'Certains fondamentaux sont encore à consolider. Rien de bloquant, mais s\'y attaquer avant de lancer un projet IA évite l\'échec le plus fréquent : un test qui ne passe jamais en production.',
  },
  no_go: {
    titre: 'Priorité à vos fondations avant l\'IA',
    texte: 'Plusieurs prérequis organisationnels manquent encore. Ce n\'est pas un jugement — c\'est précisément ce que ce test est fait pour repérer, avant d\'investir plutôt qu\'après.',
  },
}

// Explication par levier ET par niveau (6 × 3 = 18 textes) — ancrée dans les
// définitions et catégories de risques déjà sourcées dans la grille
// (01-methodologie/grille-diagnostic-maturite-ia.md), pas de nouveau
// chiffre ou fait externe inventé pour l'occasion.
export const EXPLICATION_LEVIER: Record<LevierChamp, Record<NiveauMaturite, string>> = {
  niveau_strategie: {
    sait_faire: 'L\'objectif industriel du projet est clair et mesurable — une base solide pour prioriser les cas d\'usage.',
    partiel: 'L\'intérêt existe, mais l\'objectif n\'est pas encore formulé de façon mesurable — un cadrage permettrait de le préciser avant d\'investir.',
    ignore: 'Aucun objectif industriel clair n\'est encore associé au projet — un projet IA sans objectif mesurable a statistiquement peu de chances d\'aboutir.',
  },
  niveau_organisation: {
    sait_faire: 'Le pilotage et la gouvernance du projet sont identifiés — qui décide, qui arbitre.',
    partiel: 'Un pilote existe, mais la gouvernance (arbitrages, priorisation des cas d\'usage) reste à formaliser.',
    ignore: 'Personne n\'est encore clairement désigné pour piloter le projet — sans cela, le passage à l\'échelle est rarement possible.',
  },
  niveau_personnel: {
    sait_faire: 'Les équipes comprennent les bases de l\'IA et sont impliquées dans la démarche.',
    partiel: 'Une sensibilisation existe, mais l\'implication réelle des équipes de terrain reste à construire.',
    ignore: 'L\'adhésion des équipes opérationnelles n\'est pas encore travaillée — c\'est une des causes d\'échec les plus fréquentes, avant même la technique.',
  },
  niveau_offre: {
    sait_faire: 'Le cas d\'usage cible un irritant réel du terrain, avec une valeur mesurable.',
    partiel: 'L\'idée est prometteuse, mais la valeur réelle (euros, temps, qualité) n\'est pas encore chiffrée.',
    ignore: 'Le cas d\'usage reste une opportunité théorique plus qu\'un besoin terrain vérifié — un risque fréquent de "gadget technologique".',
  },
  niveau_technologie: {
    sait_faire: 'Les données et l\'intégration aux systèmes existants (MES, SCADA, ERP) semblent maîtrisées.',
    partiel: 'Les données existent probablement, mais leur fiabilité et leur intégration aux systèmes restent à vérifier.',
    ignore: 'La disponibilité ou la fiabilité des données nécessaires n\'est pas établie — plus de la moitié des échecs de projets IA industriels viendraient d\'une donnée mal gouvernée.',
  },
  niveau_environnement: {
    sait_faire: 'Le cadre réglementaire et les partenaires externes sont identifiés et fiables.',
    partiel: 'Les grandes lignes réglementaires sont connues, mais pas encore vérifiées en détail pour ce projet précis.',
    ignore: 'Les contraintes réglementaires (RGPD, AI Act, normes sectorielles) ou la fiabilité des partenaires externes ne sont pas encore vérifiées.',
  },
}
