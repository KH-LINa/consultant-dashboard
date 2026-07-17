import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getSettings } from '@/lib/settings'
import { QuotePDF } from '@/components/devis/quote-pdf'
import { InvoicePDF } from '@/components/factures/invoice-pdf'
import { checkRateLimit, clientId } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = await checkRateLimit({
    prefix: 'relance', identifier: clientId(request, user.id), max: 30, windowSec: 60,
  })
  if (!rl.success) {
    return NextResponse.json({ error: 'Trop de relances en peu de temps. Réessayez dans une minute.' }, { status: 429 })
  }

  const { type, id, to, subject, message } = await request.json()
  const settings = await getSettings()

  if (!settings.resend_api_key) {
    return NextResponse.json({ error: 'Clé API Resend non configurée. Allez dans Paramètres.' }, { status: 400 })
  }
  if (!settings.email_expediteur) {
    return NextResponse.json({ error: 'Email expéditeur non configuré. Allez dans Paramètres.' }, { status: 400 })
  }

  let pdfBuffer: Buffer
  let filename: string
  let docTitle: string
  let contactId: string | null = null

  if (type === 'devis') {
    const { data: quote } = await supabase.from('quotes').select('*').eq('id', id).single()
    if (!quote) return NextResponse.json({ error: 'Devis introuvable' }, { status: 404 })
    const { data: contact } = await supabase.from('contacts').select('*').eq('id', quote.contact_id).single()
    if (!contact) return NextResponse.json({ error: 'Contact introuvable' }, { status: 404 })
    contactId = contact.id

    const num = `DEV-${new Date(quote.created_at).getFullYear()}-${quote.id.slice(0, 6).toUpperCase()}`
    filename = `${num}.pdf`
    docTitle = quote.titre

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pdfBuffer = await renderToBuffer(createElement(QuotePDF as any, {
      quote, contact,
      consultantName: settings.consultant_nom,
      siret: settings.consultant_siret,
      email: settings.consultant_email,
      telephone: settings.consultant_telephone,
    }) as any)
  } else {
    const { data: invoice } = await supabase.from('invoices').select('*').eq('id', id).single()
    if (!invoice) return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 })
    const { data: contact } = await supabase.from('contacts').select('*').eq('id', invoice.contact_id).single()
    if (!contact) return NextResponse.json({ error: 'Contact introuvable' }, { status: 404 })
    contactId = contact.id

    filename = `${invoice.numero}.pdf`
    docTitle = invoice.titre

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pdfBuffer = await renderToBuffer(createElement(InvoicePDF as any, {
      invoice, contact,
      consultantName: settings.consultant_nom,
      siret: settings.consultant_siret,
      email: settings.consultant_email,
      telephone: settings.consultant_telephone,
    }) as any)
  }

  const resend = new Resend(settings.resend_api_key)
  const { error } = await resend.emails.send({
    from: `${settings.consultant_nom} <${settings.email_expediteur}>`,
    to: [to],
    subject: subject || `Rappel — ${docTitle}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
        <h2 style="color: #1d4ed8;">${settings.consultant_nom}</h2>
        <p style="white-space: pre-line;">${message}</p>
        <hr style="border-color: #e5e7eb; margin: 24px 0;" />
        <p style="font-size: 12px; color: #6b7280;">
          ${settings.consultant_nom} — Auto-entrepreneur — SIRET : ${settings.consultant_siret}<br/>
          TVA non applicable — art. 293 B du CGI
        </p>
      </div>
    `,
    attachments: [{ filename, content: pdfBuffer }],
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Enregistrer la relance
  await supabase.from('reminders').insert({
    type,
    document_id: id,
    contact_id: contactId,
    email_to: to,
  })

  return NextResponse.json({ success: true })
}
