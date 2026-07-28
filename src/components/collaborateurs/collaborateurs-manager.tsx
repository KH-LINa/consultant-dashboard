'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type {
  Collaborateur, Resource, ResourceAssignment, MissionStatus, ProjectStatus,
} from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Plus, Trash2, Users, Link2, Unlink } from 'lucide-react'
import { toast } from 'sonner'

const COULEURS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#06b6d4', '#ec4899', '#64748b']
const NONE = '__none__'

function euros(n: number): string {
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
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
}

export function CollaborateursManager({
  collaborateurs, resources, assignments, missions, projects, tasks,
}: CollaborateursManagerProps) {
  const router = useRouter()
  const supabase = createClient()

  const [nom, setNom] = useState('')
  const [role, setRole] = useState('')
  const [email, setEmail] = useState('')
  const [couleur, setCouleur] = useState(COULEURS[0])
  const [adding, setAdding] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

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

  async function addCollaborateur(e: React.FormEvent) {
    e.preventDefault()
    if (!nom.trim()) return
    setAdding(true)
    const { error } = await supabase.from('collaborateurs').insert({
      nom: nom.trim(), role: role.trim() || null, email: email.trim() || null, couleur,
    })
    setAdding(false)
    if (error) toast.error(error.message)
    else {
      toast.success('Collaborateur ajouté')
      setNom(''); setRole(''); setEmail(''); setCouleur(COULEURS[0])
      router.refresh()
    }
  }

  async function update(id: string, field: string, value: string | null) {
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
      <CardContent className="space-y-3">
        {collaborateurs.length === 0 && (
          <p className="text-sm text-gray-400 py-4 text-center">
            Aucun collaborateur. Ajoutez toute personne pouvant être responsable d&apos;une
            mission, d&apos;un projet ou d&apos;une tâche — qu&apos;elle soit affectée à un projet
            en cours ou non.
          </p>
        )}

        {collaborateurs.map((c) => {
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

          return (
            <div key={c.id} className="border rounded-lg p-3 space-y-2 group">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ background: c.couleur }} />
                <Input className="h-8 w-44 font-medium" defaultValue={c.nom}
                  onBlur={(e) => e.target.value.trim() && e.target.value !== c.nom && update(c.id, 'nom', e.target.value.trim())} />
                <Input className="h-8 w-36 text-xs" placeholder="Rôle (optionnel)" defaultValue={c.role ?? ''}
                  onBlur={(e) => e.target.value.trim() !== (c.role ?? '') && update(c.id, 'role', e.target.value.trim() || null)} />
                <Input type="email" className="h-8 w-48 text-xs" placeholder="email (optionnel)" defaultValue={c.email ?? ''}
                  onBlur={(e) => e.target.value.trim() !== (c.email ?? '') && update(c.id, 'email', e.target.value.trim() || null)} />
                <div className="flex gap-1">
                  {COULEURS.map((col) => (
                    <button key={col} type="button" onClick={() => update(c.id, 'couleur', col)}
                      className={`w-4 h-4 rounded-full border-2 ${c.couleur === col ? 'border-gray-800' : 'border-transparent'}`}
                      style={{ background: col }} />
                  ))}
                </div>
                <Button variant="ghost" size="sm" onClick={() => remove(c.id)}
                  className="ml-auto h-8 w-8 p-0 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              {/* Charge de travail actuelle */}
              <div className="pl-5 flex items-center gap-2 flex-wrap text-xs">
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
                <div className="pl-5 space-y-1 text-xs text-gray-600">
                  {missionsActives.map((m) => (
                    <Link key={m.id} href={`/missions/${m.id}`} className="block hover:underline">→ {m.titre}</Link>
                  ))}
                  {projetsActifs.map((p) => (
                    <Link key={p.id} href={`/projets/${p.id}`} className="block hover:underline">→ {p.titre}</Link>
                  ))}
                </div>
              )}

              {/* Lien vers une ressource facturable */}
              <div className="pl-5 flex items-center gap-2 flex-wrap">
                {res ? <Link2 className="h-3 w-3 text-gray-400 shrink-0" /> : <Unlink className="h-3 w-3 text-gray-300 shrink-0" />}
                <Select
                  value={c.resource_id ?? NONE}
                  onValueChange={(v) => update(c.id, 'resource_id', v === NONE ? null : v)}
                >
                  <SelectTrigger className="h-7 text-xs w-56">
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
                {res && (
                  <span className="text-xs text-gray-500">
                    {res.cout_horaire > 0 && `${res.cout_horaire} €/h`}
                    {totalHeures > 0 && ` · ${totalHeures} h`}
                    {coutEstime > 0 && ` · ${euros(coutEstime)} facturé`}
                  </span>
                )}
              </div>
            </div>
          )
        })}

        <form onSubmit={addCollaborateur} className="flex flex-wrap items-end gap-2 pt-3 border-t">
          <div className="flex-1 min-w-[160px]">
            <label className="text-xs text-gray-500">Nouveau collaborateur</label>
            <Input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom" className="h-9" />
          </div>
          <div className="w-40">
            <label className="text-xs text-gray-500">Rôle (optionnel)</label>
            <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="ex: Chef de projet" className="h-9 text-xs" />
          </div>
          <div className="w-52">
            <label className="text-xs text-gray-500">Email (optionnel)</label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemple.com" className="h-9 text-xs" />
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
      </CardContent>
    </Card>
  )
}
