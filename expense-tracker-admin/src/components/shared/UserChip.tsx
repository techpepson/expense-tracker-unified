import { initials } from '@/lib/formatters'
import { cn } from '@/lib/utils'

export function AvatarCircle({
  name,
  src,
  size = 'md',
  className,
}: {
  name: string
  src?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const dims =
    size === 'sm' ? 'h-7 w-7 text-xs' : size === 'lg' ? 'h-12 w-12 text-base' : 'h-8 w-8 text-xs'
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={cn('rounded-full object-cover border border-[#BFDBFE] shrink-0', dims, className)}
      />
    )
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#2563EB] to-[#1E3A8A] font-semibold text-white',
        dims,
        className,
      )}
    >
      {initials(name)}
    </span>
  )
}

export function UserChip({
  name,
  email,
  avatarUrl,
  pill = false,
  className,
}: {
  name: string
  email?: string
  avatarUrl?: string | null
  pill?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-2.5',
        pill &&
          'rounded-full border border-[var(--border-card)] bg-[var(--surface-card)] py-1 pl-1.5 pr-3.5 shadow-xs',
        className,
      )}
    >
      <AvatarCircle name={name} src={avatarUrl} size="sm" />
      <div className="min-w-0 leading-tight">
        <div className="truncate text-sm font-medium text-[var(--text-primary)]">{name}</div>
        {email && <div className="truncate text-xs text-[var(--text-secondary)]">{email}</div>}
      </div>
    </div>
  )
}

