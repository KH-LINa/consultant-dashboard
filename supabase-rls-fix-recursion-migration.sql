-- Corrige une récursion infinie détectée en vérification : la policy
-- collaborateur de `projects` vérifiait l'existence d'une tâche assignée en
-- lisant directement `project_tasks` (soumise à RLS), dont la policy
-- collaborateur relit `projects` (soumise à RLS) pour savoir quels projets
-- sont visibles — boucle infinie.
--
-- Fix : une fonction security definer (donc hors RLS, comme
-- current_user_role()/current_collaborateur_id()) qui fait ce test sans
-- déclencher la policy de project_tasks.

create or replace function collaborateur_has_task_in_project(p_project_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from project_tasks pt
    where pt.project_id = p_project_id
    and pt.responsable_id = current_collaborateur_id()
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
    )
  );
