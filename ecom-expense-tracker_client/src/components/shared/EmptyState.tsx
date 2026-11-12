import type { ReactNode } from 'react'
import { PackageSearch } from 'lucide-react'

interface EmptyStateProps {
  title?: string
  message?: string
  icon?: ReactNode
  action?: ReactNode
}

export function EmptyState({
  title = 'Nothing here yet',
  message = 'No records found.',
  icon,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 rounded-full bg-tint p-5 text-primary">
        {icon ?? <PackageSearch size={36} />}
      </div>
      <h3 className="text-base font-semibold text-body">{title}</h3>
      <p className="mt-1 max-w-xs text-sm text-muted">{message}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

