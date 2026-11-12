import type { ReactNode } from 'react'
import { MONTH_NAMES } from '@/lib/formatters'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'

export function FormField({
  label,
  htmlFor,
  required,
  hint,
  error,
  children,
  className,
}: {
  label: string
  htmlFor?: string
  required?: boolean
  hint?: ReactNode
  error?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-[#0F172A] dark:text-slate-100"
      >
        {label}
        {required && <span className="ml-0.5 text-[#B91C1C]">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-[var(--text-secondary)]">{hint}</p>}
      {error && (
        <p role="alert" className="text-xs font-medium text-[#B91C1C]">
          {error}
        </p>
      )}
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[14px] border border-dashed border-[var(--border-card)] bg-[var(--surface-tint)]/50 px-6 py-12 text-center">
      {icon && (
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#DBEAFE] text-[#2563EB] dark:bg-[#1E3A8A] dark:text-[#38BDF8]">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-[#1E3A8A] dark:text-[#DBEAFE]">{title}</h3>
      {description && <p className="mt-1 max-w-md text-sm text-[var(--text-secondary)]">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function MonthYearPicker({
  month,
  year,
  onMonthChange,
  onYearChange,
  allowAllMonths = false,
  years = [2025, 2026, 2027],
}: {
  month: number | undefined
  year: number
  onMonthChange: (month: number | undefined) => void
  onYearChange: (year: number) => void
  allowAllMonths?: boolean
  years?: number[]
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-38">
        <Select
          aria-label="Month"
          value={month ?? ''}
          onChange={(e) => onMonthChange(e.target.value ? Number(e.target.value) : undefined)}
        >
          {allowAllMonths && <option value="">All months</option>}
          {MONTH_NAMES.map((name, idx) => (
            <option key={name} value={idx + 1}>
              {name}
            </option>
          ))}
        </Select>
      </div>
      <div className="w-26">
        <Select
          aria-label="Year"
          value={year}
          onChange={(e) => onYearChange(Number(e.target.value))}
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </Select>
      </div>
    </div>
  )
}

