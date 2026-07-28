-- Étape 7 de la méthodologie Yndra ("Suivi & amélioration continue") :
-- date du dernier point de suivi post-déploiement, renseignée manuellement
-- via le bouton dédié sur la fiche projet. Null = jamais encore fait.
-- Utilisée par le rappel du tableau de bord (lib/gantt-deps.ts,
-- detecterSuiviAPrevoir) pour ne pas laisser cette étape se perdre
-- silencieusement une fois la mission livrée.

alter table public.projects
  add column if not exists date_dernier_suivi date;
