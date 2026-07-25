-- Débloque la visibilité d'un collaborateur sur ses propres affectations de
-- ressources (resource_assignments) et son propre calendrier de
-- disponibilité (resource_unavailability), quand son profil est lié à une
-- fiche resources (profiles.resource_id). Lecture seule — pas de nouvelle
-- capacité d'écriture.

create or replace function current_resource_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select resource_id from profiles where id = auth.uid();
$$;

create policy "collaborateur reads own resource_assignments" on resource_assignments
  for select
  using (current_user_role() = 'collaborateur' and resource_id = current_resource_id());

create policy "collaborateur reads own resource_unavailability" on resource_unavailability
  for select
  using (current_user_role() = 'collaborateur' and resource_id = current_resource_id());

-- Étend la visibilité de `projects` aux projets où le collaborateur a une
-- affectation de ressource (sans quoi la jointure project:projects(titre)
-- depuis resource_assignments renverrait un projet "invisible" = null).
create or replace function collaborateur_has_resource_assignment_in_project(p_project_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from resource_assignments ra
    where ra.project_id = p_project_id
    and ra.resource_id = current_resource_id()
  );
$$;

drop policy if exists "collaborateur reads own projects" on projects;
create policy "collaborateur reads own projects" on projects
  for select
  using (
    current_user_role() = 'collaborateur'
    and (
      responsable_id = current_collaborateur_id()
      or collaborateur_has_task_in_project(projects.id)
      or collaborateur_has_resource_assignment_in_project(projects.id)
    )
  );
