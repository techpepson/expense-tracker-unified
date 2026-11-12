import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from './client'
import type { PettyCashSummary } from '@/types'

export const pettyCashKeys = {
  all: ['petty-cash'] as const,
  summary: (month: number, year: number) =>
    [...pettyCashKeys.all, 'summary', month, year] as const,
}

export interface CreatePettyCashEntryDto {
  entry_type: 'cash_in' | 'cash_out' | 'charge'
  amount: number
  entry_date: string
  description: string
}

export function normalizePettyCashSummary(raw: any): PettyCashSummary {
  return {
    opening_balance: Number(raw?.opening_balance ?? 0),
    cash_in: Number(raw?.cash_in ?? 0),
    cash_out_total: Number(raw?.cash_out_total ?? 0),
    charges: Number(raw?.charges ?? 0),
    closing_balance: Number(raw?.closing_balance ?? 0),
    cash_used: Number(raw?.cash_used ?? 0),
    entries: Array.isArray(raw?.entries)
      ? raw.entries.map((e: any) => ({
          id: String(e.id),
          entry_type: e.entry_type,
          amount: Number(e.amount ?? 0),
          entry_date: String(e.entry_date ?? '').slice(0, 10),
          description: e.description ?? '',
          created_by: String(e.created_by ?? ''),
          created_by_name: e.created_by_name ?? '',
          created_at: e.created_at ?? new Date().toISOString(),
        }))
      : [],
  }
}

export async function getPettyCashSummary(
  month: number,
  year: number
): Promise<PettyCashSummary> {
  const res = await apiClient.get<any>('/api/petty-cash', {
    params: { month, year },
  })
  return normalizePettyCashSummary(res.data)
}

export async function createPettyCashEntry(
  data: CreatePettyCashEntryDto
): Promise<void> {
  await apiClient.post('/api/petty-cash/entries', data)
}

export async function updatePettyCashEntry(
  id: string,
  data: Partial<CreatePettyCashEntryDto>
): Promise<void> {
  await apiClient.put(`/api/petty-cash/entries/${id}`, data)
}

export async function deletePettyCashEntry(id: string): Promise<void> {
  await apiClient.delete(`/api/petty-cash/entries/${id}`)
}

export function usePettyCashSummary(month: number, year: number) {
  return useQuery({
    queryKey: pettyCashKeys.summary(month, year),
    queryFn: () => getPettyCashSummary(month, year),
  })
}

export function useCreatePettyCashEntry(month: number, year: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createPettyCashEntry,
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: pettyCashKeys.summary(month, year) }),
  })
}

export function useDeletePettyCashEntry(month: number, year: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deletePettyCashEntry,
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: pettyCashKeys.summary(month, year) }),
  })
}
