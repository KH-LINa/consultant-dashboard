'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Target, Pencil, Check } from 'lucide-react'

interface ObjectifCAProps {
  caActuel: number
  objectifInitial: number
}

export function ObjectifCA({ caActuel, objectifInitial }: ObjectifCAProps) {
  const [objectif, setObjectif] = useState(objectifInitial)
  const [editing, setEditing] = useState(false)
  const [inputVal, setInputVal] = useState(String(objectifInitial))

  const pct = objectif > 0 ? Math.min((caActuel / objectif) * 100, 100) : 0
  const reste = Math.max(objectif - caActuel, 0)

  function saveObjectif() {
    const val = parseFloat(inputVal)
    if (!isNaN(val) && val > 0) {
      setObjectif(val)
      localStorage.setItem('ca_objectif', String(val))
    }
    setEditing(false)
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Target className="h-4 w-4 text-blue-500" />
          Objectif CA annuel
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editing ? saveObjectif() : setEditing(true)}
          className="h-7 w-7 p-0"
        >
          {editing ? <Check className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {editing ? (
          <div className="flex gap-2 items-center">
            <Input
              type="number"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              className="h-8 text-sm"
              onKeyDown={(e) => e.key === 'Enter' && saveObjectif()}
              autoFocus
            />
            <span className="text-sm text-gray-500">€</span>
          </div>
        ) : (
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-gray-900">
              {caActuel.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
            </span>
            <span className="text-sm text-gray-400">
              / {objectif.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
            </span>
          </div>
        )}

        {/* Barre de progression */}
        <div className="space-y-1">
          <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
            <div
              className="h-3 rounded-full transition-all duration-500"
              style={{
                width: `${pct}%`,
                background: pct >= 100
                  ? '#22c55e'
                  : pct >= 75
                  ? '#3b82f6'
                  : pct >= 40
                  ? '#f59e0b'
                  : '#9ca3af',
              }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500">
            <span className="font-medium" style={{
              color: pct >= 100 ? '#22c55e' : pct >= 75 ? '#3b82f6' : '#6b7280'
            }}>
              {pct.toFixed(1)}%
            </span>
            <span>
              {pct < 100
                ? `Il reste ${reste.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}`
                : '🎉 Objectif atteint !'}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
