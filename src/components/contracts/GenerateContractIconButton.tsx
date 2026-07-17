'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { FileSignature, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { generateContract } from '@/app/actions/contracts'

/**
 * Action compacte (icône) pour la colonne "Actions" de la liste des devis.
 * Crée un contrat brouillon depuis le template de l'offre, puis redirige.
 * Idempotent : si un contrat actif existe déjà, ouvre celui-ci.
 */
export function GenerateContractIconButton({ quoteId }: { quoteId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    try {
      const res = await generateContract(quoteId)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(res.existing ? 'Contrat existant ouvert' : 'Contrat brouillon créé ✓')
      router.push(`/contrats/${res.contractId}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleClick}
      disabled={loading}
      title="Générer le contrat"
      className="text-indigo-600 hover:text-indigo-800"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSignature className="h-4 w-4" />}
    </Button>
  )
}
