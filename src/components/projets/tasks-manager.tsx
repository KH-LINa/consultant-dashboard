'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { ProjectTask, ProjectPhase, Collaborateur, ProjectTaskStatus } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Plus, Trash2, ListChecks } from 'lucide-react'
import { toast } from 'sonner'

const statutLabel: Record<ProjectTaskStatus, string> = {
  a_faire: 'À faire', en_cours: 'En cours', fait: 'Fait', bloque: 'Bloqué',
}
const statutStyle: Record<ProjectTaskStatus, string> = {
  a_faire: 'bg-gray-100 text-gray-600',
  en_cours: 'bg-blue-100 text-blue-700',
  fait: 'bg-green-100 text-green-700',
  bloque: 'bg-red-100 text-red-700',
}

const NONE = '__none__'

interface TasksManagerProps {
  projectId: string
  tasks: ProjectTask[]
  phases: ProjectPhase[]
  collaborateurs: Collaborateur[]
}

export function TasksManager({ projectId, tasks, phases, collaborateurs }: TasksManagerProps) {
  const router = useRouter()
  const supabase = createClient()
  const [titre, setTitre] = useState('')
  const [adding, setAdding] = useState(false)

  const collabById = Object.fromEntries(collaborateurs.map((c) => [c.id, c]))
  const phaseById = Object.fromEntries(phases.map((p) => [p.id, p]))

  async function addTask(e: React.FormEvent) {
    e.preventDefault()
    if (!titre.trim()) return
    setAdding(true)
    const { error } = await supabase.from('project_tasks').insert({
      project_id: projectId, titre, ordre: tasks.length,
    })
    if (error) toast.error(error.message)
    else { toast.success('Tâche ajoutée'); setTitre(''); router.refresh() }
    setAdding(false)
  }

  async function update(id: string, field: string, value: string | number | null) {
    const { error } = await supabase.from('project_tasks').update({ [field]: value }).eq('id', id)
    if (error) toast.error(error.message); else router.refresh()
  }

  async function remove(id: string) {
    const { error } = await supabase.from('project_tasks').delete().eq('id', id)
    if (error) toast.error(error.message); else { toast.success('Tâche supprimée'); router.refresh() }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-green-600" />
          Tâches ({tasks.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {tasks.map((t) => {
          const resp = t.responsable_id ? collabById[t.responsable_id] : null
          return (
            <div key={t.id} className="border rounded-lg p-3 space-y-2 group">
              <div className="flex items-center gap-2">
                <Input className="h-8 flex-1 font-medium" defaultValue={t.titre}
                  onBlur={(e) => e.target.value !== t.titre && update(t.id, 'titre', e.target.value)} />
                <span className={`text-xs px-2 py-1 rounded-full ${statutStyle[t.statut]}`}>
                  {statutLabel[t.statut]}
                </span>
                <Button variant="ghost" size="sm" onClick={() => remove(t.id)}
                  className="h-8 w-8 p-0 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid grid-cols-12 gap-2 items-center">
                {/* Phase */}
                <div className="col-span-3">
                  <Select value={t.phase_id ?? NONE}
                    onValueChange={(v) => update(t.id, 'phase_id', v === NONE ? null : v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Phase" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>— Aucune phase —</SelectItem>
                      {phases.map((p) => <SelectItem key={p.id} value={p.id}>{p.titre}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {/* Responsable */}
                <div className="col-span-3">
                  <Select value={t.responsable_id ?? NONE}
                    onValueChange={(v) => update(t.id, 'responsable_id', v === NONE ? null : v)}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Responsable" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>— Non assigné —</SelectItem>
                      {collaborateurs.map((c) => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {/* Dates */}
                <Input type="date" className="col-span-2 h-8 text-xs" defaultValue={t.date_debut ?? ''}
                  onChange={(e) => update(t.id, 'date_debut', e.target.value || null)} />
                <Input type="date" className="col-span-2 h-8 text-xs" defaultValue={t.date_fin ?? ''}
                  onChange={(e) => update(t.id, 'date_fin', e.target.value || null)} />
                {/* Statut */}
                <div className="col-span-2">
                  <Select value={t.statut} onValueChange={(v) => update(t.id, 'statut', v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(statutLabel) as ProjectTaskStatus[]).map((s) => (
                        <SelectItem key={s} value={s}>{statutLabel[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {resp && (
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: resp.couleur }} />
                    {resp.nom}
                  </span>
                )}
                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-xs text-gray-400">Avancement</span>
                  <Input type="number" min="0" max="100" className="h-8 w-16 text-xs text-right"
                    defaultValue={t.avancement}
                    onBlur={(e) => {
                      const v = Math.max(0, Math.min(100, parseInt(e.target.value) || 0))
                      if (v !== t.avancement) update(t.id, 'avancement', v)
                    }} />
                  <span className="text-xs text-gray-400">%</span>
                </div>
              </div>
            </div>
          )
        })}
        <form onSubmit={addTask} className="flex gap-2 pt-2 border-t">
          <Input value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Nouvelle tâche" className="h-9" />
          <Button type="submit" size="sm" disabled={adding || !titre.trim()}><Plus className="h-4 w-4" /></Button>
        </form>
      </CardContent>
    </Card>
  )
}
