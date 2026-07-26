import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardShell } from '@/components/layout/dashboard-shell'
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
    <DashboardShell
      role={profile?.role ?? null}
      nom={profile?.nom ?? null}
      email={user.email ?? null}
      notifications={(notifications ?? []) as Notification[]}
    >
      {children}
    </DashboardShell>
  )
}
