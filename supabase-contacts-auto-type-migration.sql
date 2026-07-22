-- Migration : passage automatique du type de contact "prospect" → "client"
-- À exécuter dans Supabase SQL Editor (déjà appliquée sur le projet).
--
-- Contexte : le champ contacts.type était entièrement manuel (défini à la
-- création, modifiable via le formulaire) — un contact restait "prospect"
-- indéfiniment même après signature d'un devis ou création d'une facture.
--
-- Règle : "prospect" devient automatiquement "client" dès qu'un devis passé
-- au statut "signé" ou qu'une facture est créée pour ce contact. "inactif"
-- reste un choix manuel du consultant (jamais déduit) ; un contact déjà
-- "client" ou "inactif" n'est jamais rétrogradé.

create or replace function public.contact_devient_client()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_table_name = 'quotes' then
    if new.statut = 'signé' then
      update public.contacts set type = 'client' where id = new.contact_id and type = 'prospect';
    end if;
  elsif tg_table_name = 'invoices' then
    update public.contacts set type = 'client' where id = new.contact_id and type = 'prospect';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_quote_signed_upgrades_contact on public.quotes;
create trigger trg_quote_signed_upgrades_contact
  after insert or update of statut on public.quotes
  for each row execute function public.contact_devient_client();

drop trigger if exists trg_invoice_created_upgrades_contact on public.invoices;
create trigger trg_invoice_created_upgrades_contact
  after insert on public.invoices
  for each row execute function public.contact_devient_client();

-- Rattrapage des données existantes (contacts avec facture ou devis signé,
-- restés "prospect" faute de mise à jour manuelle).
update public.contacts c
set type = 'client'
where c.type = 'prospect'
  and (
    exists (select 1 from public.invoices i where i.contact_id = c.id)
    or exists (select 1 from public.quotes q where q.contact_id = c.id and q.statut = 'signé')
  );
