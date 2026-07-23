'use client'

import { useState } from 'react'
import type { AgentRun } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Markdown } from '@/components/agents/markdown'
import { History, ChevronDown, ChevronUp, CircleCheck, CircleX } from 'lucide-react'

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export function RunsHistory({ runs }: { runs: AgentRun[] }) {
  const [ouvert, setOuvert] = useState<string | null>(null)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4 text-[#534AB7]" />
          Historique des runs
        </CardTitle>
        <CardDescription>Les 20 derniers runs de l&apos;orchestrateur (table agent_runs)</CardDescription>
      </CardHeader>
      <CardContent>
        {runs.length === 0 ? (
          <p className="text-sm text-gray-400">Aucun run pour le moment.</p>
        ) : (
          <ul className="divide-y">
            {runs.map((run) => {
              const estOuvert = ouvert === run.id
              return (
                <li key={run.id} className="py-3">
                  <button
                    type="button"
                    onClick={() => setOuvert(estOuvert ? null : run.id)}
                    className="w-full text-left flex items-start justify-between gap-3 group"
                  >
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm text-gray-800 truncate group-hover:text-[#534AB7]">
                        {run.demande}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-400">
                        <span>{formatDate(run.created_at)}</span>
                        <span>· {(run.duree_ms / 1000).toFixed(1)} s</span>
                        <span>· {(run.tokens_input + run.tokens_output).toLocaleString('fr-FR')} tokens</span>
                        {run.statut === 'erreur' && (
                          <Badge variant="outline" className="border-red-300 text-red-700 bg-red-50">
                            erreur
                          </Badge>
                        )}
                        {run.agents_appeles.map((a) => (
                          <Badge
                            key={`${run.id}-${a.slug}`}
                            variant="outline"
                            className={
                              a.statut === 'succes'
                                ? 'border-[#534AB7]/30 text-[#534AB7]/90'
                                : 'border-red-300 text-red-700'
                            }
                          >
                            {a.statut === 'succes' ? (
                              <CircleCheck className="h-3 w-3 mr-1" />
                            ) : (
                              <CircleX className="h-3 w-3 mr-1" />
                            )}
                            {a.slug}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    {estOuvert ? (
                      <ChevronUp className="h-4 w-4 shrink-0 text-gray-400 mt-0.5" />
                    ) : (
                      <ChevronDown className="h-4 w-4 shrink-0 text-gray-400 mt-0.5" />
                    )}
                  </button>
                  {estOuvert && (
                    <div className="mt-3 rounded-lg border bg-gray-50 p-4">
                      {run.erreur && (
                        <p className="text-sm text-red-700 mb-2">Erreur : {run.erreur}</p>
                      )}
                      {run.resultat ? (
                        <Markdown>{run.resultat}</Markdown>
                      ) : (
                        <p className="text-sm text-gray-400">Aucun résultat enregistré.</p>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
