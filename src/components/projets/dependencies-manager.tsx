'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { ProjectTask, TaskDependency } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Link2, Trash2, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'

interface DependenciesManagerProps {
  tasks: ProjectTask[]
  dependencies: TaskDependency[]
}

export function DependenciesManager({ tasks, dependencies }: DependenciesManagerProps) {
  const router = useRouter()
  const supabase = createClient()
  const [pred, setPred] = useState('')
  const [succ, setSucc] = useState('')

  const titreById = Object.fromEntries(tasks.map((t) => [t.id, t.titre]))

  async function addDependency() {
    if (!pred || !succ) { toast.error('Sélectionnez les deux tâches'); return }
    if (pred === succ) { toast.error('Une tâche ne peut pas dépendre d\'elle-même'); return }
    const { error } = await supabase.from('task_dependencies').insert({
      predecessor_id: pred, successor_id: succ,
    })
    if (error) {
      toast.error(error.message.includes('duplicate') ? 'Cette dépendance existe déjà' : error.message)
    } else {
      toast.success('Dépendance ajoutée')
      setPred(''); setSucc('')
      router.refresh()
    }
  }

  async function remove(id: string) {
    const { error } = await supabase.from('task_dependencies').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('Dépendance supprimée'); router.refresh() }
  }

  if (tasks.length < 2) {
    return null // pas de dépendances possibles avec moins de 2 tâches
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Link2 className="h-4 w-4 text-cyan-600" />
          Dépendances entre tâches ({dependencies.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {dependencies.length > 0 && (
          <div className="space-y-1">
            {dependencies.map((d) => (
              <div key={d.id} className="flex items-center gap-2 text-sm p-2 rounded-lg hover:bg-gray-50 group">
                <span className="font-medium">{titreById[d.predecessor_id] ?? '?'}</span>
                <ArrowRight className="h-3.5 w-3.5 text-gray-400" />
                <span className="font-medium">{titreById[d.successor_id] ?? '?'}</span>
                <Button variant="ghost" size="sm" onClick={() => remove(d.id)}
                  className="ml-auto h-7 w-7 p-0 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2 pt-2 border-t">
          <div className="flex-1">
            <label className="text-xs text-gray-500">D'abord (prérequis)</label>
            <Select value={pred} onValueChange={(v) => setPred(v ?? '')}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Tâche prérequise">
                  {(v: string) => titreById[v] ?? 'Tâche prérequise'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {tasks.map((t) => <SelectItem key={t.id} value={t.id}>{t.titre}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <ArrowRight className="h-4 w-4 text-gray-400 mb-2.5" />
          <div className="flex-1">
            <label className="text-xs text-gray-500">Ensuite (dépend de)</label>
            <Select value={succ} onValueChange={(v) => setSucc(v ?? '')}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Tâche suivante">
                  {(v: string) => titreById[v] ?? 'Tâche suivante'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {tasks.map((t) => <SelectItem key={t.id} value={t.id}>{t.titre}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" onClick={addDependency} className="h-9">Lier</Button>
        </div>
        <p className="text-xs text-gray-400">
          La tâche « prérequise » doit se terminer avant que la suivante commence (flèche dans le Gantt).
        </p>
      </CardContent>
    </Card>
  )
}
