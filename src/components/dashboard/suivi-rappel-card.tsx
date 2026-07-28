import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RefreshCw } from 'lucide-react'
import type { ProjetSuiviAPrevoir } from '@/lib/gantt-deps'

// Étape 7 de la méthodologie Yndra ("Suivi & amélioration continue") : la
// surveillance planning existante couvre les tâches/ressources, pas la
// relation client post-déploiement — ce widget évite que ce point se perde
// silencieusement une fois la mission livrée.
export function SuiviRappelCard({ rappels }: { rappels: ProjetSuiviAPrevoir[] }) {
  if (rappels.length === 0) return null

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <RefreshCw className="h-4 w-4 text-cyan-600" />
          Suivi à prévoir — étape 7 ({rappels.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="divide-y">
          {rappels.map((r) => (
            <Link key={r.projectId} href={`/projets/${r.projectId}`}
              className="flex items-center justify-between gap-3 py-2 px-1 -mx-1 rounded-lg hover:bg-gray-50">
              <p className="text-sm font-medium text-gray-800 truncate">{r.projectTitre}</p>
              <span className="text-xs text-gray-500 shrink-0">
                {r.dateDernierSuivi === null
                  ? 'Aucun point de suivi encore fait'
                  : `Dernier point il y a ${r.moisEcoules} mois`}
              </span>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
