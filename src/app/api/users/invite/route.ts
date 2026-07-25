import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRateLimit, clientId } from '@/lib/rate-limit'
import { resolveAppBaseUrl } from '@/lib/base-url'
import type { UserRole } from '@/lib/types'

const ROLES: UserRole[] = ['admin', 'manager', 'collaborateur']

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: callerProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (callerProfile?.role !== 'admin') {
    return NextResponse.json({ error: 'Réservé aux administrateurs' }, { status: 403 })
  }

  const rl = await checkRateLimit({
    prefix: 'invite-user', identifier: clientId(request, user.id), max: 10, windowSec: 60,
  })
  if (!rl.success) {
    return NextResponse.json({ error: "Trop d'invitations envoyées, réessayez dans une minute." }, { status: 429 })
  }

  const body = await request.json().catch(() => null)
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const nom = typeof body?.nom === 'string' ? body.nom.trim() : ''
  const role = body?.role as UserRole
  const collaborateurId = typeof body?.collaborateur_id === 'string' && body.collaborateur_id ? body.collaborateur_id : null
  const resourceId = typeof body?.resource_id === 'string' && body.resource_id ? body.resource_id : null

  if (!email || !nom) return NextResponse.json({ error: 'Email et nom obligatoires' }, { status: 400 })
  if (!ROLES.includes(role)) return NextResponse.json({ error: 'Rôle invalide' }, { status: 400 })

  const admin = createAdminClient()
  const origin = resolveAppBaseUrl(request)

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { nom },
    redirectTo: `${origin}/update-password`,
  })

  if (inviteError || !invited?.user) {
    return NextResponse.json({ error: inviteError?.message ?? "Échec de l'invitation" }, { status: 400 })
  }

  const { error: profileError } = await admin.from('profiles').insert({
    id: invited.user.id, email, nom, role, collaborateur_id: collaborateurId, resource_id: resourceId,
  })

  if (profileError) {
    // Ne pas laisser un compte Auth orphelin (sans profil) si l'insert échoue.
    await admin.auth.admin.deleteUser(invited.user.id)
    return NextResponse.json({ error: profileError.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
