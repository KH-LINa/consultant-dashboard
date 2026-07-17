import { createClient } from '@/lib/supabase/server'
import { QuotesTable } from '@/components/devis/quotes-table'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Plus } from 'lucide-react'

export default async function DevisPage() {
  const supabase = await createClient()
  const { data: quotes } = await supabase
    .from('quotes')
    .select('*, contact:contacts(nom, entreprise, email)')
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Devis</h1>
          <p className="text-gray-500 mt-1">{quotes?.length ?? 0} devis</p>
        </div>
        <Button asChild>
          <Link href="/devis/nouveau">
            <Plus className="h-4 w-4 mr-2" />
            Nouveau devis
          </Link>
        </Button>
      </div>

      <QuotesTable quotes={quotes ?? []} />
    </div>
  )
}
