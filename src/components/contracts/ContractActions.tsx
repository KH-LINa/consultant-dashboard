'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, Send, CheckCircle2, Archive, Download, AlertCircle } from 'lucide-react'
import { markContractSigned, archiveContract } from '@/app/actions/contracts'
import type { ContractStatus } from '@/lib/types'

type ConfirmAction = 'send' | 'sign' | 'archive' | null

interface ContractActionsProps {
  contractId: string
  statut: ContractStatus
  contactEmail: string | null
  numero: string
}

export function ContractActions({ contractId, statut, contactEmail, numero }: ContractActionsProps) {
  const router = useRouter()
  const [sending, setSending] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [confirm, setConfirm] = useState<ConfirmAction>(null)

  async function handleSend() {
    if (!contactEmail) {
      toast.error('Le contact n\'a pas d\'adresse email')
      return
    }
    setConfirm(null)
    setSending(true)
    try {
      const res = await fetch(`/api/contracts/${contractId}/send`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Erreur lors de l\'envoi')
        return
      }
      toast.success(`Contrat ${numero} envoyé à ${contactEmail}`)
      router.refresh()
    } finally {
      setSending(false)
    }
  }

  function handleMarkSigned() {
    setConfirm(null)
    startTransition(async () => {
      const result = await markContractSigned(contractId)
      if (result.ok) {
        toast.success('Contrat marqué comme signé')
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  function handleArchive() {
    setConfirm(null)
    startTransition(async () => {
      const result = await archiveContract(contractId)
      if (result.ok) {
        toast.success('Contrat archivé')
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  const isLoading = sending || isPending

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {/* Télécharger le PDF (toujours disponible) */}
        <Button variant="outline" size="sm" asChild className="gap-2">
          <a href={`/api/contracts/${contractId}/pdf`} download={`${numero}.pdf`}>
            <Download className="h-4 w-4" />
            Télécharger PDF
          </a>
        </Button>

        {/* Envoyer au client (brouillon uniquement) */}
        {statut === 'brouillon' && (
          <Button
            size="sm"
            className="gap-2 bg-blue-600 hover:bg-blue-700"
            disabled={isLoading}
            onClick={() => setConfirm(confirm === 'send' ? null : 'send')}
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Envoyer au client
          </Button>
        )}

        {/* Marquer comme signé (envoyé uniquement) */}
        {statut === 'envoye' && (
          <Button
            size="sm"
            className="gap-2 bg-green-600 hover:bg-green-700"
            disabled={isLoading}
            onClick={() => setConfirm(confirm === 'sign' ? null : 'sign')}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Marquer comme signé
          </Button>
        )}

        {/* Archiver */}
        {statut !== 'archive' && (
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-gray-500 hover:text-gray-700"
            disabled={isLoading}
            onClick={() => setConfirm(confirm === 'archive' ? null : 'archive')}
          >
            <Archive className="h-4 w-4" />
            Archiver
          </Button>
        )}
      </div>

      {/* Panneau de confirmation inline */}
      {confirm === 'send' && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
              <div className="flex-1 space-y-2">
                <p className="text-sm text-blue-800 font-medium">
                  Envoyer le contrat {numero} par email ?
                </p>
                <p className="text-xs text-blue-600">
                  Un PDF sera envoyé à <strong>{contactEmail}</strong>. Le statut passera à « Envoyé ».
                </p>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" onClick={handleSend} disabled={isLoading} className="bg-blue-600 hover:bg-blue-700 gap-1.5">
                    {sending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Confirmer l'envoi
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setConfirm(null)}>Annuler</Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {confirm === 'sign' && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
              <div className="flex-1 space-y-2">
                <p className="text-sm text-green-800 font-medium">
                  Marquer comme signé manuellement ?
                </p>
                <p className="text-xs text-green-600">
                  La date de signature sera enregistrée aujourd'hui.
                  (La signature YouSign électronique est prévue en Phase B.)
                </p>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" onClick={handleMarkSigned} disabled={isLoading} className="bg-green-600 hover:bg-green-700 gap-1.5">
                    {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Confirmer
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setConfirm(null)}>Annuler</Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {confirm === 'archive' && (
        <Card className="border-gray-200 bg-gray-50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-start gap-3">
              <Archive className="h-4 w-4 text-gray-500 mt-0.5 shrink-0" />
              <div className="flex-1 space-y-2">
                <p className="text-sm text-gray-700 font-medium">Archiver ce contrat ?</p>
                <p className="text-xs text-gray-500">
                  Il n'apparaîtra plus dans les listes actives.
                </p>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={handleArchive} disabled={isLoading} className="gap-1.5">
                    {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Archiver
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setConfirm(null)}>Annuler</Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
