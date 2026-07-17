'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { FolderPlus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface CreateProjectButtonProps {
  quoteId: string
  contactId: string
  titre: string
}

export function CreateProjectButton({ quoteId, contactId, titre }: CreateProjectButtonProps) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  async function handleCreate() {
    setLoading(true)

    // Anti-doublon : un seul projet par devis
    const { data: existing } = await supabase
      .from('projects')
      .select('id')
      .eq('quote_id', quoteId)
      .maybeSingle()

    if (existing) {
      toast.info('Un projet existe déjà pour ce devis')
      router.push('/projets')
      setLoading(false)
      return
    }

    const { error } = await supabase.from('projects').insert({
      quote_id: quoteId,
      contact_id: contactId,
      titre,
      statut: 'a_demarrer',
    })

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Projet créé ✓')
      router.push('/projets')
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleCreate}
      disabled={loading}
      title="Créer le projet"
      className="text-green-600 hover:text-green-800"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderPlus className="h-4 w-4" />}
    </Button>
  )
}
