import { createClient } from '@supabase/supabase-js'

/**
 * Client Supabase avec la clé service_role.
 * À n'utiliser QUE côté serveur (cron, webhooks) — il contourne les RLS.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}
