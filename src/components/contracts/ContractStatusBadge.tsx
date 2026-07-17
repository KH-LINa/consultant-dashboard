import type { ContractStatus } from '@/lib/types'
import { cn } from '@/lib/utils'

const CONFIG: Record<ContractStatus, { label: string; className: string }> = {
  brouillon: { label: 'Brouillon',  className: 'bg-gray-100 text-gray-600 border-gray-200' },
  envoye:    { label: 'Envoyé',     className: 'bg-blue-100 text-blue-700 border-blue-200' },
  signe:     { label: 'Signé',      className: 'bg-green-100 text-green-700 border-green-200' },
  archive:   { label: 'Archivé',    className: 'bg-neutral-100 text-neutral-500 border-neutral-200' },
}

export function ContractStatusBadge({ statut }: { statut: ContractStatus }) {
  const { label, className } = CONFIG[statut] ?? CONFIG.brouillon
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border', className)}>
      {label}
    </span>
  )
}
