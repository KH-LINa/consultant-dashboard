'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { MissionTask } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Trash2, Clock, CheckSquare } from 'lucide-react'
import { toast } from 'sonner'

export function MissionTasks({ missionId, initialTasks }: { missionId: string; initialTasks: MissionTask[] }) {
  const router = useRouter()
  const supabase = createClient()
  const [tasks, setTasks] = useState<MissionTask[]>(initialTasks)
  const [newTitre, setNewTitre] = useState('')
  const [adding, setAdding] = useState(false)

  const totalHeures = tasks.reduce((s, t) => s + (Number(t.temps_passe) || 0), 0)
  const doneCount = tasks.filter((t) => t.done).length
  const pct = tasks.length > 0 ? (doneCount / tasks.length) * 100 : 0

  async function addTask(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitre.trim()) return
    setAdding(true)
    const { data, error } = await supabase.from('mission_tasks')
      .insert({ mission_id: missionId, titre: newTitre, ordre: tasks.length })
      .select().single()
    if (error) { toast.error(error.message) }
    else { setTasks((p) => [...p, data]); setNewTitre('') }
    setAdding(false)
  }

  async function toggleDone(task: MissionTask) {
    const newDone = !task.done
    setTasks((p) => p.map((t) => t.id === task.id ? { ...t, done: newDone } : t))
    await supabase.from('mission_tasks').update({ done: newDone }).eq('id', task.id)
  }

  async function updateTemps(task: MissionTask, temps: number) {
    setTasks((p) => p.map((t) => t.id === task.id ? { ...t, temps_passe: temps } : t))
    await supabase.from('mission_tasks').update({ temps_passe: temps }).eq('id', task.id)
  }

  async function deleteTask(id: string) {
    setTasks((p) => p.filter((t) => t.id !== id))
    await supabase.from('mission_tasks').delete().eq('id', id)
    toast.success('Tâche supprimée')
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-blue-500" />
            Tâches & temps
          </CardTitle>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-500">{doneCount}/{tasks.length} faites</span>
            <span className="flex items-center gap-1 font-semibold text-gray-700">
              <Clock className="h-4 w-4 text-gray-400" />{totalHeures}h
            </span>
          </div>
        </div>
        {tasks.length > 0 && (
          <div className="w-full bg-gray-100 rounded-full h-2 mt-2">
            <div className="h-2 rounded-full bg-blue-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {tasks.map((task) => (
          <div key={task.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 group">
            <input
              type="checkbox"
              checked={task.done}
              onChange={() => toggleDone(task)}
              className="h-4 w-4 rounded border-gray-300 cursor-pointer"
            />
            <span className={`flex-1 text-sm ${task.done ? 'line-through text-gray-400' : 'text-gray-800'}`}>
              {task.titre}
            </span>
            <div className="flex items-center gap-1">
              <Input
                type="number" min="0" step="0.5"
                value={task.temps_passe}
                onChange={(e) => updateTemps(task, parseFloat(e.target.value) || 0)}
                className="h-7 w-16 text-right text-xs"
              />
              <span className="text-xs text-gray-400">h</span>
            </div>
            <Button variant="ghost" size="sm"
              onClick={() => deleteTask(task.id)}
              className="h-7 w-7 p-0 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}

        {tasks.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">Aucune tâche. Ajoutez-en une ci-dessous.</p>
        )}

        <form onSubmit={addTask} className="flex gap-2 pt-2 border-t">
          <Input
            value={newTitre}
            onChange={(e) => setNewTitre(e.target.value)}
            placeholder="Nouvelle tâche…"
            className="h-9"
          />
          <Button type="submit" size="sm" disabled={adding || !newTitre.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
