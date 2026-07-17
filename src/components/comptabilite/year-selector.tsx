'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Download, ChevronLeft, ChevronRight } from 'lucide-react'

export function YearSelector({ annee, anneesDisponibles }: { annee: number; anneesDisponibles: number[] }) {
  const router = useRouter()

  function goTo(y: number) {
    router.push(`/comptabilite?year=${y}`)
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1 bg-white border rounded-lg p-1">
        <Button variant="ghost" size="sm" onClick={() => goTo(annee - 1)} className="h-7 w-7 p-0">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-semibold px-3 min-w-[60px] text-center">{annee}</span>
        <Button variant="ghost" size="sm" onClick={() => goTo(annee + 1)} className="h-7 w-7 p-0"
          disabled={annee >= new Date().getFullYear()}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <Button variant="outline" asChild>
        <a href={`/api/comptabilite/export?year=${annee}`}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </a>
      </Button>
    </div>
  )
}
