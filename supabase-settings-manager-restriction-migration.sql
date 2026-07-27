-- La clé API Resend (identifiant technique permettant d'envoyer des emails
-- au nom de l'entreprise) et les taux URSSAF/IR (statut fiscal personnel de
-- l'auto-entrepreneur) sont réservés à l'admin — un manager gère l'activité
-- (contacts, devis, factures, projets...) mais n'a pas à voir ces réglages.
-- La policy précédente ("staff full access on settings") donnait un accès
-- total (admin + manager, toutes les clés) ; on la remplace par deux
-- policies : admin = tout, manager = tout SAUF les clés sensibles listées
-- ci-dessous — le filtre porte sur la ligne (key), donc les valeurs
-- sensibles ne sont même pas renvoyées à un manager (pas seulement masquées
-- côté UI).

drop policy if exists "staff full access on settings" on settings;

create policy "admin full access on settings" on settings
  for all
  using (current_user_role() = 'admin')
  with check (current_user_role() = 'admin');

create policy "manager access on settings excluding sensitive keys" on settings
  for all
  using (
    current_user_role() = 'manager'
    and key not in (
      'resend_api_key', 'email_expediteur', 'notification_email',
      'taux_cotisation_urssaf', 'versement_liberatoire', 'taux_versement_ir'
    )
  )
  with check (
    current_user_role() = 'manager'
    and key not in (
      'resend_api_key', 'email_expediteur', 'notification_email',
      'taux_cotisation_urssaf', 'versement_liberatoire', 'taux_versement_ir'
    )
  );
