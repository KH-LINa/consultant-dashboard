// Seuils légaux auto-entrepreneur — prestations de services (BNC/BIC services) — 2025

export const SEUILS = {
  // Plafond de chiffre d'affaires annuel (prestations de services)
  plafond_ca: 77700,
  // Seuil de franchise en base de TVA (services)
  seuil_tva: 39100,
  // Seuil de franchise majoré TVA (services)
  seuil_tva_majore: 47600,
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
  cotisations: number
  versementIR: number
  netEstime: number
  parMois: BilanMensuel[]
  // seuils
  pctPlafond: number
  pctSeuilTva: number
  depassementTva: boolean
  depassementPlafond: boolean
}

const MOIS = ['Janv', 'Févr', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc']

interface InvoiceLike {
  montant_ht: number
  statut: string
  date_emission: string
}

export function calculerBilan(
  invoices: InvoiceLike[],
  annee: number,
  tauxCotisation: number,
  versementLiberatoire: boolean,
  tauxIR: number
): BilanAnnuel {
  const ofYear = invoices.filter((i) => new Date(i.date_emission).getUTCFullYear() === annee)

  const payees = ofYear.filter((i) => i.statut === 'payée')
  const nonAnnulees = ofYear.filter((i) => i.statut !== 'annulée')

  const caEncaisse = payees.reduce((s, i) => s + (i.montant_ht || 0), 0)
  const caFacture = nonAnnulees.reduce((s, i) => s + (i.montant_ht || 0), 0)

  // Cotisations URSSAF calculées sur le CA encaissé
  const cotisations = caEncaisse * (tauxCotisation / 100)
  const versementIR = versementLiberatoire ? caEncaisse * (tauxIR / 100) : 0
  const netEstime = caEncaisse - cotisations - versementIR

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
    cotisations,
    versementIR,
    netEstime,
    parMois,
    pctPlafond: (caEncaisse / SEUILS.plafond_ca) * 100,
    pctSeuilTva: (caEncaisse / SEUILS.seuil_tva) * 100,
    depassementTva: caEncaisse > SEUILS.seuil_tva,
    depassementPlafond: caEncaisse > SEUILS.plafond_ca,
  }
}
