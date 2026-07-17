'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { CheckCircle2, XCircle, FileText, Loader2 } from 'lucide-react'

interface QuoteData {
  id: string
  titre: string
  offre: string
  montant_ht: number
  statut: string
  lignes: { description: string; quantite: number; prix_unitaire: number }[]
  created_at: string
  response_at: string | null
  response_comment: string | null
  contact_nom: string
  contact_entreprise: string | null
  consultant_nom: string
  consultant_siret: string
}

const offreLabel: Record<string, string> = {
  consulting: 'Consulting IA',
  automatisation: 'Automatisation',
  solution_globale: 'Solution globale',
}

function eur(n: number) {
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
}

export default function AccepterDevisPage({ params }: { params: { token: string } }) {
  const supabase = createClient()
  const [quote, setQuote] = useState<QuoteData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<'signé' | 'refusé' | null>(null)

  async function load() {
    const { data, error } = await supabase.rpc('get_quote_by_token', { p_token: params.token })
    if (error || !data) {
      setNotFound(true)
    } else {
      setQuote(data as QuoteData)
      if ((data as QuoteData).statut === 'signé' || (data as QuoteData).statut === 'refusé') {
        setResult((data as QuoteData).statut as 'signé' | 'refusé')
      }
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function respond(decision: 'signé' | 'refusé') {
    setSubmitting(true)
    const { data, error } = await supabase.rpc('respond_to_quote', {
      p_token: params.token,
      p_decision: decision,
      p_comment: comment,
    })
    setSubmitting(false)
    if (error || (data as any)?.error) {
      if ((data as any)?.error === 'already_responded') {
        setResult((data as any).statut)
      } else {
        alert('Une erreur est survenue. Veuillez réessayer.')
      }
      return
    }
    setResult(decision)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    )
  }

  if (notFound || !quote) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center">
          <XCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-800">Devis introuvable</h1>
          <p className="text-gray-500 mt-2">Ce lien est invalide ou a expiré.</p>
        </div>
      </div>
    )
  }

  const quoteNumber = `DEV-${new Date(quote.created_at).getFullYear()}-${quote.id.slice(0, 6).toUpperCase()}`

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        {/* En-tête */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 text-blue-600 font-bold text-xl">
            <FileText className="h-6 w-6" />
            {quote.consultant_nom}
          </div>
          <p className="text-sm text-gray-400 mt-1">Consultant IA Indépendant</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          {/* Bandeau */}
          <div className="bg-blue-600 text-white p-6">
            <p className="text-blue-100 text-sm">{quoteNumber}</p>
            <h1 className="text-2xl font-bold mt-1">{quote.titre}</h1>
            <span className="inline-block mt-2 bg-white/20 text-white text-xs px-2 py-1 rounded-full">
              {offreLabel[quote.offre] ?? quote.offre}
            </span>
          </div>

          {/* Corps */}
          <div className="p-6 space-y-6">
            <div>
              <p className="text-xs text-gray-400 uppercase font-medium mb-1">Destinataire</p>
              <p className="font-medium text-gray-800">{quote.contact_nom}</p>
              {quote.contact_entreprise && <p className="text-sm text-gray-500">{quote.contact_entreprise}</p>}
            </div>

            {/* Lignes */}
            <div>
              <p className="text-xs text-gray-400 uppercase font-medium mb-2">Prestations</p>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs">
                    <tr>
                      <th className="text-left p-2 font-medium">Description</th>
                      <th className="text-center p-2 font-medium">Qté</th>
                      <th className="text-right p-2 font-medium">PU HT</th>
                      <th className="text-right p-2 font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quote.lignes?.map((l, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-2">{l.description}</td>
                        <td className="p-2 text-center">{l.quantite}</td>
                        <td className="p-2 text-right">{eur(l.prix_unitaire)}</td>
                        <td className="p-2 text-right font-medium">{eur(l.quantite * l.prix_unitaire)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Total */}
            <div className="flex justify-end">
              <div className="text-right">
                <p className="text-sm text-gray-500">Montant total HT</p>
                <p className="text-3xl font-bold text-blue-600">{eur(quote.montant_ht)}</p>
                <p className="text-xs text-gray-400">TVA non applicable — art. 293 B CGI</p>
              </div>
            </div>

            {/* Zone de réponse */}
            {result ? (
              <div className={`rounded-lg p-6 text-center ${result === 'signé' ? 'bg-green-50' : 'bg-gray-100'}`}>
                {result === 'signé' ? (
                  <>
                    <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
                    <h2 className="text-lg font-bold text-green-700">Devis accepté ✓</h2>
                    <p className="text-sm text-green-600 mt-1">
                      Merci ! {quote.consultant_nom} a été notifié et vous recontactera rapidement.
                    </p>
                  </>
                ) : (
                  <>
                    <XCircle className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <h2 className="text-lg font-bold text-gray-700">Devis refusé</h2>
                    <p className="text-sm text-gray-500 mt-1">Votre réponse a bien été enregistrée.</p>
                  </>
                )}
              </div>
            ) : (
              <div className="border-t pt-6 space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Un commentaire ? (optionnel)</label>
                  <Textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={3}
                    placeholder="Vos remarques, questions ou demandes d'ajustement…"
                    className="mt-1"
                  />
                </div>
                <div className="flex gap-3">
                  <Button
                    onClick={() => respond('signé')}
                    disabled={submitting}
                    className="flex-1 bg-green-600 hover:bg-green-700 h-12 text-base"
                  >
                    <CheckCircle2 className="h-5 w-5 mr-2" />
                    Accepter le devis
                  </Button>
                  <Button
                    onClick={() => respond('refusé')}
                    disabled={submitting}
                    variant="outline"
                    className="flex-1 h-12 text-base border-gray-300"
                  >
                    <XCircle className="h-5 w-5 mr-2" />
                    Refuser
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          {quote.consultant_nom} — SIRET {quote.consultant_siret} — TVA non applicable (art. 293 B CGI)
        </p>
      </div>
    </div>
  )
}
