'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { FolderPlus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { QuoteLine } from '@/lib/types'
import {
  buildPhasesFromLignes, buildPhasesAndTasksFromPlanning, fetchPlanningIA, type TaskInsert,
} from '@/lib/planning-ia'

interface CreateProjectButtonProps {
  quoteId: string
  contactId: string
  titre: string
  lignes: QuoteLine[]
}

export function CreateProjectButton({ quoteId, contactId, titre, lignes }: CreateProjectButtonProps) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  async function handleCreate() {
    setLoading(true)

    // Anti-doublon : un seul projet par devis
    const { data: existing } = await supabase
      .from('projects')
      .select('id')
      .eq('quote_id', quoteId)
      .maybeSingle()

    if (existing) {
      toast.info('Un projet existe déjà pour ce devis')
      router.push('/projets')
      setLoading(false)
      return
    }

    const { data: project, error } = await supabase.from('projects').insert({
      quote_id: quoteId,
      contact_id: contactId,
      titre,
      statut: 'a_demarrer',
    }).select('id').single()

    if (error || !project) {
      toast.error(error?.message ?? 'Erreur lors de la création du projet')
      setLoading(false)
      return
    }

    if (lignes.length > 0) {
      // Cadence (l'assistant IA de planification, voir /api/projets/generer-planning)
      // propose un découpage phases + tâches ; en cas d'échec, repli silencieux
      // sur l'ébauche déterministe (une phase par ligne de devis).
      const phasesIA = await fetchPlanningIA(titre, lignes)
      const { phases, tachesParPhase } = phasesIA
        ? buildPhasesAndTasksFromPlanning(project.id, phasesIA, lignes)
        : { phases: buildPhasesFromLignes(project.id, lignes), tachesParPhase: null }

      const { data: insertedPhases, error: phasesError } = await supabase
        .from('project_phases')
        .insert(phases)
        .select('id, ordre')

      if (phasesError || !insertedPhases) {
        toast.error("Projet créé, mais l'ébauche de planning a échoué : " + (phasesError?.message ?? ''))
      } else if (tachesParPhase) {
        const idParOrdre = new Map(insertedPhases.map((p) => [p.ordre, p.id]))
        const tasksToInsert: TaskInsert[] = tachesParPhase.flatMap((taches, i) =>
          taches.map((t) => ({ ...t, phase_id: idParOrdre.get(i) ?? null }))
        )
        const { error: tasksError } = await supabase.from('project_tasks').insert(tasksToInsert)
        if (tasksError) {
          toast.error("Phases créées, mais le détail des tâches a échoué : " + tasksError.message)
        } else {
          toast.success('Projet créé avec un planning détaillé généré par Cadence ✓')
        }
      } else {
        toast.success('Projet créé avec une ébauche de planning ✓')
      }
    } else {
      toast.success('Projet créé ✓')
    }
    router.push('/projets')
    router.refresh()
    setLoading(false)
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleCreate}
      disabled={loading}
      title="Créer le projet (planning généré par Cadence)"
      className="text-green-600 hover:text-green-800"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderPlus className="h-4 w-4" />}
    </Button>
  )
}
