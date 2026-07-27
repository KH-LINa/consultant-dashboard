'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  LayoutDashboard,
  Users,
  FileText,
  Receipt,
  Bell,
  Landmark,
  FolderKanban,
  FolderArchive,
  FolderGit2,
  Settings,
  LogOut,
  Briefcase,
  FileSignature,
  HardHat,
  CalendarDays,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import type { UserRole } from '@/lib/types'

const navItems = [
  { href: '/dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
  { href: '/contacts', label: 'Contacts', icon: Users },
  { href: '/devis', label: 'Devis', icon: FileText },
  { href: '/contrats', label: 'Contrats', icon: FileSignature },
  { href: '/missions', label: 'Missions', icon: FolderKanban },
  { href: '/factures', label: 'Factures', icon: Receipt },
  { href: '/projets', label: 'Projets', icon: FolderGit2 },
  { href: '/ressources', label: 'Ressources', icon: HardHat },
  { href: '/relances', label: 'Relances', icon: Bell },
  { href: '/comptabilite', label: 'Comptabilité', icon: Landmark },
  { href: '/documents', label: 'Documents', icon: FolderArchive },
  { href: '/parametres', label: 'Paramètres', icon: Settings },
]

// Un collaborateur n'a accès qu'à son propre planning et ses notifications —
// le reste de l'outil (contacts, devis, factures, comptabilité, paramètres...)
// lui est fermé côté RLS/middleware ; la sidebar reflète cette restriction.
const collaborateurNavItems = [
  { href: '/mon-planning', label: 'Mon planning', icon: CalendarDays },
  { href: '/notifications', label: 'Notifications', icon: Bell },
]

const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Administrateur', manager: 'Manager', collaborateur: 'Collaborateur',
}

function initiales(nom: string): string {
  return nom.trim().split(/\s+/).slice(0, 2).map((m) => m[0]?.toUpperCase() ?? '').join('') || '?'
}

interface SidebarProps {
  role: UserRole | null
  nom: string | null
  email: string | null
  // Ferme le tiroir mobile après un clic sur un lien (sans effet en desktop,
  // où la sidebar est toujours visible) — voir DashboardShell.
  onNavigate?: () => void
}

export function Sidebar({ role, nom, email, onNavigate }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const items = role === 'collaborateur' ? collaborateurNavItems : navItems

  async function handleLogout() {
    await supabase.auth.signOut()
    toast.success('Déconnexion réussie')
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="flex flex-col w-64 h-full min-h-screen bg-gray-900 text-white p-4 overflow-y-auto">
      <div className="flex items-center justify-between gap-2 mb-8 px-2">
        <div className="flex items-center gap-2">
          <Briefcase className="h-6 w-6 text-blue-400" />
          <span className="font-bold text-lg">Consultant IA</span>
        </div>
        <button
          type="button"
          onClick={onNavigate}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white lg:hidden"
          aria-label="Fermer le menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-1">
        {items.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              pathname === href || pathname.startsWith(href + '/')
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>

      <Separator className="bg-gray-700 my-4" />

      {/* Identité de l'utilisateur connecté */}
      {nom && (
        <div className="flex items-center gap-3 px-2 py-2 mb-1">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
            {initiales(nom)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{nom}</p>
            <p className="truncate text-xs text-gray-400">
              {role ? ROLE_LABEL[role] : email}
            </p>
          </div>
        </div>
      )}

      <Button
        variant="ghost"
        onClick={handleLogout}
        className="justify-start gap-3 text-gray-300 hover:bg-gray-800 hover:text-white"
      >
        <LogOut className="h-4 w-4" />
        Déconnexion
      </Button>
    </aside>
  )
}
