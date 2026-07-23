'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Resource, ResourceAssignment, ResourceType } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Plus, Trash2, User, Wrench, HardHat, Link2 } from 'lucide-react'
import { toast } from 'sonner'

const TYPE_LABEL: Record<ResourceType, string> = { humain: 'Humain', materiel: 'Matériel' }
const NONE = '__none__'

function euros(n: number): string {
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
}

interface ResourcesManagerProps {
  resources: Resource[]
  assignments: ResourceAssignment[]
  projects: { id: string; titre: string }[]
}

export function ResourcesManager({ resources, assignments, projects }: ResourcesManagerProps) {
  const router = useRouter()
  const supabase = createClient()

  // Formulaire nouvelle ressource
  const [nom, setNom] = useState('')
  const [type, setType] = useState<ResourceType>('humain')
  const [coutHoraire, setCoutHoraire] = useState('')
  const [adding, setAdding] = useState(false)

  // Formulaire d'affectation (par ressource dépliée)
  const [affectFor, setAffectFor] = useState<string | null>(null)
  const [affectProject, setAffectProject] = useState(NONE)
  const [affectHeures, setAffectHeures] = useState('')
  const [affectBudget, setAffectBudget] = useState('')
  const [affecting, setAffecting] = useState(false)

  const assignmentsByResource = useMemo(() => {
    const m = new Map<string, ResourceAssignment[]>()
    for (const a of assignments) {
      const arr = m.get(a.resource_id)
      if (arr) arr.push(a); else m.set(a.resource_id, [a])
    }
    return m
  }, [assignments])

  async function addResource(e: React.FormEvent) {
    e.preventDefault()
    if (!nom.trim()) return
    setAdding(true)
    const { error } = await supabase.from('resources').insert({
      nom: nom.trim(),
      type,
      cout_horaire: parseFloat(coutHoraire) || 0,
    })
    setAdding(false)
    if (error) toast.error(error.message)
    else { toast.success('Ressource ajoutée'); setNom(''); setCoutHoraire(''); router.refresh() }
  }

  async function updateResource(id: string, field: string, value: string | number) {
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
                <button
                  onClick={() => { setAffectFor(r.id); setAffectProject(NONE); setAffectHeures(''); setAffectBudget('') }}
                  className="pl-6 text-xs text-[#534AB7] hover:underline flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" />
                  Affecter à un projet
                </button>
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
          <Button type="submit" size="sm" disabled={adding || !nom.trim()} className="h-9">
            <Plus className="h-4 w-4 mr-1" />
            Ajouter
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
