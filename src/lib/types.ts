export type ContactType = 'prospect' | 'client' | 'inactif'
export type QuoteOffer = 'consulting' | 'automatisation' | 'solution_globale'
export type QuoteStatus = 'brouillon' | 'envoyé' | 'signé' | 'refusé' | 'expiré'

// Libellés affichés des types d'offre — source unique, alignée sur le
// vocabulaire du site vitrine (src/app/(public)/site/Vitrine.tsx).
// À réutiliser partout (formulaires, tables, PDF, page d'acceptation)
// pour éviter toute divergence.
export const OFFER_LABELS: Record<QuoteOffer, string> = {
  consulting: 'Consulting — accompagnement Lean',
  automatisation: 'Automatisation / IA',
  solution_globale: 'Solution globale Lean + IA',
}

export interface Contact {
  id: string
  type: ContactType
  nom: string
  email: string | null
  telephone: string | null
  entreprise: string | null
  notes: string | null
  created_at: string
}

export interface QuoteLine {
  description: string
  quantite: number
  prix_unitaire: number
}

export type InvoiceStatus = 'brouillon' | 'envoyée' | 'payée' | 'annulée'

export type ProjectStatus = 'a_demarrer' | 'en_cours' | 'en_pause' | 'termine' | 'annule'

export interface Project {
  id: string
  quote_id: string | null
  contact_id: string
  titre: string
  statut: ProjectStatus
  date_debut: string | null
  date_fin_prevue: string | null
  responsable_id?: string | null
  created_at: string
  contact?: Contact
}

export interface Collaborateur {
  id: string
  nom: string
  email: string | null
  role: string | null
  couleur: string
  created_at: string
}

export interface ProjectPhase {
  id: string
  project_id: string
  titre: string
  date_debut: string | null
  date_fin: string | null
  couleur: string
  ordre: number
  created_at: string
}

export type MilestoneStatus = 'a_faire' | 'atteint' | 'en_retard'

export interface ProjectMilestone {
  id: string
  project_id: string
  titre: string
  date_echeance: string | null
  statut: MilestoneStatus
  livrable: string | null
  ordre: number
  created_at: string
}

export type ProjectTaskStatus = 'a_faire' | 'en_cours' | 'fait' | 'bloque'

export interface ProjectTask {
  id: string
  project_id: string
  phase_id: string | null
  // Tâche parente pour une sous-tâche (imbriquée sous elle dans le Gantt) ; null = tâche de premier niveau.
  parent_task_id: string | null
  responsable_id: string | null
  titre: string
  date_debut: string | null
  date_fin: string | null
  statut: ProjectTaskStatus
  avancement: number
  ordre: number
  created_at: string
}

export type ResourceType = 'humain' | 'materiel'

export interface Resource {
  id: string
  nom: string
  type: ResourceType
  // €/h ; 0 = coût non chiffré (le coût estimé n'utilise alors que le budget)
  cout_horaire: number
  notes: string | null
  created_at: string
}

export interface ResourceAssignment {
  id: string
  resource_id: string
  project_id: string
  task_id: string | null
  heures: number
  budget: number
  created_at: string
  project?: Pick<Project, 'id' | 'titre'>
  task?: Pick<ProjectTask, 'id' | 'titre'>
}

// Types de liens MS Project : FS = fin→début (défaut), SS = début→début,
// FF = fin→fin, SF = début→fin. En français : FD / DD / FF / DF.
export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF'

export interface TaskDependency {
  id: string
  predecessor_id: string
  successor_id: string
  type: DependencyType
  // Délai (positif) ou avance (négatif) en jours ouvrés appliqué à la contrainte
  lag_days: number
  created_at: string
}

export interface DocumentFile {
  id: string
  nom: string
  chemin: string
  taille: number | null
  type_mime: string | null
  contact_id: string | null
  mission_id: string | null
  created_at: string
}

export type MissionStatus = 'a_demarrer' | 'en_cours' | 'en_pause' | 'terminee' | 'annulee'

export interface MissionTask {
  id: string
  mission_id: string
  titre: string
  done: boolean
  temps_passe: number
  ordre: number
  created_at: string
}

export interface Mission {
  id: string
  contact_id: string
  quote_id: string | null
  titre: string
  description: string | null
  statut: MissionStatus
  budget_ht: number
  date_debut: string | null
  date_fin_prevue: string | null
  project_id?: string | null
  responsable_id?: string | null
  created_at: string
  contact?: Contact
  tasks?: MissionTask[]
}

export interface Reminder {
  id: string
  type: 'devis' | 'facture'
  document_id: string
  contact_id: string | null
  email_to: string
  sent_at: string
}

export interface Invoice {
  id: string
  numero: string
  quote_id: string | null
  contact_id: string
  titre: string
  offre: QuoteOffer
  montant_ht: number
  statut: InvoiceStatus
  lignes: QuoteLine[]
  date_emission: string
  date_echeance: string | null
  notes: string | null
  created_at: string
  contact?: Contact
}

export interface Quote {
  id: string
  contact_id: string
  titre: string
  offre: QuoteOffer
  montant_ht: number
  statut: QuoteStatus
  lignes: QuoteLine[]
  created_at: string
  sent_at?: string | null
  public_token?: string
  response_at?: string | null
  response_comment?: string | null
  contact?: Contact
}

export type ContractStatus = 'brouillon' | 'envoye' | 'signe' | 'archive'
export type ContractOffer = 'consulting' | 'automatisation' | 'solution_centralisee'

export interface ContractTemplate {
  id: string
  offre: ContractOffer
  nom: string
  contenu: string
  version: number
  actif: boolean
  created_at: string
}

export interface Contract {
  id: string
  quote_id: string | null
  contact_id: string
  project_id: string | null
  template_id: string | null
  numero: string
  contenu: string
  statut: ContractStatus
  montant_ht: number
  pdf_url: string | null
  yousign_ref: string | null
  sent_at: string | null
  signed_at: string | null
  created_at: string
  contact?: Contact
  quote?: Pick<Quote, 'id' | 'titre' | 'offre'>
}
