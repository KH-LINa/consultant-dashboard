'use client'

import { useState } from 'react'
import { Sidebar } from '@/components/layout/sidebar'
import { NotificationsBell } from '@/components/layout/notifications-bell'
import { Toaster } from '@/components/ui/sonner'
import { Menu } from 'lucide-react'
import type { Notification, UserRole } from '@/lib/types'

interface DashboardShellProps {
  role: UserRole | null
  nom: string | null
  email: string | null
  notifications: Notification[]
  children: React.ReactNode
}

// Coquille cliente qui porte l'état d'ouverture du tiroir mobile — le layout
// (dashboard) est un composant serveur, donc l'état "menu ouvert" partagé
// entre le bouton du header et la sidebar doit vivre ici plutôt que d'être
// éclaté entre deux composants serveur sans lien.
export function DashboardShell({ role, nom, email, notifications, children }: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex min-h-screen">
      <div
        className={`fixed inset-y-0 left-0 z-40 transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar role={role} nom={nom} email={email} onNavigate={() => setMobileOpen(false)} />
      </div>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <header className="flex items-center justify-between gap-2 border-b bg-white px-4 sm:px-6 py-2.5">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 lg:hidden"
            aria-label="Ouvrir le menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="ml-auto">
            <NotificationsBell initial={notifications} />
          </div>
        </header>
        <main className="flex-1 overflow-auto bg-gray-50 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
      <Toaster richColors />
    </div>
  )
}
