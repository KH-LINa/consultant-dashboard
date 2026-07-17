-- Migration : Module Contrats (Phase A)
-- À exécuter dans Supabase SQL Editor après le schéma principal.

-- ─────────────────────────────────────────
-- TABLES
-- ─────────────────────────────────────────

create table if not exists public.contract_templates (
  id         uuid        primary key default gen_random_uuid(),
  offre      text        not null check (offre in ('consulting', 'automatisation', 'solution_centralisee')),
  nom        text        not null,
  contenu    text        not null,
  version    int         not null default 1,
  actif      boolean     not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.contracts (
  id           uuid        primary key default gen_random_uuid(),
  quote_id     uuid        references public.quotes(id)              on delete set null,
  contact_id   uuid        not null references public.contacts(id)   on delete cascade,
  -- project_id FK ajoutée manuellement si la table projects existe : ALTER TABLE public.contracts ADD CONSTRAINT contracts_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;
  project_id   uuid,
  template_id  uuid        references public.contract_templates(id)  on delete set null,
  numero       text        not null unique,
  contenu      text        not null,
  statut       text        not null check (statut in ('brouillon', 'envoye', 'signe', 'archive')) default 'brouillon',
  montant_ht   numeric(10,2) not null default 0,
  pdf_url      text,
  yousign_ref  text,
  sent_at      timestamptz,
  signed_at    timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists idx_contracts_quote_id    on public.contracts(quote_id);
create index if not exists idx_contracts_contact_id  on public.contracts(contact_id);
create index if not exists idx_contracts_statut      on public.contracts(statut);

-- ─────────────────────────────────────────
-- SÉCURITÉ (RLS)
-- ─────────────────────────────────────────

alter table public.contract_templates enable row level security;
alter table public.contracts           enable row level security;

create policy "authenticated users can manage contract_templates"
  on public.contract_templates for all to authenticated
  using (true) with check (true);

create policy "authenticated users can manage contracts"
  on public.contracts for all to authenticated
  using (true) with check (true);

-- ─────────────────────────────────────────
-- STORAGE — bucket « contracts » (privé)
-- ─────────────────────────────────────────

insert into storage.buckets (id, name, public)
  values ('contracts', 'contracts', false)
  on conflict (id) do nothing;

create policy "authenticated users can upload contracts"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'contracts');

create policy "authenticated users can read contracts"
  on storage.objects for select to authenticated
  using (bucket_id = 'contracts');

create policy "authenticated users can delete contracts"
  on storage.objects for delete to authenticated
  using (bucket_id = 'contracts');

-- ─────────────────────────────────────────
-- SEED : 3 templates de contrats
-- ⚠️  Premier jet — À valider par un juriste avant usage réel.
-- ─────────────────────────────────────────

insert into public.contract_templates (offre, nom, contenu) values

('consulting', 'Contrat de consulting', $tpl$CONTRAT DE PRESTATION DE SERVICES

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

ARTICLE 1 — OBJET
Le Prestataire réalise pour le Client une mission de conseil portant sur : {{objet_mission}}.

ARTICLE 2 — DURÉE ET DÉLAIS
La prestation débute à la signature du présent contrat et s'exécute dans un délai de {{delai}}.
Tout retard imputable au Client (absence de réponse, données manquantes) suspend ce délai d'autant.

ARTICLE 3 — OBLIGATIONS DU PRESTATAIRE
Le Prestataire s'engage à fournir les livrables suivants : {{livrables}}.
La mission est une prestation de conseil ; les recommandations émises relèvent de la décision
finale du Client, qui en assume la mise en œuvre.

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

ARTICLE 6 — PROPRIÉTÉ INTELLECTUELLE
Les livrables (rapports, analyses, recommandations) deviennent la propriété du Client après
paiement intégral. Le Prestataire conserve le droit de réutiliser son savoir-faire, ses méthodes
et ses outils génériques.

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
(signature)                             (signature)$tpl$),

('automatisation', 'Contrat d''automatisation', $tpl$CONTRAT DE PRESTATION DE SERVICES

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

ARTICLE 1 — OBJET
Le Prestataire réalise pour le Client la conception et la mise en place d'une ou plusieurs
automatisations sur mesure portant sur : {{objet_mission}}.

ARTICLE 2 — DURÉE ET DÉLAIS
La prestation débute à la signature du présent contrat et s'exécute dans un délai de {{delai}}.
Tout retard imputable au Client (absence de réponse, données manquantes) suspend ce délai d'autant.

ARTICLE 3 — OBLIGATIONS DU PRESTATAIRE
Le Prestataire s'engage à développer et livrer les automatisations suivantes : {{livrables}}.
Une phase de recette est prévue ; le Client dispose de 10 jours pour signaler tout écart par
rapport au périmètre convenu.

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

ARTICLE 6 — PROPRIÉTÉ INTELLECTUELLE
Après paiement intégral, le Client dispose d'un droit d'usage des automatisations livrées pour ses
besoins propres. Le Prestataire conserve la propriété de ses composants, bibliothèques et briques
techniques génériques préexistants, ainsi que le droit de les réutiliser.
[POINT À TRANCHER AVEC UN JURISTE : cession totale vs droit d'usage — selon votre modèle commercial.]

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
(signature)                             (signature)$tpl$),

('solution_centralisee', 'Contrat — Solution centralisée', $tpl$CONTRAT DE PRESTATION DE SERVICES

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

ARTICLE 1 — OBJET
Le Prestataire conçoit, développe et déploie pour le Client une solution centralisée portant sur :
{{objet_mission}}.

ARTICLE 2 — DURÉE ET DÉLAIS
La prestation débute à la signature du présent contrat et s'exécute dans un délai de {{delai}}.
Tout retard imputable au Client (absence de réponse, données manquantes) suspend ce délai d'autant.

ARTICLE 3 — OBLIGATIONS DU PRESTATAIRE
Le Prestataire s'engage à livrer la solution suivante : {{livrables}}.
Les conditions de maintenance, d'hébergement et de support éventuels font l'objet d'un accord
distinct et ne sont pas couverts par le présent contrat sauf mention expresse.

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

ARTICLE 6 — PROPRIÉTÉ INTELLECTUELLE
Après paiement intégral, le Client dispose d'un droit d'usage de la solution livrée. Le Prestataire
conserve la propriété de son socle technique réutilisable. Toute cession de code source complète
doit faire l'objet d'une clause spécifique négociée séparément.
[POINT À TRANCHER AVEC UN JURISTE : périmètre exact de la cession et conditions de maintenance.]

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
(signature)                             (signature)$tpl$);
