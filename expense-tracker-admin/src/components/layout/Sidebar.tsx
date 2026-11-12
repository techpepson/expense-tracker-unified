import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  BarChart3,
  FileUp,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Package,
  PlusCircle,
  Receipt,
  Settings,
  ShieldCheck,
  Users,
  Wallet,
  X,
} from 'lucide-react'
import { useItems, useLogout } from '@/api'
import { useUiStore } from '@/stores/ui'
import { cn } from '@/lib/utils'

interface NavItem {
  to: string
  label: string
  icon: typeof LayoutDashboard
  end?: boolean
  badge?: number
}

export function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const logout = useLogout()
  const { sidebarOpen, setSidebarOpen } = useUiStore()
  const { data: pendingItems } = useItems({ status: 'pending' })
  const pendingCount = pendingItems?.length ?? 0

  const mainNav: NavItem[] = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/expenses', label: 'Expenses', icon: Receipt, end: true },
    { to: '/expenses/new', label: 'Add Expense', icon: PlusCircle },
    { to: '/petty-cash', label: 'Petty Cash', icon: Wallet },
    { to: '/reports', label: 'Monthly Reports', icon: BarChart3 },
  ]

  const catalogNav: NavItem[] = [
    { to: '/categories', label: 'Categories', icon: FolderKanban },
    { to: '/items', label: 'Items', icon: Package, badge: pendingCount },
  ]

  const peopleNav: NavItem[] = [{ to: '/users', label: 'Users', icon: Users }]

  const systemNav: NavItem[] = [
    { to: '/import', label: 'Data Import', icon: FileUp },
    { to: '/settings', label: 'Settings', icon: Settings },
  ]

  const renderGroup = (title: string | null, items: NavItem[]) => (
    <div className="space-y-1">
      {title && (
        <div className="px-3 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#93C5FD]/70">
          {title}
        </div>
      )}
      {items.map((item) => {
        const Icon = item.icon
        const isExpensesList =
          item.to === '/expenses' &&
          location.pathname.startsWith('/expenses') &&
          location.pathname !== '/expenses/new'
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              cn(
                'flex items-center justify-between gap-2.5 rounded-[10px] px-3 py-2.5 text-sm font-medium transition-all',
                isActive || isExpensesList
                  ? 'nav-active-glow'
                  : 'text-[#BFDBFE] hover:bg-white/10 hover:text-white',
              )
            }
          >
            <span className="flex items-center gap-2.5 truncate">
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </span>
            {item.badge !== undefined && item.badge > 0 && (
              <span
                aria-label={`${item.badge} pending item suggestions`}
                className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#38BDF8] px-1.5 text-[11px] font-bold text-[#172554]"
              >
                {item.badge}
              </span>
            )}
          </NavLink>
        )
      })}
    </div>
  )

  const handleSignOut = async () => {
    setSidebarOpen(false)
    await logout()
    navigate('/login', { replace: true })
  }

  const content = (
    <aside
      aria-label="Administrator navigation"
      className="sidebar-gradient flex h-full w-[240px] shrink-0 flex-col justify-between px-3.5 py-5 text-white select-none"
    >
      <div className="space-y-5 overflow-y-auto">
        <div className="flex items-center justify-between px-1.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-gradient-to-br from-[#38BDF8] to-[#2563EB] shadow-md">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold tracking-tight text-white">e-COM Admin</span>
                <span className="rounded-full bg-[#38BDF8]/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#38BDF8]">
                  ADMIN
                </span>
              </div>
              <p className="text-[11px] text-[#93C5FD]">Expense Tracker</p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={() => setSidebarOpen(false)}
            className="rounded-[8px] p-1 text-[#BFDBFE] hover:bg-white/10 hover:text-white lg:hidden cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="space-y-1">
          {renderGroup(null, mainNav)}
          {renderGroup('Catalog', catalogNav)}
          {renderGroup('People', peopleNav)}
          {renderGroup('System', systemNav)}
        </nav>
      </div>

      <div className="border-t border-white/10 pt-3">
        <button
          type="button"
          onClick={handleSignOut}
          className="flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-sm font-medium text-[#BFDBFE] transition-colors hover:bg-white/10 hover:text-white cursor-pointer"
        >
          <LogOut className="h-4 w-4" />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  )

  return (
    <>
      <div className="hidden lg:block lg:fixed lg:inset-y-0 lg:left-0 lg:z-30">{content}</div>
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden" role="dialog" aria-modal="true">
          <div
            className="fixed inset-0 bg-[#0F172A]/60 backdrop-blur-[2px]"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="relative z-10 flex h-full">{content}</div>
        </div>
      )}
    </>
  )
}

