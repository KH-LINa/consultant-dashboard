'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Notification } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Bell, UserPlus, CalendarClock, MessageSquare, AlertTriangle } from 'lucide-react'

const TYPE_ICON = {
  tache_assignee: UserPlus,
  planning_modifie: CalendarClock,
  commentaire_tache: MessageSquare,
  signalement: AlertTriangle,
} as const

function fmtDateHeure(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function NotificationsEventsList({ initial }: { initial: Notification[] }) {
  const router = useRouter()
  const supabase = createClient()
  const [notifications, setNotifications] = useState(initial)
  const unread = notifications.filter((n) => !n.read_at).length

  async function handleClick(n: Notification) {
    if (!n.read_at) {
      const now = new Date().toISOString()
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: now } : x)))
      await supabase.from('notifications').update({ read_at: now }).eq('id', n.id)
    }
    if (n.lien) router.push(n.lien)
  }

  async function markAllRead() {
    const ids = notifications.filter((n) => !n.read_at).map((n) => n.id)
    if (ids.length === 0) return
    const now = new Date().toISOString()
    setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? now })))
    await supabase.from('notifications').update({ read_at: now }).in('id', ids)
  }

  if (notifications.length === 0) return null

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <Bell className="h-4 w-4 text-blue-600" />
          Événements récents ({notifications.length})
        </CardTitle>
        {unread > 0 && (
          <button onClick={markAllRead} className="text-xs text-blue-600 hover:underline">
            Tout marquer comme lu
          </button>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {notifications.map((n) => {
          const Icon = TYPE_ICON[n.type] ?? Bell
          return (
            <button
              key={n.id}
              onClick={() => handleClick(n)}
              className={`w-full text-left border rounded-lg p-3 flex items-start gap-2 hover:bg-gray-50 ${!n.read_at ? 'bg-blue-50/50 border-blue-100' : ''}`}
            >
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${n.read_at ? 'text-gray-300' : 'text-blue-500'}`} />
              <div className="min-w-0 flex-1">
                <p className={`text-sm truncate ${n.read_at ? 'text-gray-600' : 'font-medium text-gray-900'}`}>{n.titre}</p>
                {n.message && <p className="text-xs text-gray-400 truncate">{n.message}</p>}
              </div>
              <span className="text-[11px] text-gray-400 whitespace-nowrap">{fmtDateHeure(n.created_at)}</span>
              {!n.read_at && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />}
            </button>
          )
        })}
      </CardContent>
    </Card>
  )
}
