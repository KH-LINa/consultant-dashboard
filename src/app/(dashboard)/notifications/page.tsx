import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { toLocalISO } from '@/lib/gantt-deps'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { NotificationsEventsList } from '@/components/notifications/notifications-events-list'
import { AlertTriangle, CalendarClock, BellOff } from 'lucide-react'
import type { ProjectTask, Notification } from '@/lib/types'

type TacheAvecProjet = ProjectTask & { project: { titre: string } | null }

function fmt(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'
}

export default async function NotificationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: eventsData }] = await Promise.all([
    supabase.from('profiles').select('nom, role, collaborateur_id').eq('id', user.id).single(),
    supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(30),
  ])

  // Un admin/manager peut modifier la tâche directement sur la fiche projet ;
  // un collaborateur n'a accès qu'à la vue lecture seule de "Mon planning".
  const projetTacheHref = (projectId: string, taskId: string) =>
    profile?.role === 'collaborateur'
      ? `/mon-planning/projets/${projectId}?tache=${taskId}`
      : `/projets/${projectId}?tache=${taskId}`

  // Tâches assignées à ce collaborateur (via la RLS, il ne voit que les siennes).
  const { data: tasksData } = profile?.collaborateur_id
    ? await supabase
        .from('project_tasks')
        .select('*, project:projects(titre)')
        .eq('responsable_id', profile.collaborateur_id)
        .order('date_fin', { ascending: true, nullsFirst: false })
    : { data: [] }

  const tasks = (tasksData ?? []) as TacheAvecProjet[]
  const events = (eventsData ?? []) as Notification[]
  const auj = toLocalISO(new Date())
  const dans7Jours = toLocalISO(new Date(Date.now() + 7 * 86400000))

  const enRetard = tasks.filter((t) => t.date_fin && t.date_fin < auj && t.statut !== 'fait')
  const echeanceProche = tasks.filter(
    (t) => t.date_fin && t.date_fin >= auj && t.date_fin <= dans7Jours && t.statut !== 'fait'
  )

  const total = enRetard.length + echeanceProche.length + events.length

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Notifications</h1>
        <p className="text-gray-500 mt-1">
          {total === 0 ? 'Rien à signaler pour le moment.' : `${total} point${total > 1 ? 's' : ''} d'attention.`}
        </p>
      </div>

      <NotificationsEventsList initial={events} />

      {total === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <BellOff className="h-10 w-10 text-gray-300" />
            <p className="text-gray-500 font-medium">Aucune alerte</p>
            <p className="text-sm text-gray-400">Aucune tâche en retard ni à échéance proche.</p>
          </CardContent>
        </Card>
      )}

      {enRetard.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-4 w-4" />
              En retard ({enRetard.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {enRetard.map((t) => (
              <Link key={t.id} href={projetTacheHref(t.project_id, t.id)}
                className="border border-red-100 bg-red-50/40 rounded-lg p-3 flex items-center justify-between gap-2 hover:bg-red-50 transition-colors">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{t.titre}</p>
                  {t.project?.titre && <p className="text-xs text-gray-400 truncate">{t.project.titre}</p>}
                </div>
                <span className="text-xs text-red-600 font-medium whitespace-nowrap">échéance {fmt(t.date_fin)}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {echeanceProche.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-amber-600">
              <CalendarClock className="h-4 w-4" />
              À échéance dans les 7 jours ({echeanceProche.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {echeanceProche.map((t) => (
              <Link key={t.id} href={projetTacheHref(t.project_id, t.id)}
                className="border rounded-lg p-3 flex items-center justify-between gap-2 hover:bg-gray-50 transition-colors">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{t.titre}</p>
                  {t.project?.titre && <p className="text-xs text-gray-400 truncate">{t.project.titre}</p>}
                </div>
                <span className="text-xs text-amber-600 whitespace-nowrap">échéance {fmt(t.date_fin)}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-gray-400">
        Retrouvez le détail de vos tâches dans <Link href="/mon-planning" className="text-blue-600 hover:underline">Mon planning</Link>.
      </p>
    </div>
  )
}
