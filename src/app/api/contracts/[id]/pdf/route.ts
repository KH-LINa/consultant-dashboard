import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getSettings } from '@/lib/settings'
import { ContractPDF } from '@/lib/pdf/contract'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: contract } = await supabase
    .from('contracts')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!contract) return NextResponse.json({ error: 'Contrat introuvable' }, { status: 404 })

  const settings = await getSettings()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfBuffer = await renderToBuffer(createElement(ContractPDF as any, {
    numero:         contract.numero,
    contenu:        contract.contenu,
    consultantName: settings.consultant_nom,
    siret:          settings.consultant_siret,
    createdAt:      contract.created_at,
  }) as any)

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${contract.numero}.pdf"`,
    },
  })
}
