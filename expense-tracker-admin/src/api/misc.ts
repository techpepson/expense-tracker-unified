import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AnnualReport, ImportPayload, ImportResultCounts, MonthlyReport, Settings, User } from '@/types'
import { api } from './client'
import { normalizeUser } from './auth'
import { qk } from './queryKeys'
import { useAuthStore } from '@/stores/auth'

// ---- Reports ----
export async function fetchMonthlyReport(month: number, year: number, createdBy?: string): Promise<MonthlyReport> {
  const { data } = await api.get<MonthlyReport>('/api/admin/reports/monthly', {
    params: { month, year, ...(createdBy ? { created_by: createdBy } : {}) },
  })
  return data
}

export function useMonthlyReport(month: number, year: number, createdBy?: string) {
  return useQuery({
    queryKey: qk.monthlyReport(month, year, createdBy),
    queryFn: () => fetchMonthlyReport(month, year, createdBy),
    placeholderData: keepPreviousData,
  })
}

export function useAnnualReport(year: number) {
  return useQuery({
    queryKey: qk.annualReport(year),
    queryFn: async () => (await api.get<AnnualReport>('/api/admin/reports/annual', { params: { year } })).data,
    placeholderData: keepPreviousData,
  })
}

// ---- Import ----
export function useImport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: ImportPayload) => (await api.post<ImportResultCounts>('/api/admin/import', payload)).data,
    onSuccess: () => {
      void qc.invalidateQueries()
    },
  })
}

// ---- Settings ----
export function useSettings() {
  return useQuery({
    queryKey: qk.settings,
    queryFn: async () => (await api.get<Settings>('/api/admin/settings')).data,
    staleTime: 5 * 60_000,
  })
}

export function useUpdateSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: Partial<Settings>) => (await api.put<Settings>('/api/admin/settings', input)).data,
    onSuccess: (s) => {
      qc.setQueryData(qk.settings, s)
      // Period start day / currency affect every derived figure.
      void qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'settings' })
    },
  })
}

/** Currency code from organisation settings (defaults to GHS while loading). */
export function useCurrency(): string {
  return useSettings().data?.currency ?? 'GHS'
}

// ---- Me ----
function useSyncMe() {
  const qc = useQueryClient()
  const setUser = useAuthStore((s) => s.setUser)
  return (u: User) => {
    setUser(u)
    qc.setQueryData(qk.me, u)
    void qc.invalidateQueries({ queryKey: qk.usersAll })
  }
}

export function useUpdateProfile() {
  const sync = useSyncMe()
  return useMutation({
    mutationFn: async (input: { full_name: string; email: string }) =>
      normalizeUser((await api.put<User & { id: string | number }>('/api/me', input)).data),
    onSuccess: sync,
  })
}

export function useChangePassword() {
  return useMutation({
    mutationFn: async (input: { current_password: string; new_password: string }) => {
      await api.put('/api/me/password', input)
    },
  })
}

export function useUploadAvatar() {
  const sync = useSyncMe()
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData()
      form.append('avatar', file)
      return normalizeUser((await api.post<User & { id: string | number }>('/api/me/avatar', form)).data)
    },
    onSuccess: sync,
  })
}

