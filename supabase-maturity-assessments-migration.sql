-- Grille de diagnostic de maturité IA (6 leviers), voir
-- 01-methodologie/grille-diagnostic-maturite-ia.md côté base de connaissances
-- Yndra. Permet de suivre, par client, la préparation organisationnelle
-- dans le temps — pas seulement un rapport d'audit isolé en PDF.
--
-- Niveaux SANS notation punitive (principe explicite de la source) :
-- sait_faire (compétence acquise et déployée), partiel (croit savoir faire,
-- angle mort), ignore (lacune à combler avant d'investir).

create table if not exists public.maturity_assessments (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  date_evaluation date not null default current_date,
  recommandation text check (recommandation in ('go', 'go_conditionnel', 'no_go')),
  niveau_strategie text not null check (niveau_strategie in ('sait_faire', 'partiel', 'ignore')),
  niveau_organisation text not null check (niveau_organisation in ('sait_faire', 'partiel', 'ignore')),
  niveau_personnel text not null check (niveau_personnel in ('sait_faire', 'partiel', 'ignore')),
  niveau_offre text not null check (niveau_offre in ('sait_faire', 'partiel', 'ignore')),
  niveau_technologie text not null check (niveau_technologie in ('sait_faire', 'partiel', 'ignore')),
  niveau_environnement text not null check (niveau_environnement in ('sait_faire', 'partiel', 'ignore')),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_maturity_assessments_contact on public.maturity_assessments(contact_id);

alter table public.maturity_assessments enable row level security;

drop policy if exists "staff full access on maturity_assessments" on public.maturity_assessments;
create policy "staff full access on maturity_assessments" on public.maturity_assessments
  for all
  using (current_user_role() = any (array['admin', 'manager']))
  with check (current_user_role() = any (array['admin', 'manager']));
