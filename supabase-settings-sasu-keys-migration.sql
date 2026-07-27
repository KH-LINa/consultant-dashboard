-- Suite à supabase-settings-manager-restriction-migration.sql : les clés
-- taux_cotisation_urssaf / versement_liberatoire / taux_versement_ir
-- (statut auto-entrepreneur) sont remplacées côté application par
-- remuneration_brute_mensuelle / taux_charges_patronales / taux_charges_salariales
-- (statut SASU, président assimilé salarié). La policy manager doit être
-- mise à jour pour continuer à protéger ces nouvelles clés au même niveau
-- que les anciennes — sans cette migration, un manager retrouverait un accès
-- en lecture/écriture à la rémunération du président, ce qui n'a jamais été
-- l'intention.

drop policy if exists "manager access on settings excluding sensitive keys" on settings;

create policy "manager access on settings excluding sensitive keys" on settings
  for all
  using (
    current_user_role() = 'manager'
    and key not in (
      'resend_api_key', 'email_expediteur', 'notification_email',
      'remuneration_brute_mensuelle', 'taux_charges_patronales', 'taux_charges_salariales'
    )
  )
  with check (
    current_user_role() = 'manager'
    and key not in (
      'resend_api_key', 'email_expediteur', 'notification_email',
      'remuneration_brute_mensuelle', 'taux_charges_patronales', 'taux_charges_salariales'
    )
  );
