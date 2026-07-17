import { createClient } from '@/lib/supabase/server'

export interface ConsultantSettings {
  consultant_nom: string
  consultant_siret: string
  consultant_email: string
  consultant_telephone: string
  consultant_adresse: string
  resend_api_key: string
  email_expediteur: string
  taux_cotisation_urssaf: string
  versement_liberatoire: string
  taux_versement_ir: string
  relances_auto: string
}

const DEFAULTS: ConsultantSettings = {
  consultant_nom: 'Votre Nom',
  consultant_siret: '000 000 000 00000',
  consultant_email: 'contact@votre-domaine.fr',
  consultant_telephone: '',
  consultant_adresse: '',
  resend_api_key: '',
  email_expediteur: '',
  taux_cotisation_urssaf: '24.6',
  versement_liberatoire: 'false',
  taux_versement_ir: '2.2',
  relances_auto: 'true',
}

export async function getSettings(): Promise<ConsultantSettings> {
  const supabase = await createClient()
  const { data } = await supabase.from('settings').select('key, value')
  if (!data) return DEFAULTS
  const map = Object.fromEntries(data.map((r) => [r.key, r.value ?? '']))
  return { ...DEFAULTS, ...map } as ConsultantSettings
}
