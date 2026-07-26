import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/sidebar'
import { Toaster } from '@/components/ui/sonner'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase.from('profiles').select('role, nom').eq('id', user.id).single()

  return (
    <div className="flex min-h-screen">
      <Sidebar role={profile?.role ?? null} nom={profile?.nom ?? null} email={user.email ?? null} />
      <main className="flex-1 bg-gray-50 p-8 overflow-auto">
        {children}
      </main>
      <Toaster richColors />
    </div>
  )
}
