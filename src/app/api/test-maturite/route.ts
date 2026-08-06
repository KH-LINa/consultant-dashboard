import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRateLimit, clientId } from '@/lib/rate-limit'
import { LEVIERS, NIVEAU_CONFIG, RECOMMANDATION_CONFIG } from '@/lib/maturite'
import { PALIER_PUBLIC, type LevierChamp } from '@/lib/maturite-test'
import type { NiveauMaturite, Recommandation } from '@/lib/types'

/**
 * Réception du test de maturité IA public (site vitrine) — même schéma que
 * /api/leads : crée un contact "prospect" (client admin, non authentifié),
 * puis un maturity_assessments lié, puis notifie le consultant par email.
 * Le score/niveaux sont recalculés côté client (lib/maturite-test.ts) et
 * envoyés ici déjà agrégés — enjeu marketing, pas une donnée à haut risque,
 * donc pas besoin de tout recalculer côté serveur à partir des 18 réponses
 * brutes (qui ne sont pas conservées).
 */

const OWNER_USER_ID =
  process.env.LEAD_OWNER_USER_ID ?? '513b8bf8-f9b4-48cc-88c6-52101b1f07cc'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const NIVEAUX_VALIDES: NiveauMaturite[] = ['sait_faire', 'partiel', 'ignore']
const RECOS_VALIDES: Recommandation[] = ['go', 'go_conditionnel', 'no_go']

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export async function POST(request: NextRequest) {
  const rl = await checkRateLimit({
    prefix: 'test-maturite', identifier: clientId(request), max: 10, windowSec: 60,
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

  // Honeypot : rempli uniquement par les bots -> ignoré silencieusement (200).
  if (typeof body.website === 'string' && body.website.trim() !== '') {
    return NextResponse.json({ success: true })
  }

  const nom = String(body.nom ?? '').trim().slice(0, 200)
  const email = String(body.email ?? '').trim().slice(0, 200)
  const entreprise = String(body.entreprise ?? '').trim().slice(0, 200)
  const niveaux = body.niveaux as Record<LevierChamp, NiveauMaturite>
  const score = Number(body.score)
  const recommandation = String(body.recommandation ?? '') as Recommandation

  if (!nom) return NextResponse.json({ error: 'Nom requis.' }, { status: 400 })
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: 'Adresse email invalide.' }, { status: 400 })
  if (!recommandation || !RECOS_VALIDES.includes(recommandation)) {
    return NextResponse.json({ error: 'Résultat de test invalide.' }, { status: 400 })
  }
  if (!niveaux || LEVIERS.some(({ champ }) => !NIVEAUX_VALIDES.includes(niveaux[champ]))) {
    return NextResponse.json({ error: 'Résultat de test invalide.' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: contact, error: contactErr } = await supabase
    .from('contacts')
    .insert({
      type: 'prospect',
      nom,
      email,
      entreprise: entreprise || null,
      notes: 'Prospect créé via le test de maturité IA en ligne (site vitrine).',
      user_id: OWNER_USER_ID,
    })
    .select('id')
    .single()

  if (contactErr || !contact) {
    return NextResponse.json({ error: 'Une erreur est survenue, réessayez plus tard.' }, { status: 500 })
  }

  const assessmentPayload: Record<string, unknown> = {
    contact_id: contact.id,
    recommandation,
    notes: 'Auto-évaluation réalisée en ligne par le prospect, via le test de maturité IA du site vitrine.',
  }
  for (const { champ } of LEVIERS) assessmentPayload[champ] = niveaux[champ]

  const { error: assessErr } = await supabase.from('maturity_assessments').insert(assessmentPayload)
  if (assessErr) {
    // Le contact est déjà créé ; on ne fait pas échouer toute la requête pour autant.
    console.error('[test-maturite] échec enregistrement du résultat:', assessErr.message)
  }

  // Notification email au consultant — best-effort.
  try {
    const { data: rows } = await supabase.from('settings').select('key, value').eq('user_id', OWNER_USER_ID)
    const s = Object.fromEntries((rows ?? []).map((r) => [r.key, r.value ?? '']))
    const notifyTo = s.notification_email || s.consultant_email || s.email_expediteur

    if (s.resend_api_key && s.email_expediteur && notifyTo) {
      const resend = new Resend(s.resend_api_key)
      const fromName = s.consultant_nom || 'Yndra'
      const palier = PALIER_PUBLIC[recommandation]
      await resend.emails.send({
        from: `${fromName} <${s.email_expediteur}>`,
        to: [notifyTo],
        replyTo: email,
        subject: `Test de maturité IA rempli — ${nom}${entreprise ? ` (${entreprise})` : ''}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
            <h2 style="color: #534AB7;">Nouveau test de maturité IA rempli</h2>
            <table style="width:100%; border-collapse:collapse; margin:16px 0; font-size:14px;">
              <tr><td style="padding:6px 0; color:#857FA0; width:120px;">Nom</td><td style="padding:6px 0;"><strong>${esc(nom)}</strong></td></tr>
              ${entreprise ? `<tr><td style="padding:6px 0; color:#857FA0;">Entreprise</td><td style="padding:6px 0;">${esc(entreprise)}</td></tr>` : ''}
              <tr><td style="padding:6px 0; color:#857FA0;">Email</td><td style="padding:6px 0;"><a href="mailto:${esc(email)}" style="color:#534AB7;">${esc(email)}</a></td></tr>
              <tr><td style="padding:6px 0; color:#857FA0;">Résultat</td><td style="padding:6px 0;"><strong>${esc(RECOMMANDATION_CONFIG[recommandation].label)}</strong> — ${esc(palier.titre)} (score indicatif ${score}/100)</td></tr>
            </table>
            <p style="color:#857FA0; margin-bottom:4px;">Détail par levier :</p>
            <ul style="margin:0; padding-left:20px; font-size:13px; color:#374151;">
              ${LEVIERS.map(({ champ, label }) => `<li>${esc(label)} — ${esc(NIVEAU_CONFIG[niveaux[champ]].label)}</li>`).join('')}
            </ul>
            <p style="font-size:12px; color:#857FA0; margin-top:24px;">Répondez directement à cet email pour recontacter le prospect.</p>
          </div>
        `,
      })
    }
  } catch (e) {
    console.error('[test-maturite] exception notification:', e)
  }

  return NextResponse.json({ success: true })
}
