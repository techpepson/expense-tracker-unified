import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Category } from '@/types'
import { api } from './client'
import { qk } from './queryKeys'
import { invalidateDerived } from './dashboard'

export interface CategoryInput {
  name: string
  description: string
  is_active: boolean
}

export async function fetchCategories(): Promise<Category[]> {
  const { data } = await api.get<Category[]>('/api/admin/categories')
  return data
}

export function useCategories() {
  return useQuery({ queryKey: qk.categories, queryFn: fetchCategories, staleTime: 60_000 })
}

/** Active categories only, in display order — what the expense form offers. */
export function selectActiveCategories(categories: readonly Category[] | undefined): Category[] {
  return (categories ?? []).filter((c) => c.is_active).sort((a, b) => a.sort_order - b.sort_order)
}

function useInvalidateCategories() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: qk.categories })
    void qc.invalidateQueries({ queryKey: qk.itemsAll })
    invalidateDerived(qc)
  }
}

export function useCreateCategory() {
  const invalidate = useInvalidateCategories()
  return useMutation({
    mutationFn: async (input: CategoryInput) => (await api.post<Category>('/api/admin/categories', input)).data,
    onSuccess: invalidate,
  })
}

export function useUpdateCategory() {
  const invalidate = useInvalidateCategories()
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<CategoryInput> & { id: string }) =>
      (await api.put<Category>(`/api/admin/categories/${id}`, input)).data,
    onSuccess: invalidate,
  })
}

/** Optimistic drag-to-reorder: the list moves immediately and rolls back on error. */
export function useReorderCategories() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ids: string[]) => (await api.put<Category[]>('/api/admin/categories/reorder', { ids })).data,
    onMutate: async (ids) => {
      await qc.cancelQueries({ queryKey: qk.categories })
      const previous = qc.getQueryData<Category[]>(qk.categories)
      if (previous) {
        const next = ids
          .map((id, i) => {
            const c = previous.find((p) => p.id === id)
            return c ? { ...c, sort_order: i + 1 } : null
          })
          .filter((c): c is Category => c !== null)
        qc.setQueryData(qk.categories, next)
      }
      return { previous }
    },
    onError: (_e, _ids, ctx) => {
      if (ctx?.previous) qc.setQueryData(qk.categories, ctx.previous)
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: qk.categories })
      invalidateDerived(qc)
    },
  })
}

