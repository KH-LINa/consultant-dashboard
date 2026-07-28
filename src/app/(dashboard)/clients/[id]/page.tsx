import type { ReactNode } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { DocumentsManager } from '@/components/documents/documents-manager'
import { ContractStatusBadge } from '@/components/contracts/ContractStatusBadge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  UserCheck, Pencil, FileText, Receipt, FileSignature, FolderKanban, FolderGit2,
  Mail, Phone, Building2, StickyNote, Wallet,
} from 'lucide-react'
import type {
  Quote, QuoteStatus, Invoice, InvoiceStatus, Contract, Mission, MissionStatus, Project, ProjectStatus,
  DocumentFile,
} from '@/lib/types'

const typeBadge: Record<string, string> = {
  prospect: 'bg-yellow-100 text-yellow-800',
  client: 'bg-green-100 text-green-800',
  inactif: 'bg-gray-100 text-gray-600',
}

const quoteStatusStyle: Record<QuoteStatus, string> = {
  brouillon: 'bg-gray-100 text-gray-600',
  'envoyé': 'bg-blue-100 text-blue-700',
  'signé': 'bg-green-100 text-green-700',
  'refusé': 'bg-red-100 text-red-700',
  'expiré': 'bg-orange-100 text-orange-700',
}

const invoiceStatusStyle: Record<InvoiceStatus, string> = {
  brouillon: 'bg-gray-100 text-gray-600',
  'envoyée': 'bg-blue-100 text-blue-700',
  'payée': 'bg-green-100 text-green-700',
  'annulée': 'bg-red-100 text-red-700',
}

const missionStatusLabel: Record<MissionStatus, { label: string; cls: string }> = {
  a_demarrer: { label: 'À démarrer', cls: 'bg-gray-100 text-gray-600' },
  en_cours: { label: 'En cours', cls: 'bg-blue-100 text-blue-700' },
  en_pause: { label: 'En pause', cls: 'bg-orange-100 text-orange-700' },
  terminee: { label: 'Terminée', cls: 'bg-green-100 text-green-700' },
  annulee: { label: 'Annulée', cls: 'bg-red-100 text-red-700' },
}

const projectStatusLabel: Record<ProjectStatus, { label: string; cls: string }> = {
  a_demarrer: { label: 'À démarrer', cls: 'bg-gray-100 text-gray-600' },
  en_cours: { label: 'En cours', cls: 'bg-blue-100 text-blue-700' },
  en_pause: { label: 'En pause', cls: 'bg-orange-100 text-orange-700' },
  termine: { label: 'Terminé', cls: 'bg-green-100 text-green-700' },
  annule: { label: 'Annulé', cls: 'bg-red-100 text-red-700' },
}

function eur(n: number) {
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Ligne cliquable générique pour les sections Devis/Factures/Contrats/
// Missions/Projets : évite de dupliquer 5 fois la même mise en page.
function HistoryRow({
  href, titre, date, montant, badge,
}: {
  href: string
  titre: string
  date: string
  montant?: number | null
  badge: ReactNode
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 py-2.5 px-1 -mx-1 rounded-lg hover:bg-gray-50"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">{titre}</p>
        <p className="text-xs text-gray-400">{date}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {montant != null && montant > 0 && (
          <span className="text-sm text-gray-600 tabular-nums">{eur(montant)}</span>
        )}
        {badge}
      </div>
    </Link>
  )
}

function EmptySection({ label }: { label: string }) {
  return <p className="text-sm text-gray-400 py-2">{label}</p>
}

export default async function ClientDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()

  const [
    { data: contact },
    { data: quotes },
    { data: invoices },
    { data: contracts },
    { data: missions },
    { data: projects },
    { data: documents },
  ] = await Promise.all([
    supabase.from('contacts').select('*').eq('id', params.id).single(),
    supabase.from('quotes').select('*').eq('contact_id', params.id).order('created_at', { ascending: false }),
    supabase.from('invoices').select('*').eq('contact_id', params.id).order('date_emission', { ascending: false }),
    supabase.from('contracts').select('*').eq('contact_id', params.id).order('created_at', { ascending: false }),
    supabase.from('missions').select('*').eq('contact_id', params.id).order('created_at', { ascending: false }),
    supabase.from('projects').select('*').eq('contact_id', params.id).order('created_at', { ascending: false }),
    supabase.from('documents').select('*').eq('contact_id', params.id).order('created_at', { ascending: false }),
  ])

  if (!contact) notFound()

  const quotesList = (quotes ?? []) as Quote[]
  const invoicesList = (invoices ?? []) as Invoice[]
  const contractsList = (contracts ?? []) as Contract[]
  const missionsList = (missions ?? []) as Mission[]
  const projectsList = (projects ?? []) as Project[]
  const documentsList = (documents ?? []) as DocumentFile[]

  const caFacture = invoicesList
    .filter((i) => i.statut === 'payée')
    .reduce((s, i) => s + (i.montant_ht || 0), 0)
  const missionsActives = missionsList.filter((m) => m.statut !== 'terminee' && m.statut !== 'annulee').length

  return (
    <div className="space-y-6">
      <div>
        <Link href="/clients" className="text-sm text-gray-400 hover:text-gray-600">← Clients</Link>
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          <h1 className="text-3xl font-bold text-gray-900">{contact.nom}</h1>
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${typeBadge[contact.type]}`}>
            {contact.type}
          </span>
        </div>
      </div>

      {/* Informations du contact */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-green-600" />
            Informations
          </CardTitle>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/contacts/${contact.id}`}>
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
              Modifier
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2 text-gray-600">
              <Building2 className="h-4 w-4 text-gray-400 shrink-0" />
              {contact.entreprise ?? '—'}
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <Mail className="h-4 w-4 text-gray-400 shrink-0" />
              {contact.email ?? '—'}
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <Phone className="h-4 w-4 text-gray-400 shrink-0" />
              {contact.telephone ?? '—'}
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <UserCheck className="h-4 w-4 text-gray-400 shrink-0" />
              Contact reçu le {fmtDate(contact.created_at)}
            </div>
          </div>
          {contact.notes && (
            <div className="flex items-start gap-2 mt-3 pt-3 border-t text-sm text-gray-600">
              <StickyNote className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
              <p className="whitespace-pre-line">{contact.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
              <Wallet className="h-4 w-4 text-green-500" />
              CA facturé (payé)
            </div>
            <div className="text-2xl font-bold text-green-700">{eur(caFacture)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
              <FileText className="h-4 w-4 text-blue-500" />
              Devis
            </div>
            <div className="text-2xl font-bold">{quotesList.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
              <Receipt className="h-4 w-4 text-purple-500" />
              Factures
            </div>
            <div className="text-2xl font-bold">{invoicesList.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
              <FolderKanban className="h-4 w-4 text-indigo-500" />
              Missions actives
            </div>
            <div className="text-2xl font-bold">{missionsActives}</div>
          </CardContent>
        </Card>
      </div>

      {/* Historique */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-500" />
              Devis ({quotesList.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {quotesList.length === 0 ? <EmptySection label="Aucun devis." /> : quotesList.map((q) => (
              <HistoryRow
                key={q.id}
                href={`/devis/${q.id}`}
                titre={q.titre}
                date={fmtDate(q.created_at)}
                montant={q.montant_ht}
                badge={
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${quoteStatusStyle[q.statut]}`}>
                    {q.statut}
                  </span>
                }
              />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Receipt className="h-4 w-4 text-purple-500" />
              Factures ({invoicesList.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {invoicesList.length === 0 ? <EmptySection label="Aucune facture." /> : invoicesList.map((i) => (
              <HistoryRow
                key={i.id}
                href={`/factures/${i.id}`}
                titre={i.titre}
                date={fmtDate(i.date_emission)}
                montant={i.montant_ht}
                badge={
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${invoiceStatusStyle[i.statut]}`}>
                    {i.statut}
                  </span>
                }
              />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <FileSignature className="h-4 w-4 text-cyan-600" />
              Contrats ({contractsList.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {contractsList.length === 0 ? <EmptySection label="Aucun contrat." /> : contractsList.map((c) => (
              <HistoryRow
                key={c.id}
                href={`/contrats/${c.id}`}
                titre={c.numero}
                date={fmtDate(c.created_at)}
                montant={c.montant_ht}
                badge={<ContractStatusBadge statut={c.statut} />}
              />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <FolderKanban className="h-4 w-4 text-indigo-500" />
              Missions ({missionsList.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {missionsList.length === 0 ? <EmptySection label="Aucune mission." /> : missionsList.map((m) => (
              <HistoryRow
                key={m.id}
                href={`/missions/${m.id}`}
                titre={m.titre}
                date={fmtDate(m.created_at)}
                montant={m.budget_ht}
                badge={
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${missionStatusLabel[m.statut].cls}`}>
                    {missionStatusLabel[m.statut].label}
                  </span>
                }
              />
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <FolderGit2 className="h-4 w-4 text-[#534AB7]" />
              Projets ({projectsList.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {projectsList.length === 0 ? <EmptySection label="Aucun projet." /> : projectsList.map((p) => (
              <HistoryRow
                key={p.id}
                href={`/projets/${p.id}`}
                titre={p.titre}
                date={fmtDate(p.date_debut ?? p.created_at)}
                badge={
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${projectStatusLabel[p.statut].cls}`}>
                    {projectStatusLabel[p.statut].label}
                  </span>
                }
              />
            ))}
          </CardContent>
        </Card>
      </div>

      <DocumentsManager documents={documentsList} contactId={contact.id} title="Documents" />
    </div>
  )
}
