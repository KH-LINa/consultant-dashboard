import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { CaMensuelChart } from '@/components/dashboard/ca-mensuel-chart'
import { PipelineChart } from '@/components/dashboard/pipeline-chart'
import { TopContacts } from '@/components/dashboard/top-contacts'
import { ObjectifCA } from '@/components/dashboard/objectif-ca'
import {
  TrendingUp, Users, FileText, Clock, CheckCircle, Send,
} from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()

  const [
    { data: allQuotes },
    { data: allContacts },
  ] = await Promise.all([
    supabase.from('quotes').select('*, contact:contacts(nom, entreprise)'),
    supabase.from('contacts').select('id, nom, entreprise, type'),
  ])

  const quotes = allQuotes ?? []
  const contacts = allContacts ?? []

  // --- KPIs ---
  const now = new Date()
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const signedQuotes = quotes.filter((q) => q.statut === 'signé')
  const sentQuotes = quotes.filter((q) => q.statut === 'envoyé')
  const caTotal = signedQuotes.reduce((s, q) => s + (q.montant_ht || 0), 0)
  const caMoisCourant = signedQuotes
    .filter((q) => q.created_at >= firstOfMonth)
    .reduce((s, q) => s + (q.montant_ht || 0), 0)

  const tauxConversion = quotes.length > 0
    ? ((signedQuotes.length / quotes.length) * 100).toFixed(1)
    : '0.0'

  const nbProspects = contacts.filter((c) => c.type === 'prospect').length
  const nbClients = contacts.filter((c) => c.type === 'client').length

  // --- CA mensuel (12 derniers mois) ---
  const moisLabels = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
  const caMensuel = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1)
    const mois = moisLabels[d.getMonth()]
    const annee = d.getFullYear()
    const label = `${mois} ${annee !== now.getFullYear() ? annee : ''}`
    const ca = signedQuotes
      .filter((q) => {
        const qd = new Date(q.created_at)
        return qd.getMonth() === d.getMonth() && qd.getFullYear() === d.getFullYear()
      })
      .reduce((s, q) => s + (q.montant_ht || 0), 0)
    return { mois: label.trim(), ca }
  })

  // CA mois précédent pour trend
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const caMoisPrecedent = signedQuotes
    .filter((q) => {
      const qd = new Date(q.created_at)
      return qd.getMonth() === prevMonth.getMonth() && qd.getFullYear() === prevMonth.getFullYear()
    })
    .reduce((s, q) => s + (q.montant_ht || 0), 0)

  const trendMois = caMoisPrecedent > 0
    ? { value: `${(((caMoisCourant - caMoisPrecedent) / caMoisPrecedent) * 100).toFixed(0)}%`, positive: caMoisCourant >= caMoisPrecedent }
    : null

  // --- Pipeline par statut ---
  const statutList = ['brouillon', 'envoyé', 'signé', 'refusé', 'expiré']
  const pipeline = statutList
    .map((statut) => {
      const filtered = quotes.filter((q) => q.statut === statut)
      return {
        statut,
        count: filtered.length,
        montant: filtered.reduce((s, q) => s + (q.montant_ht || 0), 0),
      }
    })
    .filter((p) => p.count > 0)

  // --- Top contacts ---
  const topContacts = contacts
    .map((c) => {
      const cQuotes = signedQuotes.filter((q) => q.contact_id === c.id)
      return {
        nom: c.nom,
        entreprise: c.entreprise,
        ca: cQuotes.reduce((s, q) => s + (q.montant_ht || 0), 0),
        nb_devis: cQuotes.length,
      }
    })
    .filter((c) => c.ca > 0)
    .sort((a, b) => b.ca - a.ca)
    .slice(0, 5)

  // --- Devis récents (envoyés en attente) ---
  const devisEnAttente = sentQuotes
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Tableau de bord</h1>
        <p className="text-gray-500 mt-1">Vue d'ensemble de votre activité</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="CA signé (mois)"
          value={caMoisCourant.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
          subtitle="ce mois-ci"
          icon={TrendingUp}
          trend={trendMois}
          color="blue"
        />
        <KpiCard
          title="CA total signé"
          value={caTotal.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
          subtitle="tous devis signés"
          icon={CheckCircle}
          color="green"
        />
        <KpiCard
          title="Taux de conversion"
          value={`${tauxConversion}%`}
          subtitle={`${signedQuotes.length} signés / ${quotes.length} total`}
          icon={FileText}
          color="purple"
        />
        <KpiCard
          title="Devis en attente"
          value={String(sentQuotes.length)}
          subtitle="envoyés sans réponse"
          icon={Send}
          color="orange"
        />
      </div>

      {/* 2ème ligne : Objectif + Contacts stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ObjectifCA caActuel={caTotal} objectifInitial={50000} />

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" />
              Contacts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: 'Prospects', count: nbProspects, color: 'bg-yellow-400' },
              { label: 'Clients', count: nbClients, color: 'bg-green-400' },
              { label: 'Inactifs', count: contacts.length - nbProspects - nbClients, color: 'bg-gray-300' },
            ].map(({ label, count, color }) => (
              <div key={label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
                  <span className="text-sm text-gray-600">{label}</span>
                </div>
                <span className="text-sm font-semibold text-gray-900">{count}</span>
              </div>
            ))}
            <div className="pt-1 border-t">
              <div className="flex justify-between">
                <span className="text-xs text-gray-400">Total</span>
                <span className="text-xs font-bold text-gray-700">{contacts.length}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <TopContacts contacts={topContacts} />
      </div>

      {/* Graphiques */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">CA signé — 12 derniers mois</CardTitle>
          </CardHeader>
          <CardContent>
            <CaMensuelChart data={caMensuel} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pipeline devis</CardTitle>
          </CardHeader>
          <CardContent>
            <PipelineChart data={pipeline} />
          </CardContent>
        </Card>
      </div>

      {/* Devis en attente de réponse */}
      {devisEnAttente.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-500" />
              Devis envoyés — en attente de réponse
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {devisEnAttente.map((q: any) => {
                const joursEcoules = Math.floor(
                  (Date.now() - new Date(q.created_at).getTime()) / (1000 * 60 * 60 * 24)
                )
                return (
                  <div key={q.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{q.titre}</p>
                      <p className="text-xs text-gray-400">{q.contact?.nom}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900">
                        {(q.montant_ht || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                      </p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        joursEcoules > 14 ? 'bg-red-100 text-red-600' :
                        joursEcoules > 7 ? 'bg-orange-100 text-orange-600' :
                        'bg-blue-100 text-blue-600'
                      }`}>
                        {joursEcoules === 0 ? "Aujourd'hui" : `J+${joursEcoules}`}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
