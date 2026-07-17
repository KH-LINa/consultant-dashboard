'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ConsultantSettings } from '@/lib/settings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { User, Mail, Key, Eye, EyeOff, Landmark, Bell } from 'lucide-react'

export function SettingsForm({ settings }: { settings: ConsultantSettings }) {
  const supabase = createClient()
  const [form, setForm] = useState({ ...settings })
  const [saving, setSaving] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)

  function set(key: keyof ConsultantSettings, value: string) {
    setForm((p) => ({ ...p, [key]: value }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    const rows = Object.entries(form).map(([key, value]) => ({
      key,
      value: value ?? '',
      updated_at: new Date().toISOString(),
    }))

    const { error } = await supabase.from('settings').upsert(rows, { onConflict: 'user_id,key' })

    if (error) {
      toast.error(`Échec de l'enregistrement : ${error.message}`)
    } else {
      toast.success('Paramètres enregistrés ✓')
    }
    setSaving(false)
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* Profil consultant */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4 text-blue-500" />
            Profil consultant
          </CardTitle>
          <CardDescription>Ces informations apparaissent sur vos devis et factures PDF</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nom complet *</Label>
              <Input value={form.consultant_nom} onChange={(e) => set('consultant_nom', e.target.value)} placeholder="Jean Dupont" />
            </div>
            <div className="space-y-2">
              <Label>SIRET *</Label>
              <Input value={form.consultant_siret} onChange={(e) => set('consultant_siret', e.target.value)} placeholder="123 456 789 00012" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Email professionnel</Label>
              <Input type="email" value={form.consultant_email} onChange={(e) => set('consultant_email', e.target.value)} placeholder="jean@consultant-ia.fr" />
            </div>
            <div className="space-y-2">
              <Label>Téléphone</Label>
              <Input value={form.consultant_telephone} onChange={(e) => set('consultant_telephone', e.target.value)} placeholder="+33 6 00 00 00 00" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Adresse (optionnel)</Label>
            <Textarea value={form.consultant_adresse} onChange={(e) => set('consultant_adresse', e.target.value)} rows={2} placeholder="1 rue de la Paix, 75001 Paris" />
          </div>
        </CardContent>
      </Card>

      {/* Email */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="h-4 w-4 text-blue-500" />
            Configuration email (Resend)
          </CardTitle>
          <CardDescription>
            Nécessaire pour envoyer des devis/factures par email.{' '}
            <a href="https://resend.com" target="_blank" className="text-blue-600 underline">
              Créer un compte Resend gratuit →
            </a>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <Key className="h-3.5 w-3.5" />
              Clé API Resend
            </Label>
            <div className="relative">
              <Input
                type={showApiKey ? 'text' : 'password'}
                value={form.resend_api_key}
                onChange={(e) => set('resend_api_key', e.target.value)}
                placeholder="re_xxxxxxxxxxxx"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowApiKey((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Email expéditeur vérifié</Label>
            <Input
              type="email"
              value={form.email_expediteur}
              onChange={(e) => set('email_expediteur', e.target.value)}
              placeholder="factures@votre-domaine.fr"
            />
            <p className="text-xs text-gray-400">
              Doit être un domaine vérifié dans Resend (ou utilisez <code>onboarding@resend.dev</code> en test)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Comptabilité */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Landmark className="h-4 w-4 text-blue-500" />
            Comptabilité & cotisations
          </CardTitle>
          <CardDescription>Paramètres utilisés pour les estimations URSSAF dans le bilan</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Taux de cotisation URSSAF (%)</Label>
              <Input
                type="number" step="0.1"
                value={form.taux_cotisation_urssaf}
                onChange={(e) => set('taux_cotisation_urssaf', e.target.value)}
                placeholder="24.6"
              />
              <p className="text-xs text-gray-400">Prestations de services BNC : ~24,6% (2025)</p>
            </div>
            <div className="space-y-2">
              <Label>Taux versement libératoire IR (%)</Label>
              <Input
                type="number" step="0.1"
                value={form.taux_versement_ir}
                onChange={(e) => set('taux_versement_ir', e.target.value)}
                placeholder="2.2"
              />
              <p className="text-xs text-gray-400">Si option choisie : 2,2% pour les services</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="versement_lib"
              checked={form.versement_liberatoire === 'true'}
              onChange={(e) => set('versement_liberatoire', e.target.checked ? 'true' : 'false')}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="versement_lib" className="cursor-pointer">
              J'ai opté pour le versement libératoire de l'impôt sur le revenu
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Relances automatiques */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4 text-blue-500" />
            Relances automatiques
          </CardTitle>
          <CardDescription>
            Envoi automatique d'une relance par email à J+7 et J+14 pour les devis sans réponse
            et les factures impayées (nécessite la configuration email ci-dessus)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="relances_auto"
              checked={form.relances_auto === 'true'}
              onChange={(e) => set('relances_auto', e.target.checked ? 'true' : 'false')}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="relances_auto" className="cursor-pointer">
              Activer les relances automatiques (J+7 et J+14)
            </Label>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Devis : compté depuis l'envoi · Factures : compté depuis l'échéance (ou l'émission).
            Chaque relance n'est envoyée qu'une seule fois par palier.
          </p>
        </CardContent>
      </Card>

      <Separator />

      <div className="flex items-center gap-4">
        <Button type="submit" disabled={saving}>
          {saving ? 'Enregistrement...' : 'Sauvegarder les paramètres'}
        </Button>
        <p className="text-xs text-gray-400">Les modifications sont appliquées immédiatement sur les nouveaux PDF</p>
      </div>
    </form>
  )
}
