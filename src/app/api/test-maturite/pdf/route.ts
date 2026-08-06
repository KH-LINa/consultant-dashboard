import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRateLimit, clientId } from '@/lib/rate-limit'
import { LEVIERS } from '@/lib/maturite'
import { MaturityReportPDF } from '@/lib/pdf/maturity-report'
import type { LevierChamp } from '@/lib/maturite-test'
import type { NiveauMaturite, Recommandation } from '@/lib/types'

/**
 * Génère le rapport PDF téléchargeable du test de maturité IA public. Ne
 * relit rien en base : les données du résultat (déjà calculées côté
 * client juste après la soumission) sont renvoyées directement dans le
 * corps de la requête — pas de endpoint public consultable par id.
 */

const OWNER_USER_ID =
  process.env.LEAD_OWNER_USER_ID ?? '513b8bf8-f9b4-48cc-88c6-52101b1f07cc'

const NIVEAUX_VALIDES: NiveauMaturite[] = ['sait_faire', 'partiel', 'ignore']
const RECOS_VALIDES: Recommandation[] = ['go', 'go_conditionnel', 'no_go']

export async function POST(request: NextRequest) {
  const rl = await checkRateLimit({
    prefix: 'test-maturite-pdf', identifier: clientId(request), max: 10, windowSec: 60,
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

  const nom = String(body.nom ?? '').trim().slice(0, 200)
  const entreprise = String(body.entreprise ?? '').trim().slice(0, 200)
  const niveaux = body.niveaux as Record<LevierChamp, NiveauMaturite>
  const score = Number(body.score)
  const recommandation = String(body.recommandation ?? '') as Recommandation

  if (!nom) return NextResponse.json({ error: 'Nom requis.' }, { status: 400 })
  if (!recommandation || !RECOS_VALIDES.includes(recommandation)) {
    return NextResponse.json({ error: 'Résultat de test invalide.' }, { status: 400 })
  }
  if (!niveaux || LEVIERS.some(({ champ }) => !NIVEAUX_VALIDES.includes(niveaux[champ]))) {
    return NextResponse.json({ error: 'Résultat de test invalide.' }, { status: 400 })
  }
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    return NextResponse.json({ error: 'Résultat de test invalide.' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data: rows } = await supabase.from('settings').select('key, value').eq('user_id', OWNER_USER_ID)
  const s = Object.fromEntries((rows ?? []).map((r) => [r.key, r.value ?? '']))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(createElement(MaturityReportPDF as any, {
    nom, entreprise, niveaux, score, recommandation,
    consultantName: s.consultant_nom || 'Yndra',
    email: s.consultant_email || '',
    telephone: s.consultant_telephone || '',
  }) as any)

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="rapport-maturite-ia.pdf"',
    },
  })
}
