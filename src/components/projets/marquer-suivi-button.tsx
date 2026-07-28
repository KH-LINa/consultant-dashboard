'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { toLocalISO } from '@/lib/gantt-deps'

// Étape 7 de la méthodologie Yndra ("Suivi & amélioration continue") :
// enregistre la date du jour comme dernier point de suivi fait pour ce
// projet — utilisé par le rappel du tableau de bord (voir
// lib/gantt-deps.ts, detecterSuiviAPrevoir) pour ne pas laisser cette étape
// se perdre silencieusement une fois la mission livrée.
export function MarquerSuiviButton({ projectId, dateDernierSuivi }: { projectId: string; dateDernierSuivi: string | null }) {
  const router = useRouter()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)

  async function handleClick() {
    setSaving(true)
    const { error } = await supabase
      .from('projects')
      .update({ date_dernier_suivi: toLocalISO(new Date()) })
      .eq('id', projectId)
    setSaving(false)
    if (error) toast.error(`Échec : ${error.message}`)
    else { toast.success('Point de suivi enregistré ✓'); router.refresh() }
  }

  return (
    <div className="flex items-center gap-2">
      {dateDernierSuivi && (
        <span className="text-xs text-gray-400">
          Dernier point de suivi : {new Date(dateDernierSuivi + 'T00:00:00').toLocaleDateString('fr-FR')}
        </span>
      )}
      <Button variant="outline" size="sm" onClick={handleClick} disabled={saving}>
        <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
        {saving ? 'Enregistrement…' : 'Marquer un point de suivi'}
      </Button>
    </div>
  )
}
