import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import type { DashboardStats } from '@/types/api'

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api<DashboardStats>('GET', '/api/dashboard'),
  })
}
