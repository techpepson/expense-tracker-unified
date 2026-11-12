import { useQuery } from '@tanstack/react-query'
import { apiClient } from './client'
import type { MonthlyReport, AnnualReport } from '@/types'
import { normalizeExpense } from './expenses'
import { normalizePettyCashSummary } from './petty-cash'

export const reportKeys = {
  all: ['reports'] as const,
  monthly: (month: number, year: number) =>
    [...reportKeys.all, 'monthly', month, year] as const,
  annual: (year: number) => [...reportKeys.all, 'annual', year] as const,
}

function normalizeMonthlyReport(raw: any): MonthlyReport {
  const expenses = Array.isArray(raw.expenses)
    ? raw.expenses.map(normalizeExpense)
    : []

  const totalPurchases = Number(raw.total_purchases ?? raw.total ?? 0)
  const recordCount = Number(raw.record_count ?? raw.count ?? expenses.length)

  const byTypeMap = new Map<string, number>()
  if (Array.isArray(raw.by_type)) {
    raw.by_type.forEach((t: any) => {
      byTypeMap.set(t.expense_type, Number(t.total ?? 0))
    })
  }

  const individualTotal = Number(
    raw.individual_total ?? byTypeMap.get('individual') ?? 0
  )
  const sharedTotal = Number(
    raw.shared_total ?? byTypeMap.get('shared_operational') ?? 0
  )

  const categories = Array.isArray(raw.categories)
    ? raw.categories.map((cat: any) => ({
        category_id: String(cat.category_id),
        category_name: cat.category_name,
        total: Number(cat.total ?? 0),
        items: Array.isArray(cat.items)
          ? cat.items.map((it: any) => ({
              item_id: String(it.item_id),
              item_name: it.item_name,
              entries: Array.isArray(it.entries)
                ? it.entries.map(normalizeExpense)
                : [],
              subtotal: Number(it.subtotal ?? 0),
            }))
          : [],
      }))
    : []

  return {
    month: Number(raw.month),
    year: Number(raw.year),
    total_purchases: totalPurchases,
    record_count: recordCount,
    individual_total: individualTotal,
    shared_total: sharedTotal,
    petty_cash: normalizePettyCashSummary(raw.petty_cash),
    categories,
    expenses,
  }
}

function normalizeAnnualReport(raw: any): AnnualReport {
  return {
    year: Number(raw.year),
    months: Array.isArray(raw.months)
      ? raw.months.map((m: any) => ({
          month: Number(m.month),
          total: Number(m.total ?? 0),
        }))
      : [],
    categories: Array.isArray(raw.categories)
      ? raw.categories.map((cat: any) => ({
          category_id: String(cat.category_id),
          category_name: cat.category_name,
          items: Array.isArray(cat.items)
            ? cat.items.map((it: any) => ({
                item_id: String(it.item_id),
                item_name: it.item_name,
                monthly_totals: Array.isArray(it.monthly_totals)
                  ? it.monthly_totals.map((v: any) => Number(v ?? 0))
                  : [],
                year_total: Number(it.year_total ?? 0),
              }))
            : [],
          monthly_totals: Array.isArray(cat.monthly_totals)
            ? cat.monthly_totals.map((v: any) => Number(v ?? 0))
            : [],
          year_total: Number(cat.year_total ?? 0),
        }))
      : [],
    grand_total: Number(raw.grand_total ?? 0),
  }
}

export async function getMonthlyReport(
  month: number,
  year: number
): Promise<MonthlyReport> {
  const res = await apiClient.get<any>('/api/reports/monthly', {
    params: { month, year },
  })
  return normalizeMonthlyReport(res.data)
}

export async function getAnnualReport(year: number): Promise<AnnualReport> {
  const res = await apiClient.get<any>('/api/reports/annual', {
    params: { year },
  })
  return normalizeAnnualReport(res.data)
}

export function useMonthlyReport(month: number, year: number) {
  return useQuery({
    queryKey: reportKeys.monthly(month, year),
    queryFn: () => getMonthlyReport(month, year),
  })
}

export function useAnnualReport(year: number) {
  return useQuery({
    queryKey: reportKeys.annual(year),
    queryFn: () => getAnnualReport(year),
  })
}
