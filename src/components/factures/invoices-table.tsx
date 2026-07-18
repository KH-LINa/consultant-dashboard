'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Invoice } from '@/lib/types'
import { OFFER_LABELS } from '@/lib/types'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Pencil, Trash2, Download, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import { SendEmailDialog } from '@/components/send-email-dialog'

const statusStyle: Record<string, string> = {
  brouillon: 'bg-gray-100 text-gray-600',
  'envoyée': 'bg-blue-100 text-blue-700',
  'payée': 'bg-green-100 text-green-700',
  'annulée': 'bg-red-100 text-red-700',
}

const offreLabel: Record<string, string> = OFFER_LABELS

type InvoiceWithContact = Invoice & { contact?: { nom: string; entreprise: string | null; email: string | null } }

export function InvoicesTable({ invoices }: { invoices: InvoiceWithContact[] }) {
  const router = useRouter()
  const supabase = createClient()
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!deleteId) return
    setDeleting(true)
    const { error } = await supabase.from('invoices').delete().eq('id', deleteId)
    if (error) {
      toast.error('Erreur lors de la suppression')
    } else {
      toast.success('Facture supprimée')
      router.refresh()
    }
    setDeleteId(null)
    setDeleting(false)
  }

  async function markAsPaid(id: string) {
    const { error } = await supabase.from('invoices').update({ statut: 'payée' }).eq('id', id)
    if (error) {
      toast.error('Erreur')
    } else {
      toast.success('Facture marquée comme payée ✓')
      router.refresh()
    }
  }

  if (invoices.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        Aucune facture. Créez votre première facture ou convertissez un devis signé.
      </div>
    )
  }

  return (
    <>
      <div className="rounded-lg border bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Numéro</TableHead>
              <TableHead>Titre</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Montant HT</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Émission</TableHead>
              <TableHead>Échéance</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((inv) => {
              const isOverdue = inv.statut !== 'payée' && inv.statut !== 'annulée' &&
                inv.date_echeance && new Date(inv.date_echeance) < new Date()
              return (
                <TableRow key={inv.id} className={isOverdue ? 'bg-red-50' : ''}>
                  <TableCell className="font-mono font-medium text-sm">{inv.numero}</TableCell>
                  <TableCell className="font-medium">{inv.titre}</TableCell>
                  <TableCell>{inv.contact?.nom ?? '—'}</TableCell>
                  <TableCell className="font-semibold">
                    {(inv.montant_ht || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                  </TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusStyle[inv.statut]}`}>
                      {inv.statut}
                    </span>
                    {isOverdue && (
                      <span className="ml-1 text-xs text-red-600 font-medium">⚠ En retard</span>
                    )}
                  </TableCell>
                  <TableCell>{new Date(inv.date_emission).toLocaleDateString('fr-FR')}</TableCell>
                  <TableCell>
                    {inv.date_echeance
                      ? new Date(inv.date_echeance).toLocaleDateString('fr-FR')
                      : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/api/factures/${inv.id}/pdf`} target="_blank">
                          <Download className="h-4 w-4" />
                        </Link>
                      </Button>
                      <SendEmailDialog
                        type="facture"
                        id={inv.id}
                        titre={inv.titre}
                        contactEmail={inv.contact?.email ?? null}
                      />
                      {inv.statut !== 'payée' && inv.statut !== 'annulée' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => markAsPaid(inv.id)}
                          className="text-green-600 hover:text-green-800"
                          title="Marquer comme payée"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/factures/${inv.id}`}>
                          <Pencil className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteId(inv.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer la facture ?</DialogTitle>
            <DialogDescription>Cette action est irréversible.</DialogDescription>
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
