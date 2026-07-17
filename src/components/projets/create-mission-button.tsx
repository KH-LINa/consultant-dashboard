'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Collaborateur, MissionStatus, ProjectMilestone } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Plus, Loader2, Flag } from 'lucide-react'
import { toast } from 'sonner'

const NONE = '__none__'

const statutLabel: Record<MissionStatus, string> = {
  a_demarrer: 'À démarrer',
  en_cours: 'En cours',
  en_pause: 'En pause',
  terminee: 'Terminée',
  annulee: 'Annulée',
}

interface CreateMissionButtonProps {
  projectId: string
  contactId: string
  projetTitre: string
  collaborateurs: Collaborateur[]
  milestones?: ProjectMilestone[]
  defaultDateDebut?: string | null
  defaultDateFin?: string | null
  defaultResponsableId?: string | null
}

export function CreateMissionButton({
  projectId, contactId, projetTitre, collaborateurs, milestones = [],
  defaultDateDebut, defaultDateFin, defaultResponsableId,
}: CreateMissionButtonProps) {
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const collabById = Object.fromEntries(collaborateurs.map((c) => [c.id, c]))

  const [form, setForm] = useState({
    titre: `Mission — ${projetTitre}`,
    responsable_id: defaultResponsableId ?? NONE,
    statut: 'a_demarrer' as MissionStatus,
    date_debut: defaultDateDebut ?? '',
    date_fin_prevue: defaultDateFin ?? '',
    budget_ht: 0,
  })

  function fdate(d: string | null) {
    return d ? new Date(d).toLocaleDateString('fr-FR') : '—'
  }

  async function handleCreate() {
    if (!form.titre.trim()) { toast.error('Le titre est obligatoire'); return }
    setSaving(true)

    const { data, error } = await supabase
      .from('missions')
      .insert({
        project_id: projectId,
        contact_id: contactId,
        titre: form.titre,
        statut: form.statut,
        responsable_id: form.responsable_id === NONE ? null : form.responsable_id,
        date_debut: form.date_debut || null,
        date_fin_prevue: form.date_fin_prevue || null,
        budget_ht: form.budget_ht || 0,
      })
      .select('id')
      .single()

    if (error) {
      toast.error(error.message)
      setSaving(false)
      return
    }

    toast.success('Mission créée et rattachée ✓')
    setOpen(false)
    router.refresh()
    setSaving(false)
    if (data?.id) router.push(`/missions/${data.id}`)
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4 mr-1" />Nouvelle mission
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nouvelle mission</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Titre *</Label>
              <Input value={form.titre}
                onChange={(e) => setForm((p) => ({ ...p, titre: e.target.value }))} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Responsable</Label>
                <Select value={form.responsable_id}
                  onValueChange={(v) => setForm((p) => ({ ...p, responsable_id: v ?? NONE }))}>
                  <SelectTrigger>
                    <SelectValue>
                      {(v: string) => v === NONE || !v ? 'Non assigné' : (collabById[v]?.nom ?? 'Non assigné')}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>— Non assigné —</SelectItem>
                    {collaborateurs.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {collaborateurs.length === 0 && (
                  <p className="text-xs text-gray-400">Ajoutez des collaborateurs sur le projet.</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Statut</Label>
                <Select value={form.statut}
                  onValueChange={(v) => setForm((p) => ({ ...p, statut: (v ?? 'a_demarrer') as MissionStatus }))}>
                  <SelectTrigger>
                    <SelectValue>{(v: string) => statutLabel[v as MissionStatus] ?? v}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(statutLabel) as MissionStatus[]).map((s) => (
                      <SelectItem key={s} value={s}>{statutLabel[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date de début</Label>
                <Input type="date" value={form.date_debut}
                  onChange={(e) => setForm((p) => ({ ...p, date_debut: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Échéance prévue</Label>
                <Input type="date" value={form.date_fin_prevue}
                  onChange={(e) => setForm((p) => ({ ...p, date_fin_prevue: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Budget HT (€)</Label>
              <Input type="number" min="0" step="100" value={form.budget_ht}
                onChange={(e) => setForm((p) => ({ ...p, budget_ht: parseFloat(e.target.value) || 0 }))} />
            </div>

            {/* Jalons du projet (contexte, lecture seule) */}
            {milestones.length > 0 && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                <p className="text-xs font-medium text-amber-800 flex items-center gap-1.5 mb-2">
                  <Flag className="h-3.5 w-3.5" />
                  Jalons du projet ({milestones.length}) — à garder en tête
                </p>
                <div className="space-y-1">
                  {milestones.map((m) => (
                    <div key={m.id} className="flex items-center justify-between text-xs text-amber-900">
                      <span>◆ {m.titre}</span>
                      <span className="font-medium">{fdate(m.date_echeance)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Créer la mission
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
