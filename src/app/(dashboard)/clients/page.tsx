import { createClient } from '@/lib/supabase/server'
import { ClientsTable } from '@/components/clients/clients-table'

export default async function ClientsPage() {
  const supabase = await createClient()

  const [{ data: clients }, { data: invoicesPayees }] = await Promise.all([
    supabase.from('contacts').select('*').eq('type', 'client').order('nom'),
    supabase.from('invoices').select('contact_id, montant_ht').eq('statut', 'payée'),
  ])

  // CA total encaissé par client — agrégé côté code (pas de group-by simple
  // via le client Supabase JS), volume raisonnable pour un consultant solo.
  const caParContact = (invoicesPayees ?? []).reduce<Record<string, number>>((acc, i) => {
    acc[i.contact_id] = (acc[i.contact_id] ?? 0) + (i.montant_ht || 0)
    return acc
  }, {})

  const rows = (clients ?? []).map((c) => ({ ...c, caTotal: caParContact[c.id] ?? 0 }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Clients</h1>
        <p className="text-gray-500 mt-1">
          {rows.length} client(s) — un contact devient client automatiquement dès qu&apos;un devis
          est signé ou qu&apos;une facture est émise pour lui.
        </p>
      </div>

      <ClientsTable clients={rows} />
    </div>
  )
}
