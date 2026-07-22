-- Migration : colonne completed_at sur project_tasks (déjà appliquée sur le projet).
--
-- Contexte : le nouveau sous-agent "agent-suivi-planning" calibre ses
-- diagnostics de retard sur l'historique réel des tâches terminées. Le
-- planning ne trace pas de date de complétion distincte de date_fin (qui
-- peut avoir été recalée manuellement en cas de retard) — completed_at
-- capture donc le moment RÉEL où la tâche est passée à "fait", indépendamment
-- des dates affichées dans le Gantt.
--
-- Rétroactivité : les tâches déjà "fait" avant cette migration gardent
-- completed_at = null (aucune date réelle connue) — elles sont ignorées du
-- calibrage plutôt que de leur attribuer une date inventée.

alter table public.project_tasks add column if not exists completed_at timestamptz;

create or replace function public.tache_maj_completed_at()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.statut = 'fait' and (tg_op = 'INSERT' or old.statut is distinct from 'fait') then
    new.completed_at := coalesce(new.completed_at, now());
  elsif new.statut <> 'fait' then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_tache_completed_at on public.project_tasks;
create trigger trg_tache_completed_at
  before insert or update of statut on public.project_tasks
  for each row execute function public.tache_maj_completed_at();
