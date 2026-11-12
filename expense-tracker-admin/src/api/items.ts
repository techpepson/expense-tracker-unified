import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Item, ItemStatus } from '@/types'
import { api } from './client'
import { qk } from './queryKeys'
import { invalidateDerived } from './dashboard'

export interface ItemFilters {
  status?: ItemStatus | ''
  category_id?: string
  search?: string
}

export async function fetchItems(f: ItemFilters = {}): Promise<Item[]> {
  const params = Object.fromEntries(Object.entries(f).filter(([, v]) => v))
  const { data } = await api.get<Item[]>('/api/admin/items', { params })
  return data
}

export function useItems(f: ItemFilters = {}) {
  return useQuery({ queryKey: qk.items(f), queryFn: () => fetchItems(f), staleTime: 30_000 })
}

function useInvalidateItems() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: qk.itemsAll })
    void qc.invalidateQueries({ queryKey: qk.categories })
    void qc.invalidateQueries({ queryKey: qk.expensesAll })
    invalidateDerived(qc)
  }
}

export function useCreateItem() {
  const invalidate = useInvalidateItems()
  return useMutation({
    mutationFn: async (input: { name: string; category_id: string }) => (await api.post<Item>('/api/admin/items', input)).data,
    onSuccess: invalidate,
  })
}

export function useUpdateItem() {
  const invalidate = useInvalidateItems()
  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string; name?: string; category_id?: string; status?: ItemStatus }) =>
      (await api.put<Item>(`/api/admin/items/${id}`, input)).data,
    onSuccess: invalidate,
  })
}

export function useMergeItem() {
  const invalidate = useInvalidateItems()
  return useMutation({
    mutationFn: async ({ id, target_id }: { id: string; target_id: string }) =>
      (await api.post<{ moved: number; target: Item }>(`/api/admin/items/${id}/merge`, { target_id })).data,
    onSuccess: invalidate,
  })
}

export function useApproveItem() {
  const invalidate = useInvalidateItems()
  return useMutation({
    mutationFn: async (id: string) => (await api.post<Item>(`/api/admin/items/${id}/approve`)).data,
    onSuccess: invalidate,
  })
}

export function useRejectItem() {
  const invalidate = useInvalidateItems()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/api/admin/items/${id}/reject`)
    },
    onSuccess: invalidate,
  })
}

