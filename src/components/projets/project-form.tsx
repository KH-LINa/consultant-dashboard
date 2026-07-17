'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { ProjectStatus, Collaborateur } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Trash2, Flag } from 'lucide-react'
import { toast } from 'sonner'

interface ProjectFormProps {
  contacts: { id: string; nom: string; entreprise: string | null }[]
  collaborateurs: Collaborateur[]
  defaultContactId?: string
}

interface JalonDraft {
  nom: string
  date: string
}

const NONE = '__none__'
const NEW = '__new__'

export function ProjectForm({ contacts, collaborateurs, defaultContactId }: ProjectFormProps) {
  const router = useRouter()
  const supabase = createClient()

  const [form, setForm] = useState({
    contact_id: defaultContactId ?? '',
    titre: '',
    statut: 'a_demarrer' as ProjectStatus,
    date_debut: '',
    date_fin_prevue: '',
    responsable_id: NONE,
  })
  const [nouveauResponsable, setNouveauResponsable] = useState('')
  const [jalons, setJalons] = useState<JalonDraft[]>([])
  const [saving, setSaving] = useState(false)

  function addJalon() {
    setJalons((prev) => [...prev, { nom: '', date: '' }])
  }
  function updateJalon(idx: number, field: keyof JalonDraft, value: string) {
    setJalons((prev) => prev.map((j, i) => (i === idx ? { ...j, [field]: value } : j)))
  }
  function removeJalon(idx: number) {
    setJalons((prev) => prev.filter((_, i) => i !== idx))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.contact_id) { toast.error('Sélectionnez un client'); return }
    if (!form.titre.trim()) { toast.error('Le titre est obligatoire'); return }

    setSaving(true)

    // 0. Déterminer le responsable (création à la volée si nouveau)
    let responsableId: string | null = null
    if (form.responsable_id === NEW) {
      if (nouveauResponsable.trim()) {
        const { data: collab, error: cErr } = await supabase
          .from('collaborateurs')
          .insert({ nom: nouveauResponsable.trim() })
          .select('id')
          .single()
        if (cErr) {
          toast.error(`Erreur création responsable : ${cErr.message}`)
          setSaving(false)
          return
        }
        responsableId = collab?.id ?? null
      }
    } else if (form.responsable_id !== NONE) {
      responsableId = form.responsable_id
    }

    // 1. Créer le projet
    const { data: project, error } = await supabase
      .from('projects')
      .insert({
        contact_id: form.contact_id,
        titre: form.titre,
        statut: form.statut,
        date_debut: form.date_debut || null,
        date_fin_prevue: form.date_fin_prevue || null,
        responsable_id: responsableId,
      })
      .select('id')
      .single()

    if (error || !project) {
      toast.error(error?.message ?? 'Erreur lors de la création')
      setSaving(false)
      return
    }

    // 2. Créer les jalons (project_milestones) — on ignore les lignes vides
    const jalonsValides = jalons.filter((j) => j.nom.trim())
    if (jalonsValides.length > 0) {
      const { error: jErr } = await supabase.from('project_milestones').insert(
        jalonsValides.map((j, idx) => ({
          project_id: project.id,
          titre: j.nom,
          date_echeance: j.date || null,
          ordre: idx,
        }))
      )
      if (jErr) toast.error(`Projet créé, mais erreur sur les jalons : ${jErr.message}`)
    }

    toast.success('Projet créé ✓')
    router.push(`/projets/${project.id}`)
    router.refresh()
    setSaving(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader><CardTitle>Informations du projet</CardTitle></CardHeader>
        <CardContent className="space-y-4">
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
            <Label>Titre du projet *</Label>
            <Input value={form.titre}
              onChange={(e) => setForm((p) => ({ ...p, titre: e.target.value }))}
              placeholder="ex: Déploiement d'un assistant IA support client" required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date de début</Label>
              <Input type="date" value={form.date_debut}
                onChange={(e) => setForm((p) => ({ ...p, date_debut: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Date de fin prévue</Label>
              <Input type="date" value={form.date_fin_prevue}
                onChange={(e) => setForm((p) => ({ ...p, date_fin_prevue: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Statut</Label>
              <Select value={form.statut} onValueChange={(v) => setForm((p) => ({ ...p, statut: v as ProjectStatus }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="a_demarrer">À démarrer</SelectItem>
                  <SelectItem value="en_cours">En cours</SelectItem>
                  <SelectItem value="en_pause">En pause</SelectItem>
                  <SelectItem value="termine">Terminé</SelectItem>
                  <SelectItem value="annule">Annulé</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Responsable du projet</Label>
              <Select value={form.responsable_id} onValueChange={(v) => setForm((p) => ({ ...p, responsable_id: v ?? NONE }))}>
                <SelectTrigger><SelectValue placeholder="Non assigné" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>— Non assigné —</SelectItem>
                  {collaborateurs.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nom}{c.role ? ` · ${c.role}` : ''}</SelectItem>
                  ))}
                  <SelectItem value={NEW}>➕ Nouveau collaborateur…</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {form.responsable_id === NEW && (
            <div className="space-y-2">
              <Label>Nom du nouveau responsable</Label>
              <Input value={nouveauResponsable}
                onChange={(e) => setNouveauResponsable(e.target.value)}
                placeholder="ex: Khelaf Fedila" />
              <p className="text-xs text-gray-400">Il sera créé comme collaborateur et assigné au projet.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Jalons */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Flag className="h-4 w-4 text-amber-500" />
            Jalons ({jalons.length})
          </CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={addJalon}>
            <Plus className="h-4 w-4 mr-1" />Ajouter un jalon
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {jalons.length === 0 && (
            <p className="text-sm text-gray-400 py-2">
              Aucun jalon. Cliquez « Ajouter un jalon » pour planifier vos livrables (ex: Cadrage validé, Livraison V1…).
            </p>
          )}
          {jalons.map((j, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <Input className="flex-1 h-9" placeholder="Nom du jalon (ex: Livraison V1)"
                value={j.nom} onChange={(e) => updateJalon(idx, 'nom', e.target.value)} />
              <Input type="date" className="h-9 w-[160px]"
                value={j.date} onChange={(e) => updateJalon(idx, 'date', e.target.value)} />
              <Button type="button" variant="ghost" size="sm"
                onClick={() => removeJalon(idx)}
                className="h-9 w-9 p-0 text-red-400 hover:text-red-600">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? 'Création...' : 'Créer le projet'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push('/projets')}>Annuler</Button>
      </div>
    </form>
  )
}
