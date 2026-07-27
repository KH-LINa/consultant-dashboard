-- Multi-rôles Admin / Manager / Collaborateur — bascule des 23 tables métier
-- du modèle "propriétaire unique" (user_id = auth.uid()) vers un modèle
-- "staff = accès complet" (admin ET manager, qui ont les mêmes droits sur
-- ces tables — seule la gestion des comptes reste réservée à l'admin, cf.
-- supabase-profiles-migration.sql).
--
-- Chaque policy "user owns <table>" est remplacée par "staff full access on
-- <table>", même condition mécanique partout : current_user_role() in
-- ('admin', 'manager'). Les colonnes user_id ne sont pas supprimées
-- (utile pour savoir qui a créé une ligne), seules les policies changent.

drop policy if exists "user owns agent_runs" on agent_runs;
create policy "staff full access on agent_runs" on agent_runs
  for all using (current_user_role() in ('admin','manager'))
  with check (current_user_role() in ('admin','manager'));

drop policy if exists "user owns agents" on agents;
create policy "staff full access on agents" on agents
  for all using (current_user_role() in ('admin','manager'))
  with check (current_user_role() in ('admin','manager'));

drop policy if exists "user owns collaborateurs" on collaborateurs;
create policy "staff full access on collaborateurs" on collaborateurs
  for all using (current_user_role() in ('admin','manager'))
  with check (current_user_role() in ('admin','manager'));

drop policy if exists "user owns contacts" on contacts;
create policy "staff full access on contacts" on contacts
  for all using (current_user_role() in ('admin','manager'))
  with check (current_user_role() in ('admin','manager'));

drop policy if exists "user owns contract_templates" on contract_templates;
create policy "staff full access on contract_templates" on contract_templates
  for all using (current_user_role() in ('admin','manager'))
  with check (current_user_role() in ('admin','manager'));

drop policy if exists "user owns contracts" on contracts;
create policy "staff full access on contracts" on contracts
  for all using (current_user_role() in ('admin','manager'))
  with check (current_user_role() in ('admin','manager'));

drop policy if exists "user owns documents" on documents;
create policy "staff full access on documents" on documents
  for all using (current_user_role() in ('admin','manager'))
  with check (current_user_role() in ('admin','manager'));

drop policy if exists "user owns invoices" on invoices;
create policy "staff full access on invoices" on invoices
  for all using (current_user_role() in ('admin','manager'))
  with check (current_user_role() in ('admin','manager'));

drop policy if exists "user owns mission_tasks" on mission_tasks;
create policy "staff full access on mission_tasks" on mission_tasks
  for all using (current_user_role() in ('admin','manager'))
  with check (current_user_role() in ('admin','manager'));

drop policy if exists "user owns missions" on missions;
create policy "staff full access on missions" on missions
  for all using (current_user_role() in ('admin','manager'))
  with check (current_user_role() in ('admin','manager'));

drop policy if exists "user owns phase_dependencies" on phase_dependencies;
create policy "staff full access on phase_dependencies" on phase_dependencies
  for all using (current_user_role() in ('admin','manager'))
  with check (current_user_role() in ('admin','manager'));

drop policy if exists "user owns project_milestones" on project_milestones;
create policy "staff full access on project_milestones" on project_milestones
  for all using (current_user_role() in ('admin','manager'))
  with check (current_user_role() in ('admin','manager'));

drop policy if exists "user owns project_phases" on project_phases;
create policy "staff full access on project_phases" on project_phases
  for all using (current_user_role() in ('admin','manager'))
  with check (current_user_role() in ('admin','manager'));

drop policy if exists "user owns project_tasks" on project_tasks;
create policy "staff full access on project_tasks" on project_tasks
  for all using (current_user_role() in ('admin','manager'))
  with check (current_user_role() in ('admin','manager'));

drop policy if exists "user owns projects" on projects;
create policy "staff full access on projects" on projects
  for all using (current_user_role() in ('admin','manager'))
  with check (current_user_role() in ('admin','manager'));

drop policy if exists "user owns quote_messages" on quote_messages;
create policy "staff full access on quote_messages" on quote_messages
  for all using (current_user_role() in ('admin','manager'))
  with check (current_user_role() in ('admin','manager'));

drop policy if exists "user owns quotes" on quotes;
create policy "staff full access on quotes" on quotes
  for all using (current_user_role() in ('admin','manager'))
  with check (current_user_role() in ('admin','manager'));

drop policy if exists "user owns reminders" on reminders;
create policy "staff full access on reminders" on reminders
  for all using (current_user_role() in ('admin','manager'))
  with check (current_user_role() in ('admin','manager'));

drop policy if exists "user owns resource_assignments" on resource_assignments;
create policy "staff full access on resource_assignments" on resource_assignments
  for all using (current_user_role() in ('admin','manager'))
  with check (current_user_role() in ('admin','manager'));

drop policy if exists "user owns resource_unavailability" on resource_unavailability;
create policy "staff full access on resource_unavailability" on resource_unavailability
  for all using (current_user_role() in ('admin','manager'))
  with check (current_user_role() in ('admin','manager'));

drop policy if exists "user owns resources" on resources;
create policy "staff full access on resources" on resources
  for all using (current_user_role() in ('admin','manager'))
  with check (current_user_role() in ('admin','manager'));

drop policy if exists "user owns settings" on settings;
create policy "staff full access on settings" on settings
  for all using (current_user_role() in ('admin','manager'))
  with check (current_user_role() in ('admin','manager'));

drop policy if exists "user owns task_dependencies" on task_dependencies;
create policy "staff full access on task_dependencies" on task_dependencies
  for all using (current_user_role() in ('admin','manager'))
  with check (current_user_role() in ('admin','manager'));
