-- Statut Go / Go conditionnel / No-go sur une mission — voir
-- 01-methodologie/grille-diagnostic-maturite-ia.md côté base de
-- connaissances Yndra : un "no-go" documenté est un livrable de valeur,
-- pas un échec de mission. Null = non renseigné (comportement actuel
-- inchangé pour les missions existantes).

alter table public.missions
  add column if not exists recommandation text
  check (recommandation in ('go', 'go_conditionnel', 'no_go'));
