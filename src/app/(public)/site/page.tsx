import type { Metadata } from 'next'
import Vitrine from './Vitrine'

export const metadata: Metadata = {
  title: 'Yndra — Conseil Lean & IA Industrielle | Khelaf FEDILA',
  description:
    "Consultant Lean & IA industrielle. Je stabilise vos processus par le Lean, puis les amplifie avec l'intelligence artificielle. Testez gratuitement votre maturité IA en 5 minutes.",
  openGraph: {
    title: 'Yndra — Conseil Lean & IA Industrielle',
    description:
      "Stabiliser vos opérations par le Lean, puis les amplifier avec l'IA. Test de maturité IA gratuit.",
    type: 'website',
  },
}

export default function SitePage() {
  return <Vitrine />
}
