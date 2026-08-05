'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, ShieldCheck, AlertTriangle, Save, Wand2 } from 'lucide-react'
import { verifyContract, correctContract, updateContractContent } from '@/app/actions/contracts'

interface ContractReviewPanelProps {
  contractId: string
  initialContenu: string
  readOnly?: boolean
}

// Regroupe vérification, correction proposée et édition dans un seul
// composant pour partager l'état du texte : une correction d'Exact
// n'écrit JAMAIS directement en base, elle ne fait que remplir le brouillon
// affiché dans le champ ci-dessous — la sauvegarde reste une action
// manuelle explicite (bouton "Sauvegarder"), avec relecture possible entre
// les deux. Même garde-fou "propose, ne décide pas" que le reste de l'app.
export function ContractReviewPanel({ contractId, initialContenu, readOnly = false }: ContractReviewPanelProps) {
  const [contenu, setContenu] = useState(initialContenu)
  const [alertes, setAlertes] = useState<string[] | null>(null)
  const [verifying, startVerifying] = useTransition()
  const [correcting, startCorrecting] = useTransition()
  const [saving, startSaving] = useTransition()
  const isDirty = contenu !== initialContenu

  function handleVerify() {
    setAlertes(null)
    startVerifying(async () => {
      const result = await verifyContract(contractId)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setAlertes(result.alertes)
      if (result.alertes.length === 0) toast.success('Exact : rien à signaler')
    })
  }

  function handleCorrect() {
    if (!alertes || alertes.length === 0) return
    startCorrecting(async () => {
      const result = await correctContract(contractId, alertes)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setContenu(result.contenu)
      toast.success('Exact a proposé une correction — relisez avant de sauvegarder')
    })
  }

  function handleSave() {
    startSaving(async () => {
      const result = await updateContractContent(contractId, contenu)
      if (result.ok) {
        toast.success('Contrat sauvegardé')
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={verifying}
          onClick={handleVerify}
          title="Exact relit le contrat et signale les écarts avec le devis actuel, sans rien modifier"
        >
          {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          {verifying ? 'Exact vérifie…' : 'Vérifier avec Exact'}
        </Button>

        {alertes !== null && alertes.length > 0 && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <div className="flex-1 space-y-2">
                  <p className="text-sm text-amber-800 font-medium">
                    Exact a signalé {alertes.length} point{alertes.length > 1 ? 's' : ''} :
                  </p>
                  <ul className="text-xs text-amber-700 space-y-1 list-disc pl-4">
                    {alertes.map((a, i) => <li key={i}>{a}</li>)}
                  </ul>
                  {!readOnly && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 mt-1 bg-white"
                      disabled={correcting}
                      onClick={handleCorrect}
                      title="Exact propose une correction dans le champ ci-dessous — rien n'est sauvegardé automatiquement"
                    >
                      {correcting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                      {correcting ? 'Exact corrige…' : 'Corriger avec Exact'}
                    </Button>
                  )}
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

      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {readOnly
                ? 'Contrat en lecture seule (statut archivé)'
                : 'Éditez le contenu (ou relisez la correction d\'Exact) puis sauvegardez avant envoi.'}
            </p>
            {!readOnly && (
              <Button size="sm" onClick={handleSave} disabled={!isDirty || saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Sauvegarder
              </Button>
            )}
          </div>

          <textarea
            value={contenu}
            onChange={(e) => setContenu(e.target.value)}
            readOnly={readOnly}
            rows={40}
            className="w-full rounded-md border border-gray-200 bg-white px-4 py-3 text-sm font-mono text-gray-800 leading-relaxed shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y disabled:bg-gray-50 disabled:text-gray-500"
            style={{ minHeight: '60vh' }}
          />

          {isDirty && !readOnly && (
            <p className="text-xs text-amber-600">Modifications non sauvegardées</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
