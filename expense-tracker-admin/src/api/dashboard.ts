import { keepPreviousData, useQuery, type QueryClient } from '@tanstack/react-query'
import type { DashboardData } from '@/types'
import { api } from './client'
import { qk } from './queryKeys'

export async function fetchDashboard(month: number, year: number): Promise<DashboardData> {
  const { data } = await api.get<DashboardData>('/api/admin/dashboard', { params: { month, year } })
  return data
}

export function useDashboard(month: number, year: number) {
  return useQuery({ queryKey: qk.dashboard(month, year), queryFn: () => fetchDashboard(month, year), placeholderData: keepPreviousData })
}

/** Everything derived from expense / catalog / petty cash data. */
export function invalidateDerived(qc: QueryClient): void {
  void qc.invalidateQueries({ queryKey: qk.dashboardAll })
  void qc.invalidateQueries({ queryKey: qk.reportsAll })
}

