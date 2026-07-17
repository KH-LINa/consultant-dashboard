import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { QuoteForm } from '@/components/devis/quote-form'
import { GenerateContractButton } from '@/components/contracts/GenerateContractButton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2, XCircle, Mail, MessageSquare, FileSignature } from 'lucide-react'

export default async function EditDevisPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const [{ data: quote }, { data: contacts }, { data: messages }, { data: existingContract }] = await Promise.all([
    supabase.from('quotes').select('*').eq('id', params.id).single(),
    supabase.from('contacts').select('id, nom, entreprise').order('nom'),
    supabase.from('quote_messages').select('*').eq('quote_id', params.id).order('received_at', { ascending: false }),
    supabase.from('contracts').select('id, numero, statut').eq('quote_id', params.id).neq('statut', 'archive').maybeSingle(),
  ])

  if (!quote) notFound()

  const msgs = messages ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Modifier le devis</h1>
          <p className="text-gray-500 mt-1">{quote.titre}</p>
        </div>

        {/* Contrat lié */}
        {quote.statut === 'signé' && (
          existingContract ? (
            <Link
              href={`/contrats/${existingContract.id}`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-green-50 border border-green-200 text-green-700 text-sm font-medium hover:bg-green-100 transition-colors"
            >
              <FileSignature className="h-4 w-4" />
              Voir le contrat ({existingContract.numero})
            </Link>
          ) : (
            <GenerateContractButton quoteId={params.id} />
          )
        )}
      </div>

      {/* Réponse du client (acceptation en ligne) */}
      {quote.response_at && (
        <Card className={`max-w-4xl border-l-4 ${quote.statut === 'signé' ? 'border-l-green-500' : 'border-l-gray-400'}`}>
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              {quote.statut === 'signé'
                ? <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                : <XCircle className="h-5 w-5 text-gray-400 mt-0.5" />}
              <div className="flex-1">
                <p className="font-medium text-gray-800">
                  Devis {quote.statut === 'signé' ? 'accepté ✓' : 'refusé'} par le client
                </p>
                <p className="text-xs text-gray-400">
                  le {new Date(quote.response_at).toLocaleString('fr-FR')}
                </p>
                {quote.response_comment && (
                  <p className="text-sm text-gray-600 mt-2 italic bg-gray-50 rounded p-2">
                    💬 « {quote.response_comment} »
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Messages email reçus */}
      {msgs.length > 0 && (
        <Card className="max-w-4xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="h-4 w-4 text-blue-500" />
              Réponses email ({msgs.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {msgs.map((m) => (
              <div key={m.id} className="border rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-800">{m.expediteur}</span>
                  <span className="text-xs text-gray-400">
                    {new Date(m.received_at).toLocaleString('fr-FR')}
                  </span>
                </div>
                {m.sujet && <p className="text-xs text-gray-500 mb-1">{m.sujet}</p>}
                <p className="text-sm text-gray-700 whitespace-pre-line flex items-start gap-1">
                  <MessageSquare className="h-3.5 w-3.5 text-gray-300 mt-0.5 flex-shrink-0" />
                  {m.contenu}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <QuoteForm contacts={contacts ?? []} quote={quote} />
    </div>
  )
}
