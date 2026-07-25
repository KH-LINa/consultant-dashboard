import type { NextRequest } from 'next/server'

/**
 * URL de base publique de l'app pour les liens envoyés par email (invitation
 * d'un utilisateur, acceptation de devis, relances...).
 *
 * On ne se fie PAS à l'origine de la requête par défaut : une invitation (ou
 * un envoi de devis) déclenchée depuis un serveur local enverrait sinon un
 * lien `localhost:3000` à la personne destinataire — inaccessible pour elle.
 *
 * Ordre de résolution :
 *   1. NEXT_PUBLIC_APP_URL — override explicite (à définir si domaine
 *      personnalisé, ex. https://app.i-a-infinity.fr).
 *   2. VERCEL_PROJECT_PRODUCTION_URL — domaine de prod injecté par Vercel,
 *      même depuis un déploiement de preview (on préfixe en https).
 *   3. Origine de la requête — dernier recours (dev local, autre hébergeur).
 */
export function resolveAppBaseUrl(request: NextRequest): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL
  if (explicit) return explicit.replace(/\/+$/, '')

  const vercelProd = process.env.VERCEL_PROJECT_PRODUCTION_URL
  if (vercelProd) return `https://${vercelProd}`

  return new URL(request.url).origin
}
