import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRateLimit, clientId } from '@/lib/rate-limit'

/**
 * Réception des demandes du site vitrine (formulaire public).
 * Crée un contact de type "prospect" dans le dashboard, puis envoie
 * une notification email au consultant (best-effort).
 *
 * Public et non authentifié : on utilise donc le client admin (service_role)
 * et on rattache le prospect au compte du consultant via LEAD_OWNER_USER_ID.
 * Protections : rate-limit par IP + honeypot anti-bot + validation.
 */

// Compte propriétaire auquel sont rattachés les prospects entrants.
const OWNER_USER_ID =
  process.env.LEAD_OWNER_USER_ID ?? '513b8bf8-f9b4-48cc-88c6-52101b1f07cc'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

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

  // Notification email au consultant — best-effort : ne bloque JAMAIS la création du prospect.
  try {
    const { data: rows } = await supabase
      .from('settings').select('key, value').eq('user_id', OWNER_USER_ID)
    const s = Object.fromEntries((rows ?? []).map((r) => [r.key, r.value ?? '']))
    const notifyTo = s.notification_email || s.consultant_email || s.email_expediteur

    if (!s.resend_api_key || !s.email_expediteur || !notifyTo) {
      console.error('[leads] notif ignorée — config incomplète', {
        hasKey: !!s.resend_api_key, sender: s.email_expediteur || null, notifyTo: notifyTo || null,
      })
    } else {
      const resend = new Resend(s.resend_api_key)
      const fromName = s.consultant_nom || 'i·a·infinity'
      const { data: mailData, error: mailErr } = await resend.emails.send({
        from: `${fromName} <${s.email_expediteur}>`,
        to: [notifyTo],
        replyTo: email,
        subject: `Nouveau prospect — ${nom}${entreprise ? ` (${entreprise})` : ''}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
            <h2 style="color: #534AB7;">Nouveau prospect via le site</h2>
            <p style="color:#565073;">Une demande vient d'arriver depuis votre site vitrine. Le contact a été ajouté à votre dashboard.</p>
            <table style="width:100%; border-collapse:collapse; margin:20px 0; font-size:14px;">
              <tr><td style="padding:6px 0; color:#857FA0; width:120px;">Nom</td><td style="padding:6px 0;"><strong>${esc(nom)}</strong></td></tr>
              <tr><td style="padding:6px 0; color:#857FA0;">Entreprise</td><td style="padding:6px 0;">${esc(entreprise)}</td></tr>
              <tr><td style="padding:6px 0; color:#857FA0;">Email</td><td style="padding:6px 0;"><a href="mailto:${esc(email)}" style="color:#534AB7;">${esc(email)}</a></td></tr>
              ${telephone ? `<tr><td style="padding:6px 0; color:#857FA0;">Téléphone</td><td style="padding:6px 0;">${esc(telephone)}</td></tr>` : ''}
              ${besoin ? `<tr><td style="padding:6px 0; color:#857FA0;">Besoin</td><td style="padding:6px 0;">${esc(besoin)}</td></tr>` : ''}
            </table>
            ${message ? `<p style="color:#857FA0; margin-bottom:4px;">Message :</p><blockquote style="margin:0; padding:12px 16px; background:#EEEBFA; border-radius:8px; white-space:pre-line;">${esc(message)}</blockquote>` : ''}
            <p style="font-size:12px; color:#857FA0; margin-top:24px;">Répondez directement à cet email pour recontacter le prospect.</p>
          </div>
        `,
      })
      if (mailErr) {
        console.error('[leads] échec envoi notification Resend:', JSON.stringify(mailErr))
      } else {
        console.log('[leads] notification envoyée, id:', mailData?.id)
      }
    }
  } catch (e) {
    // Le prospect est déjà enregistré ; on logge mais on n'échoue jamais la requête.
    console.error('[leads] exception notification:', e)
  }

  return NextResponse.json({ success: true })
}
