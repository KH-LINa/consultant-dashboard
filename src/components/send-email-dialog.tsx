'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Send } from 'lucide-react'
import { toast } from 'sonner'

interface SendEmailDialogProps {
  type: 'devis' | 'facture'
  id: string
  titre: string
  contactEmail?: string | null
}

export function SendEmailDialog({ type, id, titre, contactEmail }: SendEmailDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [form, setForm] = useState({
    to: contactEmail ?? '',
    subject: `${type === 'devis' ? 'Devis' : 'Facture'} — ${titre}`,
    message: type === 'devis'
      ? `Bonjour,\n\nVeuillez trouver ci-joint le devis pour "${titre}".\n\nN'hésitez pas à me contacter pour toute question.\n\nCordialement,`
      : `Bonjour,\n\nVeuillez trouver ci-joint la facture "${titre}".\n\nMerci de procéder au règlement à l'échéance indiquée.\n\nCordialement,`,
  })

  async function handleSend() {
    if (!form.to) { toast.error('Email destinataire obligatoire'); return }
    setSending(true)
    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, id, ...form }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Erreur lors de l\'envoi')
      } else {
        toast.success(`${type === 'devis' ? 'Devis' : 'Facture'} envoyé(e) à ${form.to} ✓`)
        setOpen(false)
        router.refresh()
      }
    } catch {
      toast.error('Erreur réseau')
    }
    setSending(false)
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="text-blue-600 hover:text-blue-800"
        title={`Envoyer par email`}
      >
        <Send className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-blue-500" />
              Envoyer {type === 'devis' ? 'le devis' : 'la facture'} par email
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
              📎 Le PDF sera joint automatiquement
            </div>
            <div className="space-y-2">
              <Label>À *</Label>
              <Input
                type="email"
                value={form.to}
                onChange={(e) => setForm((p) => ({ ...p, to: e.target.value }))}
                placeholder="client@entreprise.fr"
              />
            </div>
            <div className="space-y-2">
              <Label>Objet</Label>
              <Input
                value={form.subject}
                onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea
                value={form.message}
                onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
                rows={5}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={handleSend} disabled={sending}>
              <Send className="h-4 w-4 mr-2" />
              {sending ? 'Envoi...' : 'Envoyer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
