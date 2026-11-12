import { format, parseISO, isValid } from 'date-fns'

/** Format an ISO date string for display */
export function formatDate(iso: string, fmt = 'dd MMM yyyy'): string {
  try {
    const d = parseISO(iso)
    if (!isValid(d)) return iso
    return format(d, fmt)
  } catch {
    return iso
  }
}

/** Format an ISO date string as Month Year */
export function formatMonthYear(month: number, year: number): string {
  return format(new Date(year, month - 1, 1), 'MMMM yyyy')
}

/** Returns 'YYYY-MM' string from month + year numbers */
export function toMonthKey(month: number, year: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

/** Get current month and year */
export function currentMonthYear(): { month: number; year: number } {
  const now = new Date()
  return { month: now.getMonth() + 1, year: now.getFullYear() }
}

/** Short month name */
export const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

export const FULL_MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

