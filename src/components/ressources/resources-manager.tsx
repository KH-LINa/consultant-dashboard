'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type {
  Resource, ResourceAssignment, ResourceType, ResourceUnavailability, ResourceUnavailabilityMotif,
} from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Plus, Trash2, User, Wrench, HardHat, Link2, CalendarDays } from 'lucide-react'
import { toast } from 'sonner'
import { ResourceCalendar, MOTIF_LABEL, MOTIF_COLOR } from '@/components/ressources/resource-calendar'

const TYPE_LABEL: Record<ResourceType, string> = { humain: 'Humain', materiel: 'Matériel' }
const NONE = '__none__'
const TOUS_MOTIFS = new Set<ResourceUnavailabilityMotif>(['absent', 'conge', 'maladie', 'autre'])

function fmtCourt(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

function euros(n: number): string {
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
}

interface ResourcesManagerProps {
  resources: Resource[]
  assignments: ResourceAssignment[]
  projects: { id: string; titre: string }[]
  unavailabilities: ResourceUnavailability[]
}

export function ResourcesManager({ resources, assignments, projects, unavailabilities }: ResourcesManagerProps) {
  const router = useRouter()
  const supabase = createClient()

  // Formulaire nouvelle ressource
  const [nom, setNom] = useState('')
  const [type, setType] = useState<ResourceType>('humain')
  const [coutHoraire, setCoutHoraire] = useState('')
  const [email, setEmail] = useState('')
  const [adding, setAdding] = useState(false)

  // Formulaire d'affectation (par ressource dépliée)
  const [affectFor, setAffectFor] = useState<string | null>(null)
  const [affectProject, setAffectProject] = useState(NONE)
  const [affectHeures, setAffectHeures] = useState('')
  const [affectBudget, setAffectBudget] = useState('')
  const [affecting, setAffecting] = useState(false)

  // Calendrier de disponibilité (par ressource dépliée)
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

  const unavailabilitiesByResource = useMemo(() => {
    const m = new Map<string, ResourceUnavailability[]>()
    for (const u of unavailabilities) {
      const arr = m.get(u.resource_id)
      if (arr) arr.push(u); else m.set(u.resource_id, [u])
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

  async function addUnavailability(resourceId: string) {
    if (!indispDebut || !indispFin) { toast.error('Renseignez les dates de début et de fin'); return }
    if (indispFin < indispDebut) { toast.error('La date de fin doit être après le début'); return }
    setAddingIndisp(true)
    const { error } = await supabase.from('resource_unavailability').insert({
      resource_id: resourceId,
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
    const { error } = await supabase.from('resource_unavailability').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('Période supprimée'); router.refresh() }
  }

  async function addResource(e: React.FormEvent) {
    e.preventDefault()
    if (!nom.trim()) return
    setAdding(true)
    const { error } = await supabase.from('resources').insert({
      nom: nom.trim(),
      type,
      cout_horaire: parseFloat(coutHoraire) || 0,
      email: type === 'humain' && email.trim() ? email.trim() : null,
    })
    setAdding(false)
    if (error) toast.error(error.message)
    else { toast.success('Ressource ajoutée'); setNom(''); setCoutHoraire(''); setEmail(''); router.refresh() }
  }

  async function updateResource(id: string, field: string, value: string | number | null) {
    const { error } = await supabase.from('resources').update({ [field]: value }).eq('id', id)
    if (error) toast.error(error.message); else router.refresh()
  }

  async function removeResource(id: string) {
    const { error } = await supabase.from('resources').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('Ressource supprimée (et ses affectations)'); router.refresh() }
  }

  async function addAssignment(resourceId: string) {
    if (affectProject === NONE) { toast.error('Sélectionnez un projet'); return }
    const heures = parseFloat(affectHeures) || 0
    const budget = parseFloat(affectBudget) || 0
    if (heures <= 0 && budget <= 0) { toast.error('Indiquez des heures et/ou un budget'); return }
    setAffecting(true)
    const { error } = await supabase.from('resource_assignments').insert({
      resource_id: resourceId,
      project_id: affectProject,
      heures,
      budget,
    })
    setAffecting(false)
    if (error) toast.error(error.message)
    else {
      toast.success('Affectation ajoutée')
      setAffectHeures(''); setAffectBudget(''); setAffectProject(NONE); setAffectFor(null)
      router.refresh()
    }
  }

  async function removeAssignment(id: string) {
    const { error } = await supabase.from('resource_assignments').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('Affectation supprimée'); router.refresh() }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <HardHat className="h-4 w-4 text-[#534AB7]" />
          Ressources ({resources.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {resources.length === 0 && (
          <p className="text-sm text-gray-400 py-4 text-center">
            Aucune ressource. Ajoutez un intervenant, une machine, une licence…
          </p>
        )}

        {resources.map((r) => {
          const affs = assignmentsByResource.get(r.id) ?? []
          const totalHeures = affs.reduce((s, a) => s + (a.heures || 0), 0)
          const totalBudget = affs.reduce((s, a) => s + (a.budget || 0), 0)
          const coutEstime = totalHeures * (r.cout_horaire || 0) + totalBudget
          const indisps = unavailabilitiesByResource.get(r.id) ?? []
          const indispsFiltrees = indisps.filter((u) => filtresMotif.has(u.motif))
          return (
            <div key={r.id} className="border rounded-lg p-3 space-y-2 group">
              <div className="flex items-center gap-2 flex-wrap">
                {r.type === 'humain'
                  ? <User className="h-4 w-4 shrink-0 text-blue-500" />
                  : <Wrench className="h-4 w-4 shrink-0 text-gray-500" />}
                <Input className="h-8 w-56 font-medium" defaultValue={r.nom}
                  onBlur={(e) => e.target.value.trim() && e.target.value !== r.nom && updateResource(r.id, 'nom', e.target.value.trim())} />
                <Select value={r.type} onValueChange={(v) => updateResource(r.id, 'type', v ?? r.type)}>
                  <SelectTrigger className="h-8 text-xs w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TYPE_LABEL) as ResourceType[]).map((t) => (
                      <SelectItem key={t} value={t}>{TYPE_LABEL[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-1">
                  <Input type="number" min="0" step="0.01" className="h-8 w-24 text-xs text-right"
                    key={`ch-${r.id}-${r.cout_horaire}`}
                    defaultValue={r.cout_horaire || ''}
                    placeholder="0"
                    onBlur={(e) => {
                      const v = parseFloat(e.target.value) || 0
                      if (v !== r.cout_horaire) updateResource(r.id, 'cout_horaire', v)
                    }} />
                  <span className="text-xs text-gray-400">€/h</span>
                </div>
                {r.type === 'humain' && (
                  <Input type="email" className="h-8 w-48 text-xs" placeholder="email (pour invitation)"
                    key={`email-${r.id}-${r.email}`}
                    defaultValue={r.email ?? ''}
                    onBlur={(e) => {
                      const v = e.target.value.trim()
                      if (v !== (r.email ?? '')) updateResource(r.id, 'email', v || null)
                    }} />
                )}
                <div className="ml-auto flex items-center gap-3 text-xs text-gray-500">
                  {totalHeures > 0 && <span>{totalHeures} h</span>}
                  {coutEstime > 0 && <span className="font-medium text-[#534AB7]">{euros(coutEstime)}</span>}
                  <Button variant="ghost" size="sm" onClick={() => removeResource(r.id)}
                    className="h-8 w-8 p-0 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Affectations existantes */}
              {affs.length > 0 && (
                <div className="space-y-1 pl-6">
                  {affs.map((a) => (
                    <div key={a.id} className="flex items-center gap-2 text-sm text-gray-600 group/aff">
                      <Link2 className="h-3 w-3 text-gray-400 shrink-0" />
                      <span className="font-medium">{a.project?.titre ?? 'Projet supprimé'}</span>
                      {a.task?.titre && <span className="text-gray-400">→ {a.task.titre}</span>}
                      <span className="ml-auto flex items-center gap-3 text-xs">
                        {a.heures > 0 && <span>{a.heures} h</span>}
                        {a.budget > 0 && <span>{euros(a.budget)}</span>}
                        {a.heures > 0 && (r.cout_horaire || 0) > 0 && (
                          <span className="text-gray-400">≈ {euros(a.heures * r.cout_horaire + (a.budget || 0))}</span>
                        )}
                      </span>
                      <Button variant="ghost" size="sm" onClick={() => removeAssignment(a.id)}
                        className="h-6 w-6 p-0 text-red-400 hover:text-red-600 opacity-0 group-hover/aff:opacity-100">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Affecter à un projet */}
              {affectFor === r.id ? (
                <div className="flex items-end gap-2 pl-6 flex-wrap">
                  <div className="w-56">
                    <label className="text-xs text-gray-500">Projet</label>
                    <Select value={affectProject} onValueChange={(v) => setAffectProject(v ?? NONE)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="— Projet —" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>— Projet —</SelectItem>
                        {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.titre}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-24">
                    <label className="text-xs text-gray-500">Heures</label>
                    <Input type="number" min="0" step="0.5" className="h-8 text-xs" value={affectHeures}
                      onChange={(e) => setAffectHeures(e.target.value)} placeholder="0" />
                  </div>
                  <div className="w-28">
                    <label className="text-xs text-gray-500">Budget (€)</label>
                    <Input type="number" min="0" step="0.01" className="h-8 text-xs" value={affectBudget}
                      onChange={(e) => setAffectBudget(e.target.value)} placeholder="0" />
                  </div>
                  <Button size="sm" className="h-8" disabled={affecting} onClick={() => addAssignment(r.id)}>
                    Affecter
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8" onClick={() => setAffectFor(null)}>
                    Annuler
                  </Button>
                </div>
              ) : (
                <div className="pl-6 flex items-center gap-3">
                  <button
                    onClick={() => { setAffectFor(r.id); setAffectProject(NONE); setAffectHeures(''); setAffectBudget('') }}
                    className="text-xs text-[#534AB7] hover:underline flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" />
                    Affecter à un projet
                  </button>
                  <button
                    onClick={() => setCalendarFor(calendarFor === r.id ? null : r.id)}
                    className="text-xs text-[#534AB7] hover:underline flex items-center gap-1"
                  >
                    <CalendarDays className="h-3 w-3" />
                    Calendrier{indisps.length > 0 ? ` (${indisps.length})` : ''}
                  </button>
                </div>
              )}

              {/* Calendrier de disponibilité */}
              {calendarFor === r.id && (
                <div className="pl-6 pt-1 space-y-3">
                  {/* Filtres par motif */}
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

                    <div className="flex-1 min-w-[240px] space-y-2">
                      {/* Formulaire d'ajout */}
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
                        <Button size="sm" className="h-8" disabled={addingIndisp} onClick={() => addUnavailability(r.id)}>
                          Ajouter
                        </Button>
                      </div>
                      <Input value={indispNote} onChange={(e) => setIndispNote(e.target.value)}
                        placeholder="Note (optionnel)" className="h-8 text-xs max-w-xs" />

                      {/* Liste des périodes (filtrée) */}
                      {indispsFiltrees.length > 0 ? (
                        <div className="space-y-1 pt-1">
                          {indispsFiltrees.map((u) => (
                            <div key={u.id} className="flex items-center gap-2 text-xs text-gray-600 group/indisp">
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ background: MOTIF_COLOR[u.motif] }}
                              />
                              <span className="font-medium" style={{ color: MOTIF_COLOR[u.motif] }}>
                                {MOTIF_LABEL[u.motif]}
                              </span>
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
              )}
            </div>
          )
        })}

        {/* Nouvelle ressource */}
        <form onSubmit={addResource} className="flex flex-wrap items-end gap-2 pt-3 border-t">
          <div className="flex-1 min-w-[180px]">
            <label className="text-xs text-gray-500">Nouvelle ressource</label>
            <Input value={nom} onChange={(e) => setNom(e.target.value)}
              placeholder="ex: Sous-traitant élec, Poste à souder…" className="h-9" />
          </div>
          <div className="w-32">
            <label className="text-xs text-gray-500">Type</label>
            <Select value={type} onValueChange={(v) => setType((v as ResourceType) ?? 'humain')}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(TYPE_LABEL) as ResourceType[]).map((t) => (
                  <SelectItem key={t} value={t}>{TYPE_LABEL[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-28">
            <label className="text-xs text-gray-500">Coût (€/h)</label>
            <Input type="number" min="0" step="0.01" value={coutHoraire}
              onChange={(e) => setCoutHoraire(e.target.value)} placeholder="0" className="h-9 text-xs" />
          </div>
          {type === 'humain' && (
            <div className="w-48">
              <label className="text-xs text-gray-500">Email (pour invitation)</label>
              <Input type="email" value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder="email@exemple.com" className="h-9 text-xs" />
            </div>
          )}
          <Button type="submit" size="sm" disabled={adding || !nom.trim()} className="h-9">
            <Plus className="h-4 w-4 mr-1" />
            Ajouter
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
