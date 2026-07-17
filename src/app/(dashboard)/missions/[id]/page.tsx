import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { MissionTasks } from '@/components/missions/mission-tasks'
import { DocumentsManager } from '@/components/documents/documents-manager'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Pencil, Calendar, Wallet, Clock, FolderGit2, Flag } from 'lucide-react'
import type { MissionStatus } from '@/lib/types'

const statutLabel: Record<MissionStatus, { label: string; cls: string }> = {
  a_demarrer: { label: 'À démarrer', cls: 'bg-gray-100 text-gray-600' },
  en_cours: { label: 'En cours', cls: 'bg-blue-100 text-blue-700' },
  en_pause: { label: 'En pause', cls: 'bg-orange-100 text-orange-700' },
  terminee: { label: 'Terminée', cls: 'bg-green-100 text-green-700' },
  annulee: { label: 'Annulée', cls: 'bg-red-100 text-red-700' },
}

export default async function MissionDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()

  const [{ data: mission }, { data: tasks }, { data: documents }] = await Promise.all([
    supabase.from('missions').select('*, contact:contacts(nom, entreprise, email), responsable:collaborateurs(nom, couleur)').eq('id', params.id).single(),
    supabase.from('mission_tasks').select('*').eq('mission_id', params.id).order('ordre'),
    supabase.from('documents').select('*').eq('mission_id', params.id).order('created_at', { ascending: false }),
  ])

  if (!mission) notFound()

  // Données du projet parent (si la mission est rattachée à un projet)
  let parentProject: any = null
  let parentMilestones: any[] = []
  if (mission.project_id) {
    const [{ data: proj }, { data: ms }] = await Promise.all([
      supabase.from('projects').select('id, titre, date_debut, date_fin_prevue, statut, responsable:collaborateurs(nom, couleur)').eq('id', mission.project_id).single(),
      supabase.from('project_milestones').select('*').eq('project_id', mission.project_id).order('date_echeance'),
    ])
    parentProject = proj
    parentMilestones = ms ?? []
  }

  const st = statutLabel[mission.statut as MissionStatus]
  function fdateShort(d: string | null) {
    return d ? new Date(d).toLocaleDateString('fr-FR') : '—'
  }
  const milestoneStatut: Record<string, string> = {
    a_faire: 'bg-gray-100 text-gray-600',
    atteint: 'bg-green-100 text-green-700',
    en_retard: 'bg-red-100 text-red-700',
  }
  const totalHeures = (tasks ?? []).reduce((s, t) => s + (Number(t.temps_passe) || 0), 0)
  const tjm = totalHeures > 0 && mission.budget_ht > 0
    ? mission.budget_ht / (totalHeures / 7)
    : null

  function fdate(d: string | null) {
    return d ? new Date(d).toLocaleDateString('fr-FR') : '—'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/missions" className="text-sm text-gray-400 hover:text-gray-600">← Missions</Link>
          <div className="flex items-center gap-3 mt-1">
            <h1 className="text-3xl font-bold text-gray-900">{mission.titre}</h1>
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${st.cls}`}>{st.label}</span>
          </div>
          <p className="text-gray-500 mt-1">{mission.contact?.nom}{mission.contact?.entreprise ? ` — ${mission.contact.entreprise}` : ''}</p>
          {(mission as any).responsable && (
            <p className="text-sm text-gray-500 mt-1 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: (mission as any).responsable.couleur }} />
              Responsable : {(mission as any).responsable.nom}
            </p>
          )}
        </div>
        <Button variant="outline" asChild>
          <Link href={`/missions/${mission.id}/edit`}><Pencil className="h-4 w-4 mr-2" />Modifier</Link>
        </Button>
      </div>

      {mission.description && (
        <Card>
          <CardContent className="pt-4 text-sm text-gray-600 whitespace-pre-line">{mission.description}</CardContent>
        </Card>
      )}

      {/* Infos clés */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4 pb-4 flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-lg"><Wallet className="h-4 w-4 text-blue-500" /></div>
          <div>
            <p className="text-xs text-gray-500">Budget HT</p>
            <p className="text-base font-bold">
              {Number(mission.budget_ht).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
            </p>
          </div>
        </CardContent></Card>

        <Card><CardContent className="pt-4 pb-4 flex items-center gap-3">
          <div className="p-2 bg-purple-50 rounded-lg"><Clock className="h-4 w-4 text-purple-500" /></div>
          <div>
            <p className="text-xs text-gray-500">Temps passé</p>
            <p className="text-base font-bold">{totalHeures}h{tjm ? ` · ${tjm.toFixed(0)}€/j` : ''}</p>
          </div>
        </CardContent></Card>

        <Card><CardContent className="pt-4 pb-4 flex items-center gap-3">
          <div className="p-2 bg-green-50 rounded-lg"><Calendar className="h-4 w-4 text-green-500" /></div>
          <div>
            <p className="text-xs text-gray-500">Début</p>
            <p className="text-base font-bold">{fdate(mission.date_debut)}</p>
          </div>
        </CardContent></Card>

        <Card><CardContent className="pt-4 pb-4 flex items-center gap-3">
          <div className="p-2 bg-orange-50 rounded-lg"><Calendar className="h-4 w-4 text-orange-500" /></div>
          <div>
            <p className="text-xs text-gray-500">Échéance</p>
            <p className="text-base font-bold">{fdate(mission.date_fin_prevue)}</p>
          </div>
        </CardContent></Card>
      </div>

      {/* Projet parent : dates + jalons hérités du projet */}
      {parentProject && (
        <Card className="border-l-4 border-l-indigo-400">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FolderGit2 className="h-4 w-4 text-indigo-500" />
              Projet parent
              <Link href={`/projets/${parentProject.id}`} className="text-sm font-normal text-blue-600 hover:underline ml-1">
                {parentProject.titre} →
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-6 text-sm">
              <div>
                <span className="text-gray-400 text-xs">Début projet</span>
                <p className="font-medium">{fdateShort(parentProject.date_debut)}</p>
              </div>
              <div>
                <span className="text-gray-400 text-xs">Fin prévue projet</span>
                <p className="font-medium">{fdateShort(parentProject.date_fin_prevue)}</p>
              </div>
              {parentProject.responsable && (
                <div>
                  <span className="text-gray-400 text-xs">Responsable projet</span>
                  <p className="font-medium flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: parentProject.responsable.couleur }} />
                    {parentProject.responsable.nom}
                  </p>
                </div>
              )}
            </div>

            <div>
              <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                <Flag className="h-3.5 w-3.5 text-amber-500" />
                Jalons du projet ({parentMilestones.length})
              </p>
              {parentMilestones.length > 0 ? (
                <div className="space-y-1">
                  {parentMilestones.map((m) => (
                    <div key={m.id} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
                      <span className="text-gray-800">◆ {m.titre}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-gray-500">{fdateShort(m.date_echeance)}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${milestoneStatut[m.statut] ?? 'bg-gray-100 text-gray-600'}`}>
                          {m.statut === 'a_faire' ? 'À faire' : m.statut === 'atteint' ? 'Atteint' : 'En retard'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">Aucun jalon défini sur le projet.</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tâches */}
      <MissionTasks missionId={mission.id} initialTasks={tasks ?? []} />

      {/* Documents */}
      <DocumentsManager documents={documents ?? []} missionId={mission.id} title="Documents de la mission" />
    </div>
  )
}
