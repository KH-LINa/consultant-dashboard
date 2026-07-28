'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { NiveauMaturite, Recommandation } from '@/lib/types'
import { LEVIERS, NIVEAU_CONFIG, RECOMMANDATION_CONFIG } from '@/lib/maturite'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Plus, ClipboardCheck } from 'lucide-react'
import { toast } from 'sonner'

interface MaturityAssessmentFormProps {
  contactId: string
  projects: { id: string; titre: string }[]
}

const NONE_PROJECT = '__none__'

export function MaturityAssessmentForm({ contactId, projects }: MaturityAssessmentFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [projectId, setProjectId] = useState(NONE_PROJECT)
  const [recommandation, setRecommandation] = useState<Recommandation | ''>('')
  const [notes, setNotes] = useState('')
  const [niveaux, setNiveaux] = useState<Record<string, NiveauMaturite>>(
    Object.fromEntries(LEVIERS.map((l) => [l.champ, 'partiel' as NiveauMaturite]))
  )

  function reset() {
    setProjectId(NONE_PROJECT)
    setRecommandation('')
    setNotes('')
    setNiveaux(Object.fromEntries(LEVIERS.map((l) => [l.champ, 'partiel' as NiveauMaturite])))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('maturity_assessments').insert({
      contact_id: contactId,
      project_id: projectId === NONE_PROJECT ? null : projectId,
      recommandation: recommandation || null,
      notes: notes.trim() || null,
      ...niveaux,
    })
    setSaving(false)
    if (error) {
      toast.error(`Échec de l'enregistrement : ${error.message}`)
      return
    }
    toast.success('Évaluation de maturité enregistrée')
    setOpen(false)
    reset()
    router.refresh()
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5 mr-1.5" />
        Nouvelle évaluation
      </Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-[#534AB7]" />
              Évaluation de maturité IA
            </DialogTitle>
            <DialogDescription>
              Grille des 6 leviers — un diagnostic de départ, pas une notation punitive. Trois
              niveaux par levier : sait faire, angle mort, à combler.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto pr-1">
            {LEVIERS.map(({ champ, label }) => (
              <div key={champ} className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">{label}</label>
                <div className="flex gap-1.5">
                  {(Object.keys(NIVEAU_CONFIG) as NiveauMaturite[]).map((niveau) => (
                    <button
                      key={niveau}
                      type="button"
                      onClick={() => setNiveaux((prev) => ({ ...prev, [champ]: niveau }))}
                      title={NIVEAU_CONFIG[niveau].description}
                      className={`flex-1 text-xs px-2 py-1.5 rounded-lg border transition-colors ${
                        niveaux[champ] === niveau
                          ? `${NIVEAU_CONFIG[niveau].cls} border-transparent font-medium`
                          : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      {NIVEAU_CONFIG[niveau].label}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {projects.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Projet lié (optionnel)</label>
                <Select value={projectId} onValueChange={(v) => setProjectId(v ?? NONE_PROJECT)}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="— Aucun projet —">
                      {(v: string) => v === NONE_PROJECT ? '— Aucun projet —' : projects.find((p) => p.id === v)?.titre}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_PROJECT}>— Aucun projet —</SelectItem>
                    {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.titre}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Recommandation globale (optionnel)</label>
              <div className="flex gap-1.5">
                {(Object.keys(RECOMMANDATION_CONFIG) as Recommandation[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRecommandation((prev) => (prev === r ? '' : r))}
                    className={`flex-1 text-xs px-2 py-1.5 rounded-lg border transition-colors ${
                      recommandation === r
                        ? `${RECOMMANDATION_CONFIG[r].cls} border-transparent font-medium`
                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    {RECOMMANDATION_CONFIG[r].label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Notes (optionnel)</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observations, contexte, prérequis à traiter avant de réévaluer…"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    </>
  )
}
