import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { PettyCashEntry, PettyCashEntryType, PettyCashMonth } from '@/types'
import { api } from './client'
import { qk } from './queryKeys'
import { invalidateDerived } from './dashboard'

export interface PettyCashInput {
  entry_type: PettyCashEntryType
  amount: number
  entry_date: string
  description: string
}

export async function fetchPettyCash(month: number, year: number): Promise<PettyCashMonth> {
  const { data } = await api.get<PettyCashMonth>('/api/admin/petty-cash', { params: { month, year } })
  return data
}

export function usePettyCash(month: number, year: number) {
  return useQuery({ queryKey: qk.pettyCash(month, year), queryFn: () => fetchPettyCash(month, year), placeholderData: keepPreviousData })
}

function useInvalidatePetty() {
  const qc = useQueryClient()
  return () => {
    // Every later month's opening balance depends on earlier entries.
    void qc.invalidateQueries({ queryKey: qk.pettyCashAll })
    invalidateDerived(qc)
  }
}

export function useCreatePettyCash() {
  const invalidate = useInvalidatePetty()
  return useMutation({
    mutationFn: async (input: PettyCashInput) => (await api.post<PettyCashEntry>('/api/admin/petty-cash/entries', input)).data,
    onSuccess: invalidate,
  })
}

export function useUpdatePettyCash() {
  const invalidate = useInvalidatePetty()
  return useMutation({
    mutationFn: async ({ id, ...input }: PettyCashInput & { id: string }) =>
      (await api.put<PettyCashEntry>(`/api/admin/petty-cash/entries/${id}`, input)).data,
    onSuccess: invalidate,
  })
}

export function useDeletePettyCash() {
  const invalidate = useInvalidatePetty()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/admin/petty-cash/entries/${id}`)
    },
    onSuccess: invalidate,
  })
}

export function useSetOpeningBalance() {
  const invalidate = useInvalidatePetty()
  return useMutation({
    mutationFn: async (input: { amount: number; month: number; year: number }) =>
      (await api.put('/api/admin/petty-cash/opening-balance', input)).data,
    onSuccess: invalidate,
  })
}

