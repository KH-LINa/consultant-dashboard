import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Trophy } from 'lucide-react'

interface TopContact {
  nom: string
  entreprise: string | null
  ca: number
  nb_devis: number
}

export function TopContacts({ contacts }: { contacts: TopContact[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Trophy className="h-4 w-4 text-yellow-500" />
          Top clients (CA signé)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {contacts.length === 0 ? (
          <p className="text-gray-400 text-sm py-4 text-center">Aucun devis signé</p>
        ) : (
          <div className="space-y-3">
            {contacts.map((c, i) => (
              <div key={c.nom} className="flex items-center gap-3">
                <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                  ${i === 0 ? 'bg-yellow-100 text-yellow-700' :
                    i === 1 ? 'bg-gray-100 text-gray-600' :
                    i === 2 ? 'bg-orange-100 text-orange-600' :
                    'bg-gray-50 text-gray-500'}`}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{c.nom}</p>
                  {c.entreprise && (
                    <p className="text-xs text-gray-400 truncate">{c.entreprise}</p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-gray-900">
                    {c.ca.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                  </p>
                  <p className="text-xs text-gray-400">{c.nb_devis} devis</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
