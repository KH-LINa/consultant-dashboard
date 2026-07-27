'use client'

import { useMemo, useState } from 'react'
import type { ResourceUnavailability, ResourceUnavailabilityMotif } from '@/lib/types'
import { estWeekend, feriesCourants } from '@/lib/jours-ouvres'
import { toLocalISO } from '@/lib/gantt-deps'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export const MOTIF_LABEL: Record<ResourceUnavailabilityMotif, string> = {
  absent: 'Absent', conge: 'Congé', maladie: 'Maladie', autre: 'Autre',
}
export const MOTIF_COLOR: Record<ResourceUnavailabilityMotif, string> = {
  absent: '#f59e0b', conge: '#0891b2', maladie: '#ef4444', autre: '#6b7280',
}

const JOURS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

/**
 * Calendrier mensuel compact d'une ressource : un jour est peint dans la
 * couleur de son motif d'indisponibilité s'il en a une (et que ce motif est
 * dans les filtres actifs), sinon grisé s'il tombe un week-end/jour férié
 * (même logique que le grisage du Gantt, jours-ouvres.ts).
 */
export function ResourceCalendar({
  unavailabilities, filtres,
}: {
  unavailabilities: ResourceUnavailability[]
  filtres: Set<ResourceUnavailabilityMotif>
}) {
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d })
  const feries = useMemo(() => feriesCourants(), [])

  const cellules = useMemo(() => {
    const annee = cursor.getFullYear()
    const mois = cursor.getMonth()
    const premier = new Date(annee, mois, 1)
    const dernier = new Date(annee, mois + 1, 0)
    // Décalage pour démarrer la grille un lundi (Date#getDay() : 0 = dimanche)
    const decalage = (premier.getDay() + 6) % 7
    const out: (Date | null)[] = Array(decalage).fill(null)
    for (let jour = 1; jour <= dernier.getDate(); jour++) out.push(new Date(annee, mois, jour))
    return out
  }, [cursor])

  function motifDuJour(d: Date): ResourceUnavailabilityMotif | null {
    const iso = toLocalISO(d)
    const trouve = unavailabilities.find(
      (u) => filtres.has(u.motif) && u.date_debut <= iso && iso <= u.date_fin
    )
    return trouve?.motif ?? null
  }

  return (
    <div className="rounded-lg border p-2 bg-gray-50/50 w-64">
      <div className="flex items-center justify-between mb-2 px-1">
        <button
          type="button"
          onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))}
          className="p-1 rounded hover:bg-gray-200 text-gray-500"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <span className="text-xs font-medium text-gray-600 capitalize">
          {cursor.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
        </span>
        <button
          type="button"
          onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))}
          className="p-1 rounded hover:bg-gray-200 text-gray-500"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {JOURS.map((j, i) => (
          <div key={i} className="text-center text-[10px] text-gray-400 font-medium py-0.5">{j}</div>
        ))}
        {cellules.map((d, i) => {
          if (!d) return <div key={i} />
          const iso = toLocalISO(d)
          const motif = motifDuJour(d)
          const nonOuvre = estWeekend(iso) || feries.has(iso)
          return (
            <div
              key={i}
              title={motif ? MOTIF_LABEL[motif] : undefined}
              className="aspect-square flex items-center justify-center rounded text-[11px]"
              style={{
                background: motif ? MOTIF_COLOR[motif] : (nonOuvre ? '#e2e8f0' : 'transparent'),
                color: motif ? '#fff' : (nonOuvre ? '#94a3b8' : '#374151'),
              }}
            >
              {d.getDate()}
            </div>
          )
        })}
      </div>
    </div>
  )
}
