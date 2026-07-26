import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/sidebar'
import { NotificationsBell } from '@/components/layout/notifications-bell'
import { Toaster } from '@/components/ui/sonner'
import type { Notification } from '@/lib/types'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const [{ data: profile }, { data: notifications }] = await Promise.all([
    supabase.from('profiles').select('role, nom').eq('id', user.id).single(),
    supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(10),
  ])

  return (
    <div className="flex min-h-screen">
      <Sidebar role={profile?.role ?? null} nom={profile?.nom ?? null} email={user.email ?? null} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-end border-b bg-white px-6 py-2">
          <NotificationsBell initial={(notifications ?? []) as Notification[]} />
        </header>
        <main className="flex-1 overflow-auto bg-gray-50 p-8">
          {children}
        </main>
      </div>
      <Toaster richColors />
    </div>
  )
}
