import { createClient } from '@/lib/supabase/server'
import { QuoteForm } from '@/components/devis/quote-form'

export default async function NouveauDevisPage({
  searchParams,
}: {
  searchParams: { contact_id?: string }
}) {
  const supabase = await createClient()
  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, nom, entreprise')
    .order('nom')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Nouveau devis</h1>
        <p className="text-gray-500 mt-1">Créez un devis pour un contact</p>
      </div>
      <QuoteForm contacts={contacts ?? []} defaultContactId={searchParams.contact_id} />
    </div>
  )
}
