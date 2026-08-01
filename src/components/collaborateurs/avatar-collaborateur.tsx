'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Camera, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

function initiales(nom: string): string {
  return nom.trim().split(/\s+/).slice(0, 2).map((m) => m[0]?.toUpperCase() ?? '').join('') || '?'
}

const TAILLES = {
  sm: 'h-9 w-9 text-xs',
  lg: 'h-20 w-20 text-2xl',
} as const

interface AvatarCollaborateurProps {
  collaborateurId: string
  nom: string
  couleur: string
  photoUrl: string | null
  taille?: keyof typeof TAILLES
  // Affiche l'overlay caméra permettant de changer la photo — désactivé
  // dans les contextes en lecture seule (ex. une simple mention du
  // responsable ailleurs dans l'app).
  editable?: boolean
}

// Avatar collaborateur : photo si renseignée, sinon initiales sur fond de sa
// couleur — avec upload/remplacement au clic quand editable. Bucket
// "avatars" public (voir supabase-collaborateurs-emploi-migration.sql) :
// pas de donnée sensible, pas besoin d'URL signée pour l'afficher partout.
export function AvatarCollaborateur({
  collaborateurId, nom, couleur, photoUrl, taille = 'lg', editable = false,
}: AvatarCollaborateurProps) {
  const router = useRouter()
  const supabase = createClient()
  const fileInput = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('Le fichier doit être une image'); return }
    if (file.size > 5 * 1024 * 1024) { toast.error('Image trop volumineuse (max 5 Mo)'); return }

    setUploading(true)
    const ext = file.name.split('.').pop()
    const chemin = `${collaborateurId}/${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage.from('avatars').upload(chemin, file)
    if (uploadError) {
      toast.error(`Erreur upload : ${uploadError.message}`)
      setUploading(false)
      return
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(chemin)
    const ancienChemin = photoUrl?.split('/avatars/')[1]

    const { error: dbError } = await supabase
      .from('collaborateurs')
      .update({ photo_url: data.publicUrl })
      .eq('id', collaborateurId)

    if (dbError) {
      toast.error(dbError.message)
      await supabase.storage.from('avatars').remove([chemin])
    } else {
      if (ancienChemin) await supabase.storage.from('avatars').remove([ancienChemin])
      toast.success('Photo mise à jour')
      router.refresh()
    }
    setUploading(false)
    if (fileInput.current) fileInput.current.value = ''
  }

  return (
    <div className={`group/avatar relative shrink-0 rounded-full ${TAILLES[taille]}`}>
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt={nom} className="h-full w-full rounded-full object-cover" />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center rounded-full font-semibold text-white"
          style={{ background: couleur }}
        >
          {initiales(nom)}
        </div>
      )}
      {editable && (
        <>
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={uploading}
            title="Changer la photo"
            className="absolute inset-0 flex items-center justify-center rounded-full text-transparent transition-colors group-hover/avatar:bg-black/40 group-hover/avatar:text-white"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
          </button>
          <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
        </>
      )}
    </div>
  )
}
