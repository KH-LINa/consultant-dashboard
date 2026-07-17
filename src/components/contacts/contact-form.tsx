'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Contact, ContactType } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

interface ContactFormProps {
  contact?: Contact
}

export function ContactForm({ contact }: ContactFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const isEdit = !!contact

  const [form, setForm] = useState({
    nom: contact?.nom ?? '',
    type: contact?.type ?? 'prospect' as ContactType,
    email: contact?.email ?? '',
    telephone: contact?.telephone ?? '',
    entreprise: contact?.entreprise ?? '',
    notes: contact?.notes ?? '',
  })
  const [saving, setSaving] = useState(false)

  function update(field: string, value: string | null) {
    setForm((prev) => ({ ...prev, [field]: value ?? '' }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nom.trim()) {
      toast.error('Le nom est obligatoire')
      return
    }
    setSaving(true)

    const payload = {
      nom: form.nom,
      type: form.type,
      email: form.email || null,
      telephone: form.telephone || null,
      entreprise: form.entreprise || null,
      notes: form.notes || null,
    }

    const { error } = isEdit
      ? await supabase.from('contacts').update(payload).eq('id', contact!.id)
      : await supabase.from('contacts').insert(payload)

    if (error) {
      toast.error(error.message)
    } else {
      toast.success(isEdit ? 'Contact mis à jour' : 'Contact créé')
      router.push('/contacts')
      router.refresh()
    }
    setSaving(false)
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>{isEdit ? 'Modifier le contact' : 'Nouveau contact'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nom">Nom *</Label>
              <Input
                id="nom"
                value={form.nom}
                onChange={(e) => update('nom', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Type *</Label>
              <Select value={form.type} onValueChange={(v) => update('type', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="prospect">Prospect</SelectItem>
                  <SelectItem value="client">Client</SelectItem>
                  <SelectItem value="inactif">Inactif</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telephone">Téléphone</Label>
              <Input
                id="telephone"
                value={form.telephone}
                onChange={(e) => update('telephone', e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="entreprise">Entreprise</Label>
            <Input
              id="entreprise"
              value={form.entreprise}
              onChange={(e) => update('entreprise', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={saving}>
              {saving ? 'Enregistrement...' : isEdit ? 'Mettre à jour' : 'Créer le contact'}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.push('/contacts')}>
              Annuler
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
