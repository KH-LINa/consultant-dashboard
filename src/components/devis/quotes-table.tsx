'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Quote } from '@/lib/types'
import { OFFER_LABELS } from '@/lib/types'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Pencil, Trash2, Download, Receipt, Link2 } from 'lucide-react'
import { toast } from 'sonner'
import { SendEmailDialog } from '@/components/send-email-dialog'
import { CreateProjectButton } from '@/components/projets/create-project-button'
import { GenerateContractIconButton } from '@/components/contracts/GenerateContractIconButton'

const statusStyle: Record<string, string> = {
  brouillon: 'bg-gray-100 text-gray-600',
  'envoyé': 'bg-blue-100 text-blue-700',
  'signé': 'bg-green-100 text-green-700',
  'refusé': 'bg-red-100 text-red-700',
  'expiré': 'bg-orange-100 text-orange-700',
}

const offreLabel: Record<string, string> = OFFER_LABELS

export function QuotesTable({ quotes }: { quotes: (Quote & { contact?: { nom: string; entreprise: string | null } })[] }) {
  const router = useRouter()
  const supabase = createClient()
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!deleteId) return
    setDeleting(true)
    const { error } = await supabase.from('quotes').delete().eq('id', deleteId)
    if (error) {
      toast.error('Erreur lors de la suppression')
    } else {
      toast.success('Devis supprimé')
      router.refresh()
    }
    setDeleteId(null)
    setDeleting(false)
  }

  async function copyLink(token?: string) {
    if (!token) {
      toast.error('Lien indisponible')
      return
    }
    const url = `${window.location.origin}/accepter/${token}`
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Lien d\'acceptation copié ✓')
    } catch {
      toast.error('Impossible de copier le lien')
    }
  }

  if (quotes.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        Aucun devis. Créez votre premier devis.
      </div>
    )
  }

  return (
    <>
      <div className="rounded-lg border bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Titre</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Offre</TableHead>
              <TableHead>Montant HT</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {quotes.map((quote) => (
              <TableRow key={quote.id}>
                <TableCell className="font-medium">
                  {quote.titre}
                  {quote.response_comment && (
                    <p className="text-xs font-normal text-gray-500 mt-0.5 italic">
                      💬 « {quote.response_comment} »
                    </p>
                  )}
                  {quote.response_at && (
                    <p className="text-xs font-normal text-gray-400 mt-0.5">
                      Réponse le {new Date(quote.response_at).toLocaleDateString('fr-FR')}
                    </p>
                  )}
                </TableCell>
                <TableCell>{quote.contact?.nom ?? '—'}</TableCell>
                <TableCell>{offreLabel[quote.offre] ?? quote.offre}</TableCell>
                <TableCell>
                  {(quote.montant_ht || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                </TableCell>
                <TableCell>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusStyle[quote.statut]}`}>
                    {quote.statut}
                  </span>
                </TableCell>
                <TableCell>
                  {new Date(quote.created_at).toLocaleDateString('fr-FR')}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/api/devis/${quote.id}/pdf`} target="_blank">
                        <Download className="h-4 w-4" />
                      </Link>
                    </Button>
                    <SendEmailDialog
                      type="devis"
                      id={quote.id}
                      titre={quote.titre}
                      contactEmail={(quote as any).contact?.email}
                    />
                    {quote.statut !== 'signé' && quote.statut !== 'refusé' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyLink(quote.public_token)}
                        title="Copier le lien d'acceptation"
                        className="text-gray-500 hover:text-gray-700"
                      >
                        <Link2 className="h-4 w-4" />
                      </Button>
                    )}
                    {quote.statut === 'signé' && (
                      <>
                        <GenerateContractIconButton quoteId={quote.id} />
                        <CreateProjectButton
                          quoteId={quote.id}
                          contactId={quote.contact_id}
                          titre={quote.titre}
                          lignes={quote.lignes}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                          className="text-blue-600 hover:text-blue-800"
                          title="Convertir en facture"
                        >
                          <Link href={`/factures/nouvelle?quote_id=${quote.id}`}>
                            <Receipt className="h-4 w-4" />
                          </Link>
                        </Button>
                      </>
                    )}
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/devis/${quote.id}`}>
                        <Pencil className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteId(quote.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer la suppression</DialogTitle>
            <DialogDescription>
              Ce devis sera définitivement supprimé.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Annuler</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Suppression...' : 'Supprimer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
