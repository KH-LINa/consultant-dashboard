-- Calendrier de disponibilité des ressources : périodes où une ressource
-- (humaine ou matérielle, table resources) n'est PAS disponible, avec un
-- motif catégorisé (absent / congé / maladie / autre) — affiché en calendrier
-- filtrable dans le module Ressources.
create table public.resource_unavailability (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.resources(id) on delete cascade,
  date_debut date not null,
  date_fin date not null,
  motif text not null default 'autre' check (motif in ('absent','conge','maladie','autre')),
  note text,
  created_at timestamptz not null default now(),
  constraint resource_unavailability_dates_check check (date_fin >= date_debut)
);

alter table public.resource_unavailability enable row level security;

create policy "user owns resource_unavailability" on public.resource_unavailability
  for all
  using (
    resource_id in (select r.id from resources r where r.user_id = (select auth.uid()))
  )
  with check (
    resource_id in (select r.id from resources r where r.user_id = (select auth.uid()))
  );
