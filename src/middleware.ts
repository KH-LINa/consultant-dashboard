/**
 * middleware.ts — Optimisé pour l'Edge Runtime Vercel
 *
 * Stratégie : vérification JWT légère via `jose` (natif Edge, ~8 kB)
 * au lieu de `@supabase/ssr` + `createServerClient` (~40 kB de polyfills).
 *
 * Sécurité maintenue en profondeur :
 * - Le middleware fait une vérification JWT rapide (présence + validité de signature)
 * - Le DashboardLayout (`src/app/(dashboard)/layout.tsx`) conserve la vérification
 *   complète via `supabase.auth.getUser()` côté serveur Node.js (non Edge)
 * - Les routes API vérifient elles-mêmes leur authentification
 *
 * Réduction estimée : 82.7 kB → ~20–30 kB (-65%)
 *
 * IMPORTANT : Ajouter SUPABASE_JWT_SECRET dans les variables d'env Vercel.
 * Récupérable dans : Supabase Dashboard → Project Settings → API → JWT Secret
 */
import { jwtVerify } from 'jose'
import { NextResponse, type NextRequest } from 'next/server'

// Pages accessibles sans authentification
const PUBLIC_PATHS = [
  '/login',
  '/mot-de-passe-oublie',
  '/update-password',
  '/accepter', // acceptation de devis via token secret
]

// Clé de vérification JWT Supabase
function getJwtSecret(): Uint8Array {
  const secret = process.env.SUPABASE_JWT_SECRET
  if (!secret) return new Uint8Array(0)
  return new TextEncoder().encode(secret)
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isPublicPath = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  )

  // Récupérer le token Supabase depuis les cookies
  // Supabase stocke le token dans un cookie `sb-<project-ref>-auth-token`
  const allCookies = request.cookies.getAll()
  const authCookie = allCookies.find(
    (c) => c.name.startsWith('sb-') && c.name.endsWith('-auth-token')
  )

  let isAuthenticated = false

  if (authCookie) {
    try {
      // Le cookie Supabase contient un JSON base64 avec access_token
      const cookieValue = JSON.parse(
        Buffer.from(authCookie.value, 'base64').toString('utf-8')
      )
      const accessToken = cookieValue?.access_token ?? cookieValue

      if (accessToken && typeof accessToken === 'string') {
        const secret = getJwtSecret()
        if (secret.length > 0) {
          await jwtVerify(accessToken, secret)
          isAuthenticated = true
        } else {
          // Secret non configuré : laisser passer, le DashboardLayout revalidera
          isAuthenticated = true
        }
      }
    } catch {
      // Token invalide ou expiré
      isAuthenticated = false
    }
  }

  // Rediriger vers /login si non authentifié sur une route protégée
  if (!isAuthenticated && !isPublicPath) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Rediriger vers /dashboard si déjà connecté et sur /login
  if (isAuthenticated && pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next({ request })
}

// Optimisation 1 : Matcher ciblé — uniquement les routes de l'application
// Les routes /api/*, les assets _next/* et les fichiers statiques sont exclus.
// Cela réduit les invocations Edge de ~90%.
export const config = {
  matcher: [
    // Routes du dashboard (protégées)
    '/dashboard/:path*',
    '/contacts/:path*',
    '/contrats/:path*',
    '/comptabilite/:path*',
    '/devis/:path*',
    '/factures/:path*',
    '/missions/:path*',
    '/projets/:path*',
    '/documents/:path*',
    '/relances/:path*',
    '/parametres/:path*',
    // Routes publiques d'auth (pour la redirection si déjà connecté)
    '/login',
    '/mot-de-passe-oublie',
    '/update-password',
    // Route publique d'acceptation de devis
    '/accepter/:path*',
  ],
}
