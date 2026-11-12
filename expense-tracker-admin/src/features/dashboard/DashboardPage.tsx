import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ArrowRight,
  Check,
  FolderKanban,
  Layers,
  Package,
  Plus,
  Receipt,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  errorMessage,
  useApproveItem,
  useCategories,
  useCurrency,
  useDashboard,
  useUsers,
} from '@/api'
import {
  EXPENSE_TYPE_LABEL,
  MONTH_SHORT,
  formatDate,
  formatPercent,
  monthLabel,
  pluralize,
} from '@/lib/formatters'
import { formatMoney } from '@/lib/money'
import { Button } from '@/components/ui/button'
import { Badge, Skeleton } from '@/components/ui/badge'
import {
  CurrencyText,
  EmptyState,
  MonthYearPicker,
  PageHeader,
  StatCard,
  UserChip,
} from '@/components/shared'

const CHART_BLUES = ['#1E3A8A', '#2563EB', '#60A5FA', '#38BDF8', '#BFDBFE'] as const

export function DashboardPage() {
  const now = new Date()
  const [month, setMonth] = useState<number>(now.getMonth() + 1)
  const [year, setYear] = useState<number>(2026)
  const navigate = useNavigate()
  const currency = useCurrency()

  const { data, isLoading } = useDashboard(month, year)
  const { data: categories } = useCategories()
  const { data: users } = useUsers()
  const approveItem = useApproveItem()

  const categoryNameById = useMemo(
    () => new Map((categories ?? []).map((c) => [c.id, c.name])),
    [categories],
  )
  const userById = useMemo(() => new Map((users ?? []).map((u) => [u.id, u])), [users])

  const donutData = useMemo(
    () =>
      (data?.by_category ?? []).map((c, idx) => ({
        ...c,
        fill: CHART_BLUES[idx % CHART_BLUES.length]!,
      })),
    [data?.by_category],
  )

  const trendData = useMemo(
    () =>
      (data?.monthly_trend ?? []).map((m) => ({
        month: m.month,
        label: MONTH_SHORT[m.month - 1] ?? '',
        total: m.total,
        isCurrent: m.month === month,
      })),
    [data?.monthly_trend, month],
  )

  const handleQuickApprove = async (id: string, name: string) => {
    try {
      await approveItem.mutateAsync(id)
      toast.success(`Approved "${name}"`)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle={`Organisation-wide expenditure overview for ${monthLabel(month, year)}`}
        actions={
          <>
            <MonthYearPicker
              month={month}
              year={year}
              onMonthChange={(m) => m && setMonth(m)}
              onYearChange={setYear}
            />
            <Button asChild>
              <Link to="/expenses/new">
                <Plus className="h-4 w-4" />
                Add Expense
              </Link>
            </Button>
          </>
        }
      />

      {isLoading || !data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className={i === 0 ? 'h-36 sm:col-span-2' : 'h-32'} />
          ))}
        </div>
      ) : (
        <>
          {/* Hero + Stat cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              hero
              className="sm:col-span-2"
              label={`Total spent on purchases · ${monthLabel(month, year)}`}
              value={<CurrencyText amount={data.total_spent} />}
              subtext={`${pluralize(data.record_count, 'expense record')} · Always computed from line items`}
              icon={<Receipt className="h-5 w-5" />}
            />

            <StatCard
              label="Largest category"
              value={data.largest_category ? data.largest_category.name : 'No spend'}
              subtext={
                data.largest_category ? (
                  <span>
                    <CurrencyText amount={data.largest_category.total} /> (
                    {formatPercent(data.largest_category.percent)})
                  </span>
                ) : (
                  'No records in this month'
                )
              }
              icon={<Layers className="h-5 w-5" />}
            />

            <StatCard
              label="Petty cash balance"
              value={<CurrencyText amount={data.petty_cash_balance} />}
              subtext="Closing balance for selected month"
              icon={<Wallet className="h-5 w-5" />}
              to="/petty-cash"
            />

            <StatCard
              label="Individual / Shared split"
              value={
                <span className="text-lg">
                  <CurrencyText amount={data.individual_total} /> /{' '}
                  <CurrencyText amount={data.shared_total} />
                </span>
              }
              subtext="Individual vs Shared operational"
              icon={<Sparkles className="h-5 w-5" />}
            />

            <StatCard
              label="Active users"
              value={data.active_users}
              subtext="Employees & administrators"
              icon={<Users className="h-5 w-5" />}
              to="/users"
            />

            <StatCard
              label="Active categories"
              value={data.active_categories}
              subtext="Available on expense forms"
              icon={<FolderKanban className="h-5 w-5" />}
              to="/categories"
            />

            <StatCard
              label="Pending item suggestions"
              value={data.pending_items}
              subtext="Click to review or merge"
              icon={<Package className="h-5 w-5" />}
              to="/items?tab=pending"
            />
          </div>

          {/* Charts row */}
          <div className="grid gap-6 lg:grid-cols-12">
            {/* Donut: Spending by category */}
            <div className="app-card lg:col-span-5 flex flex-col justify-between">
              <div>
                <h2 className="text-base font-bold text-[#1E3A8A] dark:text-[#DBEAFE]">
                  Spending by category
                </h2>
                <p className="text-xs text-[var(--text-secondary)]">
                  Share of purchases in {monthLabel(month, year)}
                </p>
              </div>

              {donutData.length === 0 ? (
                <div className="my-6">
                  <EmptyState
                    title="No category spend"
                    description="No expenses recorded in this month yet."
                  />
                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  <div className="h-52 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={donutData}
                          dataKey="total"
                          nameKey="name"
                          innerRadius={52}
                          outerRadius={80}
                          paddingAngle={2}
                        >
                          {donutData.map((entry) => (
                            <Cell key={entry.category_id} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value) => formatMoney(Number(value), currency)}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="space-y-2.5">
                    {donutData.map((cat) => (
                      <div key={cat.category_id} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-2 font-medium text-[var(--text-primary)]">
                            <span
                              className="h-2.5 w-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: cat.fill }}
                            />
                            {cat.name}
                          </span>
                          <span className="tabular-nums text-[var(--text-secondary)]">
                            <CurrencyText amount={cat.total} className="text-[var(--text-primary)]" /> ·{' '}
                            {formatPercent(cat.percent)}
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#EFF6FF] dark:bg-[#172554]">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${Math.max(3, cat.percent)}%`, backgroundColor: cat.fill }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Bar chart: Monthly trend */}
            <div className="app-card lg:col-span-7 flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-[#1E3A8A] dark:text-[#DBEAFE]">
                    Monthly trend · {year}
                  </h2>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Total purchase expenditure across all 12 months ({monthLabel(month, year)} highlighted)
                  </p>
                </div>
                <Link
                  to="/reports"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#2563EB] hover:underline"
                >
                  Full reports <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              <div className="mt-4 h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trendData} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#475569' }} axisLine={false} tickLine={false} />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#475569' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`}
                    />
                    <Tooltip
                      formatter={(value) => [formatMoney(Number(value), currency), 'Total spent']}
                    />
                    <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                      {trendData.map((entry) => (
                        <Cell
                          key={entry.month}
                          fill={entry.isCurrent ? '#2563EB' : '#93C5FD'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Spending by employee + Pending suggestions */}
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="app-card lg:col-span-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-[#1E3A8A] dark:text-[#DBEAFE]">
                    Spending by employee
                  </h2>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Ranked by records created in {monthLabel(month, year)}
                  </p>
                </div>
                <Link to="/users" className="text-xs font-semibold text-[#2563EB] hover:underline">
                  Manage users
                </Link>
              </div>

              {data.by_employee.length === 0 ? (
                <EmptyState title="No employee activity" description="No records in this period." />
              ) : (
                <ol className="divide-y divide-[var(--border-divider)]">
                  {data.by_employee.map((emp, idx) => (
                    <li key={emp.user_id} className="flex items-center justify-between gap-3 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#DBEAFE] text-xs font-bold text-[#1E3A8A]">
                          {idx + 1}
                        </span>
                        <UserChip
                          name={emp.full_name}
                          email={pluralize(emp.count, 'record')}
                        />
                      </div>
                      <CurrencyText amount={emp.total} className="font-semibold text-[#1E3A8A] dark:text-[#DBEAFE]" />
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <div className="app-card lg:col-span-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-[#1E3A8A] dark:text-[#DBEAFE]">
                    Pending suggestions
                  </h2>
                  <p className="text-xs text-[var(--text-secondary)]">
                    New catalog items suggested by employees
                  </p>
                </div>
                <Link
                  to="/items?tab=pending"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#2563EB] hover:underline"
                >
                  Review all ({data.pending_items}) <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              {data.pending_suggestions.length === 0 ? (
                <EmptyState
                  title="All caught up"
                  description="There are no pending item suggestions waiting for approval."
                />
              ) : (
                <ul className="divide-y divide-[var(--border-divider)]">
                  {data.pending_suggestions.map((item) => {
                    const suggestedBy = item.suggested_by ? userById.get(item.suggested_by) : null
                    return (
                      <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-[var(--text-primary)]">{item.name}</span>
                            <Badge variant="category">
                              {categoryNameById.get(item.category_id) ?? 'Category'}
                            </Badge>
                          </div>
                          {suggestedBy && (
                            <p className="text-xs text-[var(--text-secondary)]">
                              Suggested by {suggestedBy.full_name}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleQuickApprove(item.id, item.name)}
                            disabled={approveItem.isPending}
                          >
                            <Check className="h-3.5 w-3.5" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigate('/items?tab=pending')}
                          >
                            Review
                          </Button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* Recent expenses table */}
          <div className="app-card">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-[#1E3A8A] dark:text-[#DBEAFE]">
                  Recent expenses
                </h2>
                <p className="text-xs text-[var(--text-secondary)]">
                  Latest records recorded in {monthLabel(month, year)}
                </p>
              </div>
              <Link
                to={`/expenses?month=${month}&year=${year}`}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#2563EB] hover:underline"
              >
                View all expenses <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {data.recent_expenses.length === 0 ? (
              <EmptyState title="No expenses for this month" description="Try selecting another month or add a new expense." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border-divider)] text-[12px] font-semibold uppercase tracking-wider text-[#475569]">
                      <th className="px-3 py-2.5">Date</th>
                      <th className="px-3 py-2.5">Item</th>
                      <th className="px-3 py-2.5">Category</th>
                      <th className="px-3 py-2.5">Description</th>
                      <th className="px-3 py-2.5">Type</th>
                      <th className="px-3 py-2.5 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-divider)]">
                    {data.recent_expenses.map((exp) => (
                      <tr
                        key={exp.id}
                        onClick={() => navigate(`/expenses/${exp.id}`)}
                        className="cursor-pointer hover:bg-[var(--surface-hover)]"
                      >
                        <td className="px-3 py-3 whitespace-nowrap text-xs text-[var(--text-secondary)]">
                          {formatDate(exp.expense_date)}
                        </td>
                        <td className="px-3 py-3 font-medium">{exp.item_name}</td>
                        <td className="px-3 py-3">
                          <Badge variant="category">
                            {categoryNameById.get(exp.category_id) ?? 'Category'}
                          </Badge>
                        </td>
                        <td className="px-3 py-3 max-w-xs truncate text-[var(--text-secondary)]">
                          {exp.description || '—'}
                        </td>
                        <td className="px-3 py-3">
                          <Badge variant={exp.expense_type === 'shared_operational' ? 'shared' : 'individual'}>
                            {EXPENSE_TYPE_LABEL[exp.expense_type]}
                          </Badge>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <CurrencyText amount={exp.total} className="font-semibold" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

