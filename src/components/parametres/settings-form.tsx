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
import { User, Mail, Key, Eye, EyeOff, Landmark, Bell, Lock } from 'lucide-react'

// Clés réservées à l'admin (identifiant technique d'envoi d'emails + statut
// fiscal personnel) — doit rester synchronisé avec la RLS de la table
// settings (voir supabase-settings-manager-restriction-migration.sql). Un
// manager qui les soumettrait quand même serait de toute façon bloqué côté
// base ; ce filtre évite juste l'erreur inutile.
const ADMIN_ONLY_KEYS: (keyof ConsultantSettings)[] = [
  'resend_api_key', 'email_expediteur', 'notification_email',
  'taux_cotisation_urssaf', 'versement_liberatoire', 'taux_versement_ir',
]

function SectionReserveeAdmin() {
  return (
    <p className="flex items-center gap-2 text-sm text-gray-400 py-2">
      <Lock className="h-3.5 w-3.5" />
      Réservé à l&apos;administrateur
    </p>
  )
}

export function SettingsForm({ settings, isAdmin }: { settings: ConsultantSettings; isAdmin: boolean }) {
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

    const rows = Object.entries(form)
      .filter(([key]) => isAdmin || !ADMIN_ONLY_KEYS.includes(key as keyof ConsultantSettings))
      .map(([key, value]) => ({
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nom complet *</Label>
              <Input value={form.consultant_nom} onChange={(e) => set('consultant_nom', e.target.value)} placeholder="Jean Dupont" />
            </div>
            <div className="space-y-2">
              <Label>SIRET *</Label>
              <Input value={form.consultant_siret} onChange={(e) => set('consultant_siret', e.target.value)} placeholder="123 456 789 00012" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          {!isAdmin ? <SectionReserveeAdmin /> : (
          <>
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
          <div className="space-y-2">
            <Label>Email de notification (nouveaux prospects)</Label>
            <Input
              type="email"
              value={form.notification_email}
              onChange={(e) => set('notification_email', e.target.value)}
              placeholder="vous@exemple.fr"
            />
            <p className="text-xs text-gray-400">
              Adresse qui reçoit une alerte à chaque demande envoyée depuis le site vitrine. Si vide, l&apos;email professionnel ci-dessus est utilisé.
            </p>
          </div>
          </>
          )}
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
          {!isAdmin ? <SectionReserveeAdmin /> : (
          <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          </>
          )}
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

      {/* Surveillance des plannings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4 text-amber-500" />
            Surveillance des plannings
          </CardTitle>
          <CardDescription>
            Email quotidien récapitulant, pour tous les projets actifs : tâches et jalons en retard,
            conflits de dépendances, échéances des 3 prochains jours, doubles réservations d'un
            collaborateur ou d'une ressource sur plusieurs chantiers en même temps, et ressources
            affectées à une tâche pendant une période d'indisponibilité (absence, congé, maladie...)
            (envoyé uniquement s'il y a quelque chose à signaler)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="surveillance_planning_auto"
              checked={form.surveillance_planning_auto === 'true'}
              onChange={(e) => set('surveillance_planning_auto', e.target.checked ? 'true' : 'false')}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="surveillance_planning_auto" className="cursor-pointer">
              Activer la surveillance automatique des plannings
            </Label>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Envoyé à l&apos;adresse de notification ci-dessus (ou à défaut l&apos;email professionnel).
          </p>

          <div className="flex items-center gap-2 mt-4 pt-4 border-t">
            <input
              type="checkbox"
              id="surveillance_recap_ressources_auto"
              checked={form.surveillance_recap_ressources_auto === 'true'}
              onChange={(e) => set('surveillance_recap_ressources_auto', e.target.checked ? 'true' : 'false')}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="surveillance_recap_ressources_auto" className="cursor-pointer">
              Envoyer aussi un récap quotidien à chaque ressource
            </Label>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Un email individuel est envoyé à l&apos;adresse renseignée sur chaque ressource humaine
            (page Ressources), listant ses affectations en cours (projet, tâche si précisée, heures/budget).
            Envoyé uniquement aux ressources ayant au moins une affectation à signaler.
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
