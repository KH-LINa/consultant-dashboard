-- Collaborateur responsable d'un jalon (ex: qui doit préparer/présenter le
-- livrable) — jusqu'ici seules les tâches avaient un responsable_id.
alter table project_milestones
  add column if not exists responsable_id uuid references collaborateurs(id) on delete set null;
