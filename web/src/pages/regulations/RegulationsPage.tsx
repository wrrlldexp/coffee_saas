import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { ClipboardList, Loader2 } from 'lucide-react'

interface Regulation {
  id: string
  name: string
  description: string | null
  items: unknown[]
  orgId: string
}

export function RegulationsPage() {
  const { data: regulations, isLoading } = useQuery({
    queryKey: ['regulations'],
    queryFn: () => api<Regulation[]>('GET', '/api/regulations'),
  })

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>
  }

  return (
    <div>
      <PageHeader title="Регламенты" description="Стандарты и правила работы" />

      {!regulations || regulations.length === 0 ? (
        <EmptyState icon={ClipboardList} title="Нет регламентов" description="Регламенты появятся здесь" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {regulations.map((r) => (
            <div key={r.id} className="rounded-xl border border-border bg-surface p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-accent-soft p-2"><ClipboardList className="h-5 w-5 text-accent-text" /></div>
                <div>
                  <h3 className="font-semibold text-text">{r.name}</h3>
                  {r.description && <p className="text-sm text-text-secondary">{r.description}</p>}
                </div>
              </div>
              <p className="mt-3 text-sm text-text-muted">
                {Array.isArray(r.items) ? `${r.items.length} пунктов` : ''}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
