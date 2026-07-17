import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, clientId } from '@/lib/rate-limit'

/**
 * Webhook de réception des réponses email (inbound).
 * Compatible avec un payload générique de type Resend Inbound / autres fournisseurs.
 *
 * Le token du devis est transporté via l'adresse de réponse en plus-addressing :
 *   local+devis-<token>@domaine
 */
export async function POST(request: NextRequest) {
  // Anti-abus : max 60 requêtes / minute par IP
  const rl = await checkRateLimit({
    prefix: 'inbound', identifier: clientId(request), max: 60, windowSec: 60,
  })
  if (!rl.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  let payload: any
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Resend encapsule les données dans { type, data: {...} }
  const data = payload.data ?? payload

  // Récupérer la liste des destinataires (selon le format du fournisseur)
  const recipients: string[] = []
  const collect = (v: any) => {
    if (!v) return
    if (typeof v === 'string') recipients.push(v)
    else if (Array.isArray(v)) v.forEach((x) => collect(typeof x === 'string' ? x : x?.address ?? x?.email))
    else if (v.address) recipients.push(v.address)
    else if (v.email) recipients.push(v.email)
  }
  collect(data.to)
  collect(data.recipient)
  collect(data.envelope?.to)

  // Extraire le token depuis une adresse local+devis-<token>@domaine
  let token: string | null = null
  const tokenRegex = /\+devis-([0-9a-fA-F-]{36})@/
  for (const r of recipients) {
    const m = r.match(tokenRegex)
    if (m) { token = m[1]; break }
  }

  if (!token) {
    // Pas de token identifiable — on ignore proprement (200 pour ne pas faire retenter le webhook)
    return NextResponse.json({ ignored: true, reason: 'no token' })
  }

  const expediteur =
    (typeof data.from === 'string' ? data.from : data.from?.address ?? data.from?.email) ?? 'inconnu'
  const sujet = data.subject ?? '(sans objet)'
  const contenu = data.text ?? data.html ?? data.body ?? ''

  const supabase = await createClient()
  const { data: result, error } = await supabase.rpc('add_quote_message', {
    p_token: token,
    p_expediteur: expediteur,
    p_sujet: sujet,
    p_contenu: typeof contenu === 'string' ? contenu.slice(0, 10000) : '',
  })

  if (error || (result as any)?.error) {
    return NextResponse.json({ error: error?.message ?? (result as any)?.error }, { status: 200 })
  }

  return NextResponse.json({ success: true })
}
