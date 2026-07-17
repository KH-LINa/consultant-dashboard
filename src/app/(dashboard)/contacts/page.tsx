import { createClient } from '@/lib/supabase/server'
import { ContactsTable } from '@/components/contacts/contacts-table'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Plus } from 'lucide-react'

export default async function ContactsPage() {
  const supabase = await createClient()
  const { data: contacts } = await supabase
    .from('contacts')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Contacts</h1>
          <p className="text-gray-500 mt-1">{contacts?.length ?? 0} contact(s)</p>
        </div>
        <Button asChild>
          <Link href="/contacts/nouveau">
            <Plus className="h-4 w-4 mr-2" />
            Nouveau contact
          </Link>
        </Button>
      </div>

      <ContactsTable contacts={contacts ?? []} />
    </div>
  )
}
