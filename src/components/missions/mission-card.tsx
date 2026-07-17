'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { CheckSquare, Clock, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

interface MissionCardProps {
  id: string
  titre: string
  contactNom?: string | null
  budgetHt: number
  total: number
  done: number
  heures: number
}

export function MissionCard({ id, titre, contactNom, budgetHt, total, done, heures }: MissionCardProps) {
  const router = useRouter()
  const supabase = createClient()
  const [confirm, setConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const pct = total > 0 ? (done / total) * 100 : 0

  async function handleDelete() {
    setDeleting(true)
    const { error } = await supabase.from('missions').delete().eq('id', id)
    if (error) toast.error('Erreur lors de la suppression')
    else {
      toast.success('Mission supprimée')
      router.refresh()
    }
    setConfirm(false)
    setDeleting(false)
  }

  return (
    <>
      <Card
        onClick={() => router.push(`/missions/${id}`)}
        className="hover:shadow-md transition-shadow cursor-pointer relative group"
      >
        <CardContent className="p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-gray-900 line-clamp-2">{titre}</p>
            <button
              onClick={(e) => { e.stopPropagation(); setConfirm(true) }}
              className="flex-shrink-0 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Supprimer la mission"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="text-xs text-gray-400">{contactNom}</p>

          {total > 0 && (
            <div className="w-full bg-gray-100 rounded-full h-1.5">
              <div className="h-1.5 rounded-full bg-blue-500 transition-all" style={{ width: `${pct}%` }} />
            </div>
          )}

          <div className="flex items-center gap-3 text-xs text-gray-500 pt-1">
            {total > 0 && (
              <span className="flex items-center gap-1">
                <CheckSquare className="h-3 w-3" />{done}/{total}
              </span>
            )}
            {heures > 0 && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />{heures}h
              </span>
            )}
            {budgetHt > 0 && (
              <span className="ml-auto font-medium text-gray-600">
                {budgetHt.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer la mission ?</DialogTitle>
            <DialogDescription>
              « {titre} » et ses tâches/temps seront définitivement supprimés.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(false)}>Annuler</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Suppression...' : 'Supprimer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
