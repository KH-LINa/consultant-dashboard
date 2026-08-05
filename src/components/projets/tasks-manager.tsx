'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { ProjectTask, ProjectPhase, Collaborateur, ProjectTaskStatus, CollaborateurUnavailability } from '@/lib/types'
import { indisponibiliteChevauchante } from '@/lib/surveillance'
import { toLocalISO } from '@/lib/gantt-deps'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Plus, Trash2, ListChecks, Repeat, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { TaskComments } from '@/components/planning/task-comments'
import { MOTIF_LABEL } from '@/components/ressources/resource-calendar'

const statutLabel: Record<ProjectTaskStatus, string> = {
  a_faire: 'À faire', en_cours: 'En cours', fait: 'Fait', bloque: 'Bloqué',
}
const statutStyle: Record<ProjectTaskStatus, string> = {
  a_faire: 'bg-gray-100 text-gray-600',
  en_cours: 'bg-blue-100 text-blue-700',
  fait: 'bg-green-100 text-green-700',
  bloque: 'bg-red-100 text-red-700',
}

const NONE = '__none__'

function fmtCourt(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

function joursDepuis(iso: string, auj: string): number {
  return Math.round((new Date(auj + 'T00:00:00').getTime() - new Date(iso + 'T00:00:00').getTime()) / 86_400_000)
}

// Retard = date de fin passée et pas encore "fait" — même définition que
// partout ailleurs dans l'app (alertesProjet, dashboard, notifications).
function estEnRetard(t: Pick<ProjectTask, 'date_fin' | 'statut'>, auj: string): boolean {
  return !!t.date_fin && t.date_fin < auj && t.statut !== 'fait'
}

interface TasksManagerProps {
  projectId: string
  tasks: ProjectTask[]
  phases: ProjectPhase[]
  collaborateurs: Collaborateur[]
  // Nombre de commentaires par tâche, préchargé côté serveur — permet
  // d'afficher "Commentaires (n)" immédiatement, sans devoir dépiler chaque
  // tâche pour savoir si le collaborateur a laissé une explication.
  commentCounts?: Record<string, number>
  // Calendrier de disponibilité des collaborateurs — garde-fou NON bloquant
  // (voir indisponibiliteChevauchante) : avertit sans empêcher d'assigner
  // une tâche à un collaborateur en congé/absence, un collaborateur pouvant
  // légitimement accepter de travailler pendant cette période.
  unavailabilities?: CollaborateurUnavailability[]
}

export function TasksManager({
  projectId, tasks, phases, collaborateurs, commentCounts = {}, unavailabilities = [],
}: TasksManagerProps) {
  const router = useRouter()
  const supabase = createClient()
  const [titre, setTitre] = useState('')
  const [adding, setAdding] = useState(false)
  // Figé au montage plutôt que recalculé à chaque rendu — un changement de
  // jour en cours de session n'a pas besoin de se répercuter immédiatement.
  const [aujourdhui] = useState(() => toLocalISO(new Date()))

  // Arrivée depuis un lien "?tache=<id>" (notification de retard par email
  // ou page Notifications) : centre la vue sur la tâche visée et déplie
  // directement son fil de commentaires (voir TaskComments defaultOpen).
  // Lu depuis window.location plutôt que useSearchParams pour ne pas
  // imposer de limite de Suspense sur la page projet (même convention que
  // (auth)/login/page.tsx).
  const [tacheActive, setTacheActive] = useState<string | null>(null)
  const [surligner, setSurligner] = useState(false)

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('tache')
    if (!id) return
    setTacheActive(id)
    setSurligner(true)
    document.getElementById(`tache-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const timer = setTimeout(() => setSurligner(false), 4000)
    return () => clearTimeout(timer)
  }, [])

  const collabById = Object.fromEntries(collaborateurs.map((c) => [c.id, c]))
  const phaseById = Object.fromEntries(phases.map((p) => [p.id, p]))

  const unavailabilitiesByCollaborateur = useMemo(() => {
    const m = new Map<string, CollaborateurUnavailability[]>()
    for (const u of unavailabilities) {
      const arr = m.get(u.collaborateur_id)
      if (arr) arr.push(u); else m.set(u.collaborateur_id, [u])
    }
    return m
  }, [unavailabilities])

  // Indisponibilité en cours pour chaque tâche déjà assignée — badge
  // persistant sur la ligne (le toast d'avertissement dans update() n'est
  // visible qu'au moment du changement, pas en revenant plus tard sur la page).
  const indispoParTache = useMemo(() => {
    const m = new Map<string, CollaborateurUnavailability>()
    for (const t of tasks) {
      if (!t.responsable_id || !t.date_debut || !t.date_fin) continue
      const u = indisponibiliteChevauchante(t.date_debut, t.date_fin, unavailabilitiesByCollaborateur.get(t.responsable_id) ?? [])
      if (u) m.set(t.id, u)
    }
    return m
  }, [tasks, unavailabilitiesByCollaborateur])

  async function addTask(e: React.FormEvent) {
    e.preventDefault()
    if (!titre.trim()) return
    setAdding(true)
    const { error } = await supabase.from('project_tasks').insert({
      project_id: projectId, titre, ordre: tasks.length,
    })
    if (error) toast.error(error.message)
    else { toast.success('Tâche ajoutée'); setTitre(''); router.refresh() }
    setAdding(false)
  }

  // Si une tâche progresse réellement (avancement ou statut) alors que le
  // projet — ou une mission liée à ce projet — est encore marqué "à démarrer",
  // on les repasse automatiquement à "en cours". La condition
  // .eq('statut', 'a_demarrer') rend la mise à jour sans effet si le statut a
  // déjà été positionné manuellement (en pause, terminé...).
  async function bumpProjetEnCours() {
    await Promise.all([
      supabase.from('projects').update({ statut: 'en_cours' }).eq('id', projectId).eq('statut', 'a_demarrer'),
      supabase.from('missions').update({ statut: 'en_cours' }).eq('project_id', projectId).eq('statut', 'a_demarrer'),
    ])
  }

  async function update(id: string, field: string, value: string | number | null) {
    const { error } = await supabase.from('project_tasks').update({ [field]: value }).eq('id', id)
    if (error) { toast.error(error.message); return }
    if (field === 'avancement' && typeof value === 'number' && value > 0) await bumpProjetEnCours()
    if (field === 'responsable_id' || field === 'date_debut' || field === 'date_fin') {
      avertirSiIndisponible(id, field, value as string | null)
    }
    router.refresh()
  }

  // Garde-fou non bloquant : avertit immédiatement (au lieu d'attendre
  // l'email du lendemain, cf. conflitsIndisponibiliteCollaborateurs) si le
  // responsable résultant est en congé/absence sur la période résultante de
  // la tâche — sans jamais empêcher la sauvegarde déjà effectuée ci-dessus.
  function avertirSiIndisponible(id: string, champModifie: string, nouvelleValeur: string | null) {
    const t = tasks.find((x) => x.id === id)
    if (!t) return
    const responsableId = champModifie === 'responsable_id' ? nouvelleValeur : t.responsable_id
    const debut = champModifie === 'date_debut' ? nouvelleValeur : t.date_debut
    const fin = champModifie === 'date_fin' ? nouvelleValeur : t.date_fin
    if (!responsableId || !debut || !fin) return
    const conflit = indisponibiliteChevauchante(debut, fin, unavailabilitiesByCollaborateur.get(responsableId) ?? [])
    if (!conflit) return
    const nom = collabById[responsableId]?.nom ?? 'Ce collaborateur'
    toast.warning(
      `⚠ ${nom} est ${MOTIF_LABEL[conflit.motif].toLowerCase()} du ${fmtCourt(conflit.date_debut)} au ${fmtCourt(conflit.date_fin)} — tâche quand même assignée.`
    )
  }

  // Marquer une tâche "Fait" doit aussi mettre son avancement à 100 % —
  // sinon le statut et le pourcentage restent incohérents (ex. "Fait" à 0 %).
  async function updateStatut(id: string, statut: ProjectTaskStatus, avancementActuel: number) {
    const payload: { statut: ProjectTaskStatus; avancement?: number } = { statut }
    if (statut === 'fait' && avancementActuel !== 100) payload.avancement = 100
    const { error } = await supabase.from('project_tasks').update(payload).eq('id', id)
    if (error) { toast.error(error.message); return }
    if (statut !== 'a_faire') await bumpProjetEnCours()
    router.refresh()
  }

  async function remove(id: string) {
    const { error } = await supabase.from('project_tasks').delete().eq('id', id)
    if (error) toast.error(error.message); else { toast.success('Tâche supprimée'); router.refresh() }
  }

  // Nombre d'occurrences par série (tâches récurrentes créées ensemble depuis le Gantt)
  const tailleSerie = tasks.reduce((m, t) => {
    if (t.serie_id) m.set(t.serie_id, (m.get(t.serie_id) ?? 0) + 1)
    return m
  }, new Map<string, number>())

  // Tri chronologique pour l'affichage — `ordre` n'est unique QUE dans sa
  // propre phase (repart à 0 à chaque phase, y compris pour les tâches
  // générées par Cadence), donc trier cette liste à plat par `ordre` seul
  // mélange arbitrairement les tâches de phases différentes. Le Gantt
  // n'a pas ce problème car il trie déjà chaque groupe par date_debut ;
  // on applique la même logique ici, avec `ordre` en repli pour les tâches
  // sans date (égalité de date, ou aucune date renseignée).
  const tasksTriees = [...tasks].sort((a, b) => {
    if (a.date_debut && b.date_debut) {
      const cmp = a.date_debut.localeCompare(b.date_debut)
      if (cmp !== 0) return cmp
    } else if (a.date_debut) {
      return -1
    } else if (b.date_debut) {
      return 1
    }
    return a.ordre - b.ordre
  })

  async function removeSerie(serieId: string) {
    const { error } = await supabase.from('project_tasks').delete().eq('serie_id', serieId)
    if (error) toast.error(error.message)
    else { toast.success('Série supprimée (toutes les occurrences)'); router.refresh() }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-green-600" />
          Tâches ({tasks.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {tasksTriees.map((t) => {
          const resp = t.responsable_id ? collabById[t.responsable_id] : null
          const enRetard = estEnRetard(t, aujourdhui)
          return (
            <div key={t.id} id={`tache-${t.id}`}
              className={`border rounded-lg p-3 space-y-2 group transition-colors ${
                surligner && t.id === tacheActive
                  ? 'ring-2 ring-amber-400 bg-amber-50/60'
                  : enRetard ? 'border-red-200 bg-red-50/40' : ''
              }`}>
              <div className="flex items-center gap-2">
                <Input className="h-8 flex-1 font-medium" defaultValue={t.titre}
                  onBlur={(e) => e.target.value !== t.titre && update(t.id, 'titre', e.target.value)} />
                {enRetard && (
                  <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700 font-medium flex items-center gap-1 shrink-0"
                    title="Échéance dépassée, pas encore marquée « Fait »">
                    <AlertTriangle className="h-3 w-3" />
                    En retard ({joursDepuis(t.date_fin!, aujourdhui)} j)
                  </span>
                )}
                <span className={`text-xs px-2 py-1 rounded-full ${statutStyle[t.statut]}`}>
                  {statutLabel[t.statut]}
                </span>
                {t.serie_id && (
                  <Button variant="ghost" size="sm" onClick={() => removeSerie(t.serie_id!)}
                    title={`Supprimer toute la série (${tailleSerie.get(t.serie_id)} occurrences)`}
                    className="h-8 px-2 gap-1 text-xs text-gray-500 hover:text-red-600 opacity-0 group-hover:opacity-100">
                    <Repeat className="h-3.5 w-3.5" />
                    Série ({tailleSerie.get(t.serie_id)})
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => remove(t.id)}
                  title="Supprimer uniquement cette occurrence"
                  className="h-8 w-8 p-0 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="overflow-x-auto">
                <div className="grid grid-cols-12 gap-2 items-center min-w-[520px]">
                  {/* Phase */}
                  <div className="col-span-3 min-w-0">
                    <Select value={t.phase_id ?? NONE}
                      onValueChange={(v) => update(t.id, 'phase_id', v === NONE ? null : v)}>
                      <SelectTrigger className="h-8 w-full min-w-0 text-xs">
                        <SelectValue className="truncate min-w-0">
                          {(v: string) => (v === NONE ? '— Aucune phase —' : phaseById[v]?.titre ?? 'Phase')}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>— Aucune phase —</SelectItem>
                        {phases.map((p) => <SelectItem key={p.id} value={p.id}>{p.titre}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Responsable */}
                  <div className="col-span-3 min-w-0">
                    <Select value={t.responsable_id ?? NONE}
                      onValueChange={(v) => update(t.id, 'responsable_id', v === NONE ? null : v)}>
                      <SelectTrigger className="h-8 w-full min-w-0 text-xs">
                        <SelectValue className="truncate min-w-0">
                          {(v: string) => (v === NONE ? '— Non assigné —' : collabById[v]?.nom ?? 'Responsable')}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>— Non assigné —</SelectItem>
                        {collaborateurs.map((c) => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Dates */}
                  <Input type="date" className="col-span-2 h-8 text-xs" defaultValue={t.date_debut ?? ''}
                    onChange={(e) => update(t.id, 'date_debut', e.target.value || null)} />
                  <Input type="date" className="col-span-2 h-8 text-xs" defaultValue={t.date_fin ?? ''}
                    onChange={(e) => update(t.id, 'date_fin', e.target.value || null)} />
                  {/* Statut */}
                  <div className="col-span-2 min-w-0">
                    <Select value={t.statut}
                      onValueChange={(v) => updateStatut(t.id, v as ProjectTaskStatus, t.avancement)}>
                      <SelectTrigger className="h-8 w-full min-w-0 text-xs">
                        <SelectValue className="truncate min-w-0">
                          {(v: string) => statutLabel[v as ProjectTaskStatus] ?? v}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(statutLabel) as ProjectTaskStatus[]).map((s) => (
                          <SelectItem key={s} value={s}>{statutLabel[s]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              {indispoParTache.has(t.id) && (() => {
                const conflit = indispoParTache.get(t.id)!
                return (
                  <p className="text-xs text-red-600 flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    {resp?.nom} est {MOTIF_LABEL[conflit.motif].toLowerCase()} du {fmtCourt(conflit.date_debut)} au {fmtCourt(conflit.date_fin)} — tâche quand même assignée
                  </p>
                )
              })()}
              <div className="flex flex-wrap items-center gap-2">
                {resp && (
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: resp.couleur }} />
                    {resp.nom}
                  </span>
                )}
                <div className="flex items-center gap-1.5" title="Heure optionnelle — affine la détection de double réservation à l'heure près (uniquement pour une tâche sur une seule journée) ; sans heure, la tâche est traitée comme occupant toute la journée">
                  <span className="text-xs text-gray-400">Heure</span>
                  <Input type="time" className="h-8 w-28 text-xs" defaultValue={t.heure_debut ?? ''}
                    onChange={(e) => update(t.id, 'heure_debut', e.target.value || null)} />
                  <span className="text-xs text-gray-400">→</span>
                  <Input type="time" className="h-8 w-28 text-xs" defaultValue={t.heure_fin ?? ''}
                    onChange={(e) => update(t.id, 'heure_fin', e.target.value || null)} />
                </div>
                <div className="flex items-center gap-2 sm:ml-auto">
                  <span className="text-xs text-gray-400">Avancement</span>
                  <Input type="number" min="0" max="100" className="h-8 w-16 text-xs text-right"
                    key={`av-${t.id}-${t.avancement}`}
                    defaultValue={t.avancement}
                    onBlur={(e) => {
                      const v = Math.max(0, Math.min(100, parseInt(e.target.value) || 0))
                      if (v !== t.avancement) update(t.id, 'avancement', v)
                    }} />
                  <span className="text-xs text-gray-400">%</span>
                </div>
              </div>
              <TaskComments taskId={t.id} initialCount={commentCounts[t.id] ?? 0} defaultOpen={t.id === tacheActive} />
            </div>
          )
        })}
        <form onSubmit={addTask} className="flex gap-2 pt-2 border-t">
          <Input value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Nouvelle tâche" className="h-9" />
          <Button type="submit" size="sm" disabled={adding || !titre.trim()}><Plus className="h-4 w-4" /></Button>
        </form>
      </CardContent>
    </Card>
  )
}
