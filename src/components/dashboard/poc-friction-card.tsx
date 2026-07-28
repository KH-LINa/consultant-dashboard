import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertOctagon } from 'lucide-react'
import type { ProjetEnRisquePoc } from '@/lib/gantt-deps'

// Risque de blocage à une transition de phase — inspiré de la "zone de
// friction POC → Production" (voir
// 01-methodologie/grille-diagnostic-maturite-ia.md : la majorité des
// projets IA industriels s'arrêtent à une transition, pas sur
// l'algorithme), mais généralisé à toute transition (voir
// detecterFrictionPocProduction) puisqu'un projet réel a rarement une
// phase littéralement nommée "POC". Le titre et le message par ligne
// restent spécifiques quand la phase EST bien un POC (estZonePoc).
export function PocFrictionCard({ risques }: { risques: ProjetEnRisquePoc[] }) {
  if (risques.length === 0) return null

  const auMoinsUnPoc = risques.some((r) => r.estZonePoc)

  return (
    <Card className="border-amber-200 bg-amber-50/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2 text-amber-800">
          <AlertOctagon className="h-4 w-4 text-amber-600" />
          {auMoinsUnPoc ? 'Risque de blocage POC → Production' : 'Risque de blocage de projet'} ({risques.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-amber-700 mb-2">
          Ces projets n&apos;ont pas progressé après la date de fin prévue d&apos;une phase —
          c&apos;est précisément le type de transition où la majorité des projets IA industriels
          s&apos;arrêtent (POC → production, mais pas seulement).
        </p>
        <div className="divide-y divide-amber-100">
          {risques.map((r) => (
            <Link key={r.projectId} href={`/projets/${r.projectId}`}
              className="flex items-center justify-between gap-3 py-2 px-1 -mx-1 rounded-lg hover:bg-amber-100/60">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{r.projectTitre}</p>
                <p className="text-xs text-amber-700 truncate">
                  {r.estZonePoc ? 'Phase POC dépassée' : `Bloqué après « ${r.phaseTitre} »`}
                </p>
              </div>
              <span className="text-xs font-medium text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full shrink-0">
                {r.joursDeRetard} j de retard
              </span>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
