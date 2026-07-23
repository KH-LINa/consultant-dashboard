-- Migration : type de lien et délai (lag) sur les dépendances — déjà appliquée.
--
-- Les dépendances entre tâches portaient jusqu'ici uniquement une relation
-- fin→début implicite. On ajoute :
-- - type : le type de lien MS Project (FS/SS/FF/SF = FD/DD/FF/DF). Défaut FS
--   (fin→début), rétrocompatible avec les dépendances existantes.
-- - lag_days : délai (positif) ou avance (négatif) en jours OUVRÉS appliqué à
--   la contrainte (ex. FS +2 = le successeur démarre 2 jours ouvrés après la
--   fin du prérequis ; FS -1 = chevauchement d'un jour).
--
-- La sémantique de chaque type et le calcul en jours ouvrés sont implémentés
-- côté application (src/lib/gantt-deps.ts + src/lib/jours-ouvres.ts), testés
-- par vitest (src/lib/*.test.ts).

alter table public.task_dependencies
  add column if not exists type text not null default 'FS' check (type in ('FS','SS','FF','SF')),
  add column if not exists lag_days int not null default 0;
