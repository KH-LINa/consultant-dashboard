'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { SignalementType } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

const NONE = '__none__'

const TYPE_LABEL: Record<SignalementType, string> = {
  retard: 'Retard (trajet, livraison...)',
  imprevu: 'Imprévu',
  blocage: 'Blocage',
  materiel: 'Problème matériel',
  autre: 'Autre',
}

// Bouton + formulaire pour signaler un événement libre (pas forcément lié à
// une tâche précise) — notifie systématiquement le staff (admin/manager),
// voir supabase-comments-signalements-migration.sql.
export function SignalerEvenementDialog({ tasks = [] }: { tasks?: { id: string; titre: string }[] }) {
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [form, setForm] = useState({
    type: 'imprevu' as SignalementType,
    titre: '',
    message: '',
    task_id: NONE,
  })

  async function envoyer() {
    if (!form.titre.trim() || !form.message.trim()) {
      toast.error('Le titre et le message sont obligatoires')
      return
    }
    setSending(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSending(false); return }
    const { error } = await supabase.from('signalements').insert({
      auteur_id: user.id,
      type: form.type,
      titre: form.titre.trim(),
      message: form.message.trim(),
      task_id: form.task_id === NONE ? null : form.task_id,
    })
    if (error) { toast.error(error.message); setSending(false); return }
    toast.success('Signalement envoyé — votre administrateur a été notifié')
    setForm({ type: 'imprevu', titre: '', message: '', task_id: NONE })
    setOpen(false)
    setSending(false)
  }

  return (
    <>
      <Button
        variant="outline" size="sm" onClick={() => setOpen(true)}
        className="gap-1.5 text-amber-700 border-amber-200 hover:bg-amber-50"
      >
        <AlertTriangle className="h-4 w-4" />
        Signaler un événement
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Signaler un événement</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm((p) => ({ ...p, type: (v ?? 'autre') as SignalementType }))}>
                <SelectTrigger>
                  <SelectValue>{(v: string) => TYPE_LABEL[v as SignalementType] ?? v}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(TYPE_LABEL) as SignalementType[]).map((t) => (
                    <SelectItem key={t} value={t}>{TYPE_LABEL[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Titre *</Label>
              <Input
                value={form.titre}
                onChange={(e) => setForm((p) => ({ ...p, titre: e.target.value }))}
                placeholder="Ex. Retard sur le trajet vers le site client"
              />
            </div>

            <div className="space-y-2">
              <Label>Message *</Label>
              <Textarea
                value={form.message}
                onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
                placeholder="Détails de l'événement..."
                className="min-h-[100px]"
              />
            </div>

            {tasks.length > 0 && (
              <div className="space-y-2">
                <Label>Tâche concernée (optionnel)</Label>
                <Select value={form.task_id} onValueChange={(v) => setForm((p) => ({ ...p, task_id: v ?? NONE }))}>
                  <SelectTrigger>
                    <SelectValue>
                      {(v: string) => (v === NONE || !v ? 'Aucune tâche en particulier' : (tasks.find((t) => t.id === v)?.titre ?? 'Tâche'))}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Aucune tâche en particulier</SelectItem>
                    {tasks.map((t) => <SelectItem key={t.id} value={t.id}>{t.titre}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={envoyer} disabled={sending}>
              {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Envoyer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
