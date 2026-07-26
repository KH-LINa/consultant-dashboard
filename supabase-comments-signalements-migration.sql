-- Deux nouveaux canaux de communication terrain → bureau :
--   1. task_comments  : fil de commentaires sur une tâche (ex. cause d'un
--      retard ou d'un blocage) — lisible par le staff (admin/manager) et par
--      tout collaborateur ayant accès en lecture à cette tâche (cf. migration
--      lecture-seule-projet précédente).
--   2. signalements   : événement libre signalé par un utilisateur (imprévu,
--      retard trajet, problème matériel...), optionnellement lié à une tâche,
--      toujours notifié à l'ensemble du staff (admin/manager).
-- Les deux tables déclenchent une notification (table notifications déjà en
-- place) : commentaire d'un collaborateur → notifie le staff ; commentaire du
-- staff → notifie le collaborateur responsable de la tâche.

create table if not exists task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references project_tasks(id) on delete cascade,
  auteur_id uuid not null references profiles(id) on delete cascade,
  -- Dénormalisé au moment de l'insertion (trigger ci-dessous) : évite un join
  -- vers profiles, que la RLS de profiles (accès à son propre profil
  -- uniquement pour un collaborateur) empêcherait pour les commentaires
  -- d'un autre auteur.
  auteur_nom text not null,
  contenu text not null,
  created_at timestamptz not null default now()
);

create index if not exists task_comments_task_id_idx on task_comments(task_id, created_at);

alter table task_comments enable row level security;

create policy "admin manager read all task_comments" on task_comments
  for select
  using (current_user_role() in ('admin', 'manager'));

create policy "collaborateur reads comments on visible tasks" on task_comments
  for select
  using (current_user_role() = 'collaborateur' and task_id in (select id from project_tasks));

-- Auteur toujours = l'appelant (jamais un tiers), quel que soit son rôle ;
-- un collaborateur ne peut commenter que sur une tâche qu'il peut voir.
create policy "authenticated inserts own comment on visible task" on task_comments
  for insert
  with check (
    auteur_id = (select auth.uid())
    and (
      current_user_role() in ('admin', 'manager')
      or task_id in (select id from project_tasks)
    )
  );

create policy "author or admin deletes comment" on task_comments
  for delete
  using (auteur_id = (select auth.uid()) or current_user_role() = 'admin');

create table if not exists signalements (
  id uuid primary key default gen_random_uuid(),
  auteur_id uuid not null references profiles(id) on delete cascade,
  auteur_nom text not null,
  type text not null check (type in ('retard', 'imprevu', 'blocage', 'materiel', 'autre')),
  titre text not null,
  message text not null,
  task_id uuid references project_tasks(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists signalements_auteur_id_idx on signalements(auteur_id, created_at desc);

alter table signalements enable row level security;

create policy "admin manager read all signalements" on signalements
  for select
  using (current_user_role() in ('admin', 'manager'));

create policy "auteur reads own signalements" on signalements
  for select
  using (auteur_id = (select auth.uid()));

create policy "authenticated creates own signalement" on signalements
  for insert
  with check (auteur_id = (select auth.uid()));

-- Dénormalise auteur_nom depuis profiles à l'insertion (utilisé par les deux
-- tables ci-dessus — auteur_id = auth.uid() est garanti par les policies
-- INSERT, donc la lecture de "son propre" profil est toujours autorisée par
-- la RLS de profiles, même pour un collaborateur).
create or replace function set_auteur_nom()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select nom into new.auteur_nom from profiles where id = new.auteur_id;
  return new;
end;
$$;

drop trigger if exists trg_set_auteur_nom_task_comments on task_comments;
create trigger trg_set_auteur_nom_task_comments
  before insert on task_comments
  for each row
  execute function set_auteur_nom();

drop trigger if exists trg_set_auteur_nom_signalements on signalements;
create trigger trg_set_auteur_nom_signalements
  before insert on signalements
  for each row
  execute function set_auteur_nom();

-- Élargit les types de notifications existants.
alter table notifications drop constraint if exists notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in ('tache_assignee', 'planning_modifie', 'commentaire_tache', 'signalement'));

create or replace function notify_new_task_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task_titre text;
  v_project_id uuid;
  v_responsable_collab_id uuid;
  v_auteur_role text;
  v_dest_profile_id uuid;
  v_staff record;
begin
  select titre, project_id, responsable_id into v_task_titre, v_project_id, v_responsable_collab_id
  from project_tasks where id = new.task_id;
  select role into v_auteur_role from profiles where id = new.auteur_id;

  if v_auteur_role = 'collaborateur' then
    -- Un collaborateur commente : notifie tout le staff (admin/manager).
    for v_staff in select id from profiles where role in ('admin', 'manager') loop
      insert into notifications (profile_id, type, titre, message, lien, task_id)
      values (
        v_staff.id, 'commentaire_tache',
        'Commentaire de ' || new.auteur_nom || ' sur « ' || coalesce(v_task_titre, 'une tâche') || ' »',
        left(new.contenu, 200), '/projets/' || v_project_id, new.task_id
      );
    end loop;
  else
    -- Le staff commente : notifie le collaborateur responsable (si lié à un
    -- compte et différent de l'auteur).
    if v_responsable_collab_id is not null then
      select id into v_dest_profile_id from profiles
      where collaborateur_id = v_responsable_collab_id and id <> new.auteur_id;
      if v_dest_profile_id is not null then
        insert into notifications (profile_id, type, titre, message, lien, task_id)
        values (
          v_dest_profile_id, 'commentaire_tache',
          'Nouveau commentaire sur « ' || coalesce(v_task_titre, 'une tâche') || ' »',
          left(new.contenu, 200), '/mon-planning', new.task_id
        );
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notify_new_task_comment on task_comments;
create trigger trg_notify_new_task_comment
  after insert on task_comments
  for each row
  execute function notify_new_task_comment();

create or replace function notify_new_signalement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type_label text;
  v_lien text;
  v_staff record;
begin
  v_type_label := case new.type
    when 'retard' then 'Retard signalé'
    when 'imprevu' then 'Imprévu signalé'
    when 'blocage' then 'Blocage signalé'
    when 'materiel' then 'Problème matériel signalé'
    else 'Événement signalé'
  end;

  v_lien := null;
  if new.task_id is not null then
    select '/projets/' || project_id into v_lien from project_tasks where id = new.task_id;
  end if;

  for v_staff in select id from profiles where role in ('admin', 'manager') and id <> new.auteur_id loop
    insert into notifications (profile_id, type, titre, message, lien, task_id)
    values (
      v_staff.id, 'signalement',
      v_type_label || ' par ' || new.auteur_nom || ' — ' || new.titre,
      new.message, v_lien, new.task_id
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_notify_new_signalement on signalements;
create trigger trg_notify_new_signalement
  after insert on signalements
  for each row
  execute function notify_new_signalement();
