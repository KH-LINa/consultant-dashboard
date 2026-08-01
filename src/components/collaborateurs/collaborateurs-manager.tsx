'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type {
  Collaborateur, Resource, ResourceAssignment, MissionStatus, ProjectStatus, ContratType,
  CollaborateurUnavailability, ResourceUnavailabilityMotif,
} from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { AvatarCollaborateur } from '@/components/collaborateurs/avatar-collaborateur'
import { CompetencesTags } from '@/components/collaborateurs/competences-tags'
import { ResourceCalendar, MOTIF_LABEL, MOTIF_COLOR } from '@/components/ressources/resource-calendar'
import { Plus, Trash2, Users, Link2, Unlink, StickyNote, Mail, Phone, CalendarClock, CalendarDays } from 'lucide-react'
import { toast } from 'sonner'

const COULEURS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#06b6d4', '#ec4899', '#64748b']
const NONE = '__none__'
const TOUS_MOTIFS = new Set<ResourceUnavailabilityMotif>(['absent', 'conge', 'maladie', 'autre'])

function fmtCourt(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

const TYPES_CONTRAT: ContratType[] = ['CDI', 'CDD', 'Freelance', 'Alternance', 'Stage']
const CONTRAT_STYLE: Record<ContratType, string> = {
  CDI: 'bg-green-100 text-green-700',
  CDD: 'bg-blue-100 text-blue-700',
  Freelance: 'bg-purple-100 text-purple-700',
  Alternance: 'bg-amber-100 text-amber-700',
  Stage: 'bg-gray-100 text-gray-600',
}

function euros(n: number): string {
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
}

// Ancienneté affichée en mois sous un an, en années (+ mois restants si non
// ronds) au-delà — null si pas de date d'entrée renseignée ou date future.
function anciennete(dateEntree: string | null): string | null {
  if (!dateEntree) return null
  const debut = new Date(dateEntree + 'T00:00:00')
  const maintenant = new Date()
  let mois = (maintenant.getFullYear() - debut.getFullYear()) * 12 + (maintenant.getMonth() - debut.getMonth())
  if (maintenant.getDate() < debut.getDate()) mois -= 1
  if (mois < 0) return null
  if (mois < 1) return '< 1 mois'
  if (mois < 12) return `${mois} mois`
  const ans = Math.floor(mois / 12)
  const reste = mois % 12
  return reste === 0 ? `${ans} an${ans > 1 ? 's' : ''}` : `${ans} an${ans > 1 ? 's' : ''} ${reste} mois`
}

interface MissionLite { id: string; titre: string; statut: MissionStatus; responsable_id: string | null }
interface ProjectLite { id: string; titre: string; statut: ProjectStatus; responsable_id: string | null }
interface TaskLite { id: string; statut: string; responsable_id: string | null }

interface CollaborateursManagerProps {
  collaborateurs: Collaborateur[]
  resources: Resource[]
  assignments: ResourceAssignment[]
  missions: MissionLite[]
  projects: ProjectLite[]
  tasks: TaskLite[]
  unavailabilities: CollaborateurUnavailability[]
}

export function CollaborateursManager({
  collaborateurs, resources, assignments, missions, projects, tasks, unavailabilities,
}: CollaborateursManagerProps) {
  const router = useRouter()
  const supabase = createClient()

  const [nom, setNom] = useState('')
  const [role, setRole] = useState('')
  const [email, setEmail] = useState('')
  const [telephone, setTelephone] = useState('')
  const [couleur, setCouleur] = useState(COULEURS[0])
  const [adding, setAdding] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [notesOuvertes, setNotesOuvertes] = useState<string | null>(null)

  // Calendrier de disponibilité (par collaborateur déplié) — même mécanique
  // que le module Ressources (resource-calendar.tsx, réutilisé tel quel).
  const [calendarFor, setCalendarFor] = useState<string | null>(null)
  const [filtresMotif, setFiltresMotif] = useState<Set<ResourceUnavailabilityMotif>>(new Set(TOUS_MOTIFS))
  const [indispDebut, setIndispDebut] = useState('')
  const [indispFin, setIndispFin] = useState('')
  const [indispMotif, setIndispMotif] = useState<ResourceUnavailabilityMotif>('absent')
  const [indispNote, setIndispNote] = useState('')
  const [addingIndisp, setAddingIndisp] = useState(false)

  const assignmentsByResource = useMemo(() => {
    const m = new Map<string, ResourceAssignment[]>()
    for (const a of assignments) {
      const arr = m.get(a.resource_id)
      if (arr) arr.push(a); else m.set(a.resource_id, [a])
    }
    return m
  }, [assignments])

  const resourceById = useMemo(() => new Map(resources.map((r) => [r.id, r])), [resources])

  // Ressources sélectionnables pour un collaborateur donné : celles pas
  // encore liées à un AUTRE collaborateur (une ressource liée à ce
  // collaborateur-ci reste proposée, pour ne pas la faire disparaître du
  // select tant qu'on ne change pas explicitement).
  const dejaLiees = useMemo(
    () => new Set(collaborateurs.filter((c) => c.resource_id).map((c) => c.resource_id as string)),
    [collaborateurs]
  )

  const missionsByResp = useMemo(() => {
    const m = new Map<string, MissionLite[]>()
    for (const x of missions) {
      if (!x.responsable_id) continue
      const arr = m.get(x.responsable_id)
      if (arr) arr.push(x); else m.set(x.responsable_id, [x])
    }
    return m
  }, [missions])

  const projectsByResp = useMemo(() => {
    const m = new Map<string, ProjectLite[]>()
    for (const x of projects) {
      if (!x.responsable_id) continue
      const arr = m.get(x.responsable_id)
      if (arr) arr.push(x); else m.set(x.responsable_id, [x])
    }
    return m
  }, [projects])

  const tachesEnCoursByResp = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of tasks) {
      if (!t.responsable_id || t.statut === 'fait') continue
      m.set(t.responsable_id, (m.get(t.responsable_id) ?? 0) + 1)
    }
    return m
  }, [tasks])

  // Actifs d'abord, puis inactifs — plutôt qu'un ordre alphabétique qui les
  // mélangerait avec les collaborateurs en activité.
  const collaborateursTries = useMemo(
    () => [...collaborateurs].sort((a, b) => Number(b.actif) - Number(a.actif)),
    [collaborateurs]
  )

  const unavailabilitiesByCollaborateur = useMemo(() => {
    const m = new Map<string, CollaborateurUnavailability[]>()
    for (const u of unavailabilities) {
      const arr = m.get(u.collaborateur_id)
      if (arr) arr.push(u); else m.set(u.collaborateur_id, [u])
    }
    for (const arr of Array.from(m.values())) arr.sort((a, b) => b.date_debut.localeCompare(a.date_debut))
    return m
  }, [unavailabilities])

  function toggleFiltreMotif(motif: ResourceUnavailabilityMotif) {
    setFiltresMotif((prev) => {
      const next = new Set(prev)
      if (next.has(motif)) next.delete(motif); else next.add(motif)
      return next
    })
  }

  async function addUnavailability(collaborateurId: string) {
    if (!indispDebut || !indispFin) { toast.error('Renseignez les dates de début et de fin'); return }
    if (indispFin < indispDebut) { toast.error('La date de fin doit être après le début'); return }
    setAddingIndisp(true)
    const { error } = await supabase.from('collaborateur_unavailability').insert({
      collaborateur_id: collaborateurId,
      date_debut: indispDebut,
      date_fin: indispFin,
      motif: indispMotif,
      note: indispNote.trim() || null,
    })
    setAddingIndisp(false)
    if (error) toast.error(error.message)
    else {
      toast.success('Période ajoutée au calendrier')
      setIndispDebut(''); setIndispFin(''); setIndispMotif('absent'); setIndispNote('')
      router.refresh()
    }
  }

  async function removeUnavailability(id: string) {
    const { error } = await supabase.from('collaborateur_unavailability').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('Période supprimée'); router.refresh() }
  }

  async function addCollaborateur(e: React.FormEvent) {
    e.preventDefault()
    if (!nom.trim()) return
    setAdding(true)
    const { error } = await supabase.from('collaborateurs').insert({
      nom: nom.trim(), role: role.trim() || null, email: email.trim() || null,
      telephone: telephone.trim() || null, couleur,
    })
    setAdding(false)
    if (error) toast.error(error.message)
    else {
      toast.success('Collaborateur ajouté')
      setNom(''); setRole(''); setEmail(''); setTelephone(''); setCouleur(COULEURS[0])
      router.refresh()
    }
  }

  async function update(id: string, field: string, value: string | number | boolean | string[] | null) {
    const { error } = await supabase.from('collaborateurs').update({ [field]: value }).eq('id', id)
    if (error) toast.error(error.message); else router.refresh()
  }

  async function remove(id: string) {
    const { error } = await supabase.from('collaborateurs').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('Collaborateur supprimé'); router.refresh() }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4 text-blue-500" />
          Collaborateurs ({collaborateurs.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {collaborateurs.length === 0 && (
          <p className="text-sm text-gray-400 py-4 text-center">
            Aucun collaborateur. Ajoutez toute personne pouvant être responsable d&apos;une
            mission, d&apos;un projet ou d&apos;une tâche — qu&apos;elle soit affectée à un projet
            en cours ou non.
          </p>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {collaborateursTries.map((c) => {
            const res = c.resource_id ? resourceById.get(c.resource_id) : null
            const affs = res ? (assignmentsByResource.get(res.id) ?? []) : []
            const totalHeures = affs.reduce((s, a) => s + (a.heures || 0), 0)
            const totalBudget = affs.reduce((s, a) => s + (a.budget || 0), 0)
            const coutEstime = res ? totalHeures * (res.cout_horaire || 0) + totalBudget : 0
            const missionsActives = (missionsByResp.get(c.id) ?? []).filter((m) => m.statut !== 'terminee' && m.statut !== 'annulee')
            const projetsActifs = (projectsByResp.get(c.id) ?? []).filter((p) => p.statut !== 'termine' && p.statut !== 'annule')
            const tachesEnCours = tachesEnCoursByResp.get(c.id) ?? 0
            const sansParticipation = missionsActives.length === 0 && projetsActifs.length === 0 && tachesEnCours === 0
            const resourcesSelectionnables = resources.filter((r) => r.id === c.resource_id || !dejaLiees.has(r.id))
            const anc = anciennete(c.date_entree)

            return (
              <div key={c.id} className={`rounded-xl border p-4 space-y-3 group ${c.actif ? '' : 'opacity-60 bg-gray-50/50'}`}>
                <div className="flex items-start gap-3">
                  <AvatarCollaborateur
                    collaborateurId={c.id} nom={c.nom} couleur={c.couleur} photoUrl={c.photo_url}
                    taille="lg" editable
                  />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Input className="h-7 w-36 font-semibold px-1.5" defaultValue={c.nom}
                        onBlur={(e) => e.target.value.trim() && e.target.value !== c.nom && update(c.id, 'nom', e.target.value.trim())} />
                      {c.code_collaborateur && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 shrink-0">
                          {c.code_collaborateur}
                        </span>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => remove(c.id)}
                        className="ml-auto h-7 w-7 p-0 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    <Input className="h-7 text-xs px-1.5 w-44" placeholder="Rôle (optionnel)" defaultValue={c.role ?? ''}
                      onBlur={(e) => e.target.value.trim() !== (c.role ?? '') && update(c.id, 'role', e.target.value.trim() || null)} />

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Select value={c.type_contrat ?? NONE} onValueChange={(v) => update(c.id, 'type_contrat', v === NONE ? null : v)}>
                        <SelectTrigger className="h-6 w-auto gap-1 border-none bg-transparent px-0 shadow-none [&>svg]:h-3 [&>svg]:w-3">
                          <SelectValue>
                            {(v: string) => v === NONE ? (
                              <span className="text-[11px] text-gray-300">— contrat —</span>
                            ) : (
                              <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${CONTRAT_STYLE[v as ContratType]}`}>{v}</span>
                            )}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>— Non renseigné —</SelectItem>
                          {TYPES_CONTRAT.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Input type="date" title="Date d'entrée"
                        className="h-6 w-[118px] border-none bg-transparent px-1 text-[11px] text-gray-400 shadow-none"
                        defaultValue={c.date_entree ?? ''}
                        onChange={(e) => update(c.id, 'date_entree', e.target.value || null)} />
                      {anc && (
                        <span className="flex items-center gap-1 text-[11px] text-gray-400" title="Ancienneté">
                          <CalendarClock className="h-3 w-3" />
                          {anc}
                        </span>
                      )}
                      <label className="flex items-center gap-1.5 text-[11px] text-gray-500 ml-auto cursor-pointer">
                        <input type="checkbox" checked={c.actif} onChange={(e) => update(c.id, 'actif', e.target.checked)}
                          className="h-3.5 w-3.5 rounded border-gray-300" />
                        Actif
                      </label>
                    </div>
                  </div>
                </div>

                <CompetencesTags competences={c.competences} onChange={(next) => update(c.id, 'competences', next)} />

                {/* Charge de travail actuelle */}
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  {sansParticipation ? (
                    <span className="text-gray-400">Ne participe à aucun projet/mission en cours actuellement.</span>
                  ) : (
                    <button onClick={() => setExpanded(expanded === c.id ? null : c.id)} className="flex items-center gap-2 flex-wrap hover:opacity-80">
                      {missionsActives.length > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">
                          {missionsActives.length} mission{missionsActives.length > 1 ? 's' : ''} active{missionsActives.length > 1 ? 's' : ''}
                        </span>
                      )}
                      {projetsActifs.length > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-[#EEEBFA] text-[#534AB7] font-medium">
                          {projetsActifs.length} projet{projetsActifs.length > 1 ? 's' : ''} actif{projetsActifs.length > 1 ? 's' : ''}
                        </span>
                      )}
                      {tachesEnCours > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">
                          {tachesEnCours} tâche{tachesEnCours > 1 ? 's' : ''} en cours
                        </span>
                      )}
                    </button>
                  )}
                </div>
                {expanded === c.id && !sansParticipation && (
                  <div className="space-y-1 text-xs text-gray-600">
                    {missionsActives.map((m) => (
                      <Link key={m.id} href={`/missions/${m.id}`} className="block hover:underline">→ {m.titre}</Link>
                    ))}
                    {projetsActifs.map((p) => (
                      <Link key={p.id} href={`/projets/${p.id}`} className="block hover:underline">→ {p.titre}</Link>
                    ))}
                  </div>
                )}

                {/* Contact */}
                <div className="flex items-center gap-2 flex-wrap pt-2 border-t">
                  <Mail className="h-3 w-3 text-gray-300 shrink-0" />
                  <Input type="email" className="h-7 text-xs flex-1 min-w-[130px]" placeholder="email (optionnel)" defaultValue={c.email ?? ''}
                    onBlur={(e) => e.target.value.trim() !== (c.email ?? '') && update(c.id, 'email', e.target.value.trim() || null)} />
                  <Phone className="h-3 w-3 text-gray-300 shrink-0" />
                  <Input type="tel" className="h-7 text-xs w-32" placeholder="téléphone" defaultValue={c.telephone ?? ''}
                    onBlur={(e) => e.target.value.trim() !== (c.telephone ?? '') && update(c.id, 'telephone', e.target.value.trim() || null)} />
                  <button
                    onClick={() => setNotesOuvertes(notesOuvertes === c.id ? null : c.id)}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-[#534AB7]"
                    title="Notes (spécialité, disponibilité…)"
                  >
                    <StickyNote className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setCalendarFor(calendarFor === c.id ? null : c.id)}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-[#534AB7]"
                    title="Calendrier de disponibilité (congés, arrêts maladie…)"
                  >
                    <CalendarDays className="h-3.5 w-3.5" />
                    {(unavailabilitiesByCollaborateur.get(c.id) ?? []).length > 0 && (
                      <span>({(unavailabilitiesByCollaborateur.get(c.id) ?? []).length})</span>
                    )}
                  </button>
                </div>
                {notesOuvertes === c.id && (
                  <Input className="h-8 text-xs w-full" placeholder="Spécialité, disponibilité, remarque…"
                    defaultValue={c.notes ?? ''}
                    onBlur={(e) => e.target.value.trim() !== (c.notes ?? '') && update(c.id, 'notes', e.target.value.trim() || null)} />
                )}

                {/* Calendrier de disponibilité — congés, arrêts maladie, absences */}
                {calendarFor === c.id && (() => {
                  const indisps = unavailabilitiesByCollaborateur.get(c.id) ?? []
                  const indispsFiltrees = indisps.filter((u) => filtresMotif.has(u.motif))
                  return (
                    <div className="pt-2 border-t space-y-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {(Object.keys(MOTIF_LABEL) as ResourceUnavailabilityMotif[]).map((m) => {
                          const actif = filtresMotif.has(m)
                          return (
                            <button
                              key={m}
                              onClick={() => toggleFiltreMotif(m)}
                              className="text-[11px] px-2 py-0.5 rounded-full border transition-opacity"
                              style={{
                                background: actif ? MOTIF_COLOR[m] : 'transparent',
                                color: actif ? '#fff' : MOTIF_COLOR[m],
                                borderColor: MOTIF_COLOR[m],
                                opacity: actif ? 1 : 0.6,
                              }}
                            >
                              {MOTIF_LABEL[m]}
                            </button>
                          )
                        })}
                      </div>

                      <div className="flex items-start gap-4 flex-wrap">
                        <ResourceCalendar unavailabilities={indisps} filtres={filtresMotif} />

                        <div className="flex-1 min-w-[220px] space-y-2">
                          <div className="flex items-end gap-2 flex-wrap">
                            <div className="w-32">
                              <label className="text-xs text-gray-500">Début</label>
                              <Input type="date" className="h-8 text-xs" value={indispDebut}
                                onChange={(e) => setIndispDebut(e.target.value)} />
                            </div>
                            <div className="w-32">
                              <label className="text-xs text-gray-500">Fin</label>
                              <Input type="date" className="h-8 text-xs" value={indispFin}
                                onChange={(e) => setIndispFin(e.target.value)} />
                            </div>
                            <div className="w-28">
                              <label className="text-xs text-gray-500">Motif</label>
                              <Select value={indispMotif} onValueChange={(v) => setIndispMotif((v as ResourceUnavailabilityMotif) ?? 'absent')}>
                                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {(Object.keys(MOTIF_LABEL) as ResourceUnavailabilityMotif[]).map((m) => (
                                    <SelectItem key={m} value={m}>{MOTIF_LABEL[m]}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <Button size="sm" className="h-8" disabled={addingIndisp} onClick={() => addUnavailability(c.id)}>
                              Ajouter
                            </Button>
                          </div>
                          <Input value={indispNote} onChange={(e) => setIndispNote(e.target.value)}
                            placeholder="Note (optionnel)" className="h-8 text-xs max-w-xs" />

                          {indispsFiltrees.length > 0 ? (
                            <div className="space-y-1 pt-1">
                              {indispsFiltrees.map((u) => (
                                <div key={u.id} className="flex items-center gap-2 text-xs text-gray-600 group/indisp">
                                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: MOTIF_COLOR[u.motif] }} />
                                  <span className="font-medium" style={{ color: MOTIF_COLOR[u.motif] }}>{MOTIF_LABEL[u.motif]}</span>
                                  <span>{fmtCourt(u.date_debut)} → {fmtCourt(u.date_fin)}</span>
                                  {u.note && <span className="text-gray-400 truncate">— {u.note}</span>}
                                  <Button variant="ghost" size="sm" onClick={() => removeUnavailability(u.id)}
                                    className="ml-auto h-5 w-5 p-0 text-red-400 hover:text-red-600 opacity-0 group-hover/indisp:opacity-100">
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-gray-400 pt-1">
                              {indisps.length === 0 ? 'Aucune période renseignée.' : 'Aucune période pour les motifs sélectionnés.'}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })()}

                {/* Coût + lien vers une ressource facturable */}
                <div className="flex items-center gap-2 flex-wrap pt-2 border-t text-xs">
                  <span className="text-gray-400">Coût</span>
                  <Input
                    type="number" min="0" step="1" className="h-7 w-16 text-xs text-right"
                    key={`cout-${c.id}-${c.cout_horaire}`}
                    defaultValue={c.cout_horaire}
                    onBlur={(e) => {
                      const v = Math.max(0, parseFloat(e.target.value) || 0)
                      if (v !== c.cout_horaire) update(c.id, 'cout_horaire', v)
                    }}
                  />
                  <span className="text-gray-400">€/h</span>
                  <div className="ml-auto flex items-center gap-1.5">
                    {res ? <Link2 className="h-3 w-3 text-gray-400 shrink-0" /> : <Unlink className="h-3 w-3 text-gray-300 shrink-0" />}
                    <Select
                      value={c.resource_id ?? NONE}
                      onValueChange={(v) => update(c.id, 'resource_id', v === NONE ? null : v)}
                    >
                      <SelectTrigger className="h-7 text-xs w-44">
                        <SelectValue placeholder="Aucune ressource liée">
                          {(v: string) => v === NONE ? 'Aucune ressource liée' : resourceById.get(v)?.nom ?? 'Ressource'}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>— Aucune ressource liée —</SelectItem>
                        {resourcesSelectionnables.map((r) => (
                          <SelectItem key={r.id} value={r.id}>{r.nom}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {res && (totalHeures > 0 || coutEstime > 0) && (
                  <p className="text-[11px] text-gray-400 text-right">
                    {totalHeures > 0 && `${totalHeures} h`}
                    {coutEstime > 0 && ` · ${euros(coutEstime)} facturé`}
                  </p>
                )}
              </div>
            )
          })}
        </div>

        <form onSubmit={addCollaborateur} className="flex flex-wrap items-end gap-2 pt-3 border-t">
          <div className="flex-1 min-w-[160px]">
            <label className="text-xs text-gray-500">Nouveau collaborateur</label>
            <Input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom" className="h-9" />
          </div>
          <div className="w-36">
            <label className="text-xs text-gray-500">Rôle (optionnel)</label>
            <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="ex: Chef de projet" className="h-9 text-xs" />
          </div>
          <div className="w-48">
            <label className="text-xs text-gray-500">Email (optionnel)</label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemple.com" className="h-9 text-xs" />
          </div>
          <div className="w-36">
            <label className="text-xs text-gray-500">Téléphone (optionnel)</label>
            <Input type="tel" value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="+33 6 00 00 00 00" className="h-9 text-xs" />
          </div>
          <div className="flex gap-1 pb-2">
            {COULEURS.map((col) => (
              <button key={col} type="button" onClick={() => setCouleur(col)}
                className={`w-6 h-6 rounded-full border-2 ${couleur === col ? 'border-gray-800' : 'border-transparent'}`}
                style={{ background: col }} />
            ))}
          </div>
          <Button type="submit" size="sm" disabled={adding || !nom.trim()} className="h-9">
            <Plus className="h-4 w-4 mr-1" />
            Ajouter
          </Button>
        </form>
        <p className="text-[11px] text-gray-400">
          Contrat, date d&apos;entrée, coût horaire, compétences et photo se renseignent directement sur la fiche une fois le collaborateur créé.
        </p>
      </CardContent>
    </Card>
  )
}
