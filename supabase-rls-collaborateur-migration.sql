-- Multi-rôles Admin / Manager / Collaborateur — accès restreint du rôle
-- collaborateur : lecture de ses propres projets/tâches/missions, plus mise
-- à jour du statut/avancement de ses propres tâches. Aucune policy n'est
-- ajoutée pour "collaborateur" sur les autres tables (contacts, devis,
-- factures, contrats, comptabilité, ressources, agents, settings...) —
-- elles restent donc invisibles pour ce rôle (aucune policy ne matche =
-- 0 ligne).
--
-- Astuce : les policies sur project_phases / project_milestones /
-- project_tasks se contentent de vérifier "project_id in (select id from
-- projects)" — comme la table projects a elle-même sa RLS (staff complet OU
-- collaborateur restreint), cette sous-requête est déjà filtrée aux projets
-- visibles par l'appelant, sans dupliquer la condition partout.

-- projects : visible si le collaborateur en est responsable, ou responsable
-- d'au moins une tâche du projet.
create policy "collaborateur reads own projects" on projects
  for select
  using (
    current_user_role() = 'collaborateur'
    and (
      responsable_id = current_collaborateur_id()
      or exists (
        select 1 from project_tasks pt
        where pt.project_id = projects.id
        and pt.responsable_id = current_collaborateur_id()
      )
    )
  );

create policy "collaborateur reads phases of visible projects" on project_phases
  for select
  using (current_user_role() = 'collaborateur' and project_id in (select id from projects));

create policy "collaborateur reads milestones of visible projects" on project_milestones
  for select
  using (current_user_role() = 'collaborateur' and project_id in (select id from projects));

create policy "collaborateur reads tasks of visible projects" on project_tasks
  for select
  using (current_user_role() = 'collaborateur' and project_id in (select id from projects));

create policy "collaborateur reads task_dependencies of visible projects" on task_dependencies
  for select
  using (
    current_user_role() = 'collaborateur'
    and predecessor_id in (select id from project_tasks)
  );

create policy "collaborateur reads phase_dependencies of visible projects" on phase_dependencies
  for select
  using (
    current_user_role() = 'collaborateur'
    and predecessor_id in (select id from project_phases)
  );

create policy "collaborateur reads own missions" on missions
  for select
  using (current_user_role() = 'collaborateur' and responsable_id = current_collaborateur_id());

-- Mise à jour : un collaborateur peut modifier UNIQUEMENT statut/avancement
-- sur ses propres tâches. La policy RLS ne peut pas restreindre les colonnes
-- (elle est par ligne, pas par colonne) : on l'associe donc à un trigger qui
-- bloque toute tentative de modifier une autre colonne.
create policy "collaborateur updates own tasks" on project_tasks
  for update
  using (current_user_role() = 'collaborateur' and responsable_id = current_collaborateur_id())
  with check (current_user_role() = 'collaborateur' and responsable_id = current_collaborateur_id());

create or replace function guard_collaborateur_task_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_user_role() = 'collaborateur' then
    if new.project_id is distinct from old.project_id
      or new.phase_id is distinct from old.phase_id
      or new.responsable_id is distinct from old.responsable_id
      or new.titre is distinct from old.titre
      or new.date_debut is distinct from old.date_debut
      or new.date_fin is distinct from old.date_fin
      or new.heure_debut is distinct from old.heure_debut
      or new.heure_fin is distinct from old.heure_fin
      or new.ordre is distinct from old.ordre
      or new.parent_task_id is distinct from old.parent_task_id
      or new.serie_id is distinct from old.serie_id
      or new.completed_at is distinct from old.completed_at
    then
      raise exception 'Un collaborateur ne peut modifier que le statut et l''avancement de ses tâches';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_collaborateur_task_update on project_tasks;
create trigger guard_collaborateur_task_update
  before update on project_tasks
  for each row
  execute function guard_collaborateur_task_update();
