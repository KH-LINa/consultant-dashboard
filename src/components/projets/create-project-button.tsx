'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { FolderPlus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { QuoteLine } from '@/lib/types'
import { toLocalISO } from '@/lib/gantt-deps'

interface CreateProjectButtonProps {
  quoteId: string
  contactId: string
  titre: string
  lignes: QuoteLine[]
}

// Couleurs cycliques pour distinguer les phases auto-générées dans le Gantt
// (même défaut que project_phases.couleur pour la première).
const PALETTE = ['#93c5fd', '#a5b4fc', '#c4b5fd', '#f0abfc', '#fda4af', '#fdba74']

function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return toLocalISO(d)
}

// Durée par défaut quand la quantité ne représente probablement pas un
// nombre de jours (voir buildPhasesFromLignes) : suffisamment courte pour
// rester un premier jet, assez longue pour ne pas produire une phase d'un
// seul jour à chaque ligne facturée au forfait.
const DUREE_PAR_DEFAUT_JOURS = 3

// Une phase par ligne de devis, enchaînées à partir d'aujourd'hui. La
// quantité sert d'estimation de durée en jours UNIQUEMENT à partir de 2 —
// une quantité de 1 est le cas le plus fréquent pour une ligne forfaitaire
// (déplacement, rapport, licence…) où "1" veut dire "une unité", pas "un
// jour" : l'utiliser telle quelle produirait une phase d'un seul jour à
// chaque fois. Durée bornée à 20 jours pour éviter un planning aberrant sur
// les grandes quantités. Premier jet à ajuster manuellement dans le Gantt.
function buildPhasesFromLignes(projectId: string, lignes: QuoteLine[]) {
  let debut = toLocalISO(new Date())
  return lignes.map((l, i) => {
    const dureeJours = l.quantite >= 2 ? Math.min(20, Math.round(l.quantite)) : DUREE_PAR_DEFAUT_JOURS
    const fin = addDays(debut, dureeJours - 1)
    const phase = {
      project_id: projectId,
      titre: l.description || `Phase ${i + 1}`,
      date_debut: debut,
      date_fin: fin,
      couleur: PALETTE[i % PALETTE.length],
      ordre: i,
    }
    debut = addDays(fin, 1)
    return phase
  })
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
      const { error: phasesError } = await supabase
        .from('project_phases')
        .insert(buildPhasesFromLignes(project.id, lignes))
      if (phasesError) {
        toast.error("Projet créé, mais l'ébauche de planning a échoué : " + phasesError.message)
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
      title="Créer le projet"
      className="text-green-600 hover:text-green-800"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderPlus className="h-4 w-4" />}
    </Button>
  )
}
