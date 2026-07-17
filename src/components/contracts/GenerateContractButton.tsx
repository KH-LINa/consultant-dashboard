'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { FileSignature, Loader2 } from 'lucide-react'
import { generateContract } from '@/app/actions/contracts'

export function GenerateContractButton({ quoteId }: { quoteId: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleClick() {
    setLoading(true)
    try {
      const result = await generateContract(quoteId)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      if (result.existing) {
        toast.info('Un contrat existe déjà pour ce devis')
      } else {
        toast.success('Contrat généré avec succès !')
      }
      router.push(`/contrats/${result.contractId}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button onClick={handleClick} disabled={loading} className="gap-2 bg-blue-700 hover:bg-blue-800">
      {loading
        ? <Loader2 className="h-4 w-4 animate-spin" />
        : <FileSignature className="h-4 w-4" />}
      {loading ? 'Génération en cours…' : 'Générer le contrat'}
    </Button>
  )
}
