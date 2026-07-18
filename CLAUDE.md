# CLAUDE.md

Guidance pour Claude Code sur ce dépôt.

## Ce qu'est ce projet

`consultant-dashboard` est l'**outil opérationnel** de l'agence **Yndra** (conseil en IA appliquée à l'industrie manufacturière, porteur : Khelaf). C'est le « où » : il exécute, client par client, le processus de conseil défini ailleurs.

- Stack : **Next.js 14.2.35** (App Router) + **Supabase** (projet `wynplxbekxyrggtuehbg`, région eu-west-2) + déploiement **Vercel**.
- Domaines fonctionnels : `contacts`, `devis` (quotes), `missions`, `projets` (+ phases/jalons), `factures` (invoices), `contrats` (contracts + templates), `documents`, `comptabilite`, `relances`, `parametres`.
- Langue : répondre et rédiger en **français** par défaut.

## Brique complémentaire — la méthode

Le **« quoi »** (méthode de conseil en 7 étapes, templates de livrables, commercial, juridique) vit dans un dossier séparé : **`~/Documents/Agence IA consulting/`**.

La carte de correspondance méthode ⇄ dashboard (quelle étape/quel template correspond à quelle entité) est maintenue là-bas : **`~/Documents/Agence IA consulting/liaison-consultant-dashboard.md`**. La consulter avant de modéliser missions/phases/documents, pour rester aligné sur la méthodologie.

Règle de partage : la méthode et les templates vierges sont la source de vérité côté `Agence IA consulting/` ; les **données réelles** des clients vivent ici (base Supabase). Ne pas dupliquer.

## Sécurité (déjà auditée le 2026-07-18)

Posture d'auth/isolation validée — ne pas « re-corriger » sans vérifier :
- **Middleware** (`src/middleware.ts`) : `supabase.auth.getUser()` (validation serveur), secure-by-default (toute page hors `PUBLIC_PAGES` redirige vers `/login`).
- **RLS** activé sur les 17 tables, policies de propriété `user_id = auth.uid()`.
- Détails et décisions (dont : ne PAS appliquer `FORCE RLS` ; leaked-password protection réservée au plan Supabase Pro) : voir la mémoire `consultant-dashboard-securite`.

## Commandes

```bash
npm run dev     # dev (port 3000 ; profil de lancement Claude : port 3001)
npm run build
npm run lint
```
