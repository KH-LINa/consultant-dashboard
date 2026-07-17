'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { ProjectPhase } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Plus, Trash2, Layers } from 'lucide-react'
import { toast } from 'sonner'

export function PhasesManager({ projectId, phases }: { projectId: string; phases: ProjectPhase[] }) {
  const router = useRouter()
  const supabase = createClient()
  const [titre, setTitre] = useState('')
  const [adding, setAdding] = useState(false)

  async function addPhase(e: React.FormEvent) {
    e.preventDefault()
    if (!titre.trim()) return
    setAdding(true)
    const { error } = await supabase.from('project_phases').insert({
      project_id: projectId, titre, ordre: phases.length,
    })
    if (error) toast.error(error.message)
    else { toast.success('Phase ajoutée'); setTitre(''); router.refresh() }
    setAdding(false)
  }

  async function update(id: string, field: string, value: string | null) {
    const { error } = await supabase.from('project_phases').update({ [field]: value }).eq('id', id)
    if (error) toast.error(error.message); else router.refresh()
  }

  async function remove(id: string) {
    const { error } = await supabase.from('project_phases').delete().eq('id', id)
    if (error) toast.error(error.message); else { toast.success('Phase supprimée'); router.refresh() }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Layers className="h-4 w-4 text-indigo-500" />
          Phases ({phases.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {phases.length > 0 && (
          <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 px-1">
            <span className="col-span-5">Titre</span>
            <span className="col-span-3">Début</span>
            <span className="col-span-3">Fin</span>
            <span className="col-span-1" />
          </div>
        )}
        {phases.map((p) => (
          <div key={p.id} className="grid grid-cols-12 gap-2 items-center group">
            <Input className="col-span-5 h-9" defaultValue={p.titre}
              onBlur={(e) => e.target.value !== p.titre && update(p.id, 'titre', e.target.value)} />
            <Input type="date" className="col-span-3 h-9" defaultValue={p.date_debut ?? ''}
              onChange={(e) => update(p.id, 'date_debut', e.target.value || null)} />
            <Input type="date" className="col-span-3 h-9" defaultValue={p.date_fin ?? ''}
              onChange={(e) => update(p.id, 'date_fin', e.target.value || null)} />
            <Button variant="ghost" size="sm"
              onClick={() => remove(p.id)}
              className="col-span-1 h-9 w-9 p-0 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <form onSubmit={addPhase} className="flex gap-2 pt-2 border-t">
          <Input value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Nouvelle phase (ex: Cadrage)" className="h-9" />
          <Button type="submit" size="sm" disabled={adding || !titre.trim()}><Plus className="h-4 w-4" /></Button>
        </form>
      </CardContent>
    </Card>
  )
}
