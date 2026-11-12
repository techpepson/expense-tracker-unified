import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, TrendingUp, Wallet, Users2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useExpenses } from '@/api/expenses'
import { useCategories } from '@/api/categories'
import { usePettyCashSummary } from '@/api/petty-cash'
import { useAnnualReport } from '@/api/reports'
import { currentMonthYear, FULL_MONTH_NAMES } from '@/lib/formatters'
import { formatGHS } from '@/lib/money'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatCard } from '@/components/shared/StatCard'
import { DonutChart } from '@/components/shared/DonutChart'
import { BarTrendChart } from '@/components/shared/BarTrendChart'
import { DataTable } from '@/components/shared/DataTable'
import { PageSkeleton } from '@/components/shared/LoadingSkeleton'
import { CurrencyText } from '@/components/shared/CurrencyText'
import type { Expense } from '@/types'
import type { ColumnDef } from '@tanstack/react-table'
import { formatDate } from '@/lib/formatters'

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export function DashboardPage() {
  const { user } = useAuth()
  const firstName = user?.full_name.split(' ')[0] ?? 'there'

  const now = currentMonthYear()
  const [month, setMonth] = useState(now.month)
  const [year, setYear] = useState(now.year)

  const { data: categories = [] } = useCategories()
  const { data: expenses, isLoading: loadingExp } = useExpenses({ month, year, limit: 500 })
  const { data: pettyCash, isLoading: loadingPc } = usePettyCashSummary(month, year)
  const { data: annualReport, isLoading: loadingAnnual } = useAnnualReport(year)

  const isLoading = loadingExp || loadingPc || loadingAnnual

  const expenseList = expenses?.items ?? []

  const totalSpent = useMemo(
    () => expenseList.reduce((s, e) => s + e.total, 0),
    [expenseList]
  )

  const individualTotal = useMemo(
    () => expenseList.filter((e) => e.expense_type === 'individual').reduce((s, e) => s + e.total, 0),
    [expenseList]
  )

  const sharedTotal = useMemo(
    () => expenseList.filter((e) => e.expense_type === 'shared_operational').reduce((s, e) => s + e.total, 0),
    [expenseList]
  )

  // Category breakdown for donut
  const categoryData = useMemo(() => {
    const map = new Map<string, number>()
    const nameMap = new Map<string, string>(categories.map((c) => [c.id, c.name]))
    expenseList.forEach((e) => {
      const key = e.category_id
      map.set(key, (map.get(key) ?? 0) + e.total)
      if (e.category_name) {
        nameMap.set(key, e.category_name)
      }
    })
    return Array.from(map.entries()).map(([id, value]) => ({
      name: nameMap.get(id) ?? id,
      value,
    }))
  }, [expenseList, categories])

  // Largest category
  const largestCategory = useMemo(
    () => categoryData.sort((a, b) => b.value - a.value)[0],
    [categoryData]
  )

  // Trend data
  const trendData = useMemo(
    () => annualReport?.months ?? [],
    [annualReport]
  )

  // Recent expenses (last 5)
  const recentExpenses = useMemo(() => expenseList.slice(0, 5), [expenseList])

  const recentColumns: ColumnDef<Expense, unknown>[] = [
    {
      header: 'Date',
      accessorKey: 'expense_date',
      cell: (c) => <span className="text-muted">{formatDate(c.getValue() as string)}</span>,
    },
    {
      header: 'Item',
      accessorKey: 'item_name',
      cell: (c) => <span className="font-medium">{c.getValue() as string}</span>,
    },
    {
      header: 'Total',
      accessorKey: 'total',
      cell: (c) => <CurrencyText amount={c.getValue() as number} />,
    },
  ]

  if (isLoading) return <PageSkeleton />

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${getGreeting()}, ${firstName}`}
        subtitle="Here's your expense overview"
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="input-base w-auto min-w-[150px] pr-8 font-medium text-body"
              aria-label="Select month"
            >
              {FULL_MONTH_NAMES.map((m, i) => (
                <option key={i} value={i + 1}>{m}</option>
              ))}
            </select>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="input-base w-auto min-w-[100px] pr-8 font-medium text-body"
              aria-label="Select year"
            >
              {[2024, 2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <Link to="/expenses/new" className="btn-primary whitespace-nowrap shrink-0">
              <Plus size={16} />
              Add Expense
            </Link>
          </div>
        }
      />

      {/* Stats grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          variant="hero"
          title={`${FULL_MONTH_NAMES[month - 1]} Total`}
          value={<CurrencyText amount={totalSpent} className="text-3xl font-bold text-white" />}
          subtitle={`${expenseList.length} records`}
          icon={<TrendingUp size={22} />}
          className="sm:col-span-2"
        />
        <StatCard
          title="Largest Category"
          value={largestCategory?.name ?? '—'}
          subtitle={largestCategory ? formatGHS(largestCategory.value) : 'No data'}
        />
        <StatCard
          title="Petty Cash Balance"
          value={<CurrencyText amount={pettyCash?.closing_balance ?? 0} />}
          subtitle="Closing balance"
          icon={<Wallet size={20} />}
        />
      </div>

      {/* Individual / Shared split */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard
          title="Individual Expenses"
          value={<CurrencyText amount={individualTotal} />}
          subtitle={`${expenseList.filter((e) => e.expense_type === 'individual').length} records`}
          icon={<Users2 size={20} />}
        />
        <StatCard
          title="Shared / Operational"
          value={<CurrencyText amount={sharedTotal} />}
          subtitle={`${expenseList.filter((e) => e.expense_type === 'shared_operational').length} records`}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {categoryData.length > 0 ? (
          <DonutChart data={categoryData} label="Spending by category" />
        ) : (
          <div className="card flex items-center justify-center py-12 text-muted">
            No category data for this month.
          </div>
        )}
        <BarTrendChart
          data={trendData}
          currentMonth={month}
          label={`Monthly trend · ${year}`}
        />
      </div>

      {/* Recent expenses */}
      <div className="card p-0">
        <div className="flex items-center justify-between p-5 pb-0">
          <p className="text-sm font-semibold uppercase tracking-widest text-muted">
            Recent Expenses
          </p>
          <Link to="/expenses" className="text-sm text-primary hover:underline">
            View all →
          </Link>
        </div>
        <DataTable
          data={recentExpenses}
          columns={recentColumns}
          emptyTitle="No expenses yet"
          emptyMessage="Add your first expense to get started."
        />
      </div>
    </div>
  )
}

