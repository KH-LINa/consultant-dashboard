import { createClient } from '@/lib/supabase/server'
import { DocumentsManager } from '@/components/documents/documents-manager'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import { Users, FolderKanban } from 'lucide-react'

export default async function DocumentsPage() {
  const supabase = await createClient()

  const { data: documents } = await supabase
    .from('documents')
    .select('*, contact:contacts(nom), mission:missions(titre)')
    .order('created_at', { ascending: false })

  const list = documents ?? []
  const divers = list.filter((d) => !d.contact_id && !d.mission_id)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Documents</h1>
        <p className="text-gray-500 mt-1">{list.length} fichier(s) — contrats, comptes-rendus, livrables</p>
      </div>

      {/* Liste enrichie par rattachement */}
      {list.length > 0 && (
        <Card>
          <CardContent className="pt-4">
            <div className="space-y-1">
              {list.map((d: any) => (
                <div key={d.id} className="flex items-center justify-between py-2 border-b last:border-0 text-sm">
                  <span className="font-medium text-gray-800">{d.nom}</span>
                  <div className="flex items-center gap-2 text-xs">
                    {d.contact && (
                      <Link href={`/contacts/${d.contact_id}`} className="flex items-center gap-1 text-blue-600 hover:underline">
                        <Users className="h-3 w-3" />{d.contact.nom}
                      </Link>
                    )}
                    {d.mission && (
                      <Link href={`/missions/${d.mission_id}`} className="flex items-center gap-1 text-purple-600 hover:underline">
                        <FolderKanban className="h-3 w-3" />{d.mission.titre}
                      </Link>
                    )}
                    {!d.contact && !d.mission && <span className="text-gray-400">Non rattaché</span>}
                    <span className="text-gray-400">{new Date(d.created_at).toLocaleDateString('fr-FR')}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload de documents divers */}
      <DocumentsManager documents={divers} title="Ajouter un document (non rattaché)" />
    </div>
  )
}
