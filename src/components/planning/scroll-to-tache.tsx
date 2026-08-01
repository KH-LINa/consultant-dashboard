'use client'

import { useEffect } from 'react'

/**
 * Centre la vue sur la tâche visée par un lien "?tache=<id>" (notification
 * de retard par email ou page Notifications) et la surligne brièvement.
 * Composant purement DOM (pas de state React à faire remonter) pour les
 * pages qui n'ont pas besoin de piloter un autre composant (ex. déplier des
 * commentaires) — voir TasksManager pour la version avec state, utilisée
 * là où un fil de commentaires doit s'ouvrir en plus. Lu depuis
 * window.location plutôt que useSearchParams pour ne pas imposer de limite
 * de Suspense sur la page (même convention que (auth)/login/page.tsx).
 */
export function ScrollToTache() {
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('tache')
    if (!id) return
    const el = document.getElementById(`tache-${id}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.add('ring-2', 'ring-amber-400', 'bg-amber-50/60')
    const timer = setTimeout(() => el.classList.remove('ring-2', 'ring-amber-400', 'bg-amber-50/60'), 4000)
    return () => clearTimeout(timer)
  }, [])

  return null
}
