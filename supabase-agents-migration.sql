-- Migration : Module Agents (orchestrateur + sous-agents)
-- À exécuter dans Supabase SQL Editor après le schéma principal et la migration Contrats.
--
-- Alignement RLS : la base applique le modèle de propriété audité le 2026-07-18
-- (colonne user_id default auth.uid() + policy « user owns X » sur user_id = auth.uid()).
-- Les deux tables ci-dessous suivent exactement ce modèle — pas de nouveau modèle inventé.

-- ─────────────────────────────────────────
-- TABLES
-- ─────────────────────────────────────────

create table if not exists public.agents (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  slug          text        not null,
  nom           text        not null,
  description   text,
  system_prompt text        not null,
  model         text        not null default 'claude-haiku-4-5-20251001',
  max_tokens    int         not null default 4096,
  actif         boolean     not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- Unicité par propriétaire (et non globale) pour rester cohérent avec le
  -- modèle RLS de propriété : chaque utilisateur possède son jeu d'agents.
  constraint agents_user_slug_unique unique (user_id, slug)
);

create table if not exists public.agent_runs (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  demande        text        not null,
  agents_appeles jsonb       not null default '[]'::jsonb,
  resultat       text,
  tokens_input   int         not null default 0,
  tokens_output  int         not null default 0,
  duree_ms       int         not null default 0,
  statut         text        not null check (statut in ('succes', 'erreur')) default 'succes',
  erreur         text,
  created_at     timestamptz not null default now()
);

create index if not exists idx_agents_user_actif      on public.agents(user_id, actif);
create index if not exists idx_agent_runs_user_created on public.agent_runs(user_id, created_at desc);

-- updated_at automatique sur agents
create or replace function public.set_agents_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_agents_updated_at on public.agents;
create trigger trg_agents_updated_at
  before update on public.agents
  for each row execute function public.set_agents_updated_at();

-- ─────────────────────────────────────────
-- SÉCURITÉ (RLS) — même politique que les tables existantes
-- ─────────────────────────────────────────

alter table public.agents     enable row level security;
alter table public.agent_runs enable row level security;

drop policy if exists "user owns agents" on public.agents;
create policy "user owns agents"
  on public.agents for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "user owns agent_runs" on public.agent_runs;
create policy "user owns agent_runs"
  on public.agent_runs for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
