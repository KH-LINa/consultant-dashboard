import type { Metadata } from 'next'
import TestMaturite from './TestMaturite'

export const metadata: Metadata = {
  title: 'Test de maturité IA gratuit | Yndra',
  description:
    "18 questions pour savoir, en 5 minutes, si votre organisation est prête à lancer un projet d'IA industrielle — et ce qu'il reste à préparer si ce n'est pas encore le cas.",
  openGraph: {
    title: 'Test de maturité IA — Yndra',
    description:
      "18 questions pour savoir si votre organisation est prête à lancer un projet d'IA industrielle.",
    type: 'website',
  },
}

export default function TestMaturitePage() {
  return <TestMaturite />
}
