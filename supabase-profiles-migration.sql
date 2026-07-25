-- Multi-rôles Admin / Manager / Collaborateur — table profiles + fonctions RLS
--
-- Un "profile" relie un compte Supabase Auth (auth.users) à un rôle applicatif
-- (admin / manager / collaborateur) et, pour un collaborateur, à sa fiche
-- collaborateurs existante (celle utilisée comme responsable_id sur les
-- projets/tâches/missions) — c'est ce lien qui rend visibles les tâches déjà
-- assignées à cette personne dès la création de son compte de connexion.

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  nom text not null,
  role text not null check (role in ('admin', 'manager', 'collaborateur')),
  collaborateur_id uuid references collaborateurs(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Un collaborateur (fiche métier) ne peut être lié qu'à un seul compte de connexion.
create unique index if not exists profiles_collaborateur_id_uniq
  on profiles(collaborateur_id) where collaborateur_id is not null;

alter table profiles enable row level security;

-- Chacun voit son propre profil (nécessaire pour que middleware/layout
-- puissent lire le rôle une fois connecté, avant même toute policy "admin").
create policy "own profile is readable" on profiles
  for select
  using (id = (select auth.uid()));

-- Fonctions security definer : lisent profiles en contournant sa propre RLS,
-- pour être utilisées sans récursion dans les policies des AUTRES tables.
create or replace function current_user_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function current_collaborateur_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select collaborateur_id from profiles where id = auth.uid();
$$;

-- Seul un admin peut gérer les comptes (inviter, changer un rôle, révoquer).
create policy "admin manages profiles" on profiles
  for all
  using (current_user_role() = 'admin')
  with check (current_user_role() = 'admin');

-- Backfill : le compte existant devient le premier Admin.
insert into profiles (id, email, nom, role)
select id, email, coalesce(raw_user_meta_data->>'nom', split_part(email, '@', 1)), 'admin'
from auth.users
where email = 'k.fedila@gmail.com'
on conflict (id) do nothing;
