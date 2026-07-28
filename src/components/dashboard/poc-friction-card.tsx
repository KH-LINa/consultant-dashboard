import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertOctagon } from 'lucide-react'
import type { ProjetEnRisquePoc } from '@/lib/gantt-deps'

// Zone de friction POC → Production (voir
// 01-methodologie/grille-diagnostic-maturite-ia.md) : la majorité des
// projets IA industriels s'arrêtent entre le POC et la production, pas sur
// l'algorithme. Ce widget rend ce risque visible au lieu de le laisser
// invisible dans un planning qui a simplement cessé d'avancer.
export function PocFrictionCard({ risques }: { risques: ProjetEnRisquePoc[] }) {
  if (risques.length === 0) return null

  return (
    <Card className="border-amber-200 bg-amber-50/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2 text-amber-800">
          <AlertOctagon className="h-4 w-4 text-amber-600" />
          Risque de blocage POC → Production ({risques.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-amber-700 mb-2">
          Ces projets n&apos;ont pas progressé au-delà du POC après la date de fin prévue de cette
          phase — c&apos;est précisément la zone où la majorité des projets IA industriels s&apos;arrêtent.
        </p>
        <div className="divide-y divide-amber-100">
          {risques.map((r) => (
            <Link key={r.projectId} href={`/projets/${r.projectId}`}
              className="flex items-center justify-between gap-3 py-2 px-1 -mx-1 rounded-lg hover:bg-amber-100/60">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{r.projectTitre}</p>
                <p className="text-xs text-amber-700 truncate">Phase « {r.phaseTitre} »</p>
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
