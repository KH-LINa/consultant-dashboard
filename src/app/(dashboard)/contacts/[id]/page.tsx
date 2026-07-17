import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ContactForm } from '@/components/contacts/contact-form'
import { DocumentsManager } from '@/components/documents/documents-manager'

export default async function EditContactPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const [{ data: contact }, { data: documents }] = await Promise.all([
    supabase.from('contacts').select('*').eq('id', params.id).single(),
    supabase.from('documents').select('*').eq('contact_id', params.id).order('created_at', { ascending: false }),
  ])

  if (!contact) notFound()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Modifier le contact</h1>
        <p className="text-gray-500 mt-1">{contact.nom}</p>
      </div>
      <ContactForm contact={contact} />
      <div className="max-w-2xl">
        <DocumentsManager documents={documents ?? []} contactId={contact.id} title="Documents du contact" />
      </div>
    </div>
  )
}
