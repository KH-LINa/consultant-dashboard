import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getSettings } from '@/lib/settings'
import { ContractPDF } from '@/lib/pdf/contract'
import { checkRateLimit, clientId } from '@/lib/rate-limit'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const rl = await checkRateLimit({
    prefix: 'send-contract', identifier: clientId(request, user.id), max: 20, windowSec: 60,
  })
  if (!rl.success) {
    return NextResponse.json({ error: 'Trop d\'envois en peu de temps. Réessayez dans une minute.' }, { status: 429 })
  }

  const { data: contract } = await supabase
    .from('contracts')
    .select('*, contact:contacts(*)')
    .eq('id', params.id)
    .single()

  if (!contract) return NextResponse.json({ error: 'Contrat introuvable' }, { status: 404 })
  if (contract.statut !== 'brouillon') {
    return NextResponse.json({ error: 'Ce contrat a déjà été envoyé ou archivé' }, { status: 400 })
  }

  const contact = contract.contact
  if (!contact?.email) {
    return NextResponse.json({ error: 'Le contact n\'a pas d\'adresse email' }, { status: 400 })
  }

  const settings = await getSettings()

  if (!settings.resend_api_key) {
    return NextResponse.json({ error: 'Clé API Resend non configurée. Allez dans Paramètres.' }, { status: 400 })
  }
  if (!settings.email_expediteur) {
    return NextResponse.json({ error: 'Email expéditeur non configuré. Allez dans Paramètres.' }, { status: 400 })
  }

  // Génération du PDF
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfBuffer = await renderToBuffer(createElement(ContractPDF as any, {
    numero:         contract.numero,
    contenu:        contract.contenu,
    consultantName: settings.consultant_nom,
    siret:          settings.consultant_siret,
    createdAt:      contract.created_at,
  }) as any)

  const filename = `${contract.numero}.pdf`

  // Upload dans le bucket Storage "contracts" (PDF officiel envoyé)
  const storagePath = `${params.id}/${filename}`
  const { error: uploadError } = await supabase.storage
    .from('contracts')
    .upload(storagePath, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    })

  const pdf_url = uploadError ? null : storagePath

  // Envoi email via Resend
  const resend = new Resend(settings.resend_api_key)

  const body = await request.json().catch(() => ({}))
  const customMessage = body?.message as string | undefined

  const { error: emailError } = await resend.emails.send({
    from: `${settings.consultant_nom} <${settings.email_expediteur}>`,
    to: [contact.email],
    subject: `Contrat de prestation — ${contract.numero}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
        <h2 style="color: #1d4ed8;">${settings.consultant_nom}</h2>
        <p style="white-space: pre-line;">${
          customMessage ||
          `Bonjour,\n\nVeuillez trouver ci-joint votre contrat de prestation de services (${contract.numero}).\n\nMerci de le retourner signé dès que possible.`
        }</p>
        <hr style="border-color: #e5e7eb; margin: 24px 0;" />
        <p style="font-size: 12px; color: #6b7280;">
          ${settings.consultant_nom} — Auto-entrepreneur — SIRET : ${settings.consultant_siret}<br/>
          Dispensé d'immatriculation au RCS et au RM<br/>
          TVA non applicable — art. 293 B du CGI
        </p>
      </div>
    `,
    attachments: [{ filename, content: pdfBuffer }],
  })

  if (emailError) {
    return NextResponse.json({ error: emailError.message }, { status: 500 })
  }

  // Mise à jour du statut
  await supabase
    .from('contracts')
    .update({
      statut:  'envoye',
      sent_at: new Date().toISOString(),
      ...(pdf_url ? { pdf_url } : {}),
    })
    .eq('id', params.id)

  return NextResponse.json({ success: true })
}
