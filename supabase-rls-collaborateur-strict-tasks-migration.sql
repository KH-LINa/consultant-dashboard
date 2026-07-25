-- Resserrement de la visibilité collaborateur (revue de sécurité) :
-- un collaborateur ne doit voir QUE ses propres tâches (responsable_id), pas
-- toutes celles des projets où il est rattaché. On remplace donc la policy
-- SELECT de project_tasks (scope projet -> scope assigné) et on retire les
-- policies collaborateur sur phases/jalons/dépendances, que la page
-- "Mon planning" n'utilise pas (elle ne lit que project_tasks filtrées par
-- responsable_id, missions, resource_assignments/unavailability). Ne rien
-- exposer qui ne serve pas = surface minimale.
--
-- Conservé tel quel (nécessaire aux jointures de titres de projet) :
--   - "collaborateur reads own projects" on projects
--   - "collaborateur reads own missions" on missions
--   - "collaborateur reads own resource_assignments/unavailability"
--   - "collaborateur updates own tasks" on project_tasks (UPDATE, déjà scopé assigné)

-- project_tasks : SELECT limité à ses propres tâches.
drop policy if exists "collaborateur reads tasks of visible projects" on project_tasks;
create policy "collaborateur reads own tasks" on project_tasks
  for select
  using (current_user_role() = 'collaborateur' and responsable_id = current_collaborateur_id());

-- phases / jalons / dépendances : plus aucune policy collaborateur
-- (0 ligne visible pour ce rôle — non utilisé par son UI).
drop policy if exists "collaborateur reads phases of visible projects" on project_phases;
drop policy if exists "collaborateur reads milestones of visible projects" on project_milestones;
drop policy if exists "collaborateur reads task_dependencies of visible projects" on task_dependencies;
drop policy if exists "collaborateur reads phase_dependencies of visible projects" on phase_dependencies;
