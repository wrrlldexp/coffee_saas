import { useState, useMemo } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import { useCalendarTasks, useCreateCalendarTask, useToggleCalendarTask } from '@/api/queries/use-calendar'
import { Plus, Loader2, Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, isToday } from 'date-fns'
import { ru } from 'date-fns/locale'

export function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const monthStr = format(currentMonth, 'yyyy-MM')
  const { data: tasks, isLoading } = useCalendarTasks(monthStr)
  const createTask = useCreateCalendarTask()
  const toggleTask = useToggleCalendarTask()
  const [showForm, setShowForm] = useState(false)
  const [text, setText] = useState('')
  const [date, setDate] = useState('')

  const days = useMemo(() => {
    const start = startOfMonth(currentMonth)
    const end = endOfMonth(currentMonth)
    return eachDayOfInterval({ start, end })
  }, [currentMonth])

  const startDay = getDay(days[0])
  const offset = startDay === 0 ? 6 : startDay - 1

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    await createTask.mutateAsync({ text, date })
    setText('')
    setDate('')
    setShowForm(false)
  }

  return (
    <div>
      <PageHeader
        title="Календарь"
        description="Задачи и события"
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
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-text">Задача</label>
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                required
                className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
            </div>
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
          </div>
          <div className="mt-4 flex gap-2">
            <button type="submit" disabled={createTask.isPending} className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60">
              {createTask.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Создать
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-bg-subtle">
              Отмена
            </button>
          </div>
        </form>
      )}

      {/* Month navigation */}
      <div className="mb-4 flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3">
        <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="rounded-md p-1 hover:bg-bg-subtle">
          <ChevronLeft className="h-5 w-5 text-text-secondary" />
        </button>
        <h2 className="text-lg font-semibold capitalize text-text">
          {format(currentMonth, 'LLLL yyyy', { locale: ru })}
        </h2>
        <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="rounded-md p-1 hover:bg-bg-subtle">
          <ChevronRight className="h-5 w-5 text-text-secondary" />
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface overflow-hidden">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 border-b border-border bg-bg-subtle">
            {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((d) => (
              <div key={d} className="px-2 py-2 text-center text-xs font-medium text-text-muted">
                {d}
              </div>
            ))}
          </div>
          {/* Days grid */}
          <div className="grid grid-cols-7">
            {Array.from({ length: offset }).map((_, i) => (
              <div key={`e-${i}`} className="min-h-[80px] border-b border-r border-border-subtle p-1" />
            ))}
            {days.map((day) => {
              const dayTasks = tasks?.filter((t) => isSameDay(new Date(t.date), day)) ?? []
              return (
                <div
                  key={day.toISOString()}
                  className={`min-h-[80px] border-b border-r border-border-subtle p-1 ${
                    isToday(day) ? 'bg-accent-soft/30' : ''
                  }`}
                >
                  <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                    isToday(day) ? 'bg-accent font-bold text-white' : 'text-text-secondary'
                  }`}>
                    {format(day, 'd')}
                  </span>
                  {dayTasks.map((t) => (
                    <div
                      key={t.id}
                      className={`mt-0.5 flex items-center gap-1 rounded px-1 py-0.5 text-xs ${
                        t.done ? 'line-through text-text-muted' : 'text-text'
                      }`}
                      style={t.color ? { backgroundColor: t.color + '20', color: t.color } : undefined}
                    >
                      <button
                        onClick={() => toggleTask.mutate({ id: t.id, done: !t.done })}
                        className="shrink-0"
                      >
                        <Check className={`h-3 w-3 ${t.done ? 'text-success' : 'text-text-muted'}`} />
                      </button>
                      <span className="truncate">{t.text}</span>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
