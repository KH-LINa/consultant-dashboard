import { createClient } from '@/lib/supabase/server'
import { InvoicesTable } from '@/components/factures/invoices-table'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import { Plus, TrendingUp, Clock, CheckCircle } from 'lucide-react'

export default async function FacturesPage() {
  const supabase = await createClient()
  const { data: invoices } = await supabase
    .from('invoices')
    .select('*, contact:contacts(nom, entreprise, email)')
    .order('created_at', { ascending: false })

  const list = invoices ?? []
  const caPaye = list.filter((i) => i.statut === 'payée').reduce((s, i) => s + (i.montant_ht || 0), 0)
  const caAttente = list.filter((i) => i.statut === 'envoyée').reduce((s, i) => s + (i.montant_ht || 0), 0)
  const nbEnRetard = list.filter((i) =>
    i.statut !== 'payée' && i.statut !== 'annulée' &&
    i.date_echeance && new Date(i.date_echeance) < new Date()
  ).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Factures</h1>
          <p className="text-gray-500 mt-1">{list.length} facture(s)</p>
        </div>
        <Button asChild>
          <Link href="/factures/nouvelle">
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle facture
          </Link>
        </Button>
      </div>

      {/* KPIs rapides */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-50 rounded-lg">
                <CheckCircle className="h-4 w-4 text-green-500" />
              </div>
              <div>
                <p className="text-xs text-gray-500">CA encaissé</p>
                <p className="text-lg font-bold text-gray-900">
                  {caPaye.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <TrendingUp className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-gray-500">En attente de paiement</p>
                <p className="text-lg font-bold text-gray-900">
                  {caAttente.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-50 rounded-lg">
                <Clock className="h-4 w-4 text-red-500" />
              </div>
              <div>
                <p className="text-xs text-gray-500">En retard</p>
                <p className="text-lg font-bold text-gray-900">{nbEnRetard}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <InvoicesTable invoices={list} />
    </div>
  )
}
