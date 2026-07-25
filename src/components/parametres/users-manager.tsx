'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Profile, UserRole } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Plus, Trash2, UserPlus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Admin',
  manager: 'Manager',
  collaborateur: 'Collaborateur',
}
const ROLE_BADGE: Record<UserRole, string> = {
  admin: 'bg-purple-100 text-purple-700',
  manager: 'bg-blue-100 text-blue-700',
  collaborateur: 'bg-gray-100 text-gray-600',
}

const NONE = '__none__'

interface UsersManagerProps {
  profiles: Profile[]
  collaborateurs: { id: string; nom: string; email: string | null }[]
  currentUserId: string
}

export function UsersManager({ profiles, collaborateurs, currentUserId }: UsersManagerProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [revokeId, setRevokeId] = useState<string | null>(null)
  const [revoking, setRevoking] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)

  const [form, setForm] = useState({
    nom: '', email: '', role: 'collaborateur' as UserRole, collaborateur_id: NONE,
  })

  const collaborateurById = Object.fromEntries(collaborateurs.map((c) => [c.id, c]))
  const collaborateursDejaLies = new Set(profiles.map((p) => p.collaborateur_id).filter(Boolean))
  const collaborateursDisponibles = collaborateurs.filter((c) => !collaborateursDejaLies.has(c.id))

  async function handleInvite() {
    if (!form.nom.trim() || !form.email.trim()) { toast.error('Nom et email obligatoires'); return }
    setInviting(true)
    try {
      const res = await fetch('/api/users/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nom: form.nom.trim(),
          email: form.email.trim(),
          role: form.role,
          collaborateur_id: form.role === 'collaborateur' && form.collaborateur_id !== NONE ? form.collaborateur_id : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? "Échec de l'invitation"); return }
      toast.success(`Invitation envoyée à ${form.email}`)
      setOpen(false)
      setForm({ nom: '', email: '', role: 'collaborateur', collaborateur_id: NONE })
      router.refresh()
    } finally {
      setInviting(false)
    }
  }

  async function updateRole(id: string, role: UserRole) {
    setPendingId(id)
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        // On délie la fiche collaborateur si le rôle change pour autre chose
        // que "collaborateur" (le lien n'a plus de sens).
        body: JSON.stringify({ role, ...(role !== 'collaborateur' ? { collaborateur_id: null } : {}) }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Échec de la mise à jour'); return }
      toast.success('Rôle mis à jour')
      router.refresh()
    } finally {
      setPendingId(null)
    }
  }

  async function updateCollaborateurLink(id: string, collaborateurId: string | null) {
    setPendingId(id)
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collaborateur_id: !collaborateurId || collaborateurId === NONE ? null : collaborateurId }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Échec de la mise à jour'); return }
      toast.success('Lien mis à jour')
      router.refresh()
    } finally {
      setPendingId(null)
    }
  }

  async function handleRevoke() {
    if (!revokeId) return
    setRevoking(true)
    try {
      const res = await fetch(`/api/users/${revokeId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Échec de la révocation'); return }
      toast.success('Accès révoqué')
      router.refresh()
    } finally {
      setRevoking(false)
      setRevokeId(null)
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Comptes ({profiles.length})</CardTitle>
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />Inviter
          </Button>
        </CardHeader>
        <CardContent className="space-y-1">
          {profiles.map((p) => {
            const isSelf = p.id === currentUserId
            const busy = pendingId === p.id
            return (
              <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {p.nom} {isSelf && <span className="text-xs text-gray-400">(vous)</span>}
                  </p>
                  <p className="text-xs text-gray-400 truncate">{p.email}</p>
                </div>

                <Select value={p.role} onValueChange={(v) => updateRole(p.id, v as UserRole)} disabled={isSelf || busy}>
                  <SelectTrigger className="h-8 w-36">
                    <SelectValue>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${ROLE_BADGE[p.role]}`}>{ROLE_LABEL[p.role]}</span>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(ROLE_LABEL) as UserRole[]).map((r) => (
                      <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {p.role === 'collaborateur' && (
                  <Select
                    value={p.collaborateur_id ?? NONE}
                    onValueChange={(v) => updateCollaborateurLink(p.id, v)}
                    disabled={busy}
                  >
                    <SelectTrigger className="h-8 w-44">
                      <SelectValue placeholder="Lier à un collaborateur">
                        {p.collaborateur_id ? (collaborateurById[p.collaborateur_id]?.nom ?? '—') : '— Non lié —'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>— Non lié —</SelectItem>
                      {p.collaborateur_id && !collaborateurById[p.collaborateur_id] && (
                        <SelectItem value={p.collaborateur_id} disabled>Fiche introuvable</SelectItem>
                      )}
                      {(p.collaborateur_id ? [collaborateurById[p.collaborateur_id], ...collaborateursDisponibles] : collaborateursDisponibles)
                        .filter(Boolean)
                        .map((c) => (
                          <SelectItem key={c!.id} value={c!.id}>{c!.nom}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                )}

                <Button
                  variant="ghost" size="sm"
                  onClick={() => setRevokeId(p.id)}
                  disabled={isSelf}
                  className="text-red-400 hover:text-red-600"
                  title="Révoquer l'accès"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )
          })}
          {profiles.length === 0 && (
            <p className="text-sm text-gray-400 py-4 text-center">Aucun compte pour le moment.</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Inviter un utilisateur
            </DialogTitle>
            <DialogDescription>
              Un email d&apos;invitation est envoyé pour que la personne définisse elle-même son mot de passe.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nom *</Label>
              <Input value={form.nom} onChange={(e) => setForm((p) => ({ ...p, nom: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Rôle</Label>
              <Select value={form.role} onValueChange={(v) => setForm((p) => ({ ...p, role: v as UserRole }))}>
                <SelectTrigger><SelectValue>{ROLE_LABEL[form.role]}</SelectValue></SelectTrigger>
                <SelectContent>
                  {(Object.keys(ROLE_LABEL) as UserRole[]).map((r) => (
                    <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-400">
                {form.role === 'admin' && 'Accès complet, y compris la gestion des utilisateurs.'}
                {form.role === 'manager' && 'Accès complet à l\'outil, sauf la gestion des utilisateurs.'}
                {form.role === 'collaborateur' && 'Accès limité à son propre planning et ses tâches assignées.'}
              </p>
            </div>
            {form.role === 'collaborateur' && (
              <div className="space-y-2">
                <Label>Lier à une fiche collaborateur existante (optionnel)</Label>
                <Select value={form.collaborateur_id} onValueChange={(v) => setForm((p) => ({ ...p, collaborateur_id: v ?? NONE }))}>
                  <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>— Aucun —</SelectItem>
                    {collaborateursDisponibles.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-400">
                  Si cette personne a déjà une fiche collaborateur (utilisée sur des projets/tâches), la lier lui
                  rend immédiatement visibles les tâches déjà assignées.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={handleInvite} disabled={inviting}>
              {inviting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Envoyer l&apos;invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!revokeId} onOpenChange={() => setRevokeId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Révoquer cet accès ?</DialogTitle>
            <DialogDescription>
              La personne ne pourra plus se connecter à l&apos;outil. Son compte de connexion n&apos;est pas
              supprimé, seul son accès est retiré (réversible en créant un nouveau profil).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeId(null)}>Annuler</Button>
            <Button variant="destructive" onClick={handleRevoke} disabled={revoking}>
              {revoking ? 'Révocation...' : 'Révoquer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
