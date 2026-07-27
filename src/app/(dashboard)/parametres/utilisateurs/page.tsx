import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { UsersManager } from '@/components/parametres/users-manager'

export default async function UtilisateursPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/parametres')

  const [{ data: profiles }, { data: collaborateurs }, { data: resources }] = await Promise.all([
    supabase.from('profiles').select('*').order('created_at'),
    supabase.from('collaborateurs').select('id, nom, email').order('nom'),
    supabase.from('resources').select('id, nom, email').eq('type', 'humain').order('nom'),
  ])

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Utilisateurs</h1>
        <p className="text-gray-500 mt-1">
          Gérez qui a accès à l&apos;outil et avec quel rôle (Admin, Manager, Collaborateur).
        </p>
      </div>
      <UsersManager
        profiles={profiles ?? []}
        collaborateurs={collaborateurs ?? []}
        resources={resources ?? []}
        currentUserId={user.id}
      />
    </div>
  )
}
