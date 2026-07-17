'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Project, ProjectStatus } from '@/lib/types'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'

type ProjectRow = Project & { contact?: { nom: string; entreprise: string | null } }

const statutLabel: Record<ProjectStatus, string> = {
  a_demarrer: 'À démarrer',
  en_cours: 'En cours',
  en_pause: 'En pause',
  termine: 'Terminé',
  annule: 'Annulé',
}

const statutStyle: Record<ProjectStatus, string> = {
  a_demarrer: 'bg-gray-100 text-gray-600',
  en_cours: 'bg-blue-100 text-blue-700',
  en_pause: 'bg-orange-100 text-orange-700',
  termine: 'bg-green-100 text-green-700',
  annule: 'bg-red-100 text-red-700',
}

export function ProjectsTable({ projects }: { projects: ProjectRow[] }) {
  const router = useRouter()
  const supabase = createClient()
  const [deleteId, setDeleteId] = useState<string | null>(null)

  async function updateField(id: string, field: string, value: string | null) {
    const { error } = await supabase.from('projects').update({ [field]: value }).eq('id', id)
    if (error) toast.error(error.message)
    else router.refresh()
  }

  async function handleDelete() {
    if (!deleteId) return
    const { error } = await supabase.from('projects').delete().eq('id', deleteId)
    if (error) toast.error('Erreur lors de la suppression')
    else {
      toast.success('Projet supprimé')
      router.refresh()
    }
    setDeleteId(null)
  }

  if (projects.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        Aucun projet. Créez-en un depuis un devis signé (bouton 📁 dans la liste des devis).
      </div>
    )
  }

  return (
    <>
      <div className="rounded-lg border bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Projet</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Début</TableHead>
              <TableHead>Échéance prévue</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">
                  <Link href={`/projets/${p.id}`} className="hover:text-blue-600 hover:underline">
                    {p.titre}
                  </Link>
                </TableCell>
                <TableCell>{p.contact?.nom ?? '—'}</TableCell>
                <TableCell>
                  <Select
                    value={p.statut}
                    onValueChange={(v) => updateField(p.id, 'statut', v)}
                  >
                    <SelectTrigger className="h-8 w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(statutLabel) as ProjectStatus[]).map((s) => (
                        <SelectItem key={s} value={s}>{statutLabel[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Input
                    type="date"
                    className="h-8 w-[150px]"
                    value={p.date_debut ?? ''}
                    onChange={(e) => updateField(p.id, 'date_debut', e.target.value || null)}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="date"
                    className="h-8 w-[150px]"
                    value={p.date_fin_prevue ?? ''}
                    onChange={(e) => updateField(p.id, 'date_fin_prevue', e.target.value || null)}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteId(p.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer le projet ?</DialogTitle>
            <DialogDescription>Cette action est irréversible.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Annuler</Button>
            <Button variant="destructive" onClick={handleDelete}>Supprimer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
