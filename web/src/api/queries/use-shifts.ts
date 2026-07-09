import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import type { Shift } from '@/types/api'

export function useShifts(locationId?: string) {
  return useQuery({
    queryKey: ['shifts', locationId],
    queryFn: () => {
      const params = locationId ? `?locationId=${locationId}` : ''
      return api<Shift[]>('GET', `/api/shifts${params}`)
    },
  })
}

export function useShift(id: string) {
  return useQuery({
    queryKey: ['shift', id],
    queryFn: () => api<Shift>('GET', `/api/shifts/${id}`),
    enabled: !!id,
  })
}

export function useCreateShift() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { date: string; locationId: string; responsibleId?: string }) =>
      api<Shift>('POST', '/api/shifts', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shifts'] }),
  })
}

export function useCloseShift() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api('POST', `/api/shifts/${id}/close`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shifts'] })
      qc.invalidateQueries({ queryKey: ['shift'] })
    },
  })
}
