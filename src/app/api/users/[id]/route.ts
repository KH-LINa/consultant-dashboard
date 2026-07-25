import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { UserRole } from '@/lib/types'

const ROLES: UserRole[] = ['admin', 'manager', 'collaborateur']

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Non autorisé' }, { status: 401 }) }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Réservé aux administrateurs' }, { status: 403 }) }
  }
  return { user }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin()
  if (guard.error) return guard.error

  const body = await request.json().catch(() => null)
  const update: { role?: UserRole; collaborateur_id?: string | null } = {}

  if (body?.role !== undefined) {
    if (!ROLES.includes(body.role)) return NextResponse.json({ error: 'Rôle invalide' }, { status: 400 })
    update.role = body.role
  }
  if (body && 'collaborateur_id' in body) {
    update.collaborateur_id = body.collaborateur_id || null
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Rien à mettre à jour' }, { status: 400 })
  }

  // Un admin ne peut pas se retirer lui-même son propre rôle admin (sinon
  // plus personne ne peut gérer les comptes).
  if (params.id === guard.user!.id && update.role && update.role !== 'admin') {
    return NextResponse.json({ error: 'Vous ne pouvez pas retirer votre propre rôle admin' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin.from('profiles').update(update).eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin()
  if (guard.error) return guard.error

  if (params.id === guard.user!.id) {
    return NextResponse.json({ error: 'Vous ne pouvez pas révoquer votre propre accès' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin.from('profiles').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
