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
  Bot,
} from 'lucide-react'
import { toast } from 'sonner'

const navItems = [
  { href: '/dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
  { href: '/contacts', label: 'Contacts', icon: Users },
  { href: '/devis', label: 'Devis', icon: FileText },
  { href: '/contrats', label: 'Contrats', icon: FileSignature },
  { href: '/missions', label: 'Missions', icon: FolderKanban },
  { href: '/factures', label: 'Factures', icon: Receipt },
  { href: '/projets', label: 'Projets', icon: FolderGit2 },
  { href: '/agents', label: 'Agents', icon: Bot },
  { href: '/relances', label: 'Relances', icon: Bell },
  { href: '/comptabilite', label: 'Comptabilité', icon: Landmark },
  { href: '/documents', label: 'Documents', icon: FolderArchive },
  { href: '/parametres', label: 'Paramètres', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    toast.success('Déconnexion réussie')
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="flex flex-col w-64 min-h-screen bg-gray-900 text-white p-4">
      <div className="flex items-center gap-2 mb-8 px-2">
        <Briefcase className="h-6 w-6 text-blue-400" />
        <span className="font-bold text-lg">Consultant IA</span>
      </div>

      <nav className="flex-1 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
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
