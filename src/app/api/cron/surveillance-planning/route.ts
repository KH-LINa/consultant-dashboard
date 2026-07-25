import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'
import { toLocalISO } from '@/lib/gantt-deps'
import { feriesCourants } from '@/lib/jours-ouvres'
import {
  alertesTousProjets, nbAlertes, conflitsCollaborateurs, conflitsRessourcesModule,
  type AlerteProjet, type ConflitRessource,
} from '@/lib/surveillance'
import type {
  Project, ProjectPhase, ProjectTask, ProjectMilestone, TaskDependency, PhaseDependency,
  Collaborateur, Resource, ResourceAssignment,
} from '@/lib/types'

export const dynamic = 'force-dynamic'

/**
 * Surveillance quotidienne des plannings : un seul email récapitulatif,
 * tous projets actifs confondus (pas un email par projet ni par tâche —
 * ce serait vite ingérable). N'envoie RIEN si aucun projet n'a d'alerte à
 * signaler ce jour-là. État courant, pas de suivi de "déjà alerté" (contrairement
 * aux relances devis/factures) : le but est un point de situation quotidien,
 * pas une escalade — un retard non résolu réapparaît simplement le lendemain.
 * La détection elle-même (retards, échéances proches, conflits) est dans
 * lib/surveillance.ts, pure et testée unitairement.
 */

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function fmt(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

function renderProjetHtml(a: AlerteProjet, origin: string): string {
  const { projet, tachesEnRetard, jalonsEnRetard, jalonsProches, conflitsTaches, conflitsPhases } = a
  return `
    <div style="margin-bottom:28px; padding-bottom:20px; border-bottom:1px solid #e5e7eb;">
      <h3 style="margin:0 0 10px; font-size:15px;">
        <a href="${origin}/projets/${projet.id}" style="color:#534AB7; text-decoration:none;">${esc(projet.titre)}</a>
      </h3>
      ${tachesEnRetard.length ? `
        <p style="margin:8px 0 4px; font-size:13px; font-weight:600; color:#b91c1c;">⚠ Tâches en retard</p>
        <ul style="margin:0 0 8px; padding-left:20px; font-size:13px; color:#374151;">
          ${tachesEnRetard.map((t) => `<li>${esc(t.titre)} — ${t.joursRetard} j de retard (échéance ${fmt(t.date_fin!)})</li>`).join('')}
        </ul>` : ''}
      ${jalonsEnRetard.length ? `
        <p style="margin:8px 0 4px; font-size:13px; font-weight:600; color:#b91c1c;">⚠ Jalons en retard</p>
        <ul style="margin:0 0 8px; padding-left:20px; font-size:13px; color:#374151;">
          ${jalonsEnRetard.map((m) => `<li>${esc(m.titre)} — ${m.joursRetard} j de retard (échéance ${fmt(m.date_echeance!)})</li>`).join('')}
        </ul>` : ''}
      ${jalonsProches.length ? `
        <p style="margin:8px 0 4px; font-size:13px; font-weight:600; color:#b45309;">📅 Échéances proches (3 jours)</p>
        <ul style="margin:0 0 8px; padding-left:20px; font-size:13px; color:#374151;">
          ${jalonsProches.map((m) => `<li>${esc(m.titre)} — ${fmt(m.date_echeance!)}</li>`).join('')}
        </ul>` : ''}
      ${(conflitsTaches.length + conflitsPhases.length) ? `
        <p style="margin:8px 0 4px; font-size:13px; font-weight:600; color:#b45309;">🔗 Conflits de dépendances</p>
        <ul style="margin:0 0 8px; padding-left:20px; font-size:13px; color:#374151;">
          ${conflitsTaches.map((c) => `<li>Tâche « ${esc(c.succTitre)} » démarre avant la fin de « ${esc(c.predTitre)} »</li>`).join('')}
          ${conflitsPhases.map((c) => `<li>Phase « ${esc(c.succTitre)} » démarre avant la fin de « ${esc(c.predTitre)} »</li>`).join('')}
        </ul>` : ''}
    </div>
  `
}

function fmtPeriode(debut: string, fin: string, heureDebut: string | null, heureFin: string | null): string {
  const heures = heureDebut && heureFin ? ` ${heureDebut.slice(0, 5)}-${heureFin.slice(0, 5)}` : ''
  return debut === fin ? `${fmt(debut)}${heures}` : `${fmt(debut)} → ${fmt(fin)}${heures}`
}

function renderConflitsRessourcesHtml(conflits: ConflitRessource[], origin: string): string {
  if (conflits.length === 0) return ''
  return `
    <div style="margin-bottom:28px; padding-bottom:20px; border-bottom:1px solid #e5e7eb;">
      <h3 style="margin:0 0 10px; font-size:15px; color:#b91c1c;">⚠ Double réservation</h3>
      <ul style="margin:0; padding-left:20px; font-size:13px; color:#374151;">
        ${conflits.map((c) => `
          <li style="margin-bottom:6px;">
            ${c.type === 'collaborateur' ? 'Collaborateur' : 'Ressource'} <strong>${esc(c.nom)}</strong> affecté(e) en même temps sur :
            <br/>« ${esc(c.a.itemTitre)} » (<a href="${origin}/projets/${c.a.projetId}" style="color:#534AB7;">${esc(c.a.projetTitre)}</a>, ${fmtPeriode(c.a.debut, c.a.fin, c.a.heureDebut, c.a.heureFin)})
            <br/>« ${esc(c.b.itemTitre)} » (<a href="${origin}/projets/${c.b.projetId}" style="color:#534AB7;">${esc(c.b.projetTitre)}</a>, ${fmtPeriode(c.b.debut, c.b.fin, c.b.heureDebut, c.b.heureFin)})
          </li>`).join('')}
      </ul>
    </div>
  `
}

export async function GET(request: NextRequest) {
  // --- Sécurité : vérifier le secret (même convention que /api/cron/relances) ---
  const auth = request.headers.get('authorization')
  const secretParam = request.nextUrl.searchParams.get('secret')
  const expected = process.env.CRON_SECRET
  if (!expected || (auth !== `Bearer ${expected}` && secretParam !== expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  const { data: settingsRows } = await supabase.from('settings').select('key, value')
  const settings = Object.fromEntries((settingsRows ?? []).map((r) => [r.key, r.value ?? '']))

  if (settings.surveillance_planning_auto !== 'true') {
    return NextResponse.json({ skipped: 'surveillance des plannings désactivée' })
  }
  const notifyTo = settings.notification_email || settings.consultant_email || settings.email_expediteur
  if (!settings.resend_api_key || !settings.email_expediteur || !notifyTo) {
    return NextResponse.json({ skipped: 'configuration email incomplète' })
  }

  // --- Projets actifs (les projets terminés/annulés ne sont plus surveillés) ---
  const { data: projectsData } = await supabase
    .from('projects').select('*').not('statut', 'in', '(termine,annule)')
  const projects = (projectsData ?? []) as Project[]
  if (projects.length === 0) {
    return NextResponse.json({ success: true, alertes: 0, projets_concernes: 0, note: 'aucun projet actif' })
  }
  const projectIds = projects.map((p) => p.id)

  const [{ data: phasesData }, { data: tasksData }, { data: milestonesData }] = await Promise.all([
    supabase.from('project_phases').select('*').in('project_id', projectIds),
    supabase.from('project_tasks').select('*').in('project_id', projectIds),
    supabase.from('project_milestones').select('*').in('project_id', projectIds),
  ])
  const phases = (phasesData ?? []) as ProjectPhase[]
  const tasks = (tasksData ?? []) as ProjectTask[]
  const milestones = (milestonesData ?? []) as ProjectMilestone[]

  const taskIds = tasks.map((t) => t.id)
  const phaseIds = phases.map((p) => p.id)
  const [
    { data: taskDepsData }, { data: phaseDepsData },
    { data: collaborateursData }, { data: resourcesData }, { data: assignmentsData },
  ] = await Promise.all([
    taskIds.length
      ? supabase.from('task_dependencies').select('*').in('predecessor_id', taskIds)
      : Promise.resolve({ data: [] }),
    phaseIds.length
      ? supabase.from('phase_dependencies').select('*').in('predecessor_id', phaseIds)
      : Promise.resolve({ data: [] }),
    supabase.from('collaborateurs').select('*'),
    supabase.from('resources').select('*'),
    supabase.from('resource_assignments').select('*').in('project_id', projectIds),
  ])
  const taskDeps = (taskDepsData ?? []) as TaskDependency[]
  const phaseDeps = (phaseDepsData ?? []) as PhaseDependency[]
  const collaborateurs = (collaborateursData ?? []) as Collaborateur[]
  const resources = (resourcesData ?? []) as Resource[]
  const assignments = (assignmentsData ?? []) as ResourceAssignment[]

  const feries = feriesCourants()
  const auj = toLocalISO(new Date())
  const dans3Jours = toLocalISO(new Date(Date.now() + 3 * 86400000))

  const parProjet = alertesTousProjets(projects, tasks, phases, milestones, taskDeps, phaseDeps, auj, dans3Jours, feries)
  const conflitsRessources = [
    ...conflitsCollaborateurs(tasks, projects, collaborateurs),
    ...conflitsRessourcesModule(assignments, tasks, projects, resources),
  ]

  if (parProjet.length === 0 && conflitsRessources.length === 0) {
    return NextResponse.json({ success: true, alertes: 0, projets_concernes: 0 })
  }

  const totalAlertes = parProjet.reduce((s, a) => s + nbAlertes(a), 0) + conflitsRessources.length
  const origin = new URL(request.url).origin
  const sections = renderConflitsRessourcesHtml(conflitsRessources, origin)
    + parProjet.map((a) => renderProjetHtml(a, origin)).join('')

  const resend = new Resend(settings.resend_api_key)
  const fromName = settings.consultant_nom || 'i·a·infinity'
  const { error: mailErr } = await resend.emails.send({
    from: `${fromName} <${settings.email_expediteur}>`,
    to: [notifyTo],
    subject: `Surveillance plannings — ${totalAlertes} alerte${totalAlertes > 1 ? 's' : ''} sur ${parProjet.length} projet${parProjet.length > 1 ? 's' : ''}`,
    html: `
      <div style="font-family: sans-serif; max-width: 640px; margin: 0 auto; color: #1a1a1a;">
        <h2 style="color: #534AB7;">Point de situation quotidien</h2>
        <p style="color:#6b7280; font-size:13px;">${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        ${sections}
        <p style="font-size:12px; color:#9ca3af; margin-top:24px;">
          Envoyé automatiquement — désactivable dans Paramètres → Surveillance des plannings.
        </p>
      </div>`,
  })

  if (mailErr) {
    return NextResponse.json({ success: false, error: mailErr.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    alertes: totalAlertes,
    projets_concernes: parProjet.length,
    date: new Date().toISOString(),
  })
}
