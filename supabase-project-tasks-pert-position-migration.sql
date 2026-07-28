-- Position manuelle des tâches dans la vue PERT (glisser-déposer).
-- null = disposition automatique (colonnes par profondeur de dépendance,
-- comportement actuel de pert-view.tsx), valeurs renseignées = position
-- fixée manuellement par l'utilisateur, prioritaire sur le calcul auto.

alter table project_tasks
  add column if not exists pert_x integer,
  add column if not exists pert_y integer;
