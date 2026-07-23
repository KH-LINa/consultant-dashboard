'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AgentConfig } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Bot, ChevronDown, ChevronUp } from 'lucide-react'

interface Editable {
  system_prompt: string
  model: string
  max_tokens: number
  actif: boolean
}

export function AgentsSettings({ agents }: { agents: AgentConfig[] }) {
  const supabase = createClient()
  const [formes, setFormes] = useState<Record<string, Editable>>(
    Object.fromEntries(
      agents.map((a) => [
        a.id,
        { system_prompt: a.system_prompt, model: a.model, max_tokens: a.max_tokens, actif: a.actif },
      ])
    )
  )
  const [ouvert, setOuvert] = useState<string | null>(null)
  const [enregistrement, setEnregistrement] = useState<string | null>(null)

  function set(id: string, champ: keyof Editable, valeur: string | number | boolean) {
    setFormes((p) => ({ ...p, [id]: { ...p[id], [champ]: valeur } }))
  }

  async function enregistrer(agent: AgentConfig) {
    const forme = formes[agent.id]
    if (!forme.system_prompt.trim() || !forme.model.trim()) {
      toast.error('Le system prompt et le modèle sont obligatoires.')
      return
    }
    setEnregistrement(agent.id)
    const { error } = await supabase
      .from('agents')
      .update({
        system_prompt: forme.system_prompt,
        model: forme.model.trim(),
        max_tokens: forme.max_tokens,
        actif: forme.actif,
      })
      .eq('id', agent.id)
    if (error) {
      toast.error(`Échec de l'enregistrement : ${error.message}`)
    } else {
      toast.success(`Agent « ${agent.nom} » enregistré ✓`)
    }
    setEnregistrement(null)
  }

  if (agents.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="h-4 w-4 text-[#534AB7]" />
            Agents
          </CardTitle>
          <CardDescription>
            Aucun agent en base — exécutez la migration <code>supabase-agents-migration.sql</code> (tables + seed).
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bot className="h-4 w-4 text-[#534AB7]" />
          Agents
        </CardTitle>
        <CardDescription>
          Sous-agents du module Agents : system prompt, modèle et statut actif/inactif sont éditables.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {agents.map((agent) => {
          const forme = formes[agent.id]
          const estOuvert = ouvert === agent.id
          return (
            <div key={agent.id} className="rounded-lg border">
              <button
                type="button"
                onClick={() => setOuvert(estOuvert ? null : agent.id)}
                className="w-full flex items-center justify-between gap-3 p-3 text-left"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`h-2 w-2 rounded-full shrink-0 ${forme.actif ? 'bg-emerald-500' : 'bg-gray-300'}`}
                    title={forme.actif ? 'Actif' : 'Inactif'}
                  />
                  <span className="text-sm font-medium text-gray-900 truncate">{agent.nom}</span>
                  <Badge variant="outline" className="text-xs font-mono text-[#534AB7] border-[#534AB7]/30">
                    {agent.slug}
                  </Badge>
                </div>
                {estOuvert ? (
                  <ChevronUp className="h-4 w-4 text-gray-400 shrink-0" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
                )}
              </button>
              {estOuvert && (
                <div className="border-t p-4 space-y-4">
                  {agent.description && <p className="text-xs text-gray-500">{agent.description}</p>}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Modèle</Label>
                      <Input
                        value={forme.model}
                        onChange={(e) => set(agent.id, 'model', e.target.value)}
                        placeholder="claude-haiku-4-5-20251001"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Max tokens</Label>
                      <Input
                        type="number"
                        min={256}
                        max={64000}
                        value={forme.max_tokens}
                        onChange={(e) => set(agent.id, 'max_tokens', Number(e.target.value) || 4096)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>System prompt</Label>
                    <Textarea
                      value={forme.system_prompt}
                      onChange={(e) => set(agent.id, 'system_prompt', e.target.value)}
                      rows={12}
                      className="font-mono text-xs"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`actif-${agent.id}`}
                        checked={forme.actif}
                        onChange={(e) => set(agent.id, 'actif', e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <Label htmlFor={`actif-${agent.id}`} className="cursor-pointer">
                        Agent actif (proposé à l&apos;orchestrateur)
                      </Label>
                    </div>
                    <Button
                      type="button"
                      onClick={() => enregistrer(agent)}
                      disabled={enregistrement === agent.id}
                      className="text-white"
                      style={{ backgroundColor: '#534AB7' }}
                    >
                      {enregistrement === agent.id ? 'Enregistrement…' : 'Enregistrer'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
