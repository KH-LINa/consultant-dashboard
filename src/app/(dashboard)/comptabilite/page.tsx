import { createClient } from '@/lib/supabase/server'
import { getSettings } from '@/lib/settings'
import { calculerBilan, SEUILS } from '@/lib/comptabilite'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CaBarChart } from '@/components/comptabilite/ca-bar-chart'
import { YearSelector } from '@/components/comptabilite/year-selector'
import { Wallet, Landmark, TrendingUp, AlertTriangle, FileText, Receipt } from 'lucide-react'

function eur(n: number) {
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
}

export default async function ComptabilitePage({
  searchParams,
}: {
  searchParams: { year?: string }
}) {
  const supabase = await createClient()
  const settings = await getSettings()
  const annee = parseInt(searchParams.year ?? String(new Date().getFullYear()), 10)

  const { data: invoices } = await supabase
    .from('invoices')
    .select('montant_ht, statut, date_emission')

  const list = invoices ?? []

  const tauxCotisation = parseFloat(settings.taux_cotisation_urssaf) || 24.6
  const versementLib = settings.versement_liberatoire === 'true'
  const tauxIR = parseFloat(settings.taux_versement_ir) || 2.2

  const bilan = calculerBilan(list, annee, tauxCotisation, versementLib, tauxIR)

  // Années disponibles
  const annees = Array.from(new Set(list.map((i) => new Date(i.date_emission).getFullYear())))
    .sort((a, b) => b - a)
  if (!annees.includes(new Date().getFullYear())) annees.unshift(new Date().getFullYear())

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Comptabilité</h1>
          <p className="text-gray-500 mt-1">Bilan {annee} — auto-entrepreneur (prestations de services)</p>
        </div>
        <YearSelector annee={annee} anneesDisponibles={annees} />
      </div>

      {/* Alertes seuils */}
      {bilan.depassementPlafond && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertTriangle className="h-4 w-4" />
          <span>⚠ Plafond de CA dépassé ({eur(SEUILS.plafond_ca)}) — risque de sortie du régime micro-entreprise.</span>
        </div>
      )}
      {bilan.depassementTva && !bilan.depassementPlafond && (
        <div className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-700">
          <AlertTriangle className="h-4 w-4" />
          <span>Seuil de franchise TVA dépassé ({eur(SEUILS.seuil_tva)}) — vous devez facturer la TVA. Vérifiez votre situation.</span>
        </div>
      )}

      {/* KPIs principaux */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">CA encaissé</CardTitle>
            <div className="p-2 bg-green-50 rounded-lg"><Wallet className="h-4 w-4 text-green-500" /></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{eur(bilan.caEncaisse)}</div>
            <p className="text-xs text-gray-500 mt-1">factures payées {annee}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">CA facturé</CardTitle>
            <div className="p-2 bg-blue-50 rounded-lg"><FileText className="h-4 w-4 text-blue-500" /></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{eur(bilan.caFacture)}</div>
            <p className="text-xs text-gray-500 mt-1">émis (hors annulées)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Cotisations URSSAF</CardTitle>
            <div className="p-2 bg-orange-50 rounded-lg"><Landmark className="h-4 w-4 text-orange-500" /></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">−{eur(bilan.cotisations)}</div>
            <p className="text-xs text-gray-500 mt-1">estimé à {tauxCotisation}%</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Net estimé</CardTitle>
            <div className="p-2 bg-purple-50 rounded-lg"><TrendingUp className="h-4 w-4 text-purple-500" /></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{eur(bilan.netEstime)}</div>
            <p className="text-xs text-gray-500 mt-1">
              après cotisations{versementLib ? ' + IR' : ''}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Graphique + seuils */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">CA encaissé par mois — {annee}</CardTitle>
          </CardHeader>
          <CardContent>
            <CaBarChart data={bilan.parMois} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Seuils légaux</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 pt-2">
            {/* Plafond CA */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-600">Plafond micro-entreprise</span>
                <span className="font-medium">{bilan.pctPlafond.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                <div className="h-2.5 rounded-full transition-all"
                  style={{
                    width: `${Math.min(bilan.pctPlafond, 100)}%`,
                    background: bilan.pctPlafond >= 100 ? '#ef4444' : bilan.pctPlafond >= 80 ? '#f59e0b' : '#22c55e',
                  }} />
              </div>
              <p className="text-xs text-gray-400 mt-1">{eur(bilan.caEncaisse)} / {eur(SEUILS.plafond_ca)}</p>
            </div>

            {/* Seuil TVA */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-600">Franchise TVA</span>
                <span className="font-medium">{bilan.pctSeuilTva.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                <div className="h-2.5 rounded-full transition-all"
                  style={{
                    width: `${Math.min(bilan.pctSeuilTva, 100)}%`,
                    background: bilan.pctSeuilTva >= 100 ? '#ef4444' : bilan.pctSeuilTva >= 80 ? '#f59e0b' : '#3b82f6',
                  }} />
              </div>
              <p className="text-xs text-gray-400 mt-1">{eur(bilan.caEncaisse)} / {eur(SEUILS.seuil_tva)}</p>
            </div>

            {versementLib && (
              <div className="pt-2 border-t">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Versement libératoire IR</span>
                  <span className="font-semibold text-gray-800">−{eur(bilan.versementIR)}</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">à {tauxIR}% du CA encaissé</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Récap fiscal */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Receipt className="h-4 w-4 text-gray-500" />
            Récapitulatif {annee} à déclarer
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600">CA à déclarer à l'URSSAF (encaissé)</span>
              <span className="font-bold">{eur(bilan.caEncaisse)}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600">Cotisations sociales ({tauxCotisation}%)</span>
              <span className="font-medium text-orange-600">{eur(bilan.cotisations)}</span>
            </div>
            {versementLib && (
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">Impôt sur le revenu — versement libératoire ({tauxIR}%)</span>
                <span className="font-medium text-orange-600">{eur(bilan.versementIR)}</span>
              </div>
            )}
            <div className="flex justify-between py-2">
              <span className="font-semibold text-gray-800">Revenu net estimé</span>
              <span className="font-bold text-purple-600 text-base">{eur(bilan.netEstime)}</span>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-4 pt-3 border-t">
            ⚠ Estimations indicatives. Le taux de cotisation et l'option versement libératoire sont configurables dans Paramètres.
            Consultez votre expert-comptable ou l'URSSAF pour les chiffres officiels.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
