import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

export function StatCard({
  label,
  value,
  subtext,
  icon,
  hero = false,
  to,
  className,
}: {
  label: string
  value: ReactNode
  subtext?: ReactNode
  icon?: ReactNode
  hero?: boolean
  to?: string
  className?: string
}) {
  const content = (
    <div
      className={cn(
        hero ? 'hero-card' : 'app-card',
        to && 'transition-transform hover:-translate-y-0.5 hover:border-[#2563EB]',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            'text-xs font-semibold uppercase tracking-wider',
            hero ? 'text-[#DBEAFE]' : 'text-[var(--text-secondary)]',
          )}
        >
          {label}
        </span>
        {icon && (
          <span
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]',
              hero ? 'bg-white/15 text-white' : 'bg-[#EFF6FF] text-[#2563EB] dark:bg-[#172554] dark:text-[#38BDF8]',
            )}
          >
            {icon}
          </span>
        )}
      </div>
      <div
        className={cn(
          'mt-2.5 text-2xl font-bold tracking-tight tabular-nums',
          hero ? 'text-white sm:text-3xl' : 'text-[#0F172A] dark:text-white',
        )}
      >
        {value}
      </div>
      {subtext && (
        <div className={cn('mt-1.5 text-xs', hero ? 'text-[#DBEAFE]' : 'text-[var(--text-secondary)]')}>
          {subtext}
        </div>
      )}
    </div>
  )

  return to ? <Link to={to} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] rounded-[16px]">{content}</Link> : content
}

