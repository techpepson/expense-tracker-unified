import { useQuery } from '@tanstack/react-query'
import { apiClient } from './client'
import type { Category } from '@/types'

export const categoryKeys = {
  all: ['categories'] as const,
  list: () => [...categoryKeys.all, 'list'] as const,
}

export async function getCategories(): Promise<Category[]> {
  const res = await apiClient.get<any[]>('/api/categories')
  return res.data.map((c) => ({
    id: String(c.id),
    name: c.name,
    is_active: Boolean(c.is_active ?? true),
  }))
}

export function useCategories() {
  return useQuery({
    queryKey: categoryKeys.list(),
    queryFn: getCategories,
    staleTime: 5 * 60 * 1000,
  })
}
