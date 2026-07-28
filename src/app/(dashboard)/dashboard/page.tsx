import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { CaMensuelChart } from '@/components/dashboard/ca-mensuel-chart'
import { PipelineChart } from '@/components/dashboard/pipeline-chart'
import { TopContacts } from '@/components/dashboard/top-contacts'
import { ObjectifCA } from '@/components/dashboard/objectif-ca'
import { PocFrictionCard } from '@/components/dashboard/poc-friction-card'
import { SuiviRappelCard } from '@/components/dashboard/suivi-rappel-card'
import {
  TrendingUp, Users, FileText, Clock, CheckCircle, Send,
  FolderGit2, FolderKanban, AlertTriangle, UserCheck, ChevronRight,
} from 'lucide-react'
import type { ProjectStatus, MissionStatus } from '@/lib/types'
import { detecterFrictionPocProduction, detecterSuiviAPrevoir } from '@/lib/gantt-deps'

const PROJECT_STATUS_LABEL: Record<ProjectStatus, { label: string; cls: string }> = {
  a_demarrer: { label: 'À démarrer', cls: 'bg-gray-100 text-gray-600' },
  en_cours: { label: 'En cours', cls: 'bg-blue-100 text-blue-700' },
  en_pause: { label: 'En pause', cls: 'bg-orange-100 text-orange-700' },
  termine: { label: 'Terminé', cls: 'bg-green-100 text-green-700' },
  annule: { label: 'Annulé', cls: 'bg-red-100 text-red-700' },
}

// Vue manager : uniquement des informations opérationnelles (projets en
// cours, missions, retards, liste des clients) — jamais de chiffre
// commercial/financier (CA, objectifs, pipeline devis, top clients par CA),
// réservés à l'admin sur ce tableau de bord. Le reste de l'outil (Devis,
// Factures, Clients...) reste accessible tel quel au manager : c'est
// seulement cette page de synthèse qui est restreinte.
async function ManagerDashboard() {
  const supabase = await createClient()
  const todayIso = new Date().toISOString().slice(0, 10)

  const [
    { data: projects },
    { data: missions },
    { count: nbTachesEnRetard },
    { data: clients },
    { data: allPhases },
    { data: allTasksStatut },
  ] = await Promise.all([
    supabase.from('projects').select('id, titre, statut, date_fin_prevue, date_dernier_suivi, contact:contacts(nom, entreprise)').order('created_at', { ascending: false }),
    supabase.from('missions').select('id, statut'),
    supabase.from('project_tasks').select('id', { count: 'exact', head: true }).lt('date_fin', todayIso).neq('statut', 'fait'),
    supabase.from('contacts').select('id, nom, entreprise, code_client').eq('type', 'client').order('nom'),
    supabase.from('project_phases').select('id, project_id, titre, ordre, date_fin'),
    supabase.from('project_tasks').select('phase_id, statut'),
  ])

  const projectsList = projects ?? []
  const missionsList = (missions ?? []) as { id: string; statut: MissionStatus }[]
  const rappelsSuivi = detecterSuiviAPrevoir(projectsList)
  const clientsList = clients ?? []

  const projetsActifs = projectsList.filter((p) => p.statut !== 'termine' && p.statut !== 'annule')
  const missionsActives = missionsList.filter((m) => m.statut !== 'terminee' && m.statut !== 'annulee')
  const risquesPoc = detecterFrictionPocProduction(projectsList, allPhases ?? [], allTasksStatut ?? [])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Tableau de bord</h1>
        <p className="text-gray-500 mt-1">Vue d&apos;ensemble opérationnelle</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Projets actifs"
          value={String(projetsActifs.length)}
          subtitle={`${projectsList.length} au total`}
          icon={FolderGit2}
          color="blue"
        />
        <KpiCard
          title="Missions actives"
          value={String(missionsActives.length)}
          subtitle={`${missionsList.length} au total`}
          icon={FolderKanban}
          color="purple"
        />
        <KpiCard
          title="Tâches en retard"
          value={String(nbTachesEnRetard ?? 0)}
          subtitle="tous projets confondus"
          icon={AlertTriangle}
          color="orange"
        />
        <KpiCard
          title="Clients"
          value={String(clientsList.length)}
          subtitle="au total"
          icon={UserCheck}
          color="green"
        />
      </div>

      <PocFrictionCard risques={risquesPoc} />
      <SuiviRappelCard rappels={rappelsSuivi} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FolderGit2 className="h-4 w-4 text-[#534AB7]" />
              Projets en cours
            </CardTitle>
          </CardHeader>
          <CardContent>
            {projetsActifs.length === 0 ? (
              <p className="text-sm text-gray-400 py-4">Aucun projet actif.</p>
            ) : (
              <div className="divide-y">
                {projetsActifs.slice(0, 8).map((p: any) => (
                  <Link key={p.id} href={`/projets/${p.id}`}
                    className="flex items-center justify-between gap-3 py-2.5 px-1 -mx-1 rounded-lg hover:bg-gray-50">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{p.titre}</p>
                      <p className="text-xs text-gray-400 truncate">{p.contact?.nom}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium shrink-0 ${PROJECT_STATUS_LABEL[p.statut as ProjectStatus].cls}`}>
                      {PROJECT_STATUS_LABEL[p.statut as ProjectStatus].label}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-green-600" />
              Clients ({clientsList.length})
            </CardTitle>
            <Link href="/clients" className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
              Voir tous <ChevronRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {clientsList.length === 0 ? (
              <p className="text-sm text-gray-400 py-4">Aucun client pour l&apos;instant.</p>
            ) : (
              <div className="divide-y">
                {clientsList.slice(0, 8).map((c) => (
                  <Link key={c.id} href={`/clients/${c.id}`}
                    className="flex items-center justify-between gap-3 py-2.5 px-1 -mx-1 rounded-lg hover:bg-gray-50">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{c.nom}</p>
                      <p className="text-xs text-gray-400 truncate">{c.entreprise ?? '—'}</p>
                    </div>
                    {c.code_client && (
                      <span className="text-xs font-mono text-gray-400 shrink-0">{c.code_client}</span>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = user
    ? await supabase.from('profiles').select('role').eq('id', user.id).single()
    : { data: null }

  // Seul l'admin voit les chiffres commerciaux/financiers (CA, objectifs,
  // pipeline devis, top clients par CA) sur cette page — un manager a accès
  // au reste de l'outil normalement, mais pas à cette synthèse financière.
  if (profile?.role !== 'admin') {
    return <ManagerDashboard />
  }

  const [
    { data: allQuotes },
    { data: allContacts },
    { data: allProjects },
    { data: allPhases },
    { data: allTasksStatut },
  ] = await Promise.all([
    supabase.from('quotes').select('*, contact:contacts(nom, entreprise)'),
    supabase.from('contacts').select('id, nom, entreprise, type'),
    supabase.from('projects').select('id, titre, statut, date_dernier_suivi'),
    supabase.from('project_phases').select('id, project_id, titre, ordre, date_fin'),
    supabase.from('project_tasks').select('phase_id, statut'),
  ])

  const quotes = allQuotes ?? []
  const contacts = allContacts ?? []
  const risquesPoc = detecterFrictionPocProduction(allProjects ?? [], allPhases ?? [], allTasksStatut ?? [])
  const rappelsSuivi = detecterSuiviAPrevoir(allProjects ?? [])

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

      <PocFrictionCard risques={risquesPoc} />
      <SuiviRappelCard rappels={rappelsSuivi} />

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
              <div key={label} className="flex items-center justify-between gap-3 flex-wrap">
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
