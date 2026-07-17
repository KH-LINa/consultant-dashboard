import { createClient } from '@/lib/supabase/server'
import { ProjectsTable } from '@/components/projets/projects-table'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Plus } from 'lucide-react'

export default async function ProjetsPage() {
  const supabase = await createClient()
  const { data: projects } = await supabase
    .from('projects')
    .select('*, contact:contacts(nom, entreprise)')
    .order('created_at', { ascending: false })

  const list = projects ?? []
  const actifs = list.filter((p) => p.statut !== 'termine' && p.statut !== 'annule').length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Projets</h1>
          <p className="text-gray-500 mt-1">
            {list.length} projet(s) — {actifs} actif(s)
          </p>
        </div>
        <Button asChild>
          <Link href="/projets/nouveau"><Plus className="h-4 w-4 mr-2" />Nouveau projet</Link>
        </Button>
      </div>
      <ProjectsTable projects={list} />
    </div>
  )
}
