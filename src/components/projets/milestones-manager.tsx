'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { ProjectMilestone, MilestoneStatus, Collaborateur, CollaborateurUnavailability } from '@/lib/types'
import { indisponibiliteChevauchante } from '@/lib/surveillance'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Plus, Trash2, Flag, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { MOTIF_LABEL } from '@/components/ressources/resource-calendar'

const statutLabel: Record<MilestoneStatus, string> = {
  a_faire: 'À faire', atteint: 'Atteint', en_retard: 'En retard',
}

const NONE = '__none__'

function fmtCourt(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

interface MilestonesManagerProps {
  projectId: string
  milestones: ProjectMilestone[]
  collaborateurs?: Collaborateur[]
  // Garde-fou NON bloquant (voir TasksManager) : avertit sans empêcher
  // d'assigner un jalon à un collaborateur en congé/absence sur son échéance.
  unavailabilities?: CollaborateurUnavailability[]
}

export function MilestonesManager({
  projectId, milestones, collaborateurs = [], unavailabilities = [],
}: MilestonesManagerProps) {
  const router = useRouter()
  const supabase = createClient()
  const [titre, setTitre] = useState('')
  const [date, setDate] = useState('')
  const [responsableId, setResponsableId] = useState(NONE)
  const [adding, setAdding] = useState(false)

  const collabById = Object.fromEntries(collaborateurs.map((c) => [c.id, c]))

  const unavailabilitiesByCollaborateur = useMemo(() => {
    const m = new Map<string, CollaborateurUnavailability[]>()
    for (const u of unavailabilities) {
      const arr = m.get(u.collaborateur_id)
      if (arr) arr.push(u); else m.set(u.collaborateur_id, [u])
    }
    return m
  }, [unavailabilities])

  const indispoParJalon = useMemo(() => {
    const m = new Map<string, CollaborateurUnavailability>()
    for (const j of milestones) {
      if (!j.responsable_id || !j.date_echeance) continue
      const u = indisponibiliteChevauchante(j.date_echeance, j.date_echeance, unavailabilitiesByCollaborateur.get(j.responsable_id) ?? [])
      if (u) m.set(j.id, u)
    }
    return m
  }, [milestones, unavailabilitiesByCollaborateur])

  function avertirSiIndisponible(id: string, champModifie: string, nouvelleValeur: string | null) {
    const j = milestones.find((x) => x.id === id)
    if (!j) return
    const respId = champModifie === 'responsable_id' ? nouvelleValeur : j.responsable_id
    const echeance = champModifie === 'date_echeance' ? nouvelleValeur : j.date_echeance
    if (!respId || !echeance) return
    const conflit = indisponibiliteChevauchante(echeance, echeance, unavailabilitiesByCollaborateur.get(respId) ?? [])
    if (!conflit) return
    const nom = collabById[respId]?.nom ?? 'Ce collaborateur'
    toast.warning(
      `⚠ ${nom} est ${MOTIF_LABEL[conflit.motif].toLowerCase()} du ${fmtCourt(conflit.date_debut)} au ${fmtCourt(conflit.date_fin)} — jalon quand même assigné.`
    )
  }

  async function addMilestone(e: React.FormEvent) {
    e.preventDefault()
    if (!titre.trim()) return
    setAdding(true)
    const { error } = await supabase.from('project_milestones').insert({
      project_id: projectId, titre, date_echeance: date || null, ordre: milestones.length,
      responsable_id: responsableId === NONE ? null : responsableId,
    })
    if (error) toast.error(error.message)
    else {
      toast.success('Jalon ajouté')
      setTitre(''); setDate(''); setResponsableId(NONE)
      router.refresh()
    }
    setAdding(false)
  }

  async function update(id: string, field: string, value: string | null) {
    const { error } = await supabase.from('project_milestones').update({ [field]: value }).eq('id', id)
    if (error) { toast.error(error.message); return }
    if (field === 'responsable_id' || field === 'date_echeance') avertirSiIndisponible(id, field, value)
    router.refresh()
  }

  async function remove(id: string) {
    const { error } = await supabase.from('project_milestones').delete().eq('id', id)
    if (error) toast.error(error.message); else { toast.success('Jalon supprimé'); router.refresh() }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Flag className="h-4 w-4 text-amber-500" />
          Jalons / livrables ({milestones.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="overflow-x-auto">
          <div className="min-w-[620px] space-y-2">
            {milestones.map((m) => {
              const conflit = indispoParJalon.get(m.id)
              return (
                <div key={m.id} className="space-y-1 group">
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <Input className="col-span-4 h-9" defaultValue={m.titre}
                      onBlur={(e) => e.target.value !== m.titre && update(m.id, 'titre', e.target.value)} />
                    <Input type="date" className="col-span-2 h-9" defaultValue={m.date_echeance ?? ''}
                      onChange={(e) => update(m.id, 'date_echeance', e.target.value || null)} />
                    <div className="col-span-3 min-w-0">
                      <Select value={m.responsable_id ?? NONE}
                        onValueChange={(v) => update(m.id, 'responsable_id', v === NONE ? null : v)}>
                        <SelectTrigger className="h-9 w-full min-w-0 text-xs">
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
                    <div className="col-span-2">
                      <Select value={m.statut} onValueChange={(v) => update(m.id, 'statut', v)}>
                        <SelectTrigger className="h-9">
                          <SelectValue>{(v: string) => statutLabel[v as MilestoneStatus] ?? v}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(statutLabel) as MilestoneStatus[]).map((s) => (
                            <SelectItem key={s} value={s}>{statutLabel[s]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button variant="ghost" size="sm"
                      onClick={() => remove(m.id)}
                      className="col-span-1 h-9 w-9 p-0 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  {conflit && (
                    <p className="text-xs text-red-600 flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      {collabById[m.responsable_id!]?.nom} est {MOTIF_LABEL[conflit.motif].toLowerCase()} du {fmtCourt(conflit.date_debut)} au {fmtCourt(conflit.date_fin)} — jalon quand même assigné
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
        <form onSubmit={addMilestone} className="flex flex-wrap gap-2 pt-2 border-t">
          <Input value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Nouveau jalon (ex: Livraison V1)" className="h-9 flex-1 min-w-[180px]" />
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 w-[150px]" />
          <div className="w-44">
            <Select value={responsableId} onValueChange={(v) => setResponsableId(v ?? NONE)}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Responsable (optionnel)">
                {(v: string) => (v === NONE ? 'Responsable (optionnel)' : collabById[v]?.nom ?? 'Responsable')}
              </SelectValue></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>— Non assigné —</SelectItem>
                {collaborateurs.map((c) => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" size="sm" disabled={adding || !titre.trim()}><Plus className="h-4 w-4" /></Button>
        </form>
      </CardContent>
    </Card>
  )
}
