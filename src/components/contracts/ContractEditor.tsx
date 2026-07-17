'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Loader2, Save } from 'lucide-react'
import { updateContractContent } from '@/app/actions/contracts'

interface ContractEditorProps {
  contractId: string
  initialContenu: string
  readOnly?: boolean
}

export function ContractEditor({ contractId, initialContenu, readOnly = false }: ContractEditorProps) {
  const [contenu, setContenu] = useState(initialContenu)
  const [isPending, startTransition] = useTransition()
  const isDirty = contenu !== initialContenu

  function handleSave() {
    startTransition(async () => {
      const result = await updateContractContent(contractId, contenu)
      if (result.ok) {
        toast.success('Contrat sauvegardé')
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {readOnly
            ? 'Contrat en lecture seule (statut archivé)'
            : 'Éditez le contenu puis sauvegardez avant envoi.'}
        </p>
        {!readOnly && (
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!isDirty || isPending}
            className="gap-2"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
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
    </div>
  )
}
