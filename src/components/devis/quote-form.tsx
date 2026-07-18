'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Quote, QuoteLine, QuoteOffer, QuoteStatus } from '@/lib/types'
import { OFFER_LABELS } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Plus, Trash2, Sparkles, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface QuoteFormProps {
  contacts: { id: string; nom: string; entreprise: string | null }[]
  quote?: Quote
  defaultContactId?: string
}

const emptyLine = (): QuoteLine => ({ description: '', quantite: 1, prix_unitaire: 0 })

export function QuoteForm({ contacts, quote, defaultContactId }: QuoteFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const isEdit = !!quote

  const [form, setForm] = useState({
    contact_id: quote?.contact_id ?? defaultContactId ?? '' as string,
    titre: quote?.titre ?? '',
    offre: (quote?.offre ?? 'consulting') as QuoteOffer,
    statut: (quote?.statut ?? 'brouillon') as QuoteStatus,
  })
  const [lignes, setLignes] = useState<QuoteLine[]>(
    quote?.lignes?.length ? quote.lignes : [emptyLine()]
  )
  const [saving, setSaving] = useState(false)

  // --- Génération IA ---
  const [besoin, setBesoin] = useState('')
  const [generating, setGenerating] = useState(false)

  async function genererAvecIA() {
    if (!besoin.trim()) {
      toast.error('Décrivez le besoin du client avant de générer')
      return
    }
    setGenerating(true)
    try {
      const res = await fetch('/api/devis/generer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: besoin }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Erreur lors de la génération')
        return
      }
      const p = data.proposition as {
        titre: string
        offre: QuoteOffer
        lignes: QuoteLine[]
      }
      setForm((prev) => ({ ...prev, titre: p.titre, offre: p.offre }))
      setLignes(
        p.lignes?.length
          ? p.lignes.map((l) => ({
              description: l.description,
              quantite: Number(l.quantite) || 0,
              prix_unitaire: Number(l.prix_unitaire) || 0,
            }))
          : [emptyLine()]
      )
      toast.success('Proposition générée ✨ — vérifiez et ajustez avant d\'enregistrer')
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setGenerating(false)
    }
  }

  function updateLigne(idx: number, field: keyof QuoteLine, value: string | number) {
    setLignes((prev) => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l))
  }

  function addLigne() {
    setLignes((prev) => [...prev, emptyLine()])
  }

  function removeLigne(idx: number) {
    setLignes((prev) => prev.filter((_, i) => i !== idx))
  }

  const montantHT = lignes.reduce((sum, l) => sum + l.quantite * l.prix_unitaire, 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.contact_id) {
      toast.error('Sélectionnez un contact')
      return
    }
    if (!form.titre.trim()) {
      toast.error('Le titre est obligatoire')
      return
    }

    setSaving(true)
    const payload = {
      contact_id: form.contact_id,
      titre: form.titre,
      offre: form.offre,
      statut: form.statut,
      montant_ht: montantHT,
      lignes,
    }

    const { error } = isEdit
      ? await supabase.from('quotes').update(payload).eq('id', quote!.id)
      : await supabase.from('quotes').insert(payload)

    if (error) {
      toast.error(error.message)
    } else {
      toast.success(isEdit ? 'Devis mis à jour' : 'Devis créé')
      router.push('/devis')
      router.refresh()
    }
    setSaving(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
      {/* Assistant IA */}
      <Card className="border-blue-200 bg-blue-50/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-blue-500" />
            Générer avec l'IA
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label>Décrivez le besoin du client</Label>
          <Textarea
            value={besoin}
            onChange={(e) => setBesoin(e.target.value)}
            rows={4}
            placeholder="ex: Le client veut automatiser le tri de ses emails entrants et générer des réponses types avec un agent IA. Il a environ 200 emails/jour. Il souhaite aussi une formation de son équipe (3 personnes)."
            disabled={generating}
          />
          <div className="flex items-center gap-3">
            <Button type="button" onClick={genererAvecIA} disabled={generating}>
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Génération en cours…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Générer la proposition
                </>
              )}
            </Button>
            <p className="text-xs text-gray-500">
              L'IA pré-remplit titre, offre et lignes. Vous gardez la main pour tout éditer.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Informations générales</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-2 col-span-2">
            <Label>Contact *</Label>
            <Select value={form.contact_id} onValueChange={(v) => setForm((p) => ({ ...p, contact_id: v ?? '' }))}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un contact" />
              </SelectTrigger>
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
              placeholder="ex: Mission d'automatisation des process RH"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Type d'offre</Label>
            <Select value={form.offre} onValueChange={(v) => setForm((p) => ({ ...p, offre: v as QuoteOffer }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="consulting">{OFFER_LABELS.consulting}</SelectItem>
                <SelectItem value="automatisation">{OFFER_LABELS.automatisation}</SelectItem>
                <SelectItem value="solution_globale">{OFFER_LABELS.solution_globale}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Statut</Label>
            <Select value={form.statut} onValueChange={(v) => setForm((p) => ({ ...p, statut: v as QuoteStatus }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="brouillon">Brouillon</SelectItem>
                <SelectItem value="envoyé">Envoyé</SelectItem>
                <SelectItem value="signé">Signé</SelectItem>
                <SelectItem value="refusé">Refusé</SelectItem>
                <SelectItem value="expiré">Expiré</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Lignes de prestation</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={addLigne}>
            <Plus className="h-4 w-4 mr-1" />
            Ajouter une ligne
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 pb-1">
            <span className="col-span-6">Description</span>
            <span className="col-span-2 text-center">Quantité</span>
            <span className="col-span-3 text-right">Prix unitaire HT</span>
            <span className="col-span-1"></span>
          </div>

          {lignes.map((ligne, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 items-center">
              <Input
                className="col-span-6"
                placeholder="Description de la prestation"
                value={ligne.description}
                onChange={(e) => updateLigne(idx, 'description', e.target.value)}
              />
              <Input
                className="col-span-2 text-center"
                type="number"
                min="0"
                step="0.5"
                value={ligne.quantite}
                onChange={(e) => updateLigne(idx, 'quantite', parseFloat(e.target.value) || 0)}
              />
              <Input
                className="col-span-3 text-right"
                type="number"
                min="0"
                step="50"
                value={ligne.prix_unitaire}
                onChange={(e) => updateLigne(idx, 'prix_unitaire', parseFloat(e.target.value) || 0)}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="col-span-1 text-red-400 hover:text-red-600"
                onClick={() => removeLigne(idx)}
                disabled={lignes.length === 1}
              >
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
          {saving ? 'Enregistrement...' : isEdit ? 'Mettre à jour' : 'Créer le devis'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push('/devis')}>
          Annuler
        </Button>
      </div>
    </form>
  )
}
