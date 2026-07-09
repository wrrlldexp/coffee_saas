import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { CalendarDays, Loader2 } from 'lucide-react'
import { useTeam } from '@/api/queries/use-team'
import { useState, useMemo } from 'react'
import { format, startOfWeek, addDays, addWeeks, subWeeks } from 'date-fns'
import { ru } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface ScheduleEntry {
  id: string
  memberId: string
  date: string
  locationId: string
  startTime: string | null
  endTime: string | null
}

export function SchedulePage() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const weekStr = format(weekStart, 'yyyy-MM-dd')

  const { data: schedule, isLoading } = useQuery({
    queryKey: ['schedule', weekStr],
    queryFn: () => api<ScheduleEntry[]>('GET', `/api/schedule?week=${weekStr}`),
  })
  const { data: team } = useTeam()

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  )

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>
  }

  return (
    <div>
      <PageHeader title="Расписание" description="График работы команды" />

      <div className="mb-4 flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3">
        <button onClick={() => setWeekStart(subWeeks(weekStart, 1))} className="rounded-md p-1 hover:bg-bg-subtle">
          <ChevronLeft className="h-5 w-5 text-text-secondary" />
        </button>
        <h2 className="text-sm font-semibold text-text">
          {format(weekStart, 'd MMMM', { locale: ru })} — {format(addDays(weekStart, 6), 'd MMMM yyyy', { locale: ru })}
        </h2>
        <button onClick={() => setWeekStart(addWeeks(weekStart, 1))} className="rounded-md p-1 hover:bg-bg-subtle">
          <ChevronRight className="h-5 w-5 text-text-secondary" />
        </button>
      </div>

      {!team || team.length === 0 ? (
        <EmptyState icon={CalendarDays} title="Нет сотрудников" description="Добавьте команду для составления расписания" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="border-b border-border bg-bg-subtle">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-muted">Сотрудник</th>
                {weekDays.map((d) => (
                  <th key={d.toISOString()} className="px-2 py-3 text-center text-xs font-medium uppercase tracking-wide text-text-muted">
                    {format(d, 'EEE d', { locale: ru })}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {team.map((member) => (
                <tr key={member.id} className="hover:bg-bg-subtle/50">
                  <td className="px-4 py-3 text-sm font-medium text-text">{member.name}</td>
                  {weekDays.map((d) => {
                    const dateStr = format(d, 'yyyy-MM-dd')
                    const entry = schedule?.find(
                      (s) => s.memberId === member.id && s.date === dateStr,
                    )
                    return (
                      <td key={d.toISOString()} className="px-2 py-3 text-center">
                        {entry ? (
                          <span className="inline-block rounded bg-accent-soft px-2 py-1 text-xs font-medium text-accent-text">
                            {entry.startTime && entry.endTime
                              ? `${entry.startTime}–${entry.endTime}`
                              : 'Работает'}
                          </span>
                        ) : (
                          <span className="text-xs text-text-muted">—</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
