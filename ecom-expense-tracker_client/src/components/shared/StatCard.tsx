import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

interface StatCardProps {
  title: string
  value: ReactNode
  subtitle?: ReactNode
  icon?: ReactNode
  variant?: 'default' | 'hero' | 'muted'
  className?: string
}

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  variant = 'default',
  className,
}: StatCardProps) {
  if (variant === 'hero') {
    return (
      <div className={cn('hero-card', className)}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-blue-200">{title}</p>
            <p className="mt-1.5 text-3xl font-bold">{value}</p>
            {subtitle && <p className="mt-1 text-sm text-blue-200">{subtitle}</p>}
          </div>
          {icon && (
            <div className="rounded-xl bg-white/15 p-2.5 text-white">{icon}</div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={cn('card', className)}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted">
            {title}
          </p>
          <p className="mt-1.5 text-2xl font-bold text-body">{value}</p>
          {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
        </div>
        {icon && (
          <div className="ml-3 rounded-xl bg-tint p-2.5 text-primary">{icon}</div>
        )}
      </div>
    </div>
  )
}

