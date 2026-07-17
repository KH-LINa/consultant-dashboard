import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LucideIcon } from 'lucide-react'

interface KpiCardProps {
  title: string
  value: string
  subtitle: string
  icon: LucideIcon
  trend?: { value: string; positive: boolean } | null
  color?: 'blue' | 'green' | 'orange' | 'purple' | 'gray'
}

const colorMap = {
  blue: 'text-blue-500 bg-blue-50',
  green: 'text-green-500 bg-green-50',
  orange: 'text-orange-500 bg-orange-50',
  purple: 'text-purple-500 bg-purple-50',
  gray: 'text-gray-500 bg-gray-50',
}

export function KpiCard({ title, value, subtitle, icon: Icon, trend, color = 'blue' }: KpiCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-gray-600">{title}</CardTitle>
        <div className={`p-2 rounded-lg ${colorMap[color]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-gray-900">{value}</div>
        <div className="flex items-center gap-2 mt-1">
          <p className="text-xs text-gray-500">{subtitle}</p>
          {trend && (
            <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${
              trend.positive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              {trend.positive ? '▲' : '▼'} {trend.value}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
