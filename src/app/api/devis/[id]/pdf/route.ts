import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getSettings } from '@/lib/settings'
import { QuotePDF } from '@/components/devis/quote-pdf'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [{ data: quote }, settings] = await Promise.all([
    supabase.from('quotes').select('*').eq('id', params.id).single(),
    getSettings(),
  ])
  if (!quote) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: contact } = await supabase.from('contacts').select('*').eq('id', quote.contact_id).single()
  if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(createElement(QuotePDF as any, {
    quote, contact,
    consultantName: settings.consultant_nom,
    siret: settings.consultant_siret,
    email: settings.consultant_email,
    telephone: settings.consultant_telephone,
  }) as any)

  const quoteNumber = `DEV-${new Date(quote.created_at).getFullYear()}-${quote.id.slice(0, 6).toUpperCase()}`
  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${quoteNumber}.pdf"`,
    },
  })
}
