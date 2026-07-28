-- Étend le profil collaborateur : téléphone, identifiant lisible
-- auto-généré (même principe que contacts.code_client), notes libres, et
-- statut actif/inactif (un ex-collaborateur reste visible pour préserver
-- son historique de missions/projets, mais distingué visuellement plutôt
-- que supprimé).

alter table public.collaborateurs
  add column if not exists telephone text,
  add column if not exists code_collaborateur text unique,
  add column if not exists notes text,
  add column if not exists actif boolean not null default true;

create sequence if not exists public.collaborateur_code_seq start with 1;

create or replace function public.assign_code_collaborateur()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.code_collaborateur is null then
    new.code_collaborateur := 'COL-' || lpad(nextval('public.collaborateur_code_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_assign_code_collaborateur on public.collaborateurs;
create trigger trg_assign_code_collaborateur
  before insert on public.collaborateurs
  for each row execute function public.assign_code_collaborateur();

-- Rattrapage des collaborateurs existants sans code, dans l'ordre de création.
do $$
declare
  r record;
begin
  for r in
    select id from public.collaborateurs
    where code_collaborateur is null
    order by created_at asc
  loop
    update public.collaborateurs
    set code_collaborateur = 'COL-' || lpad(nextval('public.collaborateur_code_seq')::text, 4, '0')
    where id = r.id;
  end loop;
end $$;
