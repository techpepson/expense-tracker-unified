import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from './client'
import type { Expense, PaginatedResponse } from '@/types'

export const expenseKeys = {
  all: ['expenses'] as const,
  lists: () => [...expenseKeys.all, 'list'] as const,
  list: (params: ExpenseQueryParams) => [...expenseKeys.lists(), params] as const,
  detail: (id: string) => [...expenseKeys.all, 'detail', id] as const,
}

export interface ExpenseQueryParams {
  month?: number
  year?: number
  category_id?: string
  item_id?: string
  expense_type?: string
  search?: string
  page?: number
  limit?: number
  sort?: string
}

export interface CreateExpenseDto {
  category_id: string
  item_id?: string
  title?: string
  unit_cost: number
  quantity: number
  description?: string
  expense_date: string
  expense_type: 'individual' | 'shared_operational'
  notes?: string
}

export function normalizeExpense(raw: any): Expense {
  const total = Number(raw.total ?? raw.amount ?? 0)
  const quantity = Number(raw.quantity ?? 1)
  const unitCost =
    raw.unit_cost != null
      ? Number(raw.unit_cost)
      : quantity > 0
      ? Number((total / quantity).toFixed(2))
      : total

  return {
    id: String(raw.id),
    category_id: String(raw.category_id),
    category_name: raw.category?.name ?? raw.category_name,
    item_id: raw.item_id != null ? String(raw.item_id) : '',
    item_name: raw.item_name ?? raw.title ?? '',
    unit_cost: unitCost,
    quantity,
    total,
    description: raw.description ?? undefined,
    expense_date: String(raw.expense_date ?? '').slice(0, 10),
    expense_type: raw.expense_type,
    created_by: String(raw.created_by),
    created_by_name: raw.created_by_name ?? raw.creator?.full_name ?? '',
    notes: raw.notes ?? undefined,
    created_at: raw.created_at ?? new Date().toISOString(),
    updated_at: raw.updated_at ?? raw.created_at ?? new Date().toISOString(),
  }
}

export async function getExpenses(
  params: ExpenseQueryParams
): Promise<PaginatedResponse<Expense>> {
  const effectiveYear =
    params.month && !params.year ? new Date().getFullYear() : params.year

  const queryParams = {
    ...params,
    year: effectiveYear,
    q: params.search || undefined,
    page_size: params.limit || undefined,
  }

  const res = await apiClient.get<any>('/api/expenses', { params: queryParams })
  const items = Array.isArray(res.data?.items)
    ? res.data.items.map(normalizeExpense)
    : []

  return {
    items,
    total: Number(res.data?.total ?? items.length),
    page: Number(res.data?.page ?? params.page ?? 1),
    limit: Number(res.data?.page_size ?? res.data?.limit ?? params.limit ?? 15),
  }
}

export async function getExpense(id: string): Promise<Expense> {
  const res = await apiClient.get<any>(`/api/expenses/${id}`)
  return normalizeExpense(res.data)
}

function cleanExpensePayload(data: Partial<CreateExpenseDto>) {
  return {
    ...data,
    item_id: data.item_id ? data.item_id : undefined,
  }
}

export async function createExpense(data: CreateExpenseDto): Promise<Expense> {
  const res = await apiClient.post<any>('/api/expenses', cleanExpensePayload(data))
  return normalizeExpense(res.data)
}

export async function createExpensesBulk(data: CreateExpenseDto[]): Promise<Expense[]> {
  const res = await apiClient.post<any[]>(
    '/api/expenses/bulk',
    data.map((row) => cleanExpensePayload(row))
  )
  return res.data.map(normalizeExpense)
}

export async function updateExpense(
  id: string,
  data: Partial<CreateExpenseDto>
): Promise<Expense> {
  const res = await apiClient.put<any>(`/api/expenses/${id}`, cleanExpensePayload(data))
  return normalizeExpense(res.data)
}

export async function deleteExpense(id: string): Promise<void> {
  await apiClient.delete(`/api/expenses/${id}`)
}

export function useExpenses(params: ExpenseQueryParams) {
  return useQuery({
    queryKey: expenseKeys.list(params),
    queryFn: () => getExpenses(params),
  })
}

export function useExpense(id: string) {
  return useQuery({
    queryKey: expenseKeys.detail(id),
    queryFn: () => getExpense(id),
    enabled: !!id,
  })
}

export function useCreateExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createExpense,
    onSuccess: () => void qc.invalidateQueries({ queryKey: expenseKeys.lists() }),
  })
}

export function useCreateExpensesBulk() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createExpensesBulk,
    onSuccess: () => void qc.invalidateQueries({ queryKey: expenseKeys.lists() }),
  })
}

export function useUpdateExpense(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<CreateExpenseDto>) => updateExpense(id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: expenseKeys.lists() })
      void qc.invalidateQueries({ queryKey: expenseKeys.detail(id) })
    },
  })
}

export function useDeleteExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteExpense,
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: expenseKeys.lists() })
      return { id }
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: expenseKeys.lists() }),
  })
}
