'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { FolderPlus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { QuoteLine } from '@/lib/types'
import { toLocalISO } from '@/lib/gantt-deps'
import { addJoursOuvres, feriesCourants, prochainJourOuvre } from '@/lib/jours-ouvres'

interface CreateProjectButtonProps {
  quoteId: string
  contactId: string
  titre: string
  lignes: QuoteLine[]
}

interface PlanningTache {
  titre: string
  duree_jours_ouvres: number
}

interface PlanningPhase {
  titre: string
  taches: PlanningTache[]
}

interface PhaseInsert {
  project_id: string
  titre: string
  date_debut: string
  date_fin: string
  couleur: string
  ordre: number
}

interface TaskInsert {
  project_id: string
  phase_id: string | null
  titre: string
  date_debut: string
  date_fin: string
  ordre: number
}

// Couleurs cycliques pour distinguer les phases auto-générées dans le Gantt
// (même défaut que project_phases.couleur pour la première).
const PALETTE = ['#93c5fd', '#a5b4fc', '#c4b5fd', '#f0abfc', '#fda4af', '#fdba74']

// Durée par défaut quand la quantité ne représente probablement pas un
// nombre de jours (voir buildPhasesFromLignes) : suffisamment courte pour
// rester un premier jet, assez longue pour ne pas produire une phase d'un
// seul jour à chaque ligne facturée au forfait.
const DUREE_PAR_DEFAUT_JOURS = 3

// Ébauche déterministe (repli) : une phase par ligne de devis, enchaînées à
// partir du prochain jour ouvré, sans détail par tâche. Utilisée quand la
// génération IA (voir plus bas) échoue ou n'est pas configurée.
//
// Dates en jours OUVRÉS (weekends + fériés français exclus), pour rester
// cohérent avec la colonne "Durée" du Gantt (joursOuvresEntre, voir
// gantt-task-list.tsx) — sans ça, une phase "1 j" pouvait démarrer un samedi
// et s'étaler sur 3 jours calendaires, décalant toute la suite du planning.
function buildPhasesFromLignes(projectId: string, lignes: QuoteLine[]): PhaseInsert[] {
  const feries = feriesCourants()
  let debut = prochainJourOuvre(toLocalISO(new Date()), feries)
  return lignes.map((l, i) => {
    const dureeJours = l.quantite >= 2 ? Math.min(20, Math.round(l.quantite)) : DUREE_PAR_DEFAUT_JOURS
    const fin = addJoursOuvres(debut, dureeJours - 1, feries)
    const phase = {
      project_id: projectId,
      titre: l.description || `Phase ${i + 1}`,
      date_debut: debut,
      date_fin: fin,
      couleur: PALETTE[i % PALETTE.length],
      ordre: i,
    }
    debut = addJoursOuvres(fin, 1, feries)
    return phase
  })
}

// Construit phases + tâches à partir du planning proposé par l'IA
// (/api/projets/generer-planning) : le modèle ne propose que des durées en
// jours ouvrés par tâche, jamais de dates — tout le chaînage calendaire
// (phases entre elles, tâches dans leur phase) reste déterministe côté code.
function buildPhasesAndTasksFromPlanning(
  projectId: string,
  planning: { phases: PlanningPhase[] },
  lignes: QuoteLine[]
): { phases: PhaseInsert[]; tachesParPhase: Omit<TaskInsert, 'phase_id'>[][] } {
  const feries = feriesCourants()
  let debutPhase = prochainJourOuvre(toLocalISO(new Date()), feries)
  const phases: PhaseInsert[] = []
  const tachesParPhase: Omit<TaskInsert, 'phase_id'>[][] = []

  planning.phases.forEach((p, i) => {
    let debutTache = debutPhase
    const taches = p.taches.map((t, j) => {
      const finTache = addJoursOuvres(debutTache, Math.max(1, t.duree_jours_ouvres) - 1, feries)
      const tache = {
        project_id: projectId,
        titre: t.titre,
        date_debut: debutTache,
        date_fin: finTache,
        ordre: j,
      }
      debutTache = addJoursOuvres(finTache, 1, feries)
      return tache
    })
    const finPhase = taches[taches.length - 1].date_fin
    phases.push({
      project_id: projectId,
      titre: p.titre || lignes[i]?.description || `Phase ${i + 1}`,
      date_debut: debutPhase,
      date_fin: finPhase,
      couleur: PALETTE[i % PALETTE.length],
      ordre: i,
    })
    tachesParPhase.push(taches)
    debutPhase = addJoursOuvres(finPhase, 1, feries)
  })

  return { phases, tachesParPhase }
}

// Tente de générer un planning détaillé par IA (phases + tâches réalistes).
// Retourne null si l'API n'est pas configurée, en erreur, ou renvoie une
// réponse incohérente — jamais d'exception qui bloquerait la création du
// projet : l'appelant retombe alors sur l'ébauche déterministe.
async function genererPlanningIA(
  projectId: string, titre: string, lignes: QuoteLine[]
): Promise<{ phases: PhaseInsert[]; tachesParPhase: Omit<TaskInsert, 'phase_id'>[][] } | null> {
  try {
    const res = await fetch('/api/projets/generer-planning', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titre, lignes }),
    })
    if (!res.ok) return null
    const { planning } = await res.json()
    if (!planning?.phases?.length) return null
    return buildPhasesAndTasksFromPlanning(projectId, planning, lignes)
  } catch {
    return null
  }
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
      const genere = await genererPlanningIA(project.id, titre, lignes)
      const { phases, tachesParPhase } = genere ?? {
        phases: buildPhasesFromLignes(project.id, lignes),
        tachesParPhase: null,
      }

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
          toast.success('Projet créé avec un planning détaillé généré par IA ✓')
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
      title="Créer le projet (planning généré par IA)"
      className="text-green-600 hover:text-green-800"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderPlus className="h-4 w-4" />}
    </Button>
  )
}
