'use client'

/**
 * Liste de tâches personnalisée du Gantt (colonnes de gauche) avec
 * POIGNÉES DE REDIMENSIONNEMENT entre les colonnes (glisser comme dans un
 * tableur). La bibliothèque gantt-task-react n'offre qu'une largeur fixe
 * unique (listCellWidth) ; on lui fournit donc nos propres composants
 * TaskListHeader / TaskListTable. Largeurs persistées dans localStorage.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Task } from 'gantt-task-react'
import { Plus } from 'lucide-react'

export interface ColWidths { name: number; from: number; to: number }

const DEFAULT_WIDTHS: ColWidths = { name: 170, from: 110, to: 110 }
const MIN_W = 44
const MAX_W = 420
const STORAGE_KEY = 'gantt-col-widths-v1'

export function useResizableColumns() {
  const [widths, setWidths] = useState<ColWidths>(() => {
    if (typeof window === 'undefined') return DEFAULT_WIDTHS
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const p = JSON.parse(raw)
        if (typeof p?.name === 'number' && typeof p?.from === 'number' && typeof p?.to === 'number') return p
      }
    } catch { /* stockage indisponible : largeurs par défaut */ }
    return DEFAULT_WIDTHS
  })
  const drag = useRef<{ col: keyof ColWidths; startX: number; startW: number } | null>(null)

  const startResize = useCallback((col: keyof ColWidths, e: React.MouseEvent) => {
    e.preventDefault()
    setWidths((prev) => {
      drag.current = { col, startX: e.clientX, startW: prev[col] }
      return prev
    })
  }, [])

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!drag.current) return
      const { col, startX, startW } = drag.current
      const w = Math.min(MAX_W, Math.max(MIN_W, startW + e.clientX - startX))
      setWidths((prev) => (prev[col] === w ? prev : { ...prev, [col]: w }))
    }
    function onUp() {
      if (!drag.current) return
      drag.current = null
      setWidths((prev) => {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prev)) } catch { /* ignore */ }
        return prev
      })
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  return { widths, startResize }
}

function ResizeHandle({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  return (
    <div
      onMouseDown={onMouseDown}
      title="Glisser pour redimensionner la colonne"
      className="absolute right-0 top-0 h-full w-[6px] cursor-col-resize border-r border-gray-200 hover:border-r-2 hover:border-[#534AB7] active:border-[#534AB7]"
    />
  )
}

const COLS: { key: keyof ColWidths; label: string }[] = [
  { key: 'name', label: 'Tâche' },
  { key: 'from', label: 'Début' },
  { key: 'to', label: 'Fin' },
]

function fmtDate(d: Date): string {
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
}

/**
 * Fabrique les deux composants attendus par <Gantt TaskListHeader TaskListTable>,
 * liés aux largeurs courantes et au démarrage du drag.
 *
 * titreReel/onRename : t.name porte le libellé DÉCORÉ affiché dans le Gantt
 * ([initiales] responsable, ⚠ conflit…) — titreReel restitue le titre réel
 * (phase/tâche/jalon) à éditer, onRename persiste le renommage en base.
 * onAddTask : ajoute une tâche rattachée à la phase de la ligne cliquée
 * (ou à la même phase qu'une tâche cliquée) — pas de bouton sur les jalons.
 */
export function createTaskListComponents(
  widths: ColWidths,
  startResize: (col: keyof ColWidths, e: React.MouseEvent) => void,
  titreReel: (ganttId: string) => string,
  onRename: (ganttId: string, nouveauTitre: string) => void,
  onAddTask: (ganttId: string) => void
) {
  const Header: React.FC<{ headerHeight: number; fontFamily: string; fontSize: string }> =
    ({ headerHeight, fontFamily, fontSize }) => (
      <div style={{ fontFamily, fontSize, height: headerHeight }} className="flex border-b border-gray-200 bg-gray-50/60">
        {COLS.map(({ key, label }) => (
          <div key={key} style={{ width: widths[key], minWidth: widths[key] }}
            className="relative flex items-center px-3 font-medium text-gray-600">
            <span className="truncate">{label}</span>
            <ResizeHandle onMouseDown={(e) => startResize(key, e)} />
          </div>
        ))}
      </div>
    )

  const Table: React.FC<{
    rowHeight: number
    fontFamily: string
    fontSize: string
    tasks: Task[]
    onExpanderClick: (task: Task) => void
  }> = ({ rowHeight, fontFamily, fontSize, tasks, onExpanderClick }) => (
    <div style={{ fontFamily, fontSize }}>
      {tasks.map((t) => (
        <div key={t.id} style={{ height: rowHeight }} className="group flex items-center border-b border-gray-50">
          <div style={{ width: widths.name, minWidth: widths.name }} className="flex items-center gap-1 px-3 overflow-hidden">
            {t.type === 'project' ? (
              <button
                onClick={() => onExpanderClick(t)}
                title={t.hideChildren ? 'Déplier la phase' : 'Replier la phase'}
                className="w-4 shrink-0 text-[10px] text-gray-400 hover:text-gray-700"
              >
                {t.hideChildren ? '▶' : '▼'}
              </button>
            ) : t.project ? (
              <span className="w-4 shrink-0" />
            ) : null}
            {t.type === 'milestone' && <span className="shrink-0 text-amber-500 text-[10px]">◆</span>}
            <input
              key={`ti-${t.id}-${titreReel(t.id)}`}
              defaultValue={titreReel(t.id)}
              title={titreReel(t.id)}
              onMouseDown={(e) => e.stopPropagation()}
              onBlur={(e) => {
                const v = e.target.value.trim()
                if (v && v !== titreReel(t.id)) onRename(t.id, v)
                else e.target.value = titreReel(t.id)
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
              className={`flex-1 min-w-0 truncate bg-transparent border border-transparent outline-none rounded px-1 -mx-1 cursor-text hover:border-gray-300 focus:border-[#534AB7] focus:ring-1 focus:ring-[#534AB7] focus:bg-white ${t.type === 'project' ? 'font-semibold text-gray-800' : 'text-gray-700'}`}
            />
            {t.type !== 'milestone' && (
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => onAddTask(t.id)}
                title={t.id.startsWith('phase_') ? 'Ajouter une tâche à cette phase' : 'Ajouter une sous-tâche'}
                className="shrink-0 w-4 h-4 flex items-center justify-center rounded text-gray-400 hover:text-white hover:bg-[#534AB7] opacity-0 group-hover:opacity-100"
              >
                <Plus className="h-3 w-3" />
              </button>
            )}
          </div>
          <div style={{ width: widths.from, minWidth: widths.from }} className="px-3 truncate text-gray-500">
            {fmtDate(t.start)}
          </div>
          <div style={{ width: widths.to, minWidth: widths.to }} className="px-3 truncate text-gray-500">
            {fmtDate(t.end)}
          </div>
        </div>
      ))}
    </div>
  )

  return { Header, Table }
}
