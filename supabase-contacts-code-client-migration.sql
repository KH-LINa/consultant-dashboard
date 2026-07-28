-- Identifiant client lisible ("CLI-0001"), attribué automatiquement dès
-- qu'un contact passe au type "client" — que ce soit via le trigger
-- existant (devis signé / facture émise, voir
-- supabase-contacts-auto-type-migration.sql) ou via une modification
-- manuelle du type dans le formulaire contact. Jamais réattribué une fois
-- défini (le trigger ne touche que les lignes où code_client est encore
-- nul), et jamais retiré si le contact repasse (manuellement) à un autre
-- type — c'est une référence permanente, pas un statut.

alter table public.contacts add column if not exists code_client text unique;

create sequence if not exists public.client_code_seq start with 1;

create or replace function public.assign_code_client()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.type = 'client' and new.code_client is null then
    new.code_client := 'CLI-' || lpad(nextval('public.client_code_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_assign_code_client on public.contacts;
create trigger trg_assign_code_client
  before insert or update of type on public.contacts
  for each row execute function public.assign_code_client();

-- Rattrapage des clients existants sans code, dans l'ordre de création
-- (pour que les codes reflètent grossièrement l'ancienneté du client).
do $$
declare
  r record;
begin
  for r in
    select id from public.contacts
    where type = 'client' and code_client is null
    order by created_at asc
  loop
    update public.contacts
    set code_client = 'CLI-' || lpad(nextval('public.client_code_seq')::text, 4, '0')
    where id = r.id;
  end loop;
end $$;
