import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ContractEditor } from '@/components/contracts/ContractEditor'
import { ContractStatusBadge } from '@/components/contracts/ContractStatusBadge'
import { ContractActions } from '@/components/contracts/ContractActions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, CalendarDays, User, Euro, FileText } from 'lucide-react'
import type { ContractStatus } from '@/lib/types'

export default async function ContratDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()

  const { data: contract } = await supabase
    .from('contracts')
    .select('*, contact:contacts(*), quote:quotes(id, titre, offre)')
    .eq('id', params.id)
    .single()

  if (!contract) notFound()

  const contact = contract.contact
  const quote = contract.quote
  const statut = contract.statut as ContractStatus
  const readOnly = statut === 'archive'

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/contrats" className="hover:text-blue-600 flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" />
          Contrats
        </Link>
        <span>/</span>
        <span className="text-gray-800 font-mono font-medium">{contract.numero}</span>
      </div>

      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-900 font-mono">{contract.numero}</h1>
            <ContractStatusBadge statut={statut} />
          </div>
          <p className="text-gray-500 text-sm">
            Créé le {new Date(contract.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
        </div>

        <ContractActions
          contractId={contract.id}
          statut={statut}
          contactEmail={contact?.email ?? null}
          numero={contract.numero}
        />
      </div>

      {/* Métadonnées */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
              <User className="h-3.5 w-3.5" />
              Client
            </div>
            <p className="font-medium text-gray-900 text-sm">{contact?.nom ?? '—'}</p>
            {contact?.entreprise && <p className="text-xs text-gray-400">{contact.entreprise}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
              <Euro className="h-3.5 w-3.5" />
              Montant HT
            </div>
            <p className="font-semibold text-gray-900 text-sm">
              {Number(contract.montant_ht).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
            </p>
          </CardContent>
        </Card>

        {quote && (
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                <FileText className="h-3.5 w-3.5" />
                Devis source
              </div>
              <Link href={`/devis/${quote.id}`} className="text-sm text-blue-600 hover:underline font-medium">
                {quote.titre}
              </Link>
            </CardContent>
          </Card>
        )}

        {contract.sent_at && (
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                <CalendarDays className="h-3.5 w-3.5" />
                Envoyé le
              </div>
              <p className="text-sm text-gray-700">
                {new Date(contract.sent_at).toLocaleDateString('fr-FR')}
              </p>
            </CardContent>
          </Card>
        )}

        {contract.signed_at && (
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                <CalendarDays className="h-3.5 w-3.5" />
                Signé le
              </div>
              <p className="text-sm text-green-700 font-medium">
                {new Date(contract.signed_at).toLocaleDateString('fr-FR')}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Éditeur de contenu */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Contenu du contrat</CardTitle>
        </CardHeader>
        <CardContent>
          <ContractEditor
            contractId={contract.id}
            initialContenu={contract.contenu}
            readOnly={readOnly}
          />
        </CardContent>
      </Card>

      {/* Note juridique */}
      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
        ⚠️ Ce contrat est un premier jet non validé juridiquement. Faites-le relire par un juriste avant tout usage réel,
        en particulier les articles relatifs à la propriété intellectuelle et à la responsabilité.
      </p>
    </div>
  )
}
