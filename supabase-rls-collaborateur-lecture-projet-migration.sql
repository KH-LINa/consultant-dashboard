-- Donne à un collaborateur un accès en LECTURE SEULE à l'intégralité des
-- informations des projets qui le concernent (où il a une tâche, une
-- mission, ou une affectation ressource) — pas seulement ses propres
-- tâches comme c'était le cas depuis le resserrement de sécurité précédent.
-- L'écriture reste strictement limitée au statut/avancement de ses PROPRES
-- tâches (policy "collaborateur updates own tasks" + trigger de garde-fou,
-- tous deux inchangés).

-- project_tasks : SELECT élargi à toutes les tâches d'un projet visible
-- (au lieu de "responsable_id = current_collaborateur_id()" uniquement).
drop policy if exists "collaborateur reads own tasks" on project_tasks;
create policy "collaborateur reads tasks of visible projects" on project_tasks
  for select
  using (current_user_role() = 'collaborateur' and project_id in (select id from projects));

-- Phases / jalons / dépendances : de nouveau visibles (retirés lors du
-- resserrement de sécurité car "Mon planning" ne les utilisait pas encore —
-- ils sont maintenant nécessaires à la vue "planning complet" du projet).
create policy "collaborateur reads phases of visible projects" on project_phases
  for select
  using (current_user_role() = 'collaborateur' and project_id in (select id from projects));

create policy "collaborateur reads milestones of visible projects" on project_milestones
  for select
  using (current_user_role() = 'collaborateur' and project_id in (select id from projects));

create policy "collaborateur reads task_dependencies of visible projects" on task_dependencies
  for select
  using (current_user_role() = 'collaborateur' and predecessor_id in (select id from project_tasks));

create policy "collaborateur reads phase_dependencies of visible projects" on phase_dependencies
  for select
  using (current_user_role() = 'collaborateur' and predecessor_id in (select id from project_phases));

-- collaborateurs : un collaborateur doit pouvoir voir le NOM des autres
-- collaborateurs assignés sur un projet qui le concerne (ex. "responsable :
-- Lina" sur une tâche qui n'est pas la sienne) — scopé aux seuls
-- collaborateurs partageant un projet visible avec lui, pas un annuaire
-- complet de l'entreprise.
create policy "collaborateur reads collaborateurs on shared visible projects" on collaborateurs
  for select
  using (
    current_user_role() = 'collaborateur'
    and (
      id = current_collaborateur_id()
      or exists (
        select 1 from project_tasks pt
        where pt.responsable_id = collaborateurs.id
        and pt.project_id in (select id from projects)
      )
      or exists (
        select 1 from missions m
        where m.responsable_id = collaborateurs.id
        and m.project_id in (select id from projects)
      )
    )
  );
