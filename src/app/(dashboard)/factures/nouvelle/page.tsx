import { createClient } from '@/lib/supabase/server'
import { InvoiceForm } from '@/components/factures/invoice-form'

export default async function NouvelleFacturePage({
  searchParams,
}: {
  searchParams: { quote_id?: string }
}) {
  const supabase = await createClient()

  const [{ data: contacts }, quoteResult] = await Promise.all([
    supabase.from('contacts').select('id, nom, entreprise').order('nom'),
    searchParams.quote_id
      ? supabase.from('quotes').select('*, contact:contacts(nom)').eq('id', searchParams.quote_id).single()
      : Promise.resolve({ data: null }),
  ])

  const quote = quoteResult.data

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Nouvelle facture</h1>
        <p className="text-gray-500 mt-1">
          {quote ? `Depuis le devis : ${quote.titre}` : 'Créez une facture manuelle'}
        </p>
      </div>
      <InvoiceForm
        contacts={contacts ?? []}
        defaultContactId={quote?.contact_id}
        defaultTitre={quote ? `Facture — ${quote.titre}` : undefined}
        defaultLignes={quote?.lignes}
        defaultOffre={quote?.offre}
        defaultMontant={quote?.montant_ht}
        quoteId={searchParams.quote_id}
      />
    </div>
  )
}
