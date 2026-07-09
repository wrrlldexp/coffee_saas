import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import type { CalendarTask } from '@/types/api'

export function useCalendarTasks(month?: string) {
  return useQuery({
    queryKey: ['calendar', month],
    queryFn: () => {
      const params = month ? `?month=${month}` : ''
      return api<CalendarTask[]>('GET', `/api/calendar${params}`)
    },
  })
}

export function useCreateCalendarTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { text: string; date: string; color?: string; assignedTo?: string }) =>
      api<CalendarTask>('POST', '/api/calendar', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar'] }),
  })
}

export function useToggleCalendarTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) =>
      api<CalendarTask>('PUT', `/api/calendar/${id}`, { done }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar'] }),
  })
}

export function useDeleteCalendarTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api('DELETE', `/api/calendar/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar'] }),
  })
}
