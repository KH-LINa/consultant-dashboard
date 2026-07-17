# PROMPT CLAUDE CODE — Module Contrats (Phase A)

> À copier-coller dans Claude Code depuis `C:\Users\khela\Documents\consultant-dashboard`.
> Phase A = génération + envoi du contrat. La signature YouSign (Phase B) est volontairement hors périmètre.

---

## Contexte du projet

Plateforme de gestion pour consultant indépendant (auto-entrepreneur, France).
Stack : Next.js 14 (App Router), Supabase (auth + DB + RLS), TypeScript, Claude API, Resend, Vercel.
Workflow existant : devis (`quotes`) → conversion en projet (`projects`).

Objectif : ajouter un module **Contrats** qui s'intercale entre un devis accepté et le projet.
Workflow cible : devis accepté → bouton "Générer le contrat" → Claude pré-remplit les parties variables → l'utilisateur édite et valide → génération PDF → envoi au client par mail (Resend, avec PDF en pièce jointe + lien portail).

Déclenchement **manuel** (pas automatique au changement de statut du devis).

---

## 1. Modèle de données (Supabase)

Crée une migration SQL avec deux tables.

### Table `contract_templates`
Modèles réutilisables, un par offre.

| Champ | Type | Notes |
|---|---|---|
| `id` | uuid PK | `default gen_random_uuid()` |
| `offre` | text | enum logique : `consulting`, `automatisation`, `solution_centralisee` |
| `nom` | text | libellé affiché |
| `contenu` | text | corps du contrat avec variables `{{...}}` |
| `version` | int | `default 1` |
| `actif` | boolean | `default true` |
| `created_at` | timestamptz | `default now()` |

### Table `contracts`
Contrats générés.

| Champ | Type | Notes |
|---|---|---|
| `id` | uuid PK | `default gen_random_uuid()` |
| `quote_id` | uuid FK → `quotes.id` | le devis source |
| `contact_id` | uuid FK → `contacts.id` | le client |
| `project_id` | uuid FK → `projects.id` | nullable (rempli après conversion) |
| `template_id` | uuid FK → `contract_templates.id` | nullable |
| `numero` | text | ex : `CTR-2026-0001`, généré séquentiellement |
| `contenu` | text | contenu final édité (après pré-remplissage IA + édition manuelle) |
| `statut` | text | enum logique : `brouillon`, `envoye`, `signe`, `archive` ; `default 'brouillon'` |
| `montant_ht` | numeric | repris du devis |
| `pdf_url` | text | nullable, URL du PDF dans Supabase Storage |
| `yousign_ref` | text | nullable, réservé Phase B |
| `sent_at` | timestamptz | nullable |
| `signed_at` | timestamptz | nullable |
| `created_at` | timestamptz | `default now()` |

Crée un bucket Supabase Storage `contracts` (privé) pour les PDF.

---

## 2. Sécurité (obligatoire dès le départ)

> Rappel projet : un incident a eu lieu où `/dashboard` était public sans authentification. Ne pas reproduire.

- Protéger toutes les routes `/contracts/**` via le middleware Next.js existant (même mécanisme que les autres routes admin protégées).
- Activer **RLS** sur `contracts` et `contract_templates`.
- Policies : seul l'utilisateur authentifié (le consultant, propriétaire) peut lire/écrire. Pas d'accès anonyme.
- Le bucket Storage `contracts` doit être privé ; générer des URLs signées à durée limitée pour les téléchargements.
- Vérifier qu'aucune variable d'environnement (clé Resend, clé Anthropic) n'est exposée côté client.

---

## 3. Pré-remplissage par l'IA (Claude API)

Au clic sur "Générer le contrat" :

1. Récupérer le devis (`quotes`) et le contact lié.
2. Sélectionner le `contract_templates` correspondant à l'`offre` du devis.
3. Appeler l'API Claude (`claude-sonnet-4-6`) pour remplir **uniquement les parties variables** : objet de la mission, description des livrables, délais. Fournir en entrée le titre du devis, l'offre, le montant, et les infos client.
4. **Ne jamais laisser l'IA réécrire les clauses juridiques** (paiement, propriété intellectuelle, confidentialité, RGPD, responsabilité, résiliation, droit applicable). Ces clauses viennent du template et sont figées.
5. Remplacer les variables `{{...}}` (voir section 6) par les données réelles + le texte généré.
6. Stocker le résultat dans `contracts.contenu` avec statut `brouillon`.

L'utilisateur peut ensuite **éditer le contenu** dans l'interface avant de valider.

Implémente l'appel Claude dans une Server Action, jamais côté client (la clé API ne doit pas fuiter).

---

## 4. Génération PDF

- Réutiliser la même approche que pour les devis/factures existants (cohérence visuelle).
- Le PDF doit inclure les mentions auto-entrepreneur obligatoires :
  - N° SIRET
  - « Dispensé d'immatriculation au RCS et au RM »
  - « TVA non applicable, art. 293 B du CGI »
- Stocker le PDF généré dans le bucket Storage `contracts` et renseigner `pdf_url`.

---

## 5. Notification client (Resend)

> Domaine Resend vérifié : OK.

À l'envoi du contrat (passage `brouillon` → `envoye`) :
- Envoyer un mail au client via Resend (template React Email cohérent avec les mails existants).
- Pièce jointe : le PDF du contrat.
- Corps : message court + lien vers le portail client.
- Renseigner `sent_at`.

En Phase A, le passage au statut `signe` se fait **manuellement** par le consultant (le client signe le PDF à la main en attendant YouSign). Prévoir un bouton "Marquer comme signé" qui renseigne `signed_at`.

---

## 6. Variables de template

Le contenu des templates utilise ces variables (à remplacer au pré-remplissage) :

- `{{client_nom}}` — nom / raison sociale du client
- `{{client_adresse}}` — adresse du client
- `{{client_siret}}` — SIRET du client (si société)
- `{{prestataire_nom}}` — nom du consultant
- `{{prestataire_adresse}}` — adresse du consultant
- `{{prestataire_siret}}` — SIRET du consultant
- `{{objet_mission}}` — généré par l'IA depuis le devis
- `{{livrables}}` — généré par l'IA depuis le devis
- `{{delai}}` — délai d'exécution
- `{{montant_ht}}` — montant HT repris du devis
- `{{modalites_paiement}}` — modalités (acompte, solde)
- `{{date_signature}}` — date de signature
- `{{ville_signature}}` — lieu de signature

---

## 7. Interface et workflow

- Sur la page d'un devis accepté (`/quotes/[id]`), ajouter un bouton **"Générer le contrat"**.
- Nouvelle page `/contracts/[id]` : affichage + édition du contenu, aperçu PDF, boutons "Envoyer au client", "Marquer comme signé", "Archiver".
- Liste `/contracts` : tableau (numéro, client, montant, statut, date) avec filtres par statut.
- Statuts colorés : `brouillon` (gris), `envoye` (bleu), `signe` (vert), `archive` (neutre).
- Updates optimistes avec rollback en cas d'erreur (cohérent avec le reste de l'app).

---

## 8. Fichiers à créer / modifier

- Migration SQL : tables `contracts`, `contract_templates`, bucket Storage, policies RLS
- `/app/actions/contracts.ts` — Server Actions (génération IA, PDF, envoi Resend, changements de statut)
- `/app/contracts/page.tsx` — liste
- `/app/contracts/[id]/page.tsx` — détail / édition
- `/components/contracts/ContractEditor.tsx` — éditeur de contenu
- `/components/contracts/ContractStatusBadge.tsx`
- `/lib/pdf/contract.ts` — génération PDF (réutiliser l'existant devis/facture)
- `/emails/ContractEmail.tsx` — template Resend
- Modifier `/app/quotes/[id]/page.tsx` — ajouter le bouton "Générer le contrat"
- Seed : insérer les 3 templates ci-dessous dans `contract_templates`

---

## 9. Contenu des 3 templates (PREMIER JET — À FAIRE VALIDER PAR UN JURISTE)

> ⚠️ Ce contenu est un premier jet rédigé sans validation juridique professionnelle. Il doit être relu et corrigé par un avocat/juriste avant tout usage réel, en particulier les articles 6 (propriété intellectuelle) et 9 (responsabilité).

Le squelette de clauses est **commun aux 3 offres**. Seuls **l'Article 1 (Objet)**, **l'Article 3 (Obligations du prestataire / livrables)** et **l'Article 6 (Propriété intellectuelle)** varient. Insère 3 entrées complètes dans `contract_templates`, chacune assemblant le tronc commun + sa variante.

### Tronc commun

```
CONTRAT DE PRESTATION DE SERVICES

ENTRE LES SOUSSIGNÉS :

{{prestataire_nom}}, auto-entrepreneur,
domicilié(e) {{prestataire_adresse}},
immatriculé(e) sous le numéro SIRET {{prestataire_siret}},
dispensé(e) d'immatriculation au RCS et au RM,
ci-après dénommé(e) « le Prestataire »,

D'UNE PART,

ET

{{client_nom}},
domicilié(e) / dont le siège est situé {{client_adresse}},
SIRET {{client_siret}},
ci-après dénommé(e) « le Client »,

D'AUTRE PART,

IL A ÉTÉ CONVENU CE QUI SUIT :

[ARTICLE 1 — OBJET : voir variante par offre]

ARTICLE 2 — DURÉE ET DÉLAIS
La prestation débute à la signature du présent contrat et s'exécute dans un délai de {{delai}}.
Tout retard imputable au Client (absence de réponse, données manquantes) suspend ce délai d'autant.

[ARTICLE 3 — OBLIGATIONS DU PRESTATAIRE : voir variante par offre]

ARTICLE 4 — OBLIGATIONS DU CLIENT
Le Client s'engage à fournir au Prestataire l'ensemble des informations, accès et ressources
nécessaires à la bonne exécution de la mission, dans des délais raisonnables.
Le Client désigne un interlocuteur unique chargé du suivi.

ARTICLE 5 — CONDITIONS FINANCIÈRES
Le montant de la prestation est fixé à {{montant_ht}} € HT.
TVA non applicable, art. 293 B du CGI.
Modalités de paiement : {{modalites_paiement}}.
Tout retard de paiement entraîne des pénalités au taux légal en vigueur, ainsi qu'une indemnité
forfaitaire de recouvrement de 40 € (art. L441-10 du Code de commerce).

[ARTICLE 6 — PROPRIÉTÉ INTELLECTUELLE : voir variante par offre]

ARTICLE 7 — CONFIDENTIALITÉ
Chaque partie s'engage à conserver confidentielles les informations échangées dans le cadre
de la mission, pendant toute sa durée et pendant 2 ans après son terme.

ARTICLE 8 — DONNÉES PERSONNELLES (RGPD)
Le Prestataire traite les données personnelles strictement nécessaires à l'exécution de la mission,
conformément au RGPD. Les données sont conservées pour une durée de 3 ans après la fin de la
relation contractuelle, sauf obligation légale contraire.

ARTICLE 9 — RESPONSABILITÉ
Le Prestataire est tenu à une obligation de moyens. Sa responsabilité ne saurait excéder le montant
total HT de la prestation. Le Prestataire ne saurait être tenu responsable des dommages indirects.

ARTICLE 10 — RÉSILIATION
Chaque partie peut résilier le contrat en cas de manquement grave de l'autre partie non réparé
dans un délai de 15 jours après mise en demeure. Les prestations réalisées restent dues.

ARTICLE 11 — FORCE MAJEURE
Aucune partie ne peut être tenue responsable d'un manquement résultant d'un cas de force majeure
au sens de l'article 1218 du Code civil.

ARTICLE 12 — DROIT APPLICABLE ET LITIGES
Le présent contrat est soumis au droit français. En cas de litige, les parties s'efforcent de trouver
une solution amiable. À défaut, compétence est attribuée aux tribunaux français compétents.

Fait à {{ville_signature}}, le {{date_signature}}, en deux exemplaires originaux.

Le Prestataire                          Le Client
{{prestataire_nom}}                     {{client_nom}}
(signature)                             (signature)
```

### Variante — Offre CONSULTING

```
ARTICLE 1 — OBJET
Le Prestataire réalise pour le Client une mission de conseil portant sur : {{objet_mission}}.

ARTICLE 3 — OBLIGATIONS DU PRESTATAIRE
Le Prestataire s'engage à fournir les livrables suivants : {{livrables}}.
La mission est une prestation de conseil ; les recommandations émises relèvent de la décision
finale du Client, qui en assume la mise en œuvre.

ARTICLE 6 — PROPRIÉTÉ INTELLECTUELLE
Les livrables (rapports, analyses, recommandations) deviennent la propriété du Client après
paiement intégral. Le Prestataire conserve le droit de réutiliser son savoir-faire, ses méthodes
et ses outils génériques.
```

### Variante — Offre AUTOMATISATION

```
ARTICLE 1 — OBJET
Le Prestataire réalise pour le Client la conception et la mise en place d'une ou plusieurs
automatisations sur mesure portant sur : {{objet_mission}}.

ARTICLE 3 — OBLIGATIONS DU PRESTATAIRE
Le Prestataire s'engage à développer et livrer les automatisations suivantes : {{livrables}}.
Une phase de recette est prévue ; le Client dispose de 10 jours pour signaler tout écart par
rapport au périmètre convenu.

ARTICLE 6 — PROPRIÉTÉ INTELLECTUELLE
Après paiement intégral, le Client dispose d'un droit d'usage des automatisations livrées pour ses
besoins propres. Le Prestataire conserve la propriété de ses composants, bibliothèques et briques
techniques génériques préexistants, ainsi que le droit de les réutiliser.
[POINT À TRANCHER AVEC UN JURISTE : cession totale vs droit d'usage — selon ton modèle commercial.]
```

### Variante — Offre SOLUTION CENTRALISÉE

```
ARTICLE 1 — OBJET
Le Prestataire conçoit, développe et déploie pour le Client une solution centralisée portant sur :
{{objet_mission}}.

ARTICLE 3 — OBLIGATIONS DU PRESTATAIRE
Le Prestataire s'engage à livrer la solution suivante : {{livrables}}.
Les conditions de maintenance, d'hébergement et de support éventuels font l'objet d'un accord
distinct et ne sont pas couverts par le présent contrat sauf mention expresse.

ARTICLE 6 — PROPRIÉTÉ INTELLECTUELLE
Après paiement intégral, le Client dispose d'un droit d'usage de la solution livrée. Le Prestataire
conserve la propriété de son socle technique réutilisable. Toute cession de code source complète
doit faire l'objet d'une clause spécifique négociée séparément.
[POINT À TRANCHER AVEC UN JURISTE : périmètre exact de la cession et conditions de maintenance.]
```

---

## Hors périmètre (Phase B, ne pas implémenter maintenant)

- Intégration YouSign (envoi à signature qualifiée eIDAS, webhook de retour, passage auto au statut `signe`).
- Le champ `yousign_ref` est créé dès maintenant pour préparer cette phase, mais reste nul.

## Rappels de validation

- Tester en local avant déploiement Vercel.
- Vérifier les variables d'environnement après déploiement (incident passé : `ANTHROPIC_API_KEY` commentée).
- Valider la protection middleware + RLS sur les nouvelles routes avant toute mise en production.
