import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'

interface TeamMember {
  id: string
  name: string
  email: string
  phone: string | null
  image: string | null
  role: string
  taktRole: string
  locationIds: string[]
}

export function useTeam() {
  return useQuery({
    queryKey: ['team'],
    queryFn: () => api<TeamMember[]>('GET', '/api/team'),
  })
}

export function useInviteMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { email: string; role: string; taktRole: string }) =>
      api('POST', '/api/team/invite', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team'] }),
  })
}

export function useUpdateMemberRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ memberId, ...data }: { memberId: string; taktRole: string; locationIds?: string[] }) =>
      api('PUT', `/api/team/${memberId}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team'] }),
  })
}

export function useRemoveMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (memberId: string) => api('DELETE', `/api/team/${memberId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team'] }),
  })
}
