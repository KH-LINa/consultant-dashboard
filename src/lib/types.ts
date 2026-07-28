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
  // Identifiant lisible ("CLI-0001"), attribué automatiquement en base dès
  // que le contact passe client (trigger sur contacts.type) — null tant
  // qu'il reste prospect/inactif, jamais réattribué une fois défini.
  code_client: string | null
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
  // Date du dernier point de suivi post-déploiement (étape 7 de la
  // méthodologie Yndra : "Suivi & amélioration continue") — renseignée
  // manuellement via le bouton dédié sur la fiche projet. Null = jamais
  // encore fait de point de suivi.
  date_dernier_suivi?: string | null
  created_at: string
  contact?: Contact
}

export interface Collaborateur {
  id: string
  nom: string
  email: string | null
  telephone: string | null
  role: string | null
  couleur: string
  // Identifiant lisible ("COL-0001"), attribué automatiquement en base à la
  // création (trigger) — jamais réattribué, même schéma que
  // contacts.code_client.
  code_collaborateur: string | null
  notes: string | null
  // Faux = ne travaille plus avec l'agence — reste visible pour préserver
  // son historique (missions/projets passés), mais distingué visuellement
  // des collaborateurs en activité plutôt que supprimé.
  actif: boolean
  // Lien optionnel vers une ressource facturable (resources.id) — un
  // collaborateur (qui peut être "responsable" d'une mission/projet/tâche)
  // PEUT aussi être une ressource (suivi d'heures/coût sur des projets),
  // mais les deux restent des tables distinctes : un responsable non facturé
  // (l'admin lui-même, par ex.) n'a pas besoin de ressource liée. Unique
  // côté base : une ressource n'est liée qu'à un seul collaborateur.
  resource_id: string | null
  created_at: string
}

// Rôle d'accès à l'outil (à ne pas confondre avec Collaborateur.role, qui
// est un intitulé de poste libre) : admin = accès complet + gestion des
// comptes, manager = accès complet sauf gestion des comptes, collaborateur
// = accès limité à son propre planning (voir supabase-profiles-migration.sql).
export type UserRole = 'admin' | 'manager' | 'collaborateur'

export interface Profile {
  id: string
  email: string
  nom: string
  role: UserRole
  collaborateur_id: string | null
  resource_id: string | null
  created_at: string
}

// Notifications d'événements générées automatiquement par des triggers
// (nouvelle tâche assignée, planning modifié, nouveau commentaire, nouveau
// signalement) — voir supabase-notifications-migration.sql et
// supabase-comments-signalements-migration.sql. profile_id = destinataire.
export type NotificationType = 'tache_assignee' | 'planning_modifie' | 'commentaire_tache' | 'signalement'

export interface Notification {
  id: string
  profile_id: string
  type: NotificationType
  titre: string
  message: string | null
  lien: string | null
  task_id: string | null
  read_at: string | null
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
  // Heure optionnelle (format "HH:MM"), en plus des dates — sans heure,
  // une tâche est considérée comme occupant la journée entière.
  heure_debut: string | null
  heure_fin: string | null
  statut: ProjectTaskStatus
  avancement: number
  ordre: number
  created_at: string
  // Regroupe les occurrences d'une tâche récurrente (même série) ; null = tâche isolée.
  serie_id: string | null
  // Position manuelle dans la vue PERT (glisser-déposer) ; null = disposition automatique par profondeur.
  pert_x: number | null
  pert_y: number | null
}

// Fil de commentaires sur une tâche (ex. cause d'un retard ou d'un blocage)
// — voir supabase-comments-signalements-migration.sql. auteur_nom est
// dénormalisé à l'insertion (pas de join vers profiles, bloqué par sa RLS
// pour un tiers).
export interface TaskComment {
  id: string
  task_id: string
  auteur_id: string
  auteur_nom: string
  contenu: string
  created_at: string
}

export type SignalementType = 'retard' | 'imprevu' | 'blocage' | 'materiel' | 'autre'

// Événement libre signalé par un utilisateur (imprévu, retard trajet,
// problème matériel...), toujours notifié au staff (admin/manager).
export interface Signalement {
  id: string
  auteur_id: string
  auteur_nom: string
  type: SignalementType
  titre: string
  message: string
  task_id: string | null
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
  // Ressource humaine : peut préremplir l'invitation d'un compte de connexion.
  email: string | null
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

export type ResourceUnavailabilityMotif = 'absent' | 'conge' | 'maladie' | 'autre'

// Période où une ressource n'est PAS disponible (calendrier du module Ressources).
export interface ResourceUnavailability {
  id: string
  resource_id: string
  date_debut: string
  date_fin: string
  motif: ResourceUnavailabilityMotif
  note: string | null
  created_at: string
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

// Même modèle que TaskDependency (type + lag), mais reliant des project_phases
// entre elles (table phase_dependencies) plutôt que des project_tasks.
export interface PhaseDependency {
  id: string
  predecessor_id: string
  successor_id: string
  type: DependencyType
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
  // Recommandation d'issue de mission (Go / Go conditionnel / No-go) — voir
  // 01-methodologie/grille-diagnostic-maturite-ia.md : un "no-go" documenté
  // est un livrable de valeur, pas un échec de mission. Null = non renseigné.
  recommandation?: Recommandation | null
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

// Grille de diagnostic de maturité IA (6 leviers, voir
// 01-methodologie/grille-diagnostic-maturite-ia.md) : 3 niveaux, SANS
// notation punitive (principe explicite de la source) — l'objectif est de
// situer un point de départ, pas de sanctionner.
// - sait_faire : compétence acquise et déployée
// - partiel : croit savoir faire (angle mort à vérifier)
// - ignore : lacune à combler avant d'investir
export type NiveauMaturite = 'sait_faire' | 'partiel' | 'ignore'
export type Recommandation = 'go' | 'go_conditionnel' | 'no_go'

export interface MaturityAssessment {
  id: string
  contact_id: string
  project_id: string | null
  date_evaluation: string
  recommandation: Recommandation | null
  niveau_strategie: NiveauMaturite
  niveau_organisation: NiveauMaturite
  niveau_personnel: NiveauMaturite
  niveau_offre: NiveauMaturite
  niveau_technologie: NiveauMaturite
  niveau_environnement: NiveauMaturite
  notes: string | null
  created_at: string
}
