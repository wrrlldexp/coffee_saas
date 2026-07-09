import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import type { Location } from '@/types/api'

export function useLocations() {
  return useQuery({
    queryKey: ['locations'],
    queryFn: () => api<Location[]>('GET', '/api/locations'),
  })
}

export function useCreateLocation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; address?: string; timezone: string }) =>
      api<Location>('POST', '/api/locations', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['locations'] }),
  })
}

export function useUpdateLocation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; address?: string; timezone?: string }) =>
      api<Location>('PUT', `/api/locations/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['locations'] }),
  })
}

export function useDeleteLocation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api('DELETE', `/api/locations/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['locations'] }),
  })
}
