'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, ShieldCheck, GanttChartSquare, FileSignature } from 'lucide-react'
import { verifyContract } from '@/app/actions/contracts'
import { verifyProjectPhases } from '@/app/actions/planning'

interface CoherenceCheckPanelProps {
  quoteId: string
  projectId: string | null
  contractId: string | null
}

type Section = string[] | null

// Vue d'ensemble : lance en parallèle la vérification du planning
// (Cadence) et celle du contrat (Exact) par rapport au devis actuel — les
// deux gardes-fous existent déjà séparément, ce panneau ne fait que les
// regrouper là où ils sont utiles ensemble (la fiche devis, source
// commune des deux). Ni l'un ni l'autre ne modifie quoi que ce soit : pour
// corriger, on renvoie vers la fiche projet ou la fiche contrat.
export function CoherenceCheckPanel({ quoteId, projectId, contractId }: CoherenceCheckPanelProps) {
  const [isPending, startTransition] = useTransition()
  const [planningAlertes, setPlanningAlertes] = useState<Section>(null)
  const [contratAlertes, setContratAlertes] = useState<Section>(null)
  const [checked, setChecked] = useState(false)

  if (!projectId && !contractId) return null

  function handleCheck() {
    setChecked(false)
    startTransition(async () => {
      const [resPlanning, resContrat] = await Promise.all([
        projectId ? verifyProjectPhases(quoteId) : Promise.resolve(null),
        contractId ? verifyContract(contractId) : Promise.resolve(null),
      ])
      if (resPlanning) {
        if (!resPlanning.ok) toast.error(`Cadence : ${resPlanning.error}`)
        else setPlanningAlertes(resPlanning.alertes)
      }
      if (resContrat) {
        if (!resContrat.ok) toast.error(`Exact : ${resContrat.error}`)
        else setContratAlertes(resContrat.alertes)
      }
      setChecked(true)
    })
  }

  const total = (planningAlertes?.length ?? 0) + (contratAlertes?.length ?? 0)

  return (
    <Card className="max-w-4xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-blue-500" />
          Vérifier la cohérence
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="gap-2" disabled={isPending} onClick={handleCheck}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            {isPending ? 'Vérification en cours…' : 'Vérifier avec Cadence et Exact'}
          </Button>
          <p className="text-xs text-gray-500">
            {projectId && contractId
              ? 'Compare le planning et le contrat au devis actuel.'
              : projectId
                ? 'Compare le planning au devis actuel (aucun contrat généré).'
                : 'Compare le contrat au devis actuel (aucun projet généré).'}
          </p>
        </div>

        {checked && total === 0 && (
          <p className="text-sm text-green-700 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            Rien à signaler — cohérent avec le devis actuel.
          </p>
        )}

        {planningAlertes && planningAlertes.length > 0 && (
          <div className="border border-amber-200 bg-amber-50 rounded-lg p-3 space-y-1.5">
            <p className="text-sm text-amber-800 font-medium flex items-center gap-1.5">
              <GanttChartSquare className="h-3.5 w-3.5 shrink-0" />
              Cadence — planning ({planningAlertes.length})
              {projectId && (
                <Link href={`/projets/${projectId}`} className="ml-auto text-xs text-blue-600 hover:underline font-normal">
                  Voir le planning →
                </Link>
              )}
            </p>
            <ul className="text-xs text-amber-700 space-y-1 list-disc pl-5">
              {planningAlertes.map((a, i) => <li key={i}>{a}</li>)}
            </ul>
          </div>
        )}

        {contratAlertes && contratAlertes.length > 0 && (
          <div className="border border-amber-200 bg-amber-50 rounded-lg p-3 space-y-1.5">
            <p className="text-sm text-amber-800 font-medium flex items-center gap-1.5">
              <FileSignature className="h-3.5 w-3.5 shrink-0" />
              Exact — contrat ({contratAlertes.length})
              {contractId && (
                <Link href={`/contrats/${contractId}`} className="ml-auto text-xs text-blue-600 hover:underline font-normal">
                  Voir / corriger →
                </Link>
              )}
            </p>
            <ul className="text-xs text-amber-700 space-y-1 list-disc pl-5">
              {contratAlertes.map((a, i) => <li key={i}>{a}</li>)}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
