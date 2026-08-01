-- Calendrier de disponibilité des COLLABORATEURS : périodes où un
-- collaborateur n'est pas disponible (congé, maladie, absence...), avec un
-- motif catégorisé — même vocabulaire que resource_unavailability, mais
-- table distincte : un collaborateur non facturé (sans resource_id lié) a
-- quand même besoin d'un calendrier, même raison que cout_horaire déjà
-- dupliqué sur collaborateurs (voir supabase-collaborateurs-resource-link-migration.sql).

create table public.collaborateur_unavailability (
  id uuid primary key default gen_random_uuid(),
  collaborateur_id uuid not null references public.collaborateurs(id) on delete cascade,
  date_debut date not null,
  date_fin date not null,
  motif text not null default 'autre' check (motif in ('absent','conge','maladie','autre')),
  note text,
  created_at timestamptz not null default now(),
  constraint collaborateur_unavailability_dates_check check (date_fin >= date_debut)
);

create index collaborateur_unavailability_collaborateur_id_idx
  on public.collaborateur_unavailability(collaborateur_id);

alter table public.collaborateur_unavailability enable row level security;

-- Admin/manager : accès complet (même convention que "staff full access on ...").
create policy "staff full access on collaborateur_unavailability" on public.collaborateur_unavailability
  for all using (current_user_role() in ('admin', 'manager'))
  with check (current_user_role() in ('admin', 'manager'));

-- Un collaborateur voit son propre calendrier, lecture seule — même
-- fonction current_collaborateur_id() que le reste des policies "collaborateur".
create policy "collaborateur reads own collaborateur_unavailability" on public.collaborateur_unavailability
  for select
  using (current_user_role() = 'collaborateur' and collaborateur_id = current_collaborateur_id());
