'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { DocumentFile } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Upload, FileText, Download, Trash2, File, FileImage, FileSpreadsheet } from 'lucide-react'
import { toast } from 'sonner'

interface DocumentsManagerProps {
  documents: DocumentFile[]
  contactId?: string
  missionId?: string
  title?: string
}

function fileIcon(mime: string | null) {
  if (!mime) return File
  if (mime.startsWith('image/')) return FileImage
  if (mime.includes('pdf')) return FileText
  if (mime.includes('sheet') || mime.includes('excel') || mime.includes('csv')) return FileSpreadsheet
  return File
}

function formatSize(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

export function DocumentsManager({ documents, contactId, missionId, title = 'Documents' }: DocumentsManagerProps) {
  const router = useRouter()
  const supabase = createClient()
  const fileInput = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 20 * 1024 * 1024) {
      toast.error('Fichier trop volumineux (max 20 Mo)')
      return
    }

    setUploading(true)
    const ext = file.name.split('.').pop()
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const folder = contactId ? `contacts/${contactId}` : missionId ? `missions/${missionId}` : 'divers'
    const chemin = `${folder}/${safeName}`

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(chemin, file)

    if (uploadError) {
      toast.error(`Erreur upload : ${uploadError.message}`)
      setUploading(false)
      return
    }

    const { error: dbError } = await supabase.from('documents').insert({
      nom: file.name,
      chemin,
      taille: file.size,
      type_mime: file.type,
      contact_id: contactId ?? null,
      mission_id: missionId ?? null,
    })

    if (dbError) {
      toast.error(dbError.message)
    } else {
      toast.success(`"${file.name}" ajouté`)
      router.refresh()
    }
    setUploading(false)
    if (fileInput.current) fileInput.current.value = ''
  }

  async function handleDownload(doc: DocumentFile) {
    const { data, error } = await supabase.storage
      .from('documents')
      .createSignedUrl(doc.chemin, 60)
    if (error || !data) {
      toast.error('Impossible de générer le lien')
      return
    }
    window.open(data.signedUrl, '_blank')
  }

  async function handleDelete(doc: DocumentFile) {
    await supabase.storage.from('documents').remove([doc.chemin])
    const { error } = await supabase.from('documents').delete().eq('id', doc.id)
    if (error) {
      toast.error('Erreur lors de la suppression')
    } else {
      toast.success('Document supprimé')
      router.refresh()
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4 text-blue-500" />
          {title} {documents.length > 0 && <span className="text-gray-400 font-normal">({documents.length})</span>}
        </CardTitle>
        <Button size="sm" onClick={() => fileInput.current?.click()} disabled={uploading}>
          <Upload className="h-4 w-4 mr-2" />
          {uploading ? 'Envoi...' : 'Ajouter'}
        </Button>
        <input ref={fileInput} type="file" className="hidden" onChange={handleUpload} />
      </CardHeader>
      <CardContent>
        {documents.length === 0 ? (
          <div
            onClick={() => fileInput.current?.click()}
            className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center text-sm text-gray-400 cursor-pointer hover:border-blue-300 hover:text-blue-500 transition-colors"
          >
            <Upload className="h-6 w-6 mx-auto mb-2" />
            Cliquez pour ajouter un fichier (contrat, CR, livrable…)
          </div>
        ) : (
          <div className="space-y-1">
            {documents.map((doc) => {
              const Icon = fileIcon(doc.type_mime)
              return (
                <div key={doc.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 group">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <Icon className="h-4 w-4 text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{doc.nom}</p>
                    <p className="text-xs text-gray-400">
                      {formatSize(doc.taille)} · {new Date(doc.created_at).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleDownload(doc)}
                    className="h-8 w-8 p-0 text-blue-500 hover:text-blue-700">
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(doc)}
                    className="h-8 w-8 p-0 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
