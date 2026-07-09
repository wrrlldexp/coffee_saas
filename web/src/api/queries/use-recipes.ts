import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import type { Recipe } from '@/types/api'

export function useRecipes() {
  return useQuery({
    queryKey: ['recipes'],
    queryFn: () => api<Recipe[]>('GET', '/api/recipes'),
  })
}

export function useCreateRecipe() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Recipe>) =>
      api<Recipe>('POST', '/api/recipes', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recipes'] }),
  })
}

export function useUpdateRecipe() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<Recipe>) =>
      api<Recipe>('PUT', `/api/recipes/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recipes'] }),
  })
}

export function useDeleteRecipe() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api('DELETE', `/api/recipes/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recipes'] }),
  })
}
