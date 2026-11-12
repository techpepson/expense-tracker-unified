import { format, isValid, parseISO } from 'date-fns'

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

export const MONTH_SHORT = MONTH_NAMES.map((m) => m.slice(0, 3))

export function monthName(month: number): string {
  return MONTH_NAMES[month - 1] ?? `Month ${month}`
}

export function monthLabel(month: number, year: number): string {
  return `${monthName(month)} ${year}`
}

/** "2026-03-12" -> "12 Mar 2026". */
export function formatDate(value: string | null | undefined, pattern = 'd MMM yyyy'): string {
  if (!value) return '—'
  const d = parseISO(value)
  return isValid(d) ? format(d, pattern) : value
}

export function formatDateTime(value: string | null | undefined): string {
  return formatDate(value, "d MMM yyyy 'at' HH:mm")
}

/** Today's date as yyyy-MM-dd in local time. */
export function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

export function initials(name: string | null | undefined): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return (first + last).toUpperCase()
}

export function formatNumber(n: number, maxFractionDigits = 2): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: maxFractionDigits }).format(n)
}

export function formatPercent(n: number): string {
  return `${n.toFixed(n > 0 && n < 10 ? 1 : 0)}%`
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`
}

export const EXPENSE_TYPE_LABEL = {
  individual: 'Individual',
  shared_operational: 'Shared operational',
} as const

export const ENTRY_TYPE_LABEL = {
  cash_in: 'Cash-in',
  cash_out: 'Cash-out',
  charge: 'Charge',
} as const

