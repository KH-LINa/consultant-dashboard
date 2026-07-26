import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Pages publiques (accessibles sans authentification)
const PUBLIC_PAGES = [
  '/login',
  '/accepter',            // page publique d'acceptation de devis (token secret)
  '/site',                // site vitrine public (prospection)
  '/mot-de-passe-oublie',
  '/update-password',
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Les routes API gèrent elles-mêmes leur authentification (clé/secret/getUser).
  // On ne les redirige jamais vers /login (cela casserait les webhooks et appels JSON).
  if (pathname.startsWith('/api')) {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Session validée CÔTÉ SERVEUR (getUser interroge le serveur Auth, non falsifiable)
  const { data: { user } } = await supabase.auth.getUser()

  const isPublicPage = PUBLIC_PAGES.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  )

  // Défense en profondeur : TOUTE page non publique exige une session.
  // Une nouvelle route admin est donc protégée par défaut, sans config supplémentaire.
  if (!user && !isPublicPage) {
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  // Rôle d'accès (admin/manager/collaborateur) — un compte authentifié sans
  // profil (ex. compte créé manuellement mais jamais rattaché à un rôle)
  // n'a accès à rien, même connecté.
  let role: string | null = null
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    role = profile?.role ?? null
  }

  if (user && !role && !isPublicPage) {
    return NextResponse.redirect(new URL('/login?erreur=acces_refuse', request.url))
  }

  // Un utilisateur déjà connecté (avec un rôle valide) qui va sur /login
  // est renvoyé vers son espace.
  if (user && role && pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL(role === 'collaborateur' ? '/mon-planning' : '/dashboard', request.url))
  }

  // Un collaborateur n'a accès qu'à son planning et ses notifications — tout
  // le reste de l'outil (contacts, devis, factures, comptabilité, gestion des
  // utilisateurs...) lui est fermé.
  if (
    role === 'collaborateur' && !isPublicPage
    && !pathname.startsWith('/mon-planning')
    && !pathname.startsWith('/notifications')
  ) {
    return NextResponse.redirect(new URL('/mon-planning', request.url))
  }

  // La gestion des utilisateurs est réservée à l'admin (le manager a accès
  // au reste des paramètres, mais pas à la gestion des comptes/rôles).
  if (role && role !== 'admin' && pathname.startsWith('/parametres/utilisateurs')) {
    return NextResponse.redirect(new URL('/parametres', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
