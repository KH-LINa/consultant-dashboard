'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Collaborateur } from '@/lib/types'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'

const NONE = '__none__'

interface ProjectResponsableSelectProps {
  projectId: string
  responsableId: string | null
  collaborateurs: Collaborateur[]
}

export function ProjectResponsableSelect({ projectId, responsableId, collaborateurs }: ProjectResponsableSelectProps) {
  const router = useRouter()
  const supabase = createClient()
  const collabById = Object.fromEntries(collaborateurs.map((c) => [c.id, c]))

  async function update(value: string | null) {
    const v = value === NONE || !value ? null : value
    const { error } = await supabase.from('projects').update({ responsable_id: v }).eq('id', projectId)
    if (error) toast.error(error.message)
    else { toast.success('Responsable mis à jour'); router.refresh() }
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-500">Responsable :</span>
      <Select value={responsableId ?? NONE} onValueChange={update}>
        <SelectTrigger className="h-8 w-[200px]">
          <SelectValue>
            {(v: string) => {
              if (v === NONE || !v) return 'Non assigné'
              const c = collabById[v]
              return c ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: c.couleur }} />
                  {c.nom}
                </span>
              ) : 'Non assigné'
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>— Non assigné —</SelectItem>
          {collaborateurs.map((c) => (
            <SelectItem key={c.id} value={c.id}>{c.nom}{c.role ? ` · ${c.role}` : ''}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {collaborateurs.length === 0 && (
        <span className="text-xs text-gray-400">Ajoutez d'abord un collaborateur ci-dessous.</span>
      )}
    </div>
  )
}
