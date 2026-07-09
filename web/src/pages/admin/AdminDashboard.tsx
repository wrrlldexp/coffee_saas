import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '@/components/shared/PageHeader'
import { Loader2, Users, Building2, Activity } from 'lucide-react'

interface AdminStats {
  totalUsers: number
  totalOrganizations: number
  activeToday: number
  users: { id: string; name: string; email: string; createdAt: string }[]
  organizations: { id: string; name: string; slug: string; membersCount: number }[]
}

export function AdminDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const res = await fetch('/api/admin/stats', { credentials: 'include' })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error?.message ?? 'Unauthorized')
      return json.data as AdminStats
    },
  })

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>
  }

  return (
    <div className="min-h-screen bg-bg p-6">
      <PageHeader title="Админ-панель" description="Обзор платформы" />

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-50 p-2.5"><Users className="h-5 w-5 text-blue-700" /></div>
            <div>
              <p className="text-2xl font-bold text-text">{stats?.totalUsers ?? 0}</p>
              <p className="text-sm text-text-secondary">Пользователи</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-accent-soft p-2.5"><Building2 className="h-5 w-5 text-accent-text" /></div>
            <div>
              <p className="text-2xl font-bold text-text">{stats?.totalOrganizations ?? 0}</p>
              <p className="text-sm text-text-secondary">Организации</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-success-bg p-2.5"><Activity className="h-5 w-5 text-success-text" /></div>
            <div>
              <p className="text-2xl font-bold text-text">{stats?.activeToday ?? 0}</p>
              <p className="text-sm text-text-secondary">Активных сегодня</p>
            </div>
          </div>
        </div>
      </div>

      {stats?.organizations && stats.organizations.length > 0 && (
        <div className="rounded-xl border border-border bg-surface p-5">
          <h2 className="mb-4 text-lg font-semibold text-text">Организации</h2>
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-bg-subtle">
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-text-muted">Название</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-text-muted">Slug</th>
                  <th className="px-4 py-2 text-right text-xs font-medium uppercase text-text-muted">Участников</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {stats.organizations.map((org) => (
                  <tr key={org.id} className="hover:bg-bg-subtle/50">
                    <td className="px-4 py-2.5 text-sm font-medium text-text">{org.name}</td>
                    <td className="px-4 py-2.5 text-sm text-text-secondary">{org.slug}</td>
                    <td className="px-4 py-2.5 text-right text-sm text-text-secondary">{org.membersCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
