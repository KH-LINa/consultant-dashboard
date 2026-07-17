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
import { Bell } from 'lucide-react'
import { toast } from 'sonner'

interface RelanceButtonProps {
  type: 'devis' | 'facture'
  id: string
  titre: string
  contactNom: string
  contactEmail?: string | null
  jours: number
  nbRelances: number
  montant: number
}

export function RelanceButton({
  type, id, titre, contactNom, contactEmail, jours, nbRelances, montant,
}: RelanceButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [sending, setSending] = useState(false)

  const montantStr = montant.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })

  const defaultMessage = type === 'devis'
    ? `Bonjour,\n\nJe me permets de revenir vers vous concernant le devis "${titre}" (${montantStr}) que je vous ai transmis il y a ${jours} jours.\n\nAvez-vous eu l'occasion de l'étudier ? Je reste à votre disposition pour échanger sur d'éventuels ajustements.\n\nVous trouverez à nouveau le devis en pièce jointe.\n\nCordialement,`
    : `Bonjour,\n\nSauf erreur de ma part, la facture "${titre}" (${montantStr}) émise il y a ${jours} jours demeure impayée à ce jour.\n\nJe vous remercie de bien vouloir procéder à son règlement dans les meilleurs délais. La facture est jointe à nouveau pour votre convenance.\n\nN'hésitez pas à me contacter si vous avez la moindre question.\n\nCordialement,`

  const [form, setForm] = useState({
    to: contactEmail ?? '',
    subject: type === 'devis' ? `Relance — Devis ${titre}` : `Relance — Facture impayée ${titre}`,
    message: defaultMessage,
  })

  async function handleSend() {
    if (!form.to) { toast.error('Email destinataire obligatoire'); return }
    setSending(true)
    try {
      const res = await fetch('/api/relance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, id, ...form }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Erreur')
      } else {
        toast.success(`Relance envoyée à ${form.to} ✓`)
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
      <Button size="sm" onClick={() => setOpen(true)} className="gap-1.5">
        <Bell className="h-3.5 w-3.5" />
        Relancer
        {nbRelances > 0 && (
          <span className="ml-1 text-xs bg-white/20 px-1.5 rounded-full">{nbRelances}</span>
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-orange-500" />
              Relancer {contactNom}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="p-3 bg-orange-50 rounded-lg text-sm text-orange-700">
              {nbRelances === 0
                ? `📎 Première relance — le PDF sera joint`
                : `📎 ${nbRelances}ème relance déjà envoyée — nouvelle relance avec PDF joint`}
            </div>
            <div className="space-y-2">
              <Label>À *</Label>
              <Input type="email" value={form.to}
                onChange={(e) => setForm((p) => ({ ...p, to: e.target.value }))}
                placeholder="client@entreprise.fr" />
            </div>
            <div className="space-y-2">
              <Label>Objet</Label>
              <Input value={form.subject}
                onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea value={form.message} rows={8}
                onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={handleSend} disabled={sending}>
              <Bell className="h-4 w-4 mr-2" />
              {sending ? 'Envoi...' : 'Envoyer la relance'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
