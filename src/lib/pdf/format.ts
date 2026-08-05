/**
 * react-pdf (police Helvetica intégrée, pas la police du système) ne
 * supporte pas l'espace fine insécable (U+202F) qu'Intl utilise comme
 * séparateur de milliers en fr-FR depuis les versions récentes de
 * Node/ICU — le glyphe manquant se rend comme un caractère erroné dans le
 * PDF (ex. "2/100,00 €" au lieu de "2 100,00 €"). Les pages HTML de l'app
 * n'ont pas ce problème (la police du navigateur gère cet espace
 * correctement) — ce correctif ne concerne QUE le texte destiné à un
 * <Text> react-pdf, jamais l'affichage web. Couvre aussi l'espace
 * insécable classique (U+00A0), par précaution.
 */
export function sansEspaceFinePdf(s: string): string {
  return s.replace(/[  ]/g, ' ')
}
