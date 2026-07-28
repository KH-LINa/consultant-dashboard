-- Lien optionnel entre un collaborateur (qui peut être "responsable" d'une
-- mission/projet/tâche) et une ressource facturable (suivi d'heures/coût
-- sur des projets via resource_assignments). Les deux notions restent des
-- tables distinctes — un collaborateur n'a pas forcément de ressource liée
-- (ex. l'admin lui-même, jamais facturé à l'heure) — mais un même humain
-- peut être les deux, d'où ce lien pour éviter de ressaisir la même
-- personne deux fois sans rapport entre les deux fiches.

alter table public.collaborateurs
  add column if not exists resource_id uuid references public.resources(id) on delete set null;

-- Une ressource ne peut être liée qu'à un seul collaborateur à la fois.
create unique index if not exists idx_collaborateurs_resource_id_unique
  on public.collaborateurs(resource_id) where resource_id is not null;
