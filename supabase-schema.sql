-- Phase 1 : Schéma Supabase pour consultant IA auto-entrepreneur

-- Table contacts
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('prospect', 'client', 'inactif')) default 'prospect',
  nom text not null,
  email text,
  telephone text,
  entreprise text,
  notes text,
  created_at timestamptz not null default now()
);

-- Table quotes (devis)
create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  titre text not null,
  offre text not null check (offre in ('consulting', 'automatisation', 'solution_globale')),
  montant_ht numeric(10,2) not null default 0,
  statut text not null check (statut in ('brouillon', 'envoyé', 'signé', 'refusé', 'expiré')) default 'brouillon',
  lignes jsonb not null default '[]'::jsonb,
  public_token uuid not null default gen_random_uuid() unique,
  response_at timestamptz,
  response_comment text,
  created_at timestamptz not null default now()
);

-- Table settings (configuration du consultant)
create table if not exists public.settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);

-- Table invoices (factures)
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique,
  quote_id uuid references public.quotes(id) on delete set null,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  titre text not null,
  offre text not null check (offre in ('consulting', 'automatisation', 'solution_globale')),
  montant_ht numeric(10,2) not null default 0,
  statut text not null check (statut in ('brouillon', 'envoyée', 'payée', 'annulée')) default 'brouillon',
  lignes jsonb not null default '[]'::jsonb,
  notes text,
  date_emission date not null default current_date,
  date_echeance date,
  created_at timestamptz not null default now()
);

-- Table reminders (relances)
create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('devis', 'facture')),
  document_id uuid not null,
  contact_id uuid references public.contacts(id) on delete set null,
  email_to text not null,
  niveau integer not null default 0,
  sent_at timestamptz not null default now()
);

-- Table quote_messages (réponses emails)
create table if not exists public.quote_messages (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  expediteur text not null,
  sujet text,
  contenu text,
  received_at timestamptz not null default now()
);

-- Table missions
create table if not exists public.missions (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  quote_id uuid references public.quotes(id) on delete set null,
  titre text not null,
  description text,
  statut text not null check (statut in ('a_demarrer', 'en_cours', 'en_pause', 'terminee', 'annulee')) default 'a_demarrer',
  budget_ht numeric(10,2) not null default 0,
  date_debut date,
  date_fin_prevue date,
  created_at timestamptz not null default now()
);

-- Table mission_tasks
create table if not exists public.mission_tasks (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions(id) on delete cascade,
  titre text not null,
  done boolean not null default false,
  temps_passe numeric(10,2) not null default 0,
  ordre integer not null default 0,
  created_at timestamptz not null default now()
);

-- Table documents
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  chemin text not null,
  taille integer,
  type_mime text,
  contact_id uuid references public.contacts(id) on delete set null,
  mission_id uuid references public.missions(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Index pour les recherches fréquentes
create index if not exists idx_contacts_type on public.contacts(type);
create index if not exists idx_quotes_contact_id on public.quotes(contact_id);
create index if not exists idx_quotes_statut on public.quotes(statut);
create index if not exists idx_quotes_public_token on public.quotes(public_token);
create index if not exists idx_invoices_contact_id on public.invoices(contact_id);
create index if not exists idx_invoices_statut on public.invoices(statut);
create index if not exists idx_reminders_doc_id on public.reminders(document_id);
create index if not exists idx_quote_messages_quote_id on public.quote_messages(quote_id);
create index if not exists idx_missions_contact_id on public.missions(contact_id);
create index if not exists idx_mission_tasks_mission_id on public.mission_tasks(mission_id);
create index if not exists idx_documents_contact_mission on public.documents(contact_id, mission_id);

-- Row Level Security (RLS) : accès réservé aux utilisateurs authentifiés par défaut
alter table public.contacts enable row level security;
alter table public.quotes enable row level security;
alter table public.settings enable row level security;
alter table public.invoices enable row level security;
alter table public.reminders enable row level security;
alter table public.quote_messages enable row level security;
alter table public.missions enable row level security;
alter table public.mission_tasks enable row level security;
alter table public.documents enable row level security;

create policy "authenticated users can manage contacts" on public.contacts for all to authenticated using (true) with check (true);
create policy "authenticated users can manage quotes" on public.quotes for all to authenticated using (true) with check (true);
create policy "authenticated users can manage settings" on public.settings for all to authenticated using (true) with check (true);
create policy "authenticated users can manage invoices" on public.invoices for all to authenticated using (true) with check (true);
create policy "authenticated users can manage reminders" on public.reminders for all to authenticated using (true) with check (true);
create policy "authenticated users can manage quote_messages" on public.quote_messages for all to authenticated using (true) with check (true);
create policy "authenticated users can manage missions" on public.missions for all to authenticated using (true) with check (true);
create policy "authenticated users can manage mission_tasks" on public.mission_tasks for all to authenticated using (true) with check (true);
create policy "authenticated users can manage documents" on public.documents for all to authenticated using (true) with check (true);

-- Note sur le stockage Supabase :
-- L'application utilise un bucket de stockage nommé 'documents'.
-- Assurez-vous de créer ce bucket et d'activer l'accès pour les utilisateurs authentifiés.

-- --- Fonctions RPC (Security Definer pour contourner RLS sur les pages publiques / webhooks) ---

-- 1. Récupérer un devis via son token public (Page publique accepter)
create or replace function public.get_quote_by_token(p_token uuid)
returns table (
  id uuid,
  titre text,
  offre text,
  montant_ht numeric,
  statut text,
  lignes jsonb,
  created_at timestamptz,
  response_at timestamptz,
  response_comment text,
  contact_nom text,
  contact_entreprise text,
  consultant_nom text,
  consultant_siret text
) language plpgsql security definer as $$
begin
  return query
  select 
    q.id,
    q.titre,
    q.offre,
    q.montant_ht,
    q.statut,
    q.lignes,
    q.created_at,
    q.response_at,
    q.response_comment,
    c.nom as contact_nom,
    c.entreprise as contact_entreprise,
    coalesce((select value from public.settings where key = 'consultant_nom'), 'Votre Nom') as consultant_nom,
    coalesce((select value from public.settings where key = 'consultant_siret'), '000 000 000 00000') as consultant_siret
  from public.quotes q
  join public.contacts c on q.contact_id = c.id
  where q.public_token = p_token;
end;
$$;

-- 2. Répondre à un devis (Page publique accepter)
create or replace function public.respond_to_quote(
  p_token uuid,
  p_decision text,
  p_comment text
) returns jsonb language plpgsql security definer as $$
declare
  v_quote_id uuid;
  v_statut text;
begin
  -- Récupérer le devis
  select id, statut into v_quote_id, v_statut
  from public.quotes
  where public_token = p_token;

  if v_quote_id is null then
    return jsonb_build_object('error', 'not_found');
  end if;

  -- Vérifier si déjà répondu
  if v_statut in ('signé', 'refusé') then
    return jsonb_build_object('error', 'already_responded', 'statut', v_statut);
  end if;

  -- Mettre à jour le devis
  update public.quotes
  set 
    statut = p_decision,
    response_at = now(),
    response_comment = nullif(trim(p_comment), '')
  where id = v_quote_id;

  return jsonb_build_object('success', true);
end;
$$;

-- 3. Ajouter une réponse email entrante (Webhook Inbound)
create or replace function public.add_quote_message(
  p_token uuid,
  p_expediteur text,
  p_sujet text,
  p_contenu text
) returns jsonb language plpgsql security definer as $$
declare
  v_quote_id uuid;
begin
  -- Récupérer le devis correspondant
  select id into v_quote_id
  from public.quotes
  where public_token = p_token;

  if v_quote_id is null then
    return jsonb_build_object('error', 'not_found');
  end if;

  -- Insérer le message
  insert into public.quote_messages (quote_id, expediteur, sujet, contenu)
  values (v_quote_id, p_expediteur, p_sujet, p_contenu);

  return jsonb_build_object('success', true);
end;
$$;
