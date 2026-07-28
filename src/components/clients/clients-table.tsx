'use client'

import Link from 'next/link'
import type { Contact } from '@/lib/types'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { ChevronRight } from 'lucide-react'

interface ClientRow extends Contact {
  caTotal: number
}

function eur(n: number) {
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
}

export function ClientsTable({ clients }: { clients: ClientRow[] }) {
  if (clients.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        Aucun client pour l&apos;instant. Un contact devient automatiquement client dès qu&apos;un
        devis est signé ou qu&apos;une facture est émise pour lui.
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-white overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nom</TableHead>
            <TableHead>Entreprise</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Téléphone</TableHead>
            <TableHead className="text-right">CA facturé (payé)</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients.map((client) => (
            <TableRow key={client.id} className="cursor-pointer hover:bg-gray-50">
              <TableCell className="p-0">
                <Link href={`/clients/${client.id}`} className="block px-4 py-3 font-medium">
                  {client.nom}
                </Link>
              </TableCell>
              <TableCell className="p-0">
                <Link href={`/clients/${client.id}`} className="block px-4 py-3">
                  {client.entreprise ?? '—'}
                </Link>
              </TableCell>
              <TableCell className="p-0">
                <Link href={`/clients/${client.id}`} className="block px-4 py-3">
                  {client.email ?? '—'}
                </Link>
              </TableCell>
              <TableCell className="p-0">
                <Link href={`/clients/${client.id}`} className="block px-4 py-3">
                  {client.telephone ?? '—'}
                </Link>
              </TableCell>
              <TableCell className="p-0 text-right">
                <Link href={`/clients/${client.id}`} className="block px-4 py-3 font-medium text-green-700">
                  {client.caTotal > 0 ? eur(client.caTotal) : '—'}
                </Link>
              </TableCell>
              <TableCell className="p-0">
                <Link href={`/clients/${client.id}`} className="flex items-center justify-center px-2 py-3 text-gray-300">
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
