'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Invoice, QuoteLine, QuoteOffer, InvoiceStatus } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

interface InvoiceFormProps {
  contacts: { id: string; nom: string; entreprise: string | null }[]
  invoice?: Invoice
  defaultContactId?: string
  defaultTitre?: string
  defaultLignes?: QuoteLine[]
  defaultOffre?: QuoteOffer
  defaultMontant?: number
  quoteId?: string
}

const emptyLine = (): QuoteLine => ({ description: '', quantite: 1, prix_unitaire: 0 })

function getDefaultEcheance(days = 30): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

export function InvoiceForm({
  contacts, invoice, defaultContactId, defaultTitre,
  defaultLignes, defaultOffre, defaultMontant, quoteId,
}: InvoiceFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const isEdit = !!invoice

  const [form, setForm] = useState({
    contact_id: invoice?.contact_id ?? defaultContactId ?? '',
    titre: invoice?.titre ?? defaultTitre ?? '',
    offre: (invoice?.offre ?? defaultOffre ?? 'consulting') as QuoteOffer,
    statut: (invoice?.statut ?? 'brouillon') as InvoiceStatus,
    date_emission: invoice?.date_emission ?? new Date().toISOString().split('T')[0],
    date_echeance: invoice?.date_echeance ?? getDefaultEcheance(30),
    notes: invoice?.notes ?? '',
  })
  const [lignes, setLignes] = useState<QuoteLine[]>(
    invoice?.lignes?.length ? invoice.lignes
    : defaultLignes?.length ? defaultLignes
    : [emptyLine()]
  )
  const [saving, setSaving] = useState(false)

  function updateLigne(idx: number, field: keyof QuoteLine, value: string | number) {
    setLignes((prev) => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l))
  }

  const montantHT = lignes.reduce((s, l) => s + l.quantite * l.prix_unitaire, 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.contact_id) { toast.error('Sélectionnez un contact'); return }
    if (!form.titre.trim()) { toast.error('Le titre est obligatoire'); return }

    setSaving(true)

    if (isEdit) {
      const { error } = await supabase.from('invoices').update({
        contact_id: form.contact_id,
        titre: form.titre,
        offre: form.offre,
        statut: form.statut,
        montant_ht: montantHT,
        lignes,
        date_emission: form.date_emission,
        date_echeance: form.date_echeance || null,
        notes: form.notes || null,
      }).eq('id', invoice!.id)

      if (error) { toast.error(error.message) }
      else { toast.success('Facture mise à jour'); router.push('/factures'); router.refresh() }
    } else {
      // Générer le numéro de facture : FACT-YYYY-NNN
      const year = new Date().getFullYear()
      const { data: lastInv } = await supabase
        .from('invoices')
        .select('numero')
        .like('numero', `FACT-${year}-%`)
        .order('numero', { ascending: false })
        .limit(1)

      let nextNum = 1
      if (lastInv && lastInv.length > 0) {
        const parts = lastInv[0].numero.split('-')
        nextNum = parseInt(parts[2] || '0', 10) + 1
      }
      const numero = `FACT-${year}-${String(nextNum).padStart(3, '0')}`

      const { error } = await supabase.from('invoices').insert({
        numero,
        quote_id: quoteId ?? null,
        contact_id: form.contact_id,
        titre: form.titre,
        offre: form.offre,
        statut: form.statut,
        montant_ht: montantHT,
        lignes,
        date_emission: form.date_emission,
        date_echeance: form.date_echeance || null,
        notes: form.notes || null,
      })

      if (error) { toast.error(error.message) }
      else { toast.success(`Facture ${numero} créée !`); router.push('/factures'); router.refresh() }
    }
    setSaving(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
      <Card>
        <CardHeader><CardTitle>Informations générales</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-2 col-span-2">
            <Label>Contact *</Label>
            <Select value={form.contact_id} onValueChange={(v) => setForm((p) => ({ ...p, contact_id: v ?? '' }))}>
              <SelectTrigger><SelectValue placeholder="Sélectionner un contact" /></SelectTrigger>
              <SelectContent>
                {contacts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nom}{c.entreprise ? ` — ${c.entreprise}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 col-span-2">
            <Label>Titre *</Label>
            <Input
              value={form.titre}
              onChange={(e) => setForm((p) => ({ ...p, titre: e.target.value }))}
              placeholder="ex: Facture mission automatisation RH — Juillet 2026"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Type d'offre</Label>
            <Select value={form.offre} onValueChange={(v) => setForm((p) => ({ ...p, offre: v as QuoteOffer }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="consulting">Consulting</SelectItem>
                <SelectItem value="automatisation">Automatisation</SelectItem>
                <SelectItem value="solution_globale">Solution globale</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Statut</Label>
            <Select value={form.statut} onValueChange={(v) => setForm((p) => ({ ...p, statut: v as InvoiceStatus }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="brouillon">Brouillon</SelectItem>
                <SelectItem value="envoyée">Envoyée</SelectItem>
                <SelectItem value="payée">Payée</SelectItem>
                <SelectItem value="annulée">Annulée</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Date d'émission</Label>
            <Input
              type="date"
              value={form.date_emission}
              onChange={(e) => setForm((p) => ({ ...p, date_emission: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label>Date d'échéance</Label>
            <Input
              type="date"
              value={form.date_echeance ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, date_echeance: e.target.value }))}
            />
          </div>

          <div className="space-y-2 col-span-2">
            <Label>Notes internes (non visible sur la facture)</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              rows={2}
              placeholder="Informations de suivi, référence client…"
            />
          </div>
        </CardContent>
      </Card>

      {/* Lignes */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Lignes de prestation</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={() => setLignes((p) => [...p, emptyLine()])}>
            <Plus className="h-4 w-4 mr-1" />Ajouter une ligne
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 pb-1">
            <span className="col-span-6">Description</span>
            <span className="col-span-2 text-center">Quantité</span>
            <span className="col-span-3 text-right">Prix unitaire HT</span>
            <span className="col-span-1" />
          </div>
          {lignes.map((l, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 items-center">
              <Input className="col-span-6" placeholder="Description" value={l.description}
                onChange={(e) => updateLigne(idx, 'description', e.target.value)} />
              <Input className="col-span-2 text-center" type="number" min="0" step="0.5" value={l.quantite}
                onChange={(e) => updateLigne(idx, 'quantite', parseFloat(e.target.value) || 0)} />
              <Input className="col-span-3 text-right" type="number" min="0" step="50" value={l.prix_unitaire}
                onChange={(e) => updateLigne(idx, 'prix_unitaire', parseFloat(e.target.value) || 0)} />
              <Button type="button" variant="ghost" size="sm" className="col-span-1 text-red-400 hover:text-red-600"
                onClick={() => setLignes((p) => p.filter((_, i) => i !== idx))} disabled={lignes.length === 1}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Separator />
          <div className="flex justify-end">
            <div className="text-right">
              <p className="text-sm text-gray-500">Total HT</p>
              <p className="text-2xl font-bold">
                {montantHT.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
              </p>
              <p className="text-xs text-gray-400 mt-1">TVA non applicable — art. 293 B CGI</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? 'Enregistrement...' : isEdit ? 'Mettre à jour' : 'Créer la facture'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push('/factures')}>Annuler</Button>
      </div>
    </form>
  )
}
