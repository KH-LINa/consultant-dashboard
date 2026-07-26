'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Notification } from '@/lib/types'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Bell, BellRing, UserPlus, CalendarClock } from 'lucide-react'

const TYPE_ICON = {
  tache_assignee: UserPlus,
  planning_modifie: CalendarClock,
} as const

function tempsEcoule(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return "à l'instant"
  if (min < 60) return `il y a ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `il y a ${h} h`
  return `il y a ${Math.floor(h / 24)} j`
}

// Cloche de notifications en en-tête — présente sur toutes les pages/rôles.
// Poll léger (pas de canal Realtime) : re-fetch à l'ouverture + toutes les
// 45 s, cohérent avec la fraîcheur "quasi temps réel" attendue ici.
export function NotificationsBell({ initial }: { initial: Notification[] }) {
  const router = useRouter()
  const supabase = createClient()
  const [notifications, setNotifications] = useState(initial)
  const unread = notifications.filter((n) => !n.read_at).length

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from('notifications').select('*').order('created_at', { ascending: false }).limit(10)
    if (data) setNotifications(data as Notification[])
  }, [supabase])

  useEffect(() => {
    const id = setInterval(refresh, 45000)
    return () => clearInterval(id)
  }, [refresh])

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

  return (
    <DropdownMenu onOpenChange={(open) => { if (open) refresh() }}>
      <DropdownMenuTrigger
        className={`relative flex h-11 w-11 items-center justify-center rounded-full transition-colors ${
          unread > 0 ? 'text-blue-600 hover:bg-blue-50' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
        }`}
        aria-label="Notifications"
      >
        {unread > 0 ? <BellRing className="h-6 w-6" /> : <Bell className="h-6 w-6" />}
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-bold leading-none text-white ring-2 ring-white animate-pulse">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-1.5 py-1">
          <span className="text-xs font-medium text-muted-foreground">Notifications</span>
          {unread > 0 && (
            <button onClick={markAllRead} className="text-xs text-blue-600 hover:underline">
              Tout marquer comme lu
            </button>
          )}
        </div>
        <DropdownMenuSeparator />
        {notifications.length === 0 && (
          <p className="px-2 py-4 text-center text-sm text-gray-400">Aucune notification</p>
        )}
        {notifications.map((n) => {
          const Icon = TYPE_ICON[n.type] ?? Bell
          return (
            <DropdownMenuItem key={n.id} onClick={() => handleClick(n)} className="items-start gap-2 py-2">
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${n.read_at ? 'text-gray-300' : 'text-blue-500'}`} />
              <div className="min-w-0 flex-1">
                <p className={`truncate text-sm ${n.read_at ? 'text-gray-500' : 'font-medium text-gray-900'}`}>{n.titre}</p>
                {n.message && <p className="truncate text-xs text-gray-400">{n.message}</p>}
                <p className="text-[11px] text-gray-300">{tempsEcoule(n.created_at)}</p>
              </div>
              {!n.read_at && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />}
            </DropdownMenuItem>
          )
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push('/notifications')} className="justify-center text-sm text-blue-600">
          Voir toutes les notifications
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
