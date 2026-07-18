import type { Metadata } from 'next'
import Vitrine from './Vitrine'

export const metadata: Metadata = {
  title: 'i·a·infinity — Conseil Lean & IA Industrielle | Khelaf FEDILA',
  description:
    "Consultant Lean & IA industrielle. Je stabilise vos processus par le Lean, puis les amplifie avec l'intelligence artificielle. Diagnostic gratuit pour PME, ETI et groupes industriels.",
  openGraph: {
    title: 'i·a·infinity — Conseil Lean & IA Industrielle',
    description:
      "Stabiliser vos opérations par le Lean, puis les amplifier avec l'IA. Diagnostic gratuit.",
    type: 'website',
  },
}

export default function SitePage() {
  return <Vitrine />
}
