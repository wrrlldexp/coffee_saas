import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { useShifts, useCreateShift, useCloseShift } from '@/api/queries/use-shifts'
import { useLocations } from '@/api/queries/use-locations'
import { useState } from 'react'
import { Clock, Plus, Loader2, CheckCircle2 } from 'lucide-react'
import { formatDate } from '@/lib/utils'

export function ShiftsPage() {
  const { data: shifts, isLoading } = useShifts()
  const { data: locations } = useLocations()
  const createShift = useCreateShift()
  const closeShift = useCloseShift()
  const [showForm, setShowForm] = useState(false)
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [locationId, setLocationId] = useState('')

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    await createShift.mutateAsync({ date, locationId })
    setShowForm(false)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Смены"
        description="Управление рабочими сменами"
        action={
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover"
          >
            <Plus className="h-4 w-4" />
            Открыть смену
          </button>
        }
      />

      {showForm && (
        <form onSubmit={handleCreate} className="mb-6 rounded-xl border border-border bg-surface p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-text">Дата</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-text">Локация</label>
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                required
                className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              >
                <option value="">Выберите локацию</option>
                {locations?.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              disabled={createShift.isPending}
              className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
            >
              {createShift.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Открыть
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-bg-subtle"
            >
              Отмена
            </button>
          </div>
        </form>
      )}

      {!shifts || shifts.length === 0 ? (
        <EmptyState icon={Clock} title="Нет смен" description="Откройте первую смену" />
      ) : (
        <div className="space-y-3">
          {shifts.map((s) => {
            const loc = locations?.find((l) => l.id === s.locationId)
            return (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-xl border border-border bg-surface p-4"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`rounded-lg p-2 ${
                      s.status === 'OPEN' ? 'bg-success-bg' : 'bg-bg-subtle'
                    }`}
                  >
                    <Clock
                      className={`h-5 w-5 ${
                        s.status === 'OPEN' ? 'text-success-text' : 'text-text-muted'
                      }`}
                    />
                  </div>
                  <div>
                    <p className="font-medium text-text">
                      {formatDate(s.date)} — {loc?.name ?? 'Неизвестная локация'}
                    </p>
                    <span
                      className={`text-xs font-medium ${
                        s.status === 'OPEN' ? 'text-success' : 'text-text-muted'
                      }`}
                    >
                      {s.status === 'OPEN' ? 'Открыта' : 'Закрыта'}
                    </span>
                  </div>
                </div>
                {s.status === 'OPEN' && (
                  <button
                    onClick={() => closeShift.mutate(s.id)}
                    disabled={closeShift.isPending}
                    className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-bg-subtle"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Закрыть
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
