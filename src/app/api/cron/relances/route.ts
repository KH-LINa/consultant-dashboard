import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import { QuotePDF } from '@/components/devis/quote-pdf'
import { InvoicePDF } from '@/components/factures/invoice-pdf'

export const dynamic = 'force-dynamic'

const NIVEAUX = [7, 14] as const

function joursDepuis(date: string): number {
  return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24))
}

function eur(n: number) {
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
}

export async function GET(request: NextRequest) {
  // --- Sécurité : vérifier le secret ---
  const auth = request.headers.get('authorization')
  const secretParam = request.nextUrl.searchParams.get('secret')
  const expected = process.env.CRON_SECRET
  if (!expected || (auth !== `Bearer ${expected}` && secretParam !== expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  // --- Paramètres ---
  const { data: settingsRows } = await supabase.from('settings').select('key, value')
  const settings = Object.fromEntries((settingsRows ?? []).map((r) => [r.key, r.value ?? '']))

  if (settings.relances_auto !== 'true') {
    return NextResponse.json({ skipped: 'relances automatiques désactivées' })
  }
  if (!settings.resend_api_key || !settings.email_expediteur) {
    return NextResponse.json({ skipped: 'configuration email incomplète' })
  }

  const origin = new URL(request.url).origin
  const resend = new Resend(settings.resend_api_key)

  // --- Récupération des documents ---
  const [{ data: quotes }, { data: invoices }, { data: reminders }] = await Promise.all([
    supabase.from('quotes').select('*, contact:contacts(nom, email, telephone, entreprise)').eq('statut', 'envoyé'),
    supabase.from('invoices').select('*, contact:contacts(nom, email, telephone, entreprise)').eq('statut', 'envoyée'),
    supabase.from('reminders').select('type, document_id, niveau'),
  ])

  const sentSet = new Set(
    (reminders ?? []).map((r) => `${r.type}:${r.document_id}:${r.niveau}`)
  )

  const results: { type: string; id: string; niveau: number; to: string; ok: boolean; error?: string }[] = []

  async function envoyer(opts: {
    type: 'devis' | 'facture'
    id: string
    niveau: number
    to: string
    subject: string
    message: string
    pdfBuffer: Buffer
    filename: string
    contactId: string | null
    acceptUrl?: string | null
  }) {
    const { error } = await resend.emails.send({
      from: `${settings.consultant_nom} <${settings.email_expediteur}>`,
      to: [opts.to],
      subject: opts.subject,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
          <h2 style="color: #1d4ed8;">${settings.consultant_nom}</h2>
          <p style="white-space: pre-line;">${opts.message}</p>
          ${opts.acceptUrl ? `
          <div style="text-align:center; margin:24px 0;">
            <a href="${opts.acceptUrl}" style="display:inline-block; background:#1d4ed8; color:#fff; text-decoration:none; padding:12px 24px; border-radius:8px; font-weight:bold;">
              Consulter et répondre au devis →
            </a>
          </div>` : ''}
          <hr style="border-color:#e5e7eb; margin:24px 0;" />
          <p style="font-size:12px; color:#6b7280;">
            ${settings.consultant_nom} — Auto-entrepreneur — SIRET : ${settings.consultant_siret}<br/>
            TVA non applicable — art. 293 B du CGI
          </p>
        </div>`,
      attachments: [{ filename: opts.filename, content: opts.pdfBuffer }],
    })

    if (error) {
      results.push({ type: opts.type, id: opts.id, niveau: opts.niveau, to: opts.to, ok: false, error: error.message })
      return
    }

    await supabase.from('reminders').insert({
      type: opts.type,
      document_id: opts.id,
      contact_id: opts.contactId,
      email_to: opts.to,
      niveau: opts.niveau,
    })
    results.push({ type: opts.type, id: opts.id, niveau: opts.niveau, to: opts.to, ok: true })
  }

  // --- DEVIS (référence : date d'envoi réelle, sinon création) ---
  for (const q of (quotes ?? []) as any[]) {
    const email = q.contact?.email
    if (!email) continue
    const jours = joursDepuis(q.sent_at ?? q.created_at)
    for (const niveau of NIVEAUX) {
      if (jours >= niveau && !sentSet.has(`devis:${q.id}:${niveau}`)) {
        const num = `DEV-${new Date(q.created_at).getFullYear()}-${q.id.slice(0, 6).toUpperCase()}`
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pdf = await renderToBuffer(createElement(QuotePDF as any, {
          quote: q, contact: q.contact,
          consultantName: settings.consultant_nom, siret: settings.consultant_siret,
          email: settings.consultant_email, telephone: settings.consultant_telephone,
        }) as any)
        await envoyer({
          type: 'devis', id: q.id, niveau, to: email,
          subject: `Relance — Devis ${q.titre}`,
          message: `Bonjour,\n\nJe me permets de revenir vers vous concernant le devis "${q.titre}" (${eur(q.montant_ht || 0)}) transmis il y a ${jours} jours.\n\nAvez-vous eu l'occasion de l'étudier ? Je reste à votre disposition.\n\nCordialement,`,
          pdfBuffer: pdf, filename: `${num}.pdf`, contactId: q.contact_id,
          acceptUrl: `${origin}/accepter/${q.public_token}`,
        })
        sentSet.add(`devis:${q.id}:${niveau}`)
      }
    }
  }

  // --- FACTURES (référence : échéance si définie, sinon émission) ---
  for (const inv of (invoices ?? []) as any[]) {
    const email = inv.contact?.email
    if (!email) continue
    const ref = inv.date_echeance ?? inv.date_emission
    const jours = joursDepuis(ref)
    for (const niveau of NIVEAUX) {
      if (jours >= niveau && !sentSet.has(`facture:${inv.id}:${niveau}`)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pdf = await renderToBuffer(createElement(InvoicePDF as any, {
          invoice: inv, contact: inv.contact,
          consultantName: settings.consultant_nom, siret: settings.consultant_siret,
          email: settings.consultant_email, telephone: settings.consultant_telephone,
        }) as any)
        await envoyer({
          type: 'facture', id: inv.id, niveau, to: email,
          subject: `Relance — Facture impayée ${inv.titre}`,
          message: `Bonjour,\n\nSauf erreur de ma part, la facture "${inv.titre}" (${eur(inv.montant_ht || 0)}) demeure impayée (${jours} jours après ${inv.date_echeance ? 'son échéance' : 'son émission'}).\n\nJe vous remercie de bien vouloir procéder à son règlement dans les meilleurs délais.\n\nCordialement,`,
          pdfBuffer: pdf, filename: `${inv.numero}.pdf`, contactId: inv.contact_id,
        })
        sentSet.add(`facture:${inv.id}:${niveau}`)
      }
    }
  }

  return NextResponse.json({
    success: true,
    date: new Date().toISOString(),
    envoyees: results.filter((r) => r.ok).length,
    erreurs: results.filter((r) => !r.ok).length,
    details: results,
  })
}
