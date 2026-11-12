import { format } from 'date-fns'

/**
 * Reporting periods. With period_start_day = 1 a period is the calendar month.
 * With a later start day (e.g. 25) the period labelled "November 2026" runs from
 * 25 Nov 2026 to 24 Dec 2026 (it is named after the month in which it starts).
 */
export interface Period {
  start: string // inclusive yyyy-MM-dd
  end: string // inclusive yyyy-MM-dd
}

const iso = (d: Date) => format(d, 'yyyy-MM-dd')

export function periodRange(month: number, year: number, startDay = 1): Period {
  const day = Math.min(Math.max(1, Math.round(startDay)), 28)
  if (day === 1) {
    return { start: iso(new Date(year, month - 1, 1)), end: iso(new Date(year, month, 0)) }
  }
  return { start: iso(new Date(year, month - 1, day)), end: iso(new Date(year, month, day - 1)) }
}

export function inPeriod(date: string, period: Period): boolean {
  return date >= period.start && date <= period.end
}

/** Which period (month/year) a date falls in. */
export function periodOf(date: string, startDay = 1): { month: number; year: number } {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  const day = Math.min(Math.max(1, Math.round(startDay)), 28)
  if (day === 1 || d >= day) return { month: m, year: y }
  return m === 1 ? { month: 12, year: y - 1 } : { month: m - 1, year: y }
}

export function previousPeriod(month: number, year: number): { month: number; year: number } {
  return month === 1 ? { month: 12, year: year - 1 } : { month: month - 1, year }
}

export function comparePeriods(a: { month: number; year: number }, b: { month: number; year: number }): number {
  return a.year - b.year || a.month - b.month
}

