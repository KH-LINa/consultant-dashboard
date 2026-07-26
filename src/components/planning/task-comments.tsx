'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { TaskComment } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { MessageSquare, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'

function fmtDateHeure(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

// Fil de commentaires d'une tâche — repliable pour ne pas alourdir les
// listes de tâches par défaut ; chargé à la demande (pas de fetch tant que
// l'utilisateur ne déplie pas).
export function TaskComments({ taskId }: { taskId: string }) {
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [comments, setComments] = useState<TaskComment[] | null>(null)
  const [texte, setTexte] = useState('')
  const [sending, setSending] = useState(false)

  async function toggle() {
    if (open) { setOpen(false); return }
    setOpen(true)
    if (comments === null) {
      setLoading(true)
      const { data, error } = await supabase
        .from('task_comments').select('*').eq('task_id', taskId).order('created_at', { ascending: true })
      if (error) toast.error(error.message)
      else setComments((data ?? []) as TaskComment[])
      setLoading(false)
    }
  }

  async function envoyer() {
    if (!texte.trim()) return
    setSending(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSending(false); return }
    const { data, error } = await supabase
      .from('task_comments')
      .insert({ task_id: taskId, auteur_id: user.id, contenu: texte.trim() })
      .select('*')
      .single()
    if (error) toast.error(error.message)
    else {
      setComments((prev) => [...(prev ?? []), data as TaskComment])
      setTexte('')
    }
    setSending(false)
  }

  return (
    <div className="border-t pt-2 mt-2">
      <button type="button" onClick={toggle} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600">
        <MessageSquare className="h-3.5 w-3.5" />
        Commentaires{comments && comments.length > 0 ? ` (${comments.length})` : ''}
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {loading && <p className="text-xs text-gray-400">Chargement…</p>}
          {!loading && comments?.length === 0 && (
            <p className="text-xs text-gray-400">Aucun commentaire pour l&apos;instant.</p>
          )}
          {comments?.map((c) => (
            <div key={c.id} className="bg-gray-50 rounded-lg p-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-gray-700 truncate">{c.auteur_nom}</span>
                <span className="text-[11px] text-gray-400 whitespace-nowrap">{fmtDateHeure(c.created_at)}</span>
              </div>
              <p className="text-xs text-gray-600 mt-0.5 whitespace-pre-wrap">{c.contenu}</p>
            </div>
          ))}
          <Textarea
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            placeholder="Ajouter un commentaire (ex. cause d'un retard, blocage...)"
            className="text-xs min-h-[60px]"
          />
          <Button size="sm" onClick={envoyer} disabled={sending || !texte.trim()}>
            {sending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
            Envoyer
          </Button>
        </div>
      )}
    </div>
  )
}
