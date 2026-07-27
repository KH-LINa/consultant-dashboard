-- Correctif : transfert de propriété des 8 sous-agents vers le vrai compte
-- consultant. À exécuter dans Supabase SQL Editor (déjà appliqué sur le
-- projet).
--
-- Contexte : le seed initial (supabase-agents-migration.sql) désignait le
-- propriétaire des agents via `select id from auth.users order by
-- created_at limit 1`, en supposant que le premier compte créé sur le
-- projet Supabase était le compte consultant réel. Ce n'est pas le cas ici :
-- le premier compte créé (admin@consultant-dashboard.local) est un compte de
-- test jamais configuré (coordonnées par défaut, aucun contact/devis/facture),
-- tandis que le compte réellement utilisé au quotidien (k.fedila@gmail.com,
-- coordonnées réelles, tous les contacts/prospects) a été créé deux jours
-- plus tard. Résultat : les 8 agents étaient invisibles pour l'utilisateur
-- réel du dashboard.

update public.agents
set user_id = '513b8bf8-f9b4-48cc-88c6-52101b1f07cc'  -- k.fedila@gmail.com
where user_id = 'adfb0449-3b9d-48cd-8973-f0c123928c08'; -- admin@consultant-dashboard.local (compte de test)
