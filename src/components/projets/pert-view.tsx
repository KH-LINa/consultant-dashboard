'use client'

/**
 * Vue PERT — diagramme de réseau des tâches.
 * Nœuds positionnés par profondeur topologique (colonnes), flèches de
 * dépendance fin→début, chemin critique en rouge (marge nulle, cf. computeCpm).
 * Une brique peut être déplacée à la souris (clic maintenu) ; sa position
 * manuelle (pert_x/pert_y) est alors prioritaire sur le calcul automatique,
 * jusqu'à un double-clic qui la réinitialise. SVG pur : aucune dépendance
 * supplémentaire.
 */

import { useEffect, useMemo, useState } from 'react'
import type { ProjectTask, TaskDependency } from '@/lib/types'
import { computeCpm } from '@/lib/gantt-deps'

const NODE_W = 190
const NODE_H = 74
const GAP_X = 70
const GAP_Y = 24
const MARGIN = 24

const CRITICAL = '#dc2626'
const NORMAL = '#534AB7'

interface PertViewProps {
  tasks: ProjectTask[]
  dependencies: TaskDependency[]
  onPositionChange?: (taskId: string, x: number | null, y: number | null) => void
}

function fmt(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

export function PertView({ tasks, dependencies, onPositionChange }: PertViewProps) {
  const [dragging, setDragging] = useState<
    { id: string; startX: number; startY: number; origX: number; origY: number; curX: number; curY: number } | null
  >(null)

  const { autoNodes, edges, undated } = useMemo(() => {
    const dated = tasks.filter((t) => t.date_debut && t.date_fin)
    const undated = tasks.filter((t) => !t.date_debut || !t.date_fin)
    const byId = new Map(dated.map((t) => [t.id, t]))
    const cpm = computeCpm(tasks, dependencies)

    // Colonnes par profondeur ; tri vertical par date de début puis titre
    const cols = new Map<number, ProjectTask[]>()
    for (const id of cpm.order) {
      const t = byId.get(id)
      if (!t) continue
      const d = cpm.depth.get(id) ?? 0
      if (!cols.has(d)) cols.set(d, [])
      cols.get(d)!.push(t)
    }
    for (const list of Array.from(cols.values())) {
      list.sort((a: ProjectTask, b: ProjectTask) =>
        (a.date_debut! < b.date_debut! ? -1 : a.date_debut! > b.date_debut! ? 1 : a.titre.localeCompare(b.titre)))
    }

    const pos = new Map<string, { x: number; y: number }>()
    for (const [d, list] of Array.from(cols.entries())) {
      list.forEach((t: ProjectTask, i: number) => {
        pos.set(t.id, {
          x: MARGIN + d * (NODE_W + GAP_X),
          y: MARGIN + i * (NODE_H + GAP_Y),
        })
      })
    }

    const autoNodes = Array.from(pos.entries()).map(([id, p]) => {
      const t = byId.get(id)!
      return {
        task: t, ...p,
        critical: cpm.slack.get(id) === 0,
        slack: cpm.slack.get(id) ?? 0,
        dur: cpm.dur.get(id) ?? 1,
      }
    })

    const edges = dependencies
      .filter((d) => pos.has(d.predecessor_id) && pos.has(d.successor_id))
      .map((d) => {
        const critical =
          cpm.slack.get(d.predecessor_id) === 0 &&
          cpm.slack.get(d.successor_id) === 0 &&
          cpm.ef.get(d.predecessor_id) === cpm.es.get(d.successor_id)
        return { id: d.id, predecessor_id: d.predecessor_id, successor_id: d.successor_id, critical }
      })

    return { autoNodes, edges, undated }
  }, [tasks, dependencies])

  // Position manuelle (pert_x/pert_y) prioritaire sur l'auto, position de
  // glisser-déposer en cours prioritaire sur tout le reste.
  const nodes = useMemo(() => autoNodes.map((n) => {
    if (dragging && dragging.id === n.task.id) {
      return { ...n, x: dragging.curX, y: dragging.curY, manual: true }
    }
    if (n.task.pert_x != null && n.task.pert_y != null) {
      return { ...n, x: n.task.pert_x, y: n.task.pert_y, manual: true }
    }
    return { ...n, manual: false }
  }), [autoNodes, dragging])

  const posById = useMemo(() => new Map(nodes.map((n) => [n.task.id, n])), [nodes])

  const width = MARGIN + Math.max(NODE_W, ...nodes.map((n) => n.x + NODE_W - MARGIN)) + MARGIN
  const height = MARGIN + Math.max(NODE_H, ...nodes.map((n) => n.y + NODE_H - MARGIN)) + MARGIN

  useEffect(() => {
    if (!dragging) return
    const onMove = (e: PointerEvent) => {
      setDragging((d) => d && ({
        ...d,
        curX: Math.max(0, d.origX + (e.clientX - d.startX)),
        curY: Math.max(0, d.origY + (e.clientY - d.startY)),
      }))
    }
    const onUp = () => {
      setDragging((d) => {
        if (d) onPositionChange?.(d.id, Math.round(d.curX), Math.round(d.curY))
        return null
      })
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging?.id])

  if (nodes.length === 0) {
    return (
      <p className="text-sm text-gray-400 py-8 text-center">
        Ajoutez des dates à vos tâches pour afficher le diagramme PERT.
      </p>
    )
  }

  return (
    <div>
      <div className="overflow-auto border rounded-lg bg-white">
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Diagramme PERT">
          <defs>
            <marker id="pert-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#9ca3af" />
            </marker>
            <marker id="pert-arrow-critical" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill={CRITICAL} />
            </marker>
          </defs>

          {/* Flèches de dépendances */}
          {edges.map((e) => {
            const a = posById.get(e.predecessor_id)
            const b = posById.get(e.successor_id)
            if (!a || !b) return null
            const x1 = a.x + NODE_W
            const y1 = a.y + NODE_H / 2
            const x2 = b.x
            const y2 = b.y + NODE_H / 2
            const mx = (x1 + x2) / 2
            return (
              <path
                key={e.id}
                d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2 - 3} ${y2}`}
                fill="none"
                stroke={e.critical ? CRITICAL : '#9ca3af'}
                strokeWidth={e.critical ? 2 : 1.4}
                markerEnd={e.critical ? 'url(#pert-arrow-critical)' : 'url(#pert-arrow)'}
              />
            )
          })}

          {/* Nœuds */}
          {nodes.map((n) => {
            const accent = n.critical ? CRITICAL : NORMAL
            const isDragging = dragging?.id === n.task.id
            return (
              <g
                key={n.task.id}
                style={{ cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none' }}
                onPointerDown={(e) => {
                  if (e.button !== 0) return
                  e.stopPropagation()
                  setDragging({ id: n.task.id, startX: e.clientX, startY: e.clientY, origX: n.x, origY: n.y, curX: n.x, curY: n.y })
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation()
                  if (n.manual) onPositionChange?.(n.task.id, null, null)
                }}
              >
                <rect x={n.x} y={n.y} width={NODE_W} height={NODE_H} rx={8}
                  fill="white" stroke={accent} strokeWidth={n.critical ? 2 : 1.4} />
                {isDragging && (
                  <rect x={n.x - 2} y={n.y - 2} width={NODE_W + 4} height={NODE_H + 4} rx={10}
                    fill="none" stroke={accent} strokeWidth={1} strokeDasharray="4 3" opacity={0.6} />
                )}
                <rect x={n.x} y={n.y} width={4} height={NODE_H} rx={2} fill={accent} />
                <text x={n.x + 12} y={n.y + 20} fontSize="11" fontWeight="600" fill="#1f2937">
                  {n.task.titre.length > 26 ? n.task.titre.slice(0, 25) + '…' : n.task.titre}
                </text>
                <text x={n.x + 12} y={n.y + 38} fontSize="10" fill="#6b7280">
                  {fmt(n.task.date_debut)} → {fmt(n.task.date_fin)} · {n.dur} j
                </text>
                <text x={n.x + 12} y={n.y + 56} fontSize="10" fontWeight="500" fill={n.critical ? CRITICAL : '#059669'}>
                  {n.critical ? 'Critique — aucune marge' : `Marge : ${n.slack} j`}
                </text>
                <text x={n.x + NODE_W - 12} y={n.y + 56} fontSize="10" textAnchor="end" fill="#6b7280">
                  {n.task.avancement ?? 0} %
                </text>
                {n.manual && (
                  <circle cx={n.x + NODE_W - 8} cy={n.y + 8} r={3} fill={accent} opacity={0.6} />
                )}
              </g>
            )
          })}
        </svg>
      </div>

      <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-500">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border-2 border-[#dc2626]" />Chemin critique</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border-2 border-[#534AB7]" />Tâche avec marge</span>
        <span>Glisser une brique pour la repositionner · double-clic pour revenir à la disposition automatique</span>
        {undated.length > 0 && (
          <span className="text-gray-400">
            {undated.length} tâche{undated.length > 1 ? 's' : ''} sans dates non affichée{undated.length > 1 ? 's' : ''} : {undated.map((t) => t.titre).join(', ')}
          </span>
        )}
      </div>
    </div>
  )
}
