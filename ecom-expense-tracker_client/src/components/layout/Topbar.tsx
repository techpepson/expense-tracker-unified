import { Menu, Sun, Moon, LogOut, User } from 'lucide-react'
import { useSidebarStore } from '@/stores/sidebarStore'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'
import { getInitials } from '@/lib/utils'
import { useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

export function Topbar() {
  const { toggle } = useSidebarStore()
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const qc = useQueryClient()

  const handleLogout = () => {
    qc.clear()
    logout()
    window.location.href = '/login'
  }

  const initials = user ? getInitials(user.full_name) : '?'

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[#e0ecff] bg-white/80 px-4 backdrop-blur-sm dark:border-navy/40 dark:bg-[#0f172a]/80 md:px-6">
      {/* Hamburger (mobile) */}
      <button
        className="rounded-lg p-1.5 text-muted hover:bg-light-blue md:hidden"
        onClick={toggle}
        aria-label="Open navigation"
      >
        <Menu size={20} />
      </button>
      <div className="hidden md:block" />

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="rounded-lg p-1.5 text-muted hover:bg-light-blue"
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>

        {/* User chip */}
        <div className="flex items-center gap-2 rounded-full border border-[#e0ecff] bg-white px-3 py-1.5 shadow-sm dark:border-navy dark:bg-[#1e293b]">
          {user?.profile_picture ? (
            <img
              src={user.profile_picture}
              alt={user.full_name}
              className="h-7 w-7 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
              {initials}
            </div>
          )}
          <span className="hidden text-sm font-medium text-body sm:block">
            {user?.full_name}
          </span>

          {/* Dropdown */}
          <div className="relative ml-1 flex items-center gap-1">
            <Link
              to="/settings"
              className="rounded p-0.5 text-muted hover:text-primary"
              aria-label="Settings"
            >
              <User size={15} />
            </Link>
            <button
              onClick={handleLogout}
              className="rounded p-0.5 text-muted hover:text-red-600"
              aria-label="Sign out"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}

