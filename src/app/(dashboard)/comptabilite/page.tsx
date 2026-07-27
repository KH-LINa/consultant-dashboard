import { createClient } from '@/lib/supabase/server'
import { getSettings } from '@/lib/settings'
import { calculerBilan, SEUILS } from '@/lib/comptabilite'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CaBarChart } from '@/components/comptabilite/ca-bar-chart'
import { YearSelector } from '@/components/comptabilite/year-selector'
import { Wallet, Landmark, TrendingUp, AlertTriangle, FileText, Receipt, Banknote } from 'lucide-react'

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

  const remunerationBrutMensuelle = parseFloat(settings.remuneration_brute_mensuelle) || 0
  const tauxChargesPatronales = parseFloat(settings.taux_charges_patronales) || 45
  const tauxChargesSalariales = parseFloat(settings.taux_charges_salariales) || 22

  const bilan = calculerBilan(list, annee, remunerationBrutMensuelle, tauxChargesPatronales, tauxChargesSalariales)

  // Années disponibles
  const annees = Array.from(new Set(list.map((i) => new Date(i.date_emission).getFullYear())))
    .sort((a, b) => b - a)
  if (!annees.includes(new Date().getFullYear())) annees.unshift(new Date().getFullYear())

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Comptabilité</h1>
          <p className="text-gray-500 mt-1">Bilan {annee} — SASU (impôt sur les sociétés)</p>
        </div>
        <YearSelector annee={annee} anneesDisponibles={annees} />
      </div>

      {/* Alertes seuils */}
      {bilan.depassementTva && (
        <div className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-700">
          <AlertTriangle className="h-4 w-4" />
          <span>Seuil de franchise TVA dépassé ({eur(SEUILS.seuil_tva)}) — vous devez facturer la TVA. Vérifiez votre situation.</span>
        </div>
      )}

      {/* KPIs principaux */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
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
            <CardTitle className="text-sm font-medium text-gray-600">Rémunération chargée</CardTitle>
            <div className="p-2 bg-orange-50 rounded-lg"><Landmark className="h-4 w-4 text-orange-500" /></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">−{eur(bilan.coutTotalRemuneration)}</div>
            <p className="text-xs text-gray-500 mt-1">brut {eur(bilan.remunerationBrute)} + charges patronales</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Résultat avant IS</CardTitle>
            <div className="p-2 bg-purple-50 rounded-lg"><TrendingUp className="h-4 w-4 text-purple-500" /></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{eur(bilan.resultatAvantIS)}</div>
            <p className="text-xs text-gray-500 mt-1">CA encaissé − rémunération chargée</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">IS estimé</CardTitle>
            <div className="p-2 bg-red-50 rounded-lg"><Receipt className="h-4 w-4 text-red-500" /></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">−{eur(bilan.impotSocietes)}</div>
            <p className="text-xs text-gray-500 mt-1">15% jusqu'à 42 500 €, 25% au-delà</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Résultat net</CardTitle>
            <div className="p-2 bg-green-50 rounded-lg"><Banknote className="h-4 w-4 text-green-500" /></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{eur(bilan.resultatNet)}</div>
            <p className="text-xs text-gray-500 mt-1">après IS, distribuable en dividendes</p>
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

            <div className="pt-2 border-t">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Net perçu (président)</span>
                <span className="font-semibold text-gray-800">{eur(bilan.netPercu)}</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">brut − charges salariales, avant IR personnel</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Récap fiscal */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Receipt className="h-4 w-4 text-gray-500" />
            Récapitulatif {annee}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600">CA encaissé</span>
              <span className="font-bold">{eur(bilan.caEncaisse)}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600">Rémunération brute président (annuelle)</span>
              <span className="font-medium text-orange-600">−{eur(bilan.remunerationBrute)}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600">Charges patronales ({tauxChargesPatronales}%)</span>
              <span className="font-medium text-orange-600">−{eur(bilan.chargesPatronales)}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600">Résultat avant IS</span>
              <span className="font-medium">{eur(bilan.resultatAvantIS)}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600">Impôt sur les sociétés estimé</span>
              <span className="font-medium text-red-600">−{eur(bilan.impotSocietes)}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="font-semibold text-gray-800">Résultat net (société)</span>
              <span className="font-bold text-purple-600 text-base">{eur(bilan.resultatNet)}</span>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-4 pt-3 border-t">
            ⚠ Estimations indicatives, hors autres charges déductibles (logiciels, déplacements, RC Pro, etc.)
            et hors IR personnel du président sur sa rémunération nette. La rémunération et les taux de charges
            sont configurables dans Paramètres. Consultez votre expert-comptable pour les chiffres officiels.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
