'use client'

import type { ProjectMilestone, MilestoneStatus } from '@/lib/types'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Flag } from 'lucide-react'

const statutLabel: Record<MilestoneStatus, { label: string; cls: string }> = {
  a_faire: { label: 'À faire', cls: 'bg-gray-100 text-gray-600' },
  atteint: { label: 'Atteint', cls: 'bg-green-100 text-green-700' },
  en_retard: { label: 'En retard', cls: 'bg-red-100 text-red-700' },
}

interface GanttTooltipProps {
  milestone: ProjectMilestone | null
  onClose: () => void
}

export function GanttTooltip({ milestone, onClose }: GanttTooltipProps) {
  const st = milestone ? statutLabel[milestone.statut] : null
  return (
    <Dialog open={!!milestone} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="h-4 w-4 text-amber-500" />
            {milestone?.titre}
          </DialogTitle>
        </DialogHeader>
        {milestone && (
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Échéance</span>
              <span className="font-medium">
                {milestone.date_echeance
                  ? new Date(milestone.date_echeance).toLocaleDateString('fr-FR', {
                      day: '2-digit', month: 'long', year: 'numeric',
                    })
                  : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Statut</span>
              {st && <span className={`text-xs px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>}
            </div>
            <div>
              <p className="text-gray-500 mb-1">Livrable</p>
              <p className="text-gray-800">{milestone.livrable || <span className="text-gray-400">Non précisé</span>}</p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
