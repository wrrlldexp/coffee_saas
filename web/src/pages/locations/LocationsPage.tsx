import { useState } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { useLocations, useCreateLocation, useDeleteLocation } from '@/api/queries/use-locations'
import { MapPin, Plus, Trash2, Loader2 } from 'lucide-react'

export function LocationsPage() {
  const { data: locations, isLoading } = useLocations()
  const createLocation = useCreateLocation()
  const deleteLocation = useDeleteLocation()
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [timezone, setTimezone] = useState('Europe/Moscow')

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    await createLocation.mutateAsync({ name, address: address || undefined, timezone })
    setName('')
    setAddress('')
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
        title="Локации"
        description="Управление точками"
        action={
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover"
          >
            <Plus className="h-4 w-4" />
            Добавить
          </button>
        }
      />

      {showForm && (
        <form onSubmit={handleCreate} className="mb-6 rounded-xl border border-border bg-surface p-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-text">Название</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                placeholder="Кофейня на Пушкина"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-text">Адрес</label>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                placeholder="ул. Пушкина, 1"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-text">Часовой пояс</label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              >
                <option value="Europe/Moscow">Москва (UTC+3)</option>
                <option value="Europe/Samara">Самара (UTC+4)</option>
                <option value="Asia/Yekaterinburg">Екатеринбург (UTC+5)</option>
                <option value="Asia/Novosibirsk">Новосибирск (UTC+7)</option>
                <option value="Asia/Vladivostok">Владивосток (UTC+10)</option>
              </select>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              disabled={createLocation.isPending}
              className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
            >
              {createLocation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Создать
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

      {!locations || locations.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="Нет локаций"
          description="Добавьте первую точку для начала работы"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {locations.map((loc) => (
            <div key={loc.id} className="rounded-xl border border-border bg-surface p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-accent-soft p-2">
                    <MapPin className="h-5 w-5 text-accent-text" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-text">{loc.name}</h3>
                    {loc.address && (
                      <p className="text-sm text-text-secondary">{loc.address}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (confirm('Удалить локацию?')) deleteLocation.mutate(loc.id)
                  }}
                  className="rounded-md p-1 text-text-muted hover:bg-danger-bg hover:text-danger"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                    loc.isOpen
                      ? 'bg-success-bg text-success-text'
                      : 'bg-bg-subtle text-text-muted'
                  }`}
                >
                  {loc.isOpen ? 'Открыто' : 'Закрыто'}
                </span>
                <span className="text-xs text-text-muted">{loc.timezone}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
