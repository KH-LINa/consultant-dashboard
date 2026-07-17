'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { ProjectMilestone, MilestoneStatus } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Plus, Trash2, Flag } from 'lucide-react'
import { toast } from 'sonner'

const statutLabel: Record<MilestoneStatus, string> = {
  a_faire: 'À faire', atteint: 'Atteint', en_retard: 'En retard',
}

export function MilestonesManager({ projectId, milestones }: { projectId: string; milestones: ProjectMilestone[] }) {
  const router = useRouter()
  const supabase = createClient()
  const [titre, setTitre] = useState('')
  const [date, setDate] = useState('')
  const [adding, setAdding] = useState(false)

  async function addMilestone(e: React.FormEvent) {
    e.preventDefault()
    if (!titre.trim()) return
    setAdding(true)
    const { error } = await supabase.from('project_milestones').insert({
      project_id: projectId, titre, date_echeance: date || null, ordre: milestones.length,
    })
    if (error) toast.error(error.message)
    else { toast.success('Jalon ajouté'); setTitre(''); setDate(''); router.refresh() }
    setAdding(false)
  }

  async function update(id: string, field: string, value: string | null) {
    const { error } = await supabase.from('project_milestones').update({ [field]: value }).eq('id', id)
    if (error) toast.error(error.message); else router.refresh()
  }

  async function remove(id: string) {
    const { error } = await supabase.from('project_milestones').delete().eq('id', id)
    if (error) toast.error(error.message); else { toast.success('Jalon supprimé'); router.refresh() }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Flag className="h-4 w-4 text-amber-500" />
          Jalons / livrables ({milestones.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {milestones.map((m) => (
          <div key={m.id} className="grid grid-cols-12 gap-2 items-center group">
            <Input className="col-span-5 h-9" defaultValue={m.titre}
              onBlur={(e) => e.target.value !== m.titre && update(m.id, 'titre', e.target.value)} />
            <Input type="date" className="col-span-3 h-9" defaultValue={m.date_echeance ?? ''}
              onChange={(e) => update(m.id, 'date_echeance', e.target.value || null)} />
            <div className="col-span-3">
              <Select value={m.statut} onValueChange={(v) => update(m.id, 'statut', v)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(statutLabel) as MilestoneStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>{statutLabel[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="ghost" size="sm"
              onClick={() => remove(m.id)}
              className="col-span-1 h-9 w-9 p-0 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <form onSubmit={addMilestone} className="flex gap-2 pt-2 border-t">
          <Input value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Nouveau jalon (ex: Livraison V1)" className="h-9 flex-1" />
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 w-[150px]" />
          <Button type="submit" size="sm" disabled={adding || !titre.trim()}><Plus className="h-4 w-4" /></Button>
        </form>
      </CardContent>
    </Card>
  )
}
