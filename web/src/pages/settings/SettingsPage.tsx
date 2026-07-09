import { useState } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import { useOrg } from '@/hooks/use-org'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { Loader2 } from 'lucide-react'

export function SettingsPage() {
  const { activeMembership } = useOrg()
  const qc = useQueryClient()
  const [name, setName] = useState(activeMembership?.orgName ?? '')
  const [timezone, setTimezone] = useState(activeMembership?.orgTimezone ?? 'Europe/Moscow')

  const updateOrg = useMutation({
    mutationFn: (data: { name: string; timezone: string }) =>
      api('PUT', '/api/settings', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    updateOrg.mutate({ name, timezone })
  }

  return (
    <div>
      <PageHeader title="Настройки" description="Настройки организации" />

      <form onSubmit={handleSubmit} className="max-w-lg rounded-xl border border-border bg-surface p-6">
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-text">Название организации</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </div>
        <div className="mb-6">
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
        <button
          type="submit"
          disabled={updateOrg.isPending}
          className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
        >
          {updateOrg.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Сохранить
        </button>
        {updateOrg.isSuccess && (
          <p className="mt-3 text-sm text-success">Сохранено</p>
        )}
      </form>
    </div>
  )
}
