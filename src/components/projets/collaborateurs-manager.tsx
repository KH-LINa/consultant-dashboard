'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Collaborateur } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Plus, Trash2, Users } from 'lucide-react'
import { toast } from 'sonner'

const COULEURS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#06b6d4', '#ec4899', '#64748b']

export function CollaborateursManager({ collaborateurs }: { collaborateurs: Collaborateur[] }) {
  const router = useRouter()
  const supabase = createClient()
  const [nom, setNom] = useState('')
  const [role, setRole] = useState('')
  const [couleur, setCouleur] = useState(COULEURS[0])
  const [adding, setAdding] = useState(false)

  async function addCollaborateur(e: React.FormEvent) {
    e.preventDefault()
    if (!nom.trim()) return
    setAdding(true)
    const { error } = await supabase.from('collaborateurs').insert({
      nom, role: role || null, couleur,
    })
    if (error) toast.error(error.message)
    else {
      toast.success('Collaborateur ajouté')
      setNom(''); setRole(''); setCouleur(COULEURS[0])
      router.refresh()
    }
    setAdding(false)
  }

  async function remove(id: string) {
    const { error } = await supabase.from('collaborateurs').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('Supprimé'); router.refresh() }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4 text-blue-500" />
          Collaborateurs ({collaborateurs.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {collaborateurs.length > 0 && (
          <div className="space-y-1">
            {collaborateurs.map((c) => (
              <div key={c.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 group">
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: c.couleur }} />
                <span className="text-sm font-medium">{c.nom}</span>
                {c.role && <span className="text-xs text-gray-400">· {c.role}</span>}
                <Button variant="ghost" size="sm"
                  onClick={() => remove(c.id)}
                  className="ml-auto h-7 w-7 p-0 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={addCollaborateur} className="flex items-end gap-2 pt-2 border-t">
          <div className="flex-1">
            <Input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom" className="h-9" />
          </div>
          <div className="flex-1">
            <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Rôle (optionnel)" className="h-9" />
          </div>
          <div className="flex gap-1">
            {COULEURS.map((col) => (
              <button key={col} type="button" onClick={() => setCouleur(col)}
                className={`w-6 h-6 rounded-full border-2 ${couleur === col ? 'border-gray-800' : 'border-transparent'}`}
                style={{ background: col }} />
            ))}
          </div>
          <Button type="submit" size="sm" disabled={adding || !nom.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
