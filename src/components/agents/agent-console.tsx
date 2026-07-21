'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Markdown } from '@/components/agents/markdown'
import { toast } from 'sonner'
import { Bot, Sparkles, Loader2, CircleCheck, CircleX, Copy, MessageCircleQuestion } from 'lucide-react'

interface AgentAppele {
  slug: string
  nom: string
  statut: 'succes' | 'erreur'
  erreur?: string
}

interface Orchestration {
  type: 'questions' | 'resultat'
  contenu: string
  agents_appeles: AgentAppele[]
  tokens_input: number
  tokens_output: number
  duree_ms: number
}

const VIOLET = '#534AB7'

export function AgentConsole() {
  const router = useRouter()
  const [demande, setDemande] = useState('')
  const [loading, setLoading] = useState(false)
  const [resultat, setResultat] = useState<Orchestration | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!demande.trim() || loading) return
    setLoading(true)
    setResultat(null)
    try {
      const res = await fetch('/api/agents/orchestrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ demande: demande.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Erreur lors de l’orchestration')
        return
      }
      setResultat(data)
      router.refresh() // rafraîchit l'historique des runs
    } catch {
      toast.error('Erreur réseau — réessayez.')
    } finally {
      setLoading(false)
    }
  }

  function copierResultat() {
    if (!resultat) return
    navigator.clipboard.writeText(resultat.contenu)
    toast.success('Résultat copié')
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="h-4 w-4" style={{ color: VIOLET }} />
            Nouvelle demande
          </CardTitle>
          <CardDescription>
            L&apos;orchestrateur analyse votre demande, appelle les sous-agents nécessaires
            (devis, contrat, CDC, prospection, email, planning, diagnostic, formation) et assemble le résultat.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            <Textarea
              value={demande}
              onChange={(e) => setDemande(e.target.value)}
              rows={4}
              placeholder="Ex. : « Rédige un devis pour un diagnostic Lean chez Métallerie Dupont » ou « Prépare la mission complète pour X : devis + planning + premier email »"
              disabled={loading}
            />
            <div className="flex items-center gap-3">
              <Button
                type="submit"
                disabled={loading || !demande.trim()}
                className="text-white"
                style={{ backgroundColor: VIOLET }}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Orchestration en cours…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Lancer les agents
                  </>
                )}
              </Button>
              {loading && (
                <p className="text-xs text-gray-400">
                  Routage, sous-agents en parallèle puis synthèse — jusqu&apos;à une minute.
                </p>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {resultat?.type === 'questions' && (
        <Card className="border-amber-300 bg-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-amber-900">
              <MessageCircleQuestion className="h-4 w-4" />
              L&apos;orchestrateur a besoin de précisions
            </CardTitle>
            <CardDescription className="text-amber-800">
              Aucun sous-agent n&apos;a été appelé : complétez votre demande avec les éléments ci-dessous.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Markdown>{resultat.contenu}</Markdown>
          </CardContent>
        </Card>
      )}

      {resultat?.type === 'resultat' && (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <CardTitle className="text-base">Résultat</CardTitle>
                <div className="flex flex-wrap gap-1.5">
                  {resultat.agents_appeles.map((a) => (
                    <Badge
                      key={a.slug}
                      variant="outline"
                      className={
                        a.statut === 'succes'
                          ? 'border-[#534AB7]/40 text-[#534AB7] bg-[#534AB7]/5'
                          : 'border-red-300 text-red-700 bg-red-50'
                      }
                      title={a.erreur}
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
              <Button type="button" variant="outline" size="sm" onClick={copierResultat}>
                <Copy className="h-3.5 w-3.5 mr-1.5" />
                Copier
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Markdown>{resultat.contenu}</Markdown>
            <p className="text-xs text-gray-400 mt-4 pt-3 border-t">
              {(resultat.duree_ms / 1000).toFixed(1)} s · {resultat.tokens_input.toLocaleString('fr-FR')} tokens
              entrée · {resultat.tokens_output.toLocaleString('fr-FR')} tokens sortie
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
