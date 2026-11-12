import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Expense, ExpenseType, Paginated } from '@/types'
import { api } from './client'
import { qk } from './queryKeys'
import { invalidateDerived } from './dashboard'

export interface ExpenseFilters {
  month?: number
  year?: number
  category_id?: string
  item_id?: string
  expense_type?: ExpenseType | ''
  created_by?: string
  search?: string
  page?: number
  limit?: number
  sort?: string
}

export interface ExpenseInput {
  category_id: string
  item_id: string
  unit_cost: number
  quantity: number
  description: string
  expense_date: string
  expense_type: ExpenseType
  incurred_by?: string | null
  notes?: string | null
}

const clean = (f: object) => Object.fromEntries(Object.entries(f).filter(([, v]) => v !== undefined && v !== '' && v !== null))

export async function fetchExpenses(f: ExpenseFilters): Promise<Paginated<Expense>> {
  const { data } = await api.get<Paginated<Expense>>('/api/admin/expenses', { params: clean(f) })
  return data
}

export function useExpenses(f: ExpenseFilters) {
  return useQuery({ queryKey: qk.expenses(f), queryFn: () => fetchExpenses(f), placeholderData: keepPreviousData })
}

export function useExpense(id: string | undefined) {
  return useQuery({
    queryKey: qk.expense(id ?? ''),
    queryFn: async () => (await api.get<Expense>(`/api/admin/expenses/${id}`)).data,
    enabled: !!id,
  })
}

function useInvalidateExpenses() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: qk.expensesAll })
    void qc.invalidateQueries({ queryKey: qk.itemsAll })
    invalidateDerived(qc)
  }
}

export function useCreateExpense() {
  const invalidate = useInvalidateExpenses()
  return useMutation({
    mutationFn: async (input: ExpenseInput) => (await api.post<Expense>('/api/admin/expenses', input)).data,
    onSuccess: invalidate,
  })
}

export function useCreateExpensesBulk() {
  const invalidate = useInvalidateExpenses()
  return useMutation({
    mutationFn: async (lines: ExpenseInput[]) => (await api.post<Expense[]>('/api/admin/expenses/bulk', { lines })).data,
    onSuccess: invalidate,
  })
}

export function useUpdateExpense() {
  const qc = useQueryClient()
  const invalidate = useInvalidateExpenses()
  return useMutation({
    mutationFn: async ({ id, ...input }: ExpenseInput & { id: string }) => (await api.put<Expense>(`/api/admin/expenses/${id}`, input)).data,
    onSuccess: (e) => {
      qc.setQueryData(qk.expense(e.id), e)
      invalidate()
    },
  })
}

/** Optimistic delete: the row disappears from every cached list immediately. */
export function useDeleteExpense() {
  const qc = useQueryClient()
  const invalidate = useInvalidateExpenses()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/admin/expenses/${id}`)
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: [...qk.expensesAll, 'list'] })
      const snapshots = qc.getQueriesData<Paginated<Expense>>({ queryKey: [...qk.expensesAll, 'list'] })
      for (const [key, data] of snapshots) {
        if (!data) continue
        const removed = data.data.find((e) => e.id === id)
        if (!removed) continue
        qc.setQueryData<Paginated<Expense>>(key, {
          ...data,
          data: data.data.filter((e) => e.id !== id),
          total: data.total - 1,
          total_amount: data.total_amount !== undefined ? Math.round((data.total_amount - removed.total) * 100) / 100 : undefined,
        })
      }
      return { snapshots }
    },
    onError: (_e, _id, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data))
    },
    onSettled: (_d, _e, id) => {
      qc.removeQueries({ queryKey: qk.expense(id) })
      invalidate()
    },
  })
}

