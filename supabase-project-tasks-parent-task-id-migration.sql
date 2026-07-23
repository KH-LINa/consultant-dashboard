-- Migration : sous-tâches (project_tasks.parent_task_id) — déjà appliquée.
--
-- Contexte : le Gantt imbriquait déjà les tâches sous leur phase (project_id
-- de la lib gantt-task-react). Une tâche peut désormais aussi avoir des
-- sous-tâches, imbriquées sous elle de la même façon (bouton "+" sur une
-- ligne de tâche dans le Gantt, cf. project-gantt.tsx / gantt-task-list.tsx).
--
-- parent_task_id est auto-référencée sur project_tasks, ON DELETE CASCADE
-- (supprimer une tâche supprime ses sous-tâches). Pas de garde anti-cycle en
-- base : le seul chemin de création (bouton "+" du Gantt) insère toujours une
-- ligne neuve, il ne peut donc jamais y avoir de boucle.

alter table public.project_tasks
  add column if not exists parent_task_id uuid references public.project_tasks(id) on delete cascade;

create index if not exists idx_project_tasks_parent on public.project_tasks(parent_task_id);
