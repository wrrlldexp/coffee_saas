import { useState } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { useTeam, useInviteMember, useRemoveMember } from '@/api/queries/use-team'
import { Users, Plus, Trash2, Loader2 } from 'lucide-react'
import { initials } from '@/lib/utils'
import type { TaktRole } from '@/types/api'

const TAKT_ROLES: { value: TaktRole; label: string }[] = [
  { value: 'OWNER', label: 'Владелец' },
  { value: 'OPS_DIRECTOR', label: 'Операционный директор' },
  { value: 'HEAD_BARISTA', label: 'Старший бариста' },
  { value: 'MANAGER', label: 'Менеджер' },
  { value: 'BARISTA', label: 'Бариста' },
  { value: 'TRAINEE', label: 'Стажёр' },
]

export function TeamPage() {
  const { data: team, isLoading } = useTeam()
  const inviteMember = useInviteMember()
  const removeMember = useRemoveMember()
  const [showForm, setShowForm] = useState(false)
  const [email, setEmail] = useState('')
  const [taktRole, setTaktRole] = useState<TaktRole>('BARISTA')

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    await inviteMember.mutateAsync({ email, role: 'member', taktRole })
    setEmail('')
    setTaktRole('BARISTA')
    setShowForm(false)
  }

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>
  }

  return (
    <div>
      <PageHeader
        title="Команда"
        description="Управление сотрудниками"
        action={
          <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover">
            <Plus className="h-4 w-4" /> Пригласить
          </button>
        }
      />

      {showForm && (
        <form onSubmit={handleInvite} className="mb-6 rounded-xl border border-border bg-surface p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-text">Email</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} required type="email" className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" placeholder="user@example.com" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-text">Роль</label>
              <select value={taktRole} onChange={(e) => setTaktRole(e.target.value as TaktRole)} className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20">
                {TAKT_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button type="submit" disabled={inviteMember.isPending} className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60">
              {inviteMember.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Пригласить
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-bg-subtle">Отмена</button>
          </div>
        </form>
      )}

      {!team || team.length === 0 ? (
        <EmptyState icon={Users} title="Нет сотрудников" description="Пригласите команду" />
      ) : (
        <div className="space-y-3">
          {team.map((m) => (
            <div key={m.id} className="flex items-center justify-between rounded-xl border border-border bg-surface p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-sm font-bold text-accent-text">
                  {initials(m.name)}
                </div>
                <div>
                  <p className="font-medium text-text">{m.name}</p>
                  <p className="text-sm text-text-secondary">{m.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-bg-subtle px-2.5 py-1 text-xs font-medium text-text-secondary">
                  {TAKT_ROLES.find((r) => r.value === m.taktRole)?.label ?? m.taktRole}
                </span>
                <button
                  onClick={() => { if (confirm(`Удалить ${m.name}?`)) removeMember.mutate(m.id) }}
                  className="rounded-md p-1 text-text-muted hover:bg-danger-bg hover:text-danger"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
