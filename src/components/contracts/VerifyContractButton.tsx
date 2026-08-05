'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, ShieldCheck, AlertTriangle } from 'lucide-react'
import { verifyContract } from '@/app/actions/contracts'

// Vérification NON bloquante par Exact : relit le contrat déjà généré et
// signale les écarts avec le devis actuel, sans jamais rien modifier —
// même garde-fou "signale seulement" que le reste de l'app.
export function VerifyContractButton({ contractId }: { contractId: string }) {
  const [isPending, startTransition] = useTransition()
  const [alertes, setAlertes] = useState<string[] | null>(null)

  function handleVerify() {
    setAlertes(null)
    startTransition(async () => {
      const result = await verifyContract(contractId)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setAlertes(result.alertes)
      if (result.alertes.length === 0) toast.success('Exact : rien à signaler')
    })
  }

  return (
    <div className="space-y-3">
      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        disabled={isPending}
        onClick={handleVerify}
        title="Exact relit le contrat et signale les écarts avec le devis actuel, sans rien modifier"
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
        {isPending ? 'Exact vérifie…' : 'Vérifier avec Exact'}
      </Button>

      {alertes !== null && alertes.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <div className="flex-1 space-y-1.5">
                <p className="text-sm text-amber-800 font-medium">
                  Exact a signalé {alertes.length} point{alertes.length > 1 ? 's' : ''} :
                </p>
                <ul className="text-xs text-amber-700 space-y-1 list-disc pl-4">
                  {alertes.map((a, i) => <li key={i}>{a}</li>)}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {alertes !== null && alertes.length === 0 && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-green-600 shrink-0" />
              <p className="text-sm text-green-800">
                Exact n'a rien à signaler — le contrat est cohérent avec le devis actuel.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
