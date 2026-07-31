-- Rapproche la fiche collaborateur d'une fiche "salarié" : date d'entrée,
-- type de contrat, coût horaire (indépendant du lien vers une Ressource
-- facturable — un collaborateur non facturé a quand même un coût réel pour
-- l'entreprise), compétences (tags libres) et photo de profil.

alter table public.collaborateurs
  add column if not exists date_entree date,
  add column if not exists type_contrat text check (type_contrat in ('CDI', 'CDD', 'Freelance', 'Alternance', 'Stage')),
  add column if not exists cout_horaire numeric not null default 0,
  add column if not exists competences text[] not null default '{}',
  add column if not exists photo_url text;

-- Bucket public dédié aux photos de profil : contrairement à documents/
-- contracts (privés, URL signée à la demande), une photo doit s'afficher en
-- continu dans plusieurs vues (trombinoscope, listes...) sans regénérer une
-- URL signée à chaque rendu — et n'est pas une donnée sensible comme un
-- contrat ou un document interne.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Même convention que documents/contracts : accès par bucket, sans
-- vérification de rôle supplémentaire (les pages qui exposent l'upload —
-- /collaborateurs — sont déjà réservées à l'admin/manager côté navigation ;
-- un collaborateur n'a de toute façon pas accès à cette page).
create policy "authenticated read avatars bucket" on storage.objects
  for select
  using (bucket_id = 'avatars');

create policy "authenticated insert avatars bucket" on storage.objects
  for insert
  with check (bucket_id = 'avatars');

create policy "authenticated delete avatars bucket" on storage.objects
  for delete
  using (bucket_id = 'avatars');
