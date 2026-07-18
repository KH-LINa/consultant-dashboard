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

  // Un utilisateur déjà connecté qui va sur /login est renvoyé au tableau de bord
  if (user && pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
