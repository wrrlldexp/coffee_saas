import { useState } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { CheckSquare, Plus, Trash2, Loader2 } from 'lucide-react'

interface Checklist {
  id: string
  name: string
  items: { text: string; done: boolean }[]
  locationId: string | null
  orgId: string
}

export function ChecklistsPage() {
  const { data: checklists, isLoading } = useQuery({
    queryKey: ['checklists'],
    queryFn: () => api<Checklist[]>('GET', '/api/checklists'),
  })
  const qc = useQueryClient()
  const createChecklist = useMutation({
    mutationFn: (data: { name: string }) => api<Checklist>('POST', '/api/checklists', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['checklists'] }),
  })
  const deleteChecklist = useMutation({
    mutationFn: (id: string) => api('DELETE', `/api/checklists/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['checklists'] }),
  })

  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    await createChecklist.mutateAsync({ name })
    setName('')
    setShowForm(false)
  }

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>
  }

  return (
    <div>
      <PageHeader
        title="Чек-листы"
        description="Шаблоны для контроля процессов"
        action={
          <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover">
            <Plus className="h-4 w-4" /> Добавить
          </button>
        }
      />

      {showForm && (
        <form onSubmit={handleCreate} className="mb-6 rounded-xl border border-border bg-surface p-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-text">Название</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" placeholder="Чек-лист открытия" />
          </div>
          <div className="mt-4 flex gap-2">
            <button type="submit" disabled={createChecklist.isPending} className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60">
              {createChecklist.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Создать
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-bg-subtle">Отмена</button>
          </div>
        </form>
      )}

      {!checklists || checklists.length === 0 ? (
        <EmptyState icon={CheckSquare} title="Нет чек-листов" description="Создайте чек-лист для стандартизации процессов" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {checklists.map((c) => (
            <div key={c.id} className="rounded-xl border border-border bg-surface p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-accent-soft p-2"><CheckSquare className="h-5 w-5 text-accent-text" /></div>
                  <h3 className="font-semibold text-text">{c.name}</h3>
                </div>
                <button onClick={() => { if (confirm('Удалить?')) deleteChecklist.mutate(c.id) }} className="rounded-md p-1 text-text-muted hover:bg-danger-bg hover:text-danger">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-3 text-sm text-text-secondary">
                {Array.isArray(c.items) ? `${c.items.length} пунктов` : 'Пусто'}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
