-- Migration : gestion de série pour les tâches récurrentes — déjà appliquée.
--
-- Contexte : le formulaire d'ajout rapide du Gantt peut créer plusieurs
-- occurrences d'une tâche récurrente (chaque semaine/mois × N). serie_id
-- regroupe ces occurrences pour permettre une suppression groupée (bouton
-- "Série (n)" dans le panneau Tâches) sans avoir à les sélectionner une par
-- une. Null pour une tâche isolée (créée hors récurrence).

alter table public.project_tasks
  add column if not exists serie_id uuid;

create index if not exists idx_project_tasks_serie on public.project_tasks(serie_id);
