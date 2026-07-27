-- Ajoute un email sur les ressources (utile pour les ressources humaines),
-- réutilisable pour préremplir l'invitation d'un compte, et un lien profiles
-- ↔ resources symétrique à profiles ↔ collaborateurs (une ressource ne peut
-- être liée qu'à un seul compte de connexion).

alter table resources add column if not exists email text;

alter table profiles add column if not exists resource_id uuid references resources(id) on delete set null;

create unique index if not exists profiles_resource_id_uniq
  on profiles(resource_id) where resource_id is not null;
