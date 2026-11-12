import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from './client'
import type { Item } from '@/types'

export const itemKeys = {
  all: ['items'] as const,
  list: (params?: { category_id?: string; search?: string }) =>
    [...itemKeys.all, 'list', params] as const,
}

function normalizeItem(raw: any): Item {
  return {
    id: String(raw.id),
    category_id: String(raw.category_id),
    name: raw.name,
    status: raw.status === 'pending' ? 'pending' : 'approved',
  }
}

export async function getItems(params?: {
  category_id?: string
  search?: string
}): Promise<Item[]> {
  const res = await apiClient.get<any[]>('/api/items', { params })
  return res.data.map(normalizeItem)
}

export async function suggestItem(data: {
  category_id: string
  name: string
}): Promise<Item> {
  const res = await apiClient.post<any>('/api/items', data)
  return normalizeItem(res.data)
}

export function useItems(params?: { category_id?: string; search?: string }) {
  return useQuery({
    queryKey: itemKeys.list(params),
    queryFn: () => getItems(params),
    staleTime: 2 * 60 * 1000,
  })
}

export function useSuggestItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: suggestItem,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: itemKeys.all })
    },
  })
}
