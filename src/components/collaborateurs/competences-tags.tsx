'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

// Tags libres (compétences) — saisie par Entrée ou virgule, suppression au
// clic sur le tag. Édition optimiste : le composant parent persiste
// immédiatement le tableau complet à chaque ajout/retrait (pas de bouton
// "valider" séparé, cohérent avec le reste de la fiche collaborateur).
export function CompetencesTags({
  competences, onChange, editable = true,
}: {
  competences: string[]
  onChange: (next: string[]) => void
  editable?: boolean
}) {
  const [texte, setTexte] = useState('')

  function ajouter() {
    const v = texte.trim()
    if (!v || competences.includes(v)) { setTexte(''); return }
    onChange([...competences, v])
    setTexte('')
  }

  function retirer(tag: string) {
    onChange(competences.filter((c) => c !== tag))
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {competences.map((tag) => (
        <span key={tag} className="group/tag flex items-center gap-1 rounded-full bg-[#EEEBFA] px-2 py-0.5 text-[11px] font-medium text-[#534AB7]">
          {tag}
          {editable && (
            <button type="button" onClick={() => retirer(tag)} className="opacity-50 hover:opacity-100">
              <X className="h-2.5 w-2.5" />
            </button>
          )}
        </span>
      ))}
      {editable && (
        <input
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); ajouter() }
          }}
          onBlur={ajouter}
          placeholder={competences.length === 0 ? 'Compétences (Entrée pour ajouter)' : '+ ajouter'}
          className="h-5 min-w-[90px] flex-1 border-none bg-transparent text-[11px] text-gray-500 outline-none placeholder:text-gray-350"
        />
      )}
    </div>
  )
}
