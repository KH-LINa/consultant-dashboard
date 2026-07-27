-- Notifications d'événements pour la cloche en en-tête : nouvelle tâche
-- assignée à un collaborateur, ou planning (dates) modifié sur une tâche
-- déjà assignée. Table personnelle (un destinataire = un profil), générée
-- automatiquement par un trigger sur project_tasks — pas d'insertion
-- directe côté client.

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  type text not null check (type in ('tache_assignee', 'planning_modifie')),
  titre text not null,
  message text,
  lien text,
  task_id uuid references project_tasks(id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_profile_id_idx on notifications(profile_id, read_at, created_at desc);

alter table notifications enable row level security;

-- Chacun ne voit que ses propres notifications.
create policy "own notifications are readable" on notifications
  for select
  using (profile_id = (select auth.uid()));

-- Chacun peut marquer ses propres notifications comme lues (UPDATE read_at
-- uniquement en pratique — la colonne read_at est la seule que le client
-- modifie, mais rien n'empêche techniquement d'autres colonnes ; comme la
-- ligne lui appartient déjà, ce n'est pas un problème d'exposition).
create policy "mark own notifications as read" on notifications
  for update
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

-- Aucune policy INSERT/DELETE pour les utilisateurs : seul le trigger
-- (security definer, ci-dessous) crée des notifications.

create or replace function notify_task_assignment_and_planning()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_projet_titre text;
begin
  if tg_op = 'INSERT' then
    if new.responsable_id is not null then
      select id into v_profile_id from profiles where collaborateur_id = new.responsable_id;
      if v_profile_id is not null then
        select titre into v_projet_titre from projects where id = new.project_id;
        insert into notifications (profile_id, type, titre, message, lien, task_id)
        values (v_profile_id, 'tache_assignee', 'Nouvelle tâche assignée', coalesce(v_projet_titre, new.titre), '/mon-planning', new.id);
      end if;
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    -- Nouveau responsable (différent de l'ancien, y compris depuis null) : assignation.
    if new.responsable_id is distinct from old.responsable_id and new.responsable_id is not null then
      select id into v_profile_id from profiles where collaborateur_id = new.responsable_id;
      if v_profile_id is not null then
        select titre into v_projet_titre from projects where id = new.project_id;
        insert into notifications (profile_id, type, titre, message, lien, task_id)
        values (v_profile_id, 'tache_assignee', 'Nouvelle tâche assignée', coalesce(v_projet_titre, new.titre), '/mon-planning', new.id);
      end if;
    -- Même responsable, mais dates changées : planning modifié.
    elsif new.responsable_id is not null and new.responsable_id = old.responsable_id
      and (new.date_debut is distinct from old.date_debut or new.date_fin is distinct from old.date_fin) then
      select id into v_profile_id from profiles where collaborateur_id = new.responsable_id;
      if v_profile_id is not null then
        select titre into v_projet_titre from projects where id = new.project_id;
        insert into notifications (profile_id, type, titre, message, lien, task_id)
        values (v_profile_id, 'planning_modifie', 'Planning modifié : ' || new.titre, v_projet_titre, '/mon-planning', new.id);
      end if;
    end if;
    return new;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_notify_task_assignment on project_tasks;
create trigger trg_notify_task_assignment
  after insert or update on project_tasks
  for each row
  execute function notify_task_assignment_and_planning();
