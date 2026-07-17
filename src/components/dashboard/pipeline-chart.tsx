'use client'

import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

interface PipelineChartProps {
  data: { statut: string; count: number; montant: number }[]
}

const COLORS: Record<string, string> = {
  brouillon: '#9ca3af',
  'envoyé': '#3b82f6',
  'signé': '#22c55e',
  'refusé': '#ef4444',
  'expiré': '#f97316',
}

const LABELS: Record<string, string> = {
  brouillon: 'Brouillon',
  'envoyé': 'Envoyé',
  'signé': 'Signé',
  'refusé': 'Refusé',
  'expiré': 'Expiré',
}

function CustomTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    const d = payload[0].payload
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
        <p className="text-sm font-semibold">{LABELS[d.statut] ?? d.statut}</p>
        <p className="text-sm text-gray-600">{d.count} devis</p>
        <p className="text-sm font-bold text-gray-800">
          {d.montant.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
        </p>
      </div>
    )
  }
  return null
}

export function PipelineChart({ data }: PipelineChartProps) {
  if (data.length === 0) {
    return <p className="text-gray-400 text-sm text-center py-8">Aucun devis</p>
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={90}
          paddingAngle={3}
          dataKey="count"
        >
          {data.map((entry) => (
            <Cell key={entry.statut} fill={COLORS[entry.statut] ?? '#6b7280'} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend
          formatter={(value, entry: any) => (
            <span className="text-xs text-gray-600">
              {LABELS[entry.payload.statut] ?? entry.payload.statut} ({entry.payload.count})
            </span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
