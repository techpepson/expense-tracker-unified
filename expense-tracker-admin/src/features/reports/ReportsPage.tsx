import { useMemo, useState } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { Download, FileSpreadsheet, FileText } from 'lucide-react'
import { toast } from 'sonner'
import {
  errorMessage,
  fetchExpenses,
  fetchPettyCash,
  useAnnualReport,
  useCategories,
  useCurrency,
  useItems,
  useMonthlyReport,
  useSettings,
  useUsers,
} from '@/api'
import { MONTH_SHORT, formatDate, formatPercent, monthLabel, pluralize } from '@/lib/formatters'
import { formatMoney } from '@/lib/money'
import { buildTrackerWorkbook, workbookToBlob } from '@/lib/exporters/trackerWorkbook'
import { buildMonthlyReportPdf } from '@/lib/exporters/pdfReport'
import { downloadBlob } from '@/lib/exporters/download'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/controls'
import { Skeleton } from '@/components/ui/badge'
import {
  CurrencyText,
  EmptyState,
  MonthYearPicker,
  PageHeader,
  StatCard,
} from '@/components/shared'

const CHART_BLUES = ['#1E3A8A', '#2563EB', '#60A5FA', '#38BDF8', '#BFDBFE'] as const

export function ReportsPage() {
  const [tab, setTab] = useState<'monthly' | 'annual'>('monthly')
  const [month, setMonth] = useState<number>(3)
  const [year, setYear] = useState<number>(2026)
  const [createdBy, setCreatedBy] = useState('')
  const [busyExcel, setBusyExcel] = useState(false)

  const currency = useCurrency()
  const { data: settings } = useSettings()
  const { data: categories } = useCategories()
  const { data: items } = useItems()
  const { data: users } = useUsers()

  const { data: monthly, isLoading: loadingMonthly } = useMonthlyReport(
    month,
    year,
    createdBy || undefined,
  )
  const { data: annual, isLoading: loadingAnnual } = useAnnualReport(year)

  const donutData = useMemo(
    () =>
      (monthly?.by_category ?? []).map((c, idx) => ({
        ...c,
        fill: CHART_BLUES[idx % CHART_BLUES.length]!,
      })),
    [monthly?.by_category],
  )

  const handleDownloadExcel = async (monthsToExport: number[], filename: string) => {
    try {
      setBusyExcel(true)
      const allExp = await fetchExpenses({
        year,
        created_by: createdBy || undefined,
        page: 1,
        limit: 10000,
      })
      const pettyByMonth: Record<number, { opening: number; entries: Awaited<ReturnType<typeof fetchPettyCash>>['entries'] }> = {}
      for (const m of monthsToExport) {
        const pc = await fetchPettyCash(m, year)
        pettyByMonth[m] = { opening: pc.summary.opening_balance, entries: pc.entries }
      }
      const wb = buildTrackerWorkbook({
        year,
        months: monthsToExport,
        categories: categories ?? [],
        items: items ?? [],
        expenses: allExp.data,
        pettyCash: pettyByMonth,
        organisationName: settings?.organisation_name ?? 'e-COM Services',
        currency,
        startDay: settings?.period_start_day ?? 1,
      })
      const blob = await workbookToBlob(wb)
      downloadBlob(blob, filename)
      toast.success('Downloaded Expenditure Tracker Excel workbook')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusyExcel(false)
    }
  }

  const handleDownloadPdf = () => {
    if (!monthly) return
    const creatorName = createdBy ? users?.find((u) => u.id === createdBy)?.full_name : undefined
    const doc = buildMonthlyReportPdf(monthly, creatorName)
    doc.save(`ecom-monthly-report-${year}-${String(month).padStart(2, '0')}.pdf`)
    toast.success('Downloaded Monthly Report PDF')
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Monthly Reports"
        subtitle="Audit-ready monthly & annual reports with Excel (original tracker layout) and PDF export"
        actions={
          <Tabs value={tab} onValueChange={(v) => setTab(v as 'monthly' | 'annual')}>
            <TabsList>
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
              <TabsTrigger value="annual">Annual</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'monthly' | 'annual')}>
        <TabsContent value="monthly" className="space-y-6">
          {/* Monthly Toolbar */}
          <div className="app-card flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <MonthYearPicker
                month={month}
                year={year}
                onMonthChange={(m) => m && setMonth(m)}
                onYearChange={setYear}
              />
              <div className="w-52">
                <Select
                  aria-label="Filter report by creator"
                  value={createdBy}
                  onChange={(e) => setCreatedBy(e.target.value)}
                >
                  <option value="">All creators</option>
                  {(users ?? []).map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <Button
                variant="outline"
                disabled={busyExcel}
                onClick={() =>
                  handleDownloadExcel(
                    [month],
                    `expenditure-tracker-${year}-${String(month).padStart(2, '0')}.xlsx`,
                  )
                }
              >
                <FileSpreadsheet className="h-4 w-4" />
                Download Excel
              </Button>
              <Button onClick={handleDownloadPdf} disabled={!monthly}>
                <FileText className="h-4 w-4" />
                Download PDF
              </Button>
            </div>
          </div>

          {loadingMonthly || !monthly ? (
            <Skeleton className="h-96 w-full" />
          ) : (
            <>
              {/* Report Banner Header */}
              <div className="hero-card flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-widest text-[#DBEAFE]">
                    {monthly.organisation_name}
                  </div>
                  <h2 className="mt-1 text-2xl font-bold">
                    {monthly.organisation_name} / Monthly Expense Report · {monthLabel(month, year)}
                  </h2>
                </div>
                <div className="text-right">
                  <div className="text-xs text-[#DBEAFE]">Grand total spent on purchases</div>
                  <div className="text-2xl font-extrabold">
                    <CurrencyText amount={monthly.grand_total} />
                  </div>
                </div>
              </div>

              {/* Stat Cards */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  label="Total spent on purchases"
                  value={<CurrencyText amount={monthly.grand_total} />}
                  subtext={pluralize(monthly.record_count, 'record')}
                />
                <StatCard
                  label="Shared operational"
                  value={<CurrencyText amount={monthly.shared_total} />}
                  subtext="Company-wide & utility bills"
                />
                <StatCard
                  label="Individual"
                  value={<CurrencyText amount={monthly.individual_total} />}
                  subtext="Staff-assigned records"
                />
                <StatCard
                  label="Petty cash closing"
                  value={<CurrencyText amount={monthly.petty_cash.closing_balance} />}
                  subtext="Balance after cash-out"
                />
              </div>

              <div className="grid gap-6 lg:grid-cols-12">
                {/* Category Sections */}
                <div className="lg:col-span-8 space-y-6">
                  {monthly.categories.length === 0 ? (
                    <div className="app-card">
                      <EmptyState
                        title="No expenses recorded for this month"
                        description="Choose another month such as January, March, June, or September 2026."
                      />
                    </div>
                  ) : (
                    monthly.categories.map((cat) => (
                      <div key={cat.category_id} className="app-card space-y-3">
                        <div className="flex items-center justify-between border-b border-[var(--border-divider)] pb-3">
                          <h3 className="text-base font-bold text-[#1E3A8A] dark:text-[#DBEAFE]">
                            {cat.name}
                          </h3>
                          <div className="text-sm font-semibold">
                            Subtotal: <CurrencyText amount={cat.subtotal} className="text-[#2563EB]" />
                          </div>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse text-left text-sm">
                            <thead>
                              <tr className="border-b border-[var(--border-divider)] text-[11px] font-semibold uppercase tracking-wider text-[#475569]">
                                <th className="py-2 pr-3">Item (Bill)</th>
                                <th className="py-2 px-2 text-right">Unit Cost</th>
                                <th className="py-2 px-2 text-right">Qty</th>
                                <th className="py-2 px-3">Description</th>
                                <th className="py-2 px-2 text-right">Total Price</th>
                                <th className="py-2 pl-2 text-right">Date</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border-divider)]">
                              {cat.items.flatMap((item) =>
                                item.entries.map((entry, idx) => (
                                  <tr key={entry.id}>
                                    <td className="py-2.5 pr-3 font-medium">
                                      {idx === 0 ? item.item_name : ''}
                                    </td>
                                    <td className="py-2.5 px-2 text-right">
                                      <CurrencyText amount={entry.unit_cost} />
                                    </td>
                                    <td className="py-2.5 px-2 text-right tabular-nums">
                                      {entry.quantity}
                                    </td>
                                    <td className="py-2.5 px-3 text-xs text-[var(--text-secondary)]">
                                      {entry.description || '—'}
                                    </td>
                                    <td className="py-2.5 px-2 text-right font-semibold">
                                      <CurrencyText amount={entry.total} />
                                    </td>
                                    <td className="py-2.5 pl-2 text-right whitespace-nowrap text-xs text-[var(--text-secondary)]">
                                      {formatDate(entry.expense_date)}
                                    </td>
                                  </tr>
                                )),
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))
                  )}

                  {/* Petty cash summary + GRAND TOTAL row */}
                  <div className="app-card space-y-4">
                    <h3 className="text-base font-bold text-[#1E3A8A] dark:text-[#DBEAFE]">
                      Petty Cash Summary · {monthLabel(month, year)}
                    </h3>
                    <dl className="grid gap-3 sm:grid-cols-5 text-xs">
                      <div className="rounded-[10px] bg-[var(--surface-tint)] p-3">
                        <dt className="text-[var(--text-secondary)]">Balance before cash-in</dt>
                        <dd className="mt-1 text-sm font-bold">
                          <CurrencyText amount={monthly.petty_cash.opening_balance} />
                        </dd>
                      </div>
                      <div className="rounded-[10px] bg-[var(--surface-tint)] p-3">
                        <dt className="text-[var(--text-secondary)]">Cash-in</dt>
                        <dd className="mt-1 text-sm font-bold">
                          <CurrencyText amount={monthly.petty_cash.cash_in} />
                        </dd>
                      </div>
                      <div className="rounded-[10px] bg-[var(--surface-tint)] p-3">
                        <dt className="text-[var(--text-secondary)]">Cash-out (+ Charges)</dt>
                        <dd className="mt-1 text-sm font-bold">
                          <CurrencyText amount={monthly.petty_cash.cash_out_total} />
                        </dd>
                      </div>
                      <div className="rounded-[10px] bg-[var(--surface-tint)] p-3">
                        <dt className="text-[var(--text-secondary)]">Balance after cash-out</dt>
                        <dd className="mt-1 text-sm font-bold">
                          <CurrencyText amount={monthly.petty_cash.closing_balance} />
                        </dd>
                      </div>
                      <div className="rounded-[10px] bg-[var(--surface-tint)] p-3">
                        <dt className="text-[var(--text-secondary)]">Cash used (no charges)</dt>
                        <dd className="mt-1 text-sm font-bold">
                          <CurrencyText amount={monthly.petty_cash.cash_used} />
                        </dd>
                      </div>
                    </dl>

                    <div className="flex items-center justify-between rounded-[12px] border-2 border-[#2563EB] bg-[#EFF6FF] dark:bg-[#172554] px-4 py-3.5 font-extrabold text-[#1E3A8A] dark:text-white">
                      <span className="text-sm tracking-wide uppercase">
                        GRAND TOTAL SPENT ON PURCHASES
                      </span>
                      <span className="text-xl">
                        <CurrencyText amount={monthly.grand_total} />
                      </span>
                    </div>
                  </div>
                </div>

                {/* Category Donut */}
                <div className="lg:col-span-4">
                  <div className="app-card space-y-4">
                    <h3 className="text-base font-bold text-[#1E3A8A] dark:text-[#DBEAFE]">
                      Category breakdown
                    </h3>
                    {donutData.length === 0 ? (
                      <p className="text-xs text-[var(--text-secondary)]">No data for this month.</p>
                    ) : (
                      <>
                        <div className="h-52">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={donutData}
                                dataKey="total"
                                nameKey="name"
                                innerRadius={48}
                                outerRadius={76}
                              >
                                {donutData.map((d) => (
                                  <Cell key={d.category_id} fill={d.fill} />
                                ))}
                              </Pie>
                              <Tooltip formatter={(v) => formatMoney(Number(v), currency)} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <ul className="space-y-2 text-xs">
                          {donutData.map((c) => (
                            <li key={c.category_id} className="flex items-center justify-between">
                              <span className="flex items-center gap-2 font-medium">
                                <span
                                  className="h-2.5 w-2.5 rounded-full"
                                  style={{ backgroundColor: c.fill }}
                                />
                                {c.name}
                              </span>
                              <span>
                                <CurrencyText amount={c.total} /> ({formatPercent(c.percent)})
                              </span>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="annual" className="space-y-6">
          <div className="app-card flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">Reporting Year:</span>
              <div className="w-28">
                <Select
                  aria-label="Annual report year"
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                >
                  {[2025, 2026, 2027].map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <Button
              disabled={busyExcel}
              onClick={() =>
                handleDownloadExcel(
                  [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
                  `expenditure-tracker-${year}-full.xlsx`,
                )
              }
            >
              <Download className="h-4 w-4" />
              Download 12-Month Expenditure Tracker (.xlsx)
            </Button>
          </div>

          {loadingAnnual || !annual ? (
            <Skeleton className="h-96 w-full" />
          ) : (
            <div className="app-card overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--border-divider)] font-semibold uppercase tracking-wider text-[#475569]">
                    <th className="py-3 pr-3 sticky left-0 bg-[var(--surface-card)]">Category</th>
                    <th className="py-3 pr-3">Item</th>
                    {MONTH_SHORT.map((m) => (
                      <th key={m} className="py-3 px-2 text-right">
                        {m}
                      </th>
                    ))}
                    <th className="py-3 pl-3 text-right text-[#1E3A8A] dark:text-[#DBEAFE]">
                      Row Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-divider)]">
                  {annual.rows.map((row) => (
                    <tr key={`${row.category_id}-${row.item_id}`} className="hover:bg-[var(--surface-hover)]">
                      <td className="py-2.5 pr-3 text-[var(--text-secondary)] whitespace-nowrap">
                        {row.category_name}
                      </td>
                      <td className="py-2.5 pr-3 font-medium whitespace-nowrap">{row.item_name}</td>
                      {row.months.map((val, mIdx) => (
                        <td key={mIdx} className="py-2.5 px-2 text-right tabular-nums">
                          {val > 0 ? <CurrencyText amount={val} /> : '—'}
                        </td>
                      ))}
                      <td className="py-2.5 pl-3 text-right font-bold text-[#1E3A8A] dark:text-white">
                        <CurrencyText amount={row.total} />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-[#2563EB] bg-[#EFF6FF] dark:bg-[#172554] font-bold text-[#1E3A8A] dark:text-white">
                    <td colSpan={2} className="py-3 pr-3 uppercase">
                      GRAND TOTAL ({year})
                    </td>
                    {annual.month_totals.map((val, mIdx) => (
                      <td key={mIdx} className="py-3 px-2 text-right tabular-nums">
                        <CurrencyText amount={val} />
                      </td>
                    ))}
                    <td className="py-3 pl-3 text-right text-sm font-extrabold">
                      <CurrencyText amount={annual.grand_total} />
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

