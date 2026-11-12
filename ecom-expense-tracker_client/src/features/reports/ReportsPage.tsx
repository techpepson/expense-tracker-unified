import { useState } from 'react'
import { FileSpreadsheet, FileText, Calendar } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatCard } from '@/components/shared/StatCard'
import { DonutChart } from '@/components/shared/DonutChart'
import { CurrencyText } from '@/components/shared/CurrencyText'
import { PageSkeleton } from '@/components/shared/LoadingSkeleton'
import { useMonthlyReport, useAnnualReport } from '@/api/reports'
import { currentMonthYear, FULL_MONTH_NAMES, MONTH_NAMES, formatDate } from '@/lib/formatters'
import { formatGHS } from '@/lib/money'
import { exportMonthlyExcel, exportMonthlyPdf } from '@/lib/exporters'
import { toast } from 'sonner'

export function ReportsPage() {
  const [activeTab, setActiveTab] = useState<'monthly' | 'annual'>('monthly')
  const now = currentMonthYear()
  const [month, setMonth] = useState(now.month)
  const [year, setYear] = useState(now.year)

  const { data: monthlyData, isLoading: loadingMonthly } = useMonthlyReport(month, year)
  const { data: annualData, isLoading: loadingAnnual } = useAnnualReport(year)

  const handleExcelExport = async () => {
    if (!monthlyData) return
    try {
      await exportMonthlyExcel(monthlyData)
      toast.success('Excel report downloaded')
    } catch {
      toast.error('Failed to export Excel report')
    }
  }

  const handlePdfExport = () => {
    if (!monthlyData) return
    try {
      exportMonthlyPdf(monthlyData)
      toast.success('PDF report downloaded')
    } catch {
      toast.error('Failed to export PDF report')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Monthly Reports"
        subtitle="Review expenditure reports and export monthly summaries"
        actions={
          <div className="flex items-center gap-2">
            {activeTab === 'monthly' && (
              <>
                <button onClick={handleExcelExport} className="btn-outline">
                  <FileSpreadsheet size={16} /> Download Excel
                </button>
                <button onClick={handlePdfExport} className="btn-primary">
                  <FileText size={16} /> Download PDF
                </button>
              </>
            )}
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex border-b border-[#e0ecff]">
        <button
          onClick={() => setActiveTab('monthly')}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'monthly'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted hover:text-body'
          }`}
        >
          Monthly Breakdown
        </button>
        <button
          onClick={() => setActiveTab('annual')}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'annual'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted hover:text-body'
          }`}
        >
          Annual Matrix
        </button>
      </div>

      {activeTab === 'monthly' ? (
        <div className="space-y-6">
          {/* Controls */}
          <div className="card flex flex-wrap items-center justify-between gap-4 py-3">
            <div className="flex flex-wrap items-center gap-3">
              <Calendar size={18} className="text-primary shrink-0" />
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="input-base w-auto min-w-[155px] pr-8 text-sm font-semibold text-navy"
              >
                {FULL_MONTH_NAMES.map((m, idx) => (
                  <option key={m} value={idx + 1} className="text-body font-normal">
                    {m}
                  </option>
                ))}
              </select>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="input-base w-auto min-w-[100px] pr-8 text-sm font-semibold text-navy"
              >
                {[2024, 2025, 2026, 2027].map((y) => (
                  <option key={y} value={y} className="text-body font-normal">
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <div className="text-sm font-semibold text-body">
              e-COM Services · Monthly Expense Report · {FULL_MONTH_NAMES[month - 1]} {year}
            </div>
          </div>

          {loadingMonthly || !monthlyData ? (
            <PageSkeleton />
          ) : (
            <>
              {/* Stat Cards */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <StatCard
                  variant="hero"
                  title="Grand Total Purchases"
                  value={
                    <CurrencyText
                      amount={monthlyData.total_purchases}
                      size="xl"
                      className="text-white"
                    />
                  }
                  subtitle={`${monthlyData.record_count} total records`}
                />
                <StatCard
                  title="Individual Total"
                  value={<CurrencyText amount={monthlyData.individual_total} size="lg" />}
                  subtitle="Recorded by staff"
                />
                <StatCard
                  title="Shared Operational"
                  value={<CurrencyText amount={monthlyData.shared_total} size="lg" />}
                  subtitle="Company operations"
                />
              </div>

              {/* Donut chart for spending */}
              {monthlyData.categories.length > 0 && (
                <DonutChart
                  data={monthlyData.categories.map((c) => ({
                    name: c.category_name,
                    value: c.total,
                  }))}
                  label="Category Distribution"
                />
              )}

              {/* Category-by-Category Expense Lists */}
              <div className="space-y-4">
                {monthlyData.categories.map((cat) => (
                  <div key={cat.category_id} className="card p-0 overflow-hidden">
                    <div className="flex items-center justify-between bg-tint px-5 py-3 border-b border-[#eaf1ff]">
                      <h4 className="font-bold text-navy text-sm uppercase tracking-wide">
                        {cat.category_name}
                      </h4>
                      <div className="text-sm font-semibold text-body">
                        Subtotal: <CurrencyText amount={cat.total} />
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-[#eaf1ff]">
                            <th className="table-header-cell">Item</th>
                            <th className="table-header-cell">Date</th>
                            <th className="table-header-cell">Qty</th>
                            <th className="table-header-cell">Unit Cost</th>
                            <th className="table-header-cell">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cat.items.flatMap((it) =>
                            it.entries.map((entry) => (
                              <tr key={entry.id} className="table-row">
                                <td className="table-cell font-medium">{entry.item_name}</td>
                                <td className="table-cell text-muted">
                                  {formatDate(entry.expense_date)}
                                </td>
                                <td className="table-cell">{entry.quantity}</td>
                                <td className="table-cell">
                                  <CurrencyText amount={entry.unit_cost} size="sm" />
                                </td>
                                <td className="table-cell font-semibold">
                                  <CurrencyText amount={entry.total} size="sm" />
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>

              {/* Petty Cash Summary for the month */}
              <div className="card space-y-3">
                <h4 className="text-sm font-semibold uppercase tracking-wider text-muted">
                  Petty Cash Summary for {FULL_MONTH_NAMES[month - 1]}
                </h4>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-sm">
                  <div>
                    <span className="text-muted block text-xs">Opening Balance</span>
                    <CurrencyText
                      amount={monthlyData.petty_cash.opening_balance}
                      className="font-semibold"
                    />
                  </div>
                  <div>
                    <span className="text-muted block text-xs">Cash-In</span>
                    <CurrencyText
                      amount={monthlyData.petty_cash.cash_in}
                      className="font-semibold text-green-600"
                    />
                  </div>
                  <div>
                    <span className="text-muted block text-xs">Cash-Out (+ Charges)</span>
                    <CurrencyText
                      amount={monthlyData.petty_cash.cash_out_total}
                      className="font-semibold"
                    />
                  </div>
                  <div>
                    <span className="text-muted block text-xs">Closing Balance</span>
                    <CurrencyText
                      amount={monthlyData.petty_cash.closing_balance}
                      className="font-bold text-navy"
                    />
                  </div>
                </div>
              </div>

              {/* Grand Total Footer Card */}
              <div className="hero-card flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-200">Total Expenditure</p>
                  <p className="text-2xl font-bold">
                    GRAND TOTAL AMOUNT SPENT ON PURCHASES:
                  </p>
                </div>
                <CurrencyText
                  amount={monthlyData.total_purchases}
                  size="xl"
                  className="text-white"
                />
              </div>
            </>
          )}
        </div>
      ) : (
        /* Annual Matrix Tab */
        <div className="space-y-6">
          <div className="card flex items-center gap-3 py-3">
            <span className="text-sm font-medium text-body">Select Year:</span>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="input-base w-auto text-sm"
            >
              {[2024, 2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {loadingAnnual || !annualData ? (
            <PageSkeleton />
          ) : (
            <div className="card p-0 overflow-x-auto">
              <table className="w-full text-xs min-w-[900px]">
                <thead>
                  <tr className="bg-tint border-b border-[#eaf1ff]">
                    <th className="table-header-cell sticky left-0 bg-tint z-10 text-navy font-bold">
                      Category / Item
                    </th>
                    {MONTH_NAMES.map((m) => (
                      <th key={m} className="table-header-cell text-center text-navy font-bold">
                        {m}
                      </th>
                    ))}
                    <th className="table-header-cell text-right pr-4 text-navy font-bold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {annualData.categories.map((cat) => (
                    <>
                      <tr key={cat.category_id} className="bg-light-blue/20 font-bold border-b border-[#eaf1ff]">
                        <td className="table-cell sticky left-0 bg-[#f8fbff] text-navy font-bold">
                          {cat.category_name}
                        </td>
                        {cat.monthly_totals.map((mTotal, i) => (
                          <td key={i} className="table-cell text-center font-semibold">
                            {mTotal > 0 ? formatGHS(mTotal) : '—'}
                          </td>
                        ))}
                        <td className="table-cell text-right font-bold text-navy pr-4">
                          {formatGHS(cat.year_total)}
                        </td>
                      </tr>
                      {cat.items.map((it) => (
                        <tr key={it.item_id} className="table-row">
                          <td className="table-cell pl-6 text-muted sticky left-0 bg-white">
                            {it.item_name}
                          </td>
                          {it.monthly_totals.map((val, i) => (
                            <td key={i} className="table-cell text-center text-muted">
                              {val > 0 ? formatGHS(val) : '—'}
                            </td>
                          ))}
                          <td className="table-cell text-right font-semibold text-body pr-4">
                            {formatGHS(it.year_total)}
                          </td>
                        </tr>
                      ))}
                    </>
                  ))}
                  {/* Monthly Totals Row */}
                  <tr className="bg-navy text-white font-bold">
                    <td className="table-cell sticky left-0 bg-navy text-white font-bold">
                      Grand Total
                    </td>
                    {annualData.months.map((m) => (
                      <td key={m.month} className="table-cell text-center text-white">
                        {formatGHS(m.total)}
                      </td>
                    ))}
                    <td className="table-cell text-right pr-4 text-white text-sm">
                      {formatGHS(annualData.grand_total)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
