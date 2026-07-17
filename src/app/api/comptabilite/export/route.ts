import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const year = parseInt(
    request.nextUrl.searchParams.get('year') ?? String(new Date().getFullYear()),
    10
  )

  const { data: invoices } = await supabase
    .from('invoices')
    .select('numero, titre, montant_ht, statut, date_emission, date_echeance, contact:contacts(nom, entreprise)')
    .order('date_emission', { ascending: true })

  const list = (invoices ?? []).filter(
    (i) => new Date(i.date_emission).getUTCFullYear() === year
  )

  // En-têtes CSV
  const headers = [
    'Numéro', 'Date émission', 'Date échéance', 'Client', 'Entreprise',
    'Titre', 'Montant HT (€)', 'Statut',
  ]

  function esc(v: any): string {
    const s = String(v ?? '')
    if (s.includes(';') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`
    }
    return s
  }

  const rows = list.map((i: any) => [
    i.numero,
    new Date(i.date_emission).toLocaleDateString('fr-FR'),
    i.date_echeance ? new Date(i.date_echeance).toLocaleDateString('fr-FR') : '',
    i.contact?.nom ?? '',
    i.contact?.entreprise ?? '',
    i.titre,
    (i.montant_ht || 0).toFixed(2).replace('.', ','),
    i.statut,
  ].map(esc).join(';'))

  // Ligne de total (CA encaissé)
  const totalPaye = list
    .filter((i: any) => i.statut === 'payée')
    .reduce((s: number, i: any) => s + (i.montant_ht || 0), 0)

  const csvLines = [
    headers.join(';'),
    ...rows,
    '',
    `TOTAL CA ENCAISSÉ ${year};;;;;;${totalPaye.toFixed(2).replace('.', ',')};payée`,
  ]

  // BOM UTF-8 pour Excel + séparateur ;
  const csv = '﻿' + csvLines.join('\r\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="comptabilite-${year}.csv"`,
    },
  })
}
