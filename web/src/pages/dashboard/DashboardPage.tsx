import { PageHeader } from '@/components/shared/PageHeader'
import { useDashboard } from '@/api/queries/use-dashboard'
import { useOrg } from '@/hooks/use-org'
import { useRoleCheck } from '@/hooks/use-role'
import {
  MapPin,
  Users,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from 'lucide-react'

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof MapPin
  label: string
  value: string | number
  color: string
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="flex items-center gap-3">
        <div className={`rounded-lg p-2.5 ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-bold text-text">{value}</p>
          <p className="text-sm text-text-secondary">{label}</p>
        </div>
      </div>
    </div>
  )
}

export function DashboardPage() {
  const { data: stats, isLoading } = useDashboard()
  const { activeMembership, role } = useOrg()
  const { canViewDashboard } = useRoleCheck(role)

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
        title={`${activeMembership?.orgName ?? 'Дашборд'}`}
        description={canViewDashboard ? 'Обзор за сегодня' : 'Добро пожаловать'}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={MapPin}
          label="Локации"
          value={stats?.locations?.length ?? 0}
          color="bg-accent-soft text-accent-text"
        />
        <StatCard
          icon={Users}
          label="Сотрудники"
          value={stats?.members?.length ?? 0}
          color="bg-blue-50 text-blue-700"
        />
        <StatCard
          icon={Clock}
          label="Смены сегодня"
          value={stats?.todayShifts?.length ?? 0}
          color="bg-warning-bg text-warning-text"
        />
        <StatCard
          icon={AlertTriangle}
          label="Оповещения"
          value={stats?.alerts?.length ?? 0}
          color="bg-danger-bg text-danger-text"
        />
      </div>

      {stats?.pendingTasks && stats.pendingTasks.length > 0 && (
        <div className="mt-6 rounded-xl border border-border bg-surface p-5">
          <h2 className="mb-4 text-lg font-semibold text-text">Задачи на сегодня</h2>
          <ul className="space-y-2">
            {stats.pendingTasks.map((task: any, i: number) => (
              <li key={i} className="flex items-center gap-2 text-sm text-text-secondary">
                <CheckCircle2 className="h-4 w-4 text-text-muted" />
                {typeof task === 'string' ? task : JSON.stringify(task)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
