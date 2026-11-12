import { cva, type VariantProps } from 'class-variance-authority'
import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
  {
    variants: {
      variant: {
        category: 'bg-[#DBEAFE] text-[#1E3A8A] dark:bg-[#1E3A8A]/70 dark:text-[#DBEAFE]',
        shared: 'bg-[#E0F2FE] text-[#0369A1] border border-[#38BDF8]/40 dark:bg-sky-950/70 dark:text-[#38BDF8]',
        individual: 'bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE] dark:bg-[#172554] dark:text-[#93C5FD]',
        admin: 'bg-[#1E3A8A] text-white',
        employee: 'bg-[#EFF6FF] text-[#1E3A8A] border border-[#BFDBFE] dark:bg-[#172554] dark:text-[#DBEAFE]',
        approved: 'bg-[#DBEAFE] text-[#1E3A8A] dark:bg-[#1E3A8A] dark:text-[#DBEAFE]',
        active: 'bg-[#DBEAFE] text-[#1E3A8A] dark:bg-[#1E3A8A] dark:text-[#DBEAFE]',
        pending: 'bg-[#E0F2FE] text-[#0284C7] border border-[#38BDF8]/50 dark:bg-sky-950 dark:text-[#38BDF8]',
        inactive: 'bg-slate-100 text-[#475569] border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
        danger: 'bg-red-50 text-[#B91C1C] border border-[#FCA5A5] dark:bg-red-950/40 dark:text-red-300',
      },
    },
    defaultVariants: {
      variant: 'category',
    },
  },
)

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-[10px] bg-[#DBEAFE]/60 dark:bg-[#1E3A8A]/40', className)}
      {...props}
    />
  )
}

/**
 * Selectable option card: bordered 12px box that turns blue-bordered with #EFF6FF fill when selected.
 */
export function OptionCard({
  selected,
  onSelect,
  title,
  description,
  icon,
  disabled,
  role = 'radio',
}: {
  selected: boolean
  onSelect: () => void
  title: string
  description: string
  icon?: ReactNode
  disabled?: boolean
  role?: 'radio' | 'checkbox'
}) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        'flex w-full items-start gap-3 rounded-[12px] border p-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50',
        selected
          ? 'border-[#2563EB] bg-[#EFF6FF] dark:bg-[#172554]'
          : 'border-[var(--border-card)] bg-[var(--surface-card)] hover:border-[#BFDBFE]',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border',
          role === 'radio' ? 'rounded-full' : 'rounded-[6px]',
          selected ? 'border-[#2563EB] bg-[#2563EB] text-white' : 'border-[#BFDBFE] bg-white dark:bg-slate-900',
        )}
      >
        {selected && <span className={role === 'radio' ? 'h-2 w-2 rounded-full bg-white' : 'text-xs font-bold'}>✓</span>}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 font-semibold text-sm text-[#0F172A] dark:text-white">
          {icon}
          <span>{title}</span>
        </div>
        <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{description}</p>
      </div>
    </button>
  )
}

