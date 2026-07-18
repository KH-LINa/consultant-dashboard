import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRateLimit, clientId } from '@/lib/rate-limit'

/**
 * Réception des demandes du site vitrine (formulaire public).
 * Crée un contact de type "prospect" dans le dashboard.
 *
 * Public et non authentifié : on utilise donc le client admin (service_role)
 * et on rattache le prospect au compte du consultant via LEAD_OWNER_USER_ID.
 * Protections : rate-limit par IP + honeypot anti-bot + validation.
 */

// Compte propriétaire auquel sont rattachés les prospects entrants.
const OWNER_USER_ID =
  process.env.LEAD_OWNER_USER_ID ?? '513b8bf8-f9b4-48cc-88c6-52101b1f07cc'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: NextRequest) {
  // Anti-abus : 10 demandes / minute / IP
  const rl = await checkRateLimit({
    prefix: 'leads', identifier: clientId(request), max: 10, windowSec: 60,
  })
  if (!rl.success) {
    return NextResponse.json({ error: 'Trop de demandes, réessayez dans un instant.' }, { status: 429 })
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 })
  }

  // Honeypot : rempli uniquement par les bots -> on ignore silencieusement (200).
  if (typeof body.website === 'string' && body.website.trim() !== '') {
    return NextResponse.json({ success: true })
  }

  const nom = String(body.nom ?? '').trim().slice(0, 200)
  const email = String(body.email ?? '').trim().slice(0, 200)
  const entreprise = String(body.entreprise ?? '').trim().slice(0, 200)
  const telephone = String(body.telephone ?? '').trim().slice(0, 40)
  const besoin = String(body.besoin ?? '').trim().slice(0, 200)
  const message = String(body.message ?? '').trim().slice(0, 5000)

  if (!nom || !entreprise) {
    return NextResponse.json({ error: 'Nom et entreprise sont requis.' }, { status: 400 })
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Adresse email invalide.' }, { status: 400 })
  }

  const notes = [
    'Demande reçue depuis le site vitrine.',
    besoin && `Besoin : ${besoin}`,
    message && `Message : ${message}`,
  ].filter(Boolean).join('\n')

  const supabase = createAdminClient()
  const { error } = await supabase.from('contacts').insert({
    type: 'prospect',
    nom,
    email: email || null,
    telephone: telephone || null,
    entreprise: entreprise || null,
    notes: notes || null,
    user_id: OWNER_USER_ID,
  })

  if (error) {
    return NextResponse.json({ error: "Une erreur est survenue, réessayez plus tard." }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
