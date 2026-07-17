import { createClient } from '@/lib/supabase/server'
import { ContractStatusBadge } from '@/components/contracts/ContractStatusBadge'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import type { ContractStatus } from '@/lib/types'
import { FileSignature } from 'lucide-react'

const STATUTS: { value: ContractStatus | 'tous'; label: string }[] = [
  { value: 'tous',      label: 'Tous' },
  { value: 'brouillon', label: 'Brouillons' },
  { value: 'envoye',    label: 'Envoyés' },
  { value: 'signe',     label: 'Signés' },
  { value: 'archive',   label: 'Archivés' },
]

export default async function ContratsPage({
  searchParams,
}: {
  searchParams: { statut?: string }
}) {
  const supabase = await createClient()
  const filtre = (searchParams.statut ?? 'tous') as ContractStatus | 'tous'

  let query = supabase
    .from('contracts')
    .select('*, contact:contacts(nom, entreprise, email)')
    .order('created_at', { ascending: false })

  if (filtre !== 'tous') {
    query = query.eq('statut', filtre)
  }

  const { data: contracts } = await query

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Contrats</h1>
          <p className="text-gray-500 mt-1">{contracts?.length ?? 0} contrat{(contracts?.length ?? 0) !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Filtres par statut */}
      <div className="flex gap-2 flex-wrap">
        {STATUTS.map(({ value, label }) => (
          <Link
            key={value}
            href={value === 'tous' ? '/contrats' : `/contrats?statut=${value}`}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              filtre === value
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600'
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      {/* Table des contrats */}
      {!contracts?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <FileSignature className="h-10 w-10 text-gray-300" />
            <p className="text-gray-500 font-medium">Aucun contrat{filtre !== 'tous' ? ` (${filtre})` : ''}</p>
            <p className="text-sm text-gray-400">
              Ouvrez un devis accepté et cliquez sur « Générer le contrat ».
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Numéro</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Client</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Montant HT</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">Statut</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {contracts.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/contrats/${c.id}`} className="font-mono text-blue-600 hover:underline font-medium">
                        {c.numero}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-800">
                      <div>{c.contact?.nom ?? '—'}</div>
                      {c.contact?.entreprise && (
                        <div className="text-xs text-gray-400">{c.contact.entreprise}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {Number(c.montant_ht).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <ContractStatusBadge statut={c.statut as ContractStatus} />
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {new Date(c.created_at).toLocaleDateString('fr-FR')}
                      {c.sent_at && (
                        <div className="text-blue-400">Envoyé le {new Date(c.sent_at).toLocaleDateString('fr-FR')}</div>
                      )}
                      {c.signed_at && (
                        <div className="text-green-500">Signé le {new Date(c.signed_at).toLocaleDateString('fr-FR')}</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
