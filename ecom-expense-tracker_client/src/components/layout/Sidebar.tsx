import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  PlusCircle,
  Receipt,
  Wallet,
  BarChart3,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { APP_NAME } from '@/lib/constants'

const NAV_ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/expenses/new', icon: PlusCircle, label: 'Add Expense' },
  { to: '/expenses', icon: Receipt, label: 'Expenses' },
  { to: '/petty-cash', icon: Wallet, label: 'Petty Cash' },
  { to: '/reports', icon: BarChart3, label: 'Monthly Reports' },
]

const ACCOUNT_ITEMS = [
  { to: '/settings', icon: Settings, label: 'Settings' },
]

interface SidebarProps {
  onClose?: () => void
}

export function Sidebar({ onClose }: SidebarProps) {
  const location = useLocation()

  const isActive = (to: string) => {
    if (to === '/dashboard') return location.pathname === '/dashboard'
    if (to === '/expenses/new') return location.pathname === '/expenses/new'
    if (to === '/expenses') {
      return (
        location.pathname === '/expenses' ||
        (location.pathname.startsWith('/expenses/') && location.pathname !== '/expenses/new')
      )
    }
    return location.pathname === to || location.pathname.startsWith(to + '/')
  }

  return (
    <div className="sidebar-bg flex h-full w-60 flex-col py-5">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 pb-7">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl"
          style={{ background: 'linear-gradient(135deg, #38bdf8 0%, #2563eb 100%)' }}
        >
          <span className="text-sm font-bold text-white">e</span>
        </div>
        <span className="text-[15px] font-semibold text-white">{APP_NAME}</span>
      </div>

      {/* Main nav */}
      <nav className="flex-1 px-3 space-y-1">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <Link
            key={to}
            to={to}
            onClick={onClose}
            className={cn(
              'flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium transition-all',
              isActive(to)
                ? 'bg-primary text-white shadow-[0_0_0_4px_rgba(37,99,235,0.2)]'
                : 'text-[#bfdbfe] hover:bg-white/10 hover:text-white'
            )}
          >
            <Icon size={18} />
            {label}
          </Link>
        ))}
      </nav>

      {/* Account group */}
      <div className="px-3 pt-4">
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-[#6b93d6]">
          Account
        </p>
        {ACCOUNT_ITEMS.map(({ to, icon: Icon, label }) => (
          <Link
            key={to}
            to={to}
            onClick={onClose}
            className={cn(
              'flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium transition-all',
              isActive(to)
                ? 'bg-primary text-white'
                : 'text-[#bfdbfe] hover:bg-white/10 hover:text-white'
            )}
          >
            <Icon size={18} />
            {label}
          </Link>
        ))}
      </div>
    </div>
  )
}

