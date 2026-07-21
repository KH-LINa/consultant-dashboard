import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, clientId } from '@/lib/rate-limit'
import { orchestrer } from '@/lib/agents/orchestrator'

export const dynamic = 'force-dynamic'
// Un run peut enchaîner routage + sous-agents parallèles + synthèse :
// on prend la limite d'exécution maximale des fonctions Vercel du plan actuel.
export const maxDuration = 60

export async function POST(request: NextRequest) {
  // Auth : vérification serveur via getUser() (jamais getSession()),
  // cohérente avec le middleware existant.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  // Anti-abus : un run orchestré coûte plusieurs appels Claude.
  const rl = await checkRateLimit({
    prefix: 'ai-agents', identifier: clientId(request, user.id), max: 10, windowSec: 60,
  })
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Trop de demandes en peu de temps. Réessayez dans une minute.' },
      { status: 429 }
    )
  }

  // Clé API côté serveur uniquement.
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'Clé ANTHROPIC_API_KEY non configurée côté serveur.' },
      { status: 500 }
    )
  }
  // Garde-fou : une ANTHROPIC_BASE_URL résiduelle pointant vers localhost
  // (proxy de dev) ferait échouer tous les appels en production.
  const baseUrl = process.env.ANTHROPIC_BASE_URL ?? ''
  if (/localhost|127\.0\.0\.1/.test(baseUrl)) {
    return NextResponse.json(
      { error: `ANTHROPIC_BASE_URL pointe vers ${baseUrl} : supprimez cette variable d'environnement.` },
      { status: 500 }
    )
  }

  let demande = ''
  try {
    const body = await request.json()
    demande = (body.demande ?? '').toString().trim()
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 })
  }
  if (!demande) {
    return NextResponse.json({ error: 'Veuillez décrire votre demande.' }, { status: 400 })
  }
  if (demande.length > 20000) {
    return NextResponse.json({ error: 'Demande trop longue (20 000 caractères max).' }, { status: 400 })
  }

  try {
    const resultat = await orchestrer(demande)
    return NextResponse.json(resultat)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    return NextResponse.json({ error: `Erreur d'orchestration : ${message}` }, { status: 500 })
  }
}
