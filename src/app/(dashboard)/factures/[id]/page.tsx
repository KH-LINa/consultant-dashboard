import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { InvoiceForm } from '@/components/factures/invoice-form'

export default async function EditFacturePage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const [{ data: invoice }, { data: contacts }] = await Promise.all([
    supabase.from('invoices').select('*').eq('id', params.id).single(),
    supabase.from('contacts').select('id, nom, entreprise').order('nom'),
  ])

  if (!invoice) notFound()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Modifier la facture</h1>
        <p className="text-gray-500 mt-1 font-mono">{invoice.numero}</p>
      </div>
      <InvoiceForm contacts={contacts ?? []} invoice={invoice} />
    </div>
  )
}
