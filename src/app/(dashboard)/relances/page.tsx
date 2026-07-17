import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RelanceButton } from '@/components/relances/relance-button'
import { FileText, Receipt, Bell, AlertTriangle, CheckCircle2 } from 'lucide-react'

function joursDepuis(date: string): number {
  return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24))
}

export default async function RelancesPage() {
  const supabase = await createClient()

  const [{ data: quotes }, { data: invoices }, { data: reminders }] = await Promise.all([
    supabase.from('quotes').select('*, contact:contacts(nom, email)').eq('statut', 'envoyé'),
    supabase.from('invoices').select('*, contact:contacts(nom, email)')
      .in('statut', ['envoyée']),
    supabase.from('reminders').select('type, document_id, sent_at'),
  ])

  const allReminders = reminders ?? []

  function reminderInfo(type: 'devis' | 'facture', id: string) {
    const list = allReminders.filter((r) => r.type === type && r.document_id === id)
    const last = list.sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime())[0]
    return { count: list.length, lastSent: last?.sent_at as string | undefined }
  }

  // Devis envoyés (en attente de réponse)
  const devisEnAttente = (quotes ?? [])
    .map((q: any) => ({ ...q, jours: joursDepuis(q.sent_at ?? q.created_at), ...reminderInfo('devis', q.id) }))
    .sort((a, b) => b.jours - a.jours)

  // Factures envoyées mais impayées (en retard si échéance dépassée)
  const facturesImpayees = (invoices ?? [])
    .map((i: any) => ({
      ...i,
      jours: joursDepuis(i.date_emission),
      enRetard: i.date_echeance ? new Date(i.date_echeance) < new Date() : false,
      ...reminderInfo('facture', i.id),
    }))
    .sort((a, b) => Number(b.enRetard) - Number(a.enRetard) || b.jours - a.jours)

  const totalARelancer = devisEnAttente.length + facturesImpayees.length
  const montantImpaye = facturesImpayees.reduce((s, i) => s + (i.montant_ht || 0), 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Relances</h1>
        <p className="text-gray-500 mt-1">Devis sans réponse et factures impayées</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <div className="p-2 bg-orange-50 rounded-lg"><Bell className="h-4 w-4 text-orange-500" /></div>
            <div>
              <p className="text-xs text-gray-500">À relancer</p>
              <p className="text-lg font-bold">{totalARelancer}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg"><FileText className="h-4 w-4 text-blue-500" /></div>
            <div>
              <p className="text-xs text-gray-500">Devis en attente</p>
              <p className="text-lg font-bold">{devisEnAttente.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <div className="p-2 bg-red-50 rounded-lg"><Receipt className="h-4 w-4 text-red-500" /></div>
            <div>
              <p className="text-xs text-gray-500">Montant impayé</p>
              <p className="text-lg font-bold">
                {montantImpaye.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Factures impayées */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Receipt className="h-4 w-4 text-red-500" />
            Factures impayées ({facturesImpayees.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {facturesImpayees.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" /> Aucune facture impayée 🎉
            </p>
          ) : (
            <div className="space-y-2">
              {facturesImpayees.map((inv) => (
                <div key={inv.id} className={`flex items-center justify-between p-3 rounded-lg border ${
                  inv.enRetard ? 'bg-red-50 border-red-200' : 'bg-white'
                }`}>
                  <div className="flex items-center gap-3">
                    {inv.enRetard && <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />}
                    <div>
                      <p className="text-sm font-medium">{inv.numero} — {inv.titre}</p>
                      <p className="text-xs text-gray-500">
                        {inv.contact?.nom} · émise il y a {inv.jours}j
                        {inv.enRetard && <span className="text-red-600 font-medium"> · échéance dépassée</span>}
                        {inv.count > 0 && <span className="text-orange-600"> · {inv.count} relance(s)</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold">
                      {(inv.montant_ht || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                    </span>
                    <RelanceButton
                      type="facture" id={inv.id} titre={inv.titre}
                      contactNom={inv.contact?.nom ?? 'Client'}
                      contactEmail={inv.contact?.email}
                      jours={inv.jours} nbRelances={inv.count} montant={inv.montant_ht || 0}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Devis en attente */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-500" />
            Devis en attente de réponse ({devisEnAttente.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {devisEnAttente.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" /> Aucun devis en attente
            </p>
          ) : (
            <div className="space-y-2">
              {devisEnAttente.map((q) => (
                <div key={q.id} className={`flex items-center justify-between p-3 rounded-lg border ${
                  q.jours > 14 ? 'bg-orange-50 border-orange-200' : 'bg-white'
                }`}>
                  <div>
                    <p className="text-sm font-medium">{q.titre}</p>
                    <p className="text-xs text-gray-500">
                      {q.contact?.nom} · envoyé il y a {q.jours}j
                      {q.jours > 14 && <span className="text-orange-600 font-medium"> · sans réponse depuis longtemps</span>}
                      {q.count > 0 && <span className="text-orange-600"> · {q.count} relance(s)</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold">
                      {(q.montant_ht || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                    </span>
                    <RelanceButton
                      type="devis" id={q.id} titre={q.titre}
                      contactNom={q.contact?.nom ?? 'Client'}
                      contactEmail={q.contact?.email}
                      jours={q.jours} nbRelances={q.count} montant={q.montant_ht || 0}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
