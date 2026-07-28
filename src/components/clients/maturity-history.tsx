import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LEVIERS, NIVEAU_CONFIG, RECOMMANDATION_CONFIG, scoreIndicatif } from '@/lib/maturite'
import type { MaturityAssessment } from '@/lib/types'
import { ClipboardCheck } from 'lucide-react'
import { MaturityAssessmentForm } from './maturity-assessment-form'

function fmtDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

interface MaturityHistoryProps {
  contactId: string
  assessments: MaturityAssessment[]
  projects: { id: string; titre: string }[]
}

export function MaturityHistory({ contactId, assessments, projects }: MaturityHistoryProps) {
  const triees = [...assessments].sort((a, b) => b.date_evaluation.localeCompare(a.date_evaluation))

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4 text-[#534AB7]" />
          Maturité IA ({triees.length})
        </CardTitle>
        <MaturityAssessmentForm contactId={contactId} projects={projects} />
      </CardHeader>
      <CardContent>
        {triees.length === 0 ? (
          <p className="text-sm text-gray-400 py-4">
            Aucune évaluation de maturité pour ce client. La grille des 6 leviers (Stratégie,
            Organisation, Personnel, Offre, Technologie et innovation, Environnement) permet de
            situer un point de départ avant d&apos;investir, sans notation punitive.
          </p>
        ) : (
          <div className="space-y-4 divide-y">
            {triees.map((a) => (
              <div key={a.id} className="pt-4 first:pt-0">
                <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-800">{fmtDate(a.date_evaluation)}</span>
                    {a.recommandation && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${RECOMMANDATION_CONFIG[a.recommandation].cls}`}>
                        {RECOMMANDATION_CONFIG[a.recommandation].label}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400" title="Repère indicatif, pas une note officielle de la grille">
                    Préparation globale ~{scoreIndicatif(a)}%
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
                  {LEVIERS.map(({ champ, label }) => {
                    const niveau = a[champ]
                    return (
                      <div key={champ} className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-gray-500">{label}</span>
                        <span className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded-full ${NIVEAU_CONFIG[niveau].cls}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${NIVEAU_CONFIG[niveau].dot}`} />
                          {NIVEAU_CONFIG[niveau].label}
                        </span>
                      </div>
                    )
                  })}
                </div>
                {a.notes && <p className="text-xs text-gray-500 mt-2 whitespace-pre-line">{a.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
