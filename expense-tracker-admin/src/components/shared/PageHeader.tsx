import type { ReactNode } from 'react'
import { Menu, Moon, Sun } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore, useUiStore } from '@/stores/ui'
import { Button } from '@/components/ui/button'
import { UserChip } from './UserChip'

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
}) {
  const user = useAuthStore((s) => s.user)
  const { theme, toggle } = useThemeStore()
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen)

  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <Button
          variant="outline"
          size="iconSm"
          aria-label="Open navigation menu"
          onClick={() => setSidebarOpen(true)}
          className="mt-0.5 lg:hidden"
        >
          <Menu className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-[26px] font-bold leading-tight text-[#1E3A8A] dark:text-[#DBEAFE]">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-[var(--text-secondary)]">{subtitle}</p>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5 sm:justify-end">
        {actions}
        <Button
          variant="outline"
          size="iconSm"
          onClick={toggle}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        {user && (
          <UserChip
            pill
            name={user.full_name}
            avatarUrl={user.profile_picture}
          />
        )}
      </div>
    </header>
  )
}

