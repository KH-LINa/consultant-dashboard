-- Heures optionnelles (heure_debut / heure_fin) sur project_tasks, en plus
-- des dates existantes (date_debut/date_fin, type `date`, sans heure). But :
-- affiner la détection de double-réservation d'un collaborateur ou d'une
-- ressource (voir lib/surveillance.ts) au niveau de l'heure quand elle est
-- renseignée, plutôt que de rester à la granularité du jour entier.
-- Nullable : une tâche sans heure précisée reste traitée comme "toute la
-- journée", comportement inchangé pour tout l'existant.
alter table public.project_tasks
  add column heure_debut time,
  add column heure_fin time;
