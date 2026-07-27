// Seuils et paramètres légaux — SASU, prestations de services (2025)

export const SEUILS = {
  // Franchise en base de TVA (services) — s'applique à toute structure sous ce seuil, pas
  // seulement aux micro-entreprises.
  seuil_tva: 39100,
  seuil_tva_majore: 47600,
  // Tranches d'impôt sur les sociétés (IS)
  is_taux_reduit: 0.15,
  is_plafond_taux_reduit: 42500,
  is_taux_normal: 0.25,
}

export interface BilanMensuel {
  mois: string
  moisIndex: number
  ca: number
}

export interface BilanAnnuel {
  annee: number
  caEncaisse: number
  caFacture: number // émis (toutes factures non annulées)
  remunerationBrute: number
  chargesPatronales: number
  chargesSalariales: number
  coutTotalRemuneration: number // brut + charges patronales, ce que ça coûte à la société
  netPercu: number // brut - charges salariales, avant IR personnel du président
  resultatAvantIS: number
  impotSocietes: number
  resultatNet: number
  parMois: BilanMensuel[]
  // seuils
  pctSeuilTva: number
  depassementTva: boolean
}

const MOIS = ['Janv', 'Févr', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc']

interface InvoiceLike {
  montant_ht: number
  statut: string
  date_emission: string
}

function calculerIS(resultat: number): number {
  if (resultat <= 0) return 0
  const tranche1 = Math.min(resultat, SEUILS.is_plafond_taux_reduit) * SEUILS.is_taux_reduit
  const tranche2 = Math.max(resultat - SEUILS.is_plafond_taux_reduit, 0) * SEUILS.is_taux_normal
  return tranche1 + tranche2
}

export function calculerBilan(
  invoices: InvoiceLike[],
  annee: number,
  remunerationBrutMensuelle: number,
  tauxChargesPatronales: number,
  tauxChargesSalariales: number
): BilanAnnuel {
  const ofYear = invoices.filter((i) => new Date(i.date_emission).getUTCFullYear() === annee)

  const payees = ofYear.filter((i) => i.statut === 'payée')
  const nonAnnulees = ofYear.filter((i) => i.statut !== 'annulée')

  const caEncaisse = payees.reduce((s, i) => s + (i.montant_ht || 0), 0)
  const caFacture = nonAnnulees.reduce((s, i) => s + (i.montant_ht || 0), 0)

  const remunerationBrute = remunerationBrutMensuelle * 12
  const chargesPatronales = remunerationBrute * (tauxChargesPatronales / 100)
  const chargesSalariales = remunerationBrute * (tauxChargesSalariales / 100)
  const coutTotalRemuneration = remunerationBrute + chargesPatronales
  const netPercu = remunerationBrute - chargesSalariales

  // Simplification : hors autres charges déductibles (logiciels, déplacements, RC Pro, etc.)
  const resultatAvantIS = caEncaisse - coutTotalRemuneration
  const impotSocietes = calculerIS(resultatAvantIS)
  const resultatNet = resultatAvantIS - impotSocietes

  const parMois: BilanMensuel[] = MOIS.map((mois, idx) => ({
    mois,
    moisIndex: idx,
    ca: payees
      .filter((i) => new Date(i.date_emission).getUTCMonth() === idx)
      .reduce((s, i) => s + (i.montant_ht || 0), 0),
  }))

  return {
    annee,
    caEncaisse,
    caFacture,
    remunerationBrute,
    chargesPatronales,
    chargesSalariales,
    coutTotalRemuneration,
    netPercu,
    resultatAvantIS,
    impotSocietes,
    resultatNet,
    parMois,
    pctSeuilTva: (caEncaisse / SEUILS.seuil_tva) * 100,
    depassementTva: caEncaisse > SEUILS.seuil_tva,
  }
}
