-- Migration : module Ressources (humaines et matérielles) — déjà appliquée.
--
-- Deux tables, alignées sur le modèle RLS de propriété du projet :
-- - resources : ressources du consultant (humain ou matériel), avec un coût
--   horaire optionnel (0 = non chiffré). Distinct de `collaborateurs` (qui
--   sert aux responsables de tâches) : une ressource peut être une machine,
--   une licence, un prestataire…
-- - resource_assignments : affectation d'une ressource à un projet (et
--   optionnellement une tâche précise), avec des heures et/ou un budget.
--   Le coût estimé affiché = heures × cout_horaire + budget.
--
-- RLS : resources par user_id ; resource_assignments par propriété de la
-- ressource (même principe transitif que project_phases via projects).

create table if not exists public.resources (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  nom           text        not null,
  type          text        not null check (type in ('humain', 'materiel')) default 'humain',
  cout_horaire  numeric     not null default 0,
  notes         text,
  created_at    timestamptz not null default now()
);

create table if not exists public.resource_assignments (
  id           uuid        primary key default gen_random_uuid(),
  resource_id  uuid        not null references public.resources(id) on delete cascade,
  project_id   uuid        not null references public.projects(id) on delete cascade,
  task_id      uuid        references public.project_tasks(id) on delete cascade,
  heures       numeric     not null default 0,
  budget       numeric     not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists idx_resources_user on public.resources(user_id);
create index if not exists idx_resource_assignments_resource on public.resource_assignments(resource_id);
create index if not exists idx_resource_assignments_project on public.resource_assignments(project_id);

alter table public.resources enable row level security;
alter table public.resource_assignments enable row level security;

drop policy if exists "user owns resources" on public.resources;
create policy "user owns resources"
  on public.resources for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "user owns resource_assignments" on public.resource_assignments;
create policy "user owns resource_assignments"
  on public.resource_assignments for all
  using (resource_id in (select id from public.resources where user_id = (select auth.uid())))
  with check (resource_id in (select id from public.resources where user_id = (select auth.uid())));
