-- Dépendances entre PHASES (distinctes des dépendances entre tâches,
-- table task_dependencies) : même modèle que les tâches — type MS Project
-- (FS/SS/FF/SF) + délai en jours ouvrés (lag_days) — mais reliant des
-- project_phases entre elles plutôt que des project_tasks.
create table public.phase_dependencies (
  id uuid primary key default gen_random_uuid(),
  predecessor_id uuid not null references public.project_phases(id) on delete cascade,
  successor_id uuid not null references public.project_phases(id) on delete cascade,
  type text not null default 'FS' check (type in ('FS','SS','FF','SF')),
  lag_days integer not null default 0,
  created_at timestamptz not null default now(),
  constraint phase_dependencies_no_self check (predecessor_id <> successor_id),
  constraint phase_dependencies_predecessor_id_successor_id_key unique (predecessor_id, successor_id)
);

alter table public.phase_dependencies enable row level security;

create policy "user owns phase_dependencies" on public.phase_dependencies
  for all
  using (
    predecessor_id in (
      select ph.id from project_phases ph
      where ph.project_id in (select projects.id from projects where projects.user_id = (select auth.uid()))
    )
  )
  with check (
    predecessor_id in (
      select ph.id from project_phases ph
      where ph.project_id in (select projects.id from projects where projects.user_id = (select auth.uid()))
    )
    and successor_id in (
      select ph.id from project_phases ph
      where ph.project_id in (select projects.id from projects where projects.user_id = (select auth.uid()))
    )
  );
