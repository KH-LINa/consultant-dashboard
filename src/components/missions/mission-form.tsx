'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Mission, MissionStatus, Collaborateur } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

interface MissionFormProps {
  contacts: { id: string; nom: string; entreprise: string | null }[]
  mission?: Mission
  defaultContactId?: string
  defaultProjectId?: string
  collaborateurs?: Collaborateur[]
}

const NONE = '__none__'

export function MissionForm({ contacts, mission, defaultContactId, defaultProjectId, collaborateurs = [] }: MissionFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const isEdit = !!mission

  const [form, setForm] = useState({
    contact_id: mission?.contact_id ?? defaultContactId ?? '',
    titre: mission?.titre ?? '',
    description: mission?.description ?? '',
    statut: (mission?.statut ?? 'a_demarrer') as MissionStatus,
    budget_ht: mission?.budget_ht ?? 0,
    date_debut: mission?.date_debut ?? '',
    date_fin_prevue: mission?.date_fin_prevue ?? '',
    responsable_id: mission?.responsable_id ?? NONE,
  })
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.contact_id) { toast.error('Sélectionnez un client'); return }
    if (!form.titre.trim()) { toast.error('Le titre est obligatoire'); return }
    setSaving(true)

    const payload = {
      contact_id: form.contact_id,
      titre: form.titre,
      description: form.description || null,
      statut: form.statut,
      budget_ht: form.budget_ht || 0,
      date_debut: form.date_debut || null,
      date_fin_prevue: form.date_fin_prevue || null,
      responsable_id: form.responsable_id === NONE ? null : form.responsable_id,
    }

    const { error } = isEdit
      ? await supabase.from('missions').update(payload).eq('id', mission!.id)
      : await supabase.from('missions').insert({ ...payload, project_id: defaultProjectId ?? null })

    if (error) { toast.error(error.message) }
    else {
      toast.success(isEdit ? 'Mission mise à jour' : 'Mission créée')
      router.push(defaultProjectId && !isEdit ? `/projets/${defaultProjectId}` : '/missions')
      router.refresh()
    }
    setSaving(false)
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader><CardTitle>{isEdit ? 'Modifier la mission' : 'Nouvelle mission'}</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Client *</Label>
            <Select value={form.contact_id} onValueChange={(v) => setForm((p) => ({ ...p, contact_id: v ?? '' }))}>
              <SelectTrigger><SelectValue placeholder="Sélectionner un client" /></SelectTrigger>
              <SelectContent>
                {contacts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nom}{c.entreprise ? ` — ${c.entreprise}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Titre de la mission *</Label>
            <Input value={form.titre} onChange={(e) => setForm((p) => ({ ...p, titre: e.target.value }))}
              placeholder="ex: Automatisation du support client par IA" required />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={form.description} rows={3}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Objectifs, périmètre, livrables…" />
          </div>

          <div className="space-y-2">
            <Label>Responsable</Label>
            <Select value={form.responsable_id} onValueChange={(v) => setForm((p) => ({ ...p, responsable_id: v ?? NONE }))}>
              <SelectTrigger><SelectValue placeholder="Non assigné" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>— Non assigné —</SelectItem>
                {collaborateurs.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nom}{c.role ? ` · ${c.role}` : ''}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Statut</Label>
              <Select value={form.statut} onValueChange={(v) => setForm((p) => ({ ...p, statut: v as MissionStatus }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="a_demarrer">À démarrer</SelectItem>
                  <SelectItem value="en_cours">En cours</SelectItem>
                  <SelectItem value="en_pause">En pause</SelectItem>
                  <SelectItem value="terminee">Terminée</SelectItem>
                  <SelectItem value="annulee">Annulée</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Budget HT (€)</Label>
              <Input type="number" min="0" step="100" value={form.budget_ht}
                onChange={(e) => setForm((p) => ({ ...p, budget_ht: parseFloat(e.target.value) || 0 }))} />
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

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={saving}>
              {saving ? 'Enregistrement...' : isEdit ? 'Mettre à jour' : 'Créer la mission'}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.push('/missions')}>Annuler</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
