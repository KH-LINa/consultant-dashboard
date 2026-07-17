'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

type ActionResult = { ok: true } | { ok: false; error: string }

function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function diffDays(fromISO: string, toISO: string): number {
  const a = new Date(fromISO + 'T00:00:00').getTime()
  const b = new Date(toISO + 'T00:00:00').getTime()
  return Math.round((b - a) / 86400000)
}

/** Met à jour les dates d'une tâche. */
export async function updateTaskDates(
  taskId: string,
  dateDebut: string,
  dateFin: string,
  projectId?: string
): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non autorisé' }

  const { error } = await supabase
    .from('project_tasks')
    .update({ date_debut: dateDebut, date_fin: dateFin })
    .eq('id', taskId)
  if (error) return { ok: false, error: error.message }
  if (projectId) revalidatePath(`/projets/${projectId}`)
  return { ok: true }
}

/** Met à jour la date d'échéance d'un jalon. */
export async function updateMilestoneDate(
  milestoneId: string,
  dateEcheance: string,
  projectId?: string
): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non autorisé' }

  const { error } = await supabase
    .from('project_milestones')
    .update({ date_echeance: dateEcheance })
    .eq('id', milestoneId)
  if (error) return { ok: false, error: error.message }
  if (projectId) revalidatePath(`/projets/${projectId}`)
  return { ok: true }
}

/**
 * Déplace une phase et propage le même décalage (en jours) à toutes ses tâches.
 * Le delta est calculé côté serveur à partir de l'ancienne date de début.
 */
export async function updatePhaseWithTasks(
  phaseId: string,
  newDateDebut: string,
  newDateFin: string,
  projectId?: string
): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non autorisé' }

  // Récupère l'ancienne date de début pour calculer le décalage
  const { data: phase, error: phErr } = await supabase
    .from('project_phases')
    .select('date_debut')
    .eq('id', phaseId)
    .single()
  if (phErr || !phase) return { ok: false, error: phErr?.message ?? 'Phase introuvable' }

  const delta = phase.date_debut ? diffDays(phase.date_debut, newDateDebut) : 0

  // Met à jour la phase
  const { error: upErr } = await supabase
    .from('project_phases')
    .update({ date_debut: newDateDebut, date_fin: newDateFin })
    .eq('id', phaseId)
  if (upErr) return { ok: false, error: upErr.message }

  // Décale les tâches de la phase du même nombre de jours
  if (delta !== 0) {
    const { data: tasks } = await supabase
      .from('project_tasks')
      .select('id, date_debut, date_fin')
      .eq('phase_id', phaseId)

    for (const t of tasks ?? []) {
      const patch: Record<string, string> = {}
      if (t.date_debut) patch.date_debut = addDays(t.date_debut, delta)
      if (t.date_fin) patch.date_fin = addDays(t.date_fin, delta)
      if (Object.keys(patch).length) {
        await supabase.from('project_tasks').update(patch).eq('id', t.id)
      }
    }
  }

  if (projectId) revalidatePath(`/projets/${projectId}`)
  return { ok: true }
}

/** Met à jour l'avancement (0-100) d'une tâche. */
export async function updateTaskProgress(
  taskId: string,
  avancement: number,
  projectId?: string
): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non autorisé' }

  const { error } = await supabase
    .from('project_tasks')
    .update({ avancement: Math.max(0, Math.min(100, Math.round(avancement))) })
    .eq('id', taskId)
  if (error) return { ok: false, error: error.message }
  if (projectId) revalidatePath(`/projets/${projectId}`)
  return { ok: true }
}
