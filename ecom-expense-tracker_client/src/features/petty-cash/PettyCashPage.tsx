import { useState } from 'react'
import { Plus, ArrowDownLeft, ArrowUpRight, Percent, Info, DollarSign } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatCard } from '@/components/shared/StatCard'
import { DataTable } from '@/components/shared/DataTable'
import { CurrencyText } from '@/components/shared/CurrencyText'
import { PageSkeleton } from '@/components/shared/LoadingSkeleton'
import { usePettyCashSummary, useCreatePettyCashEntry } from '@/api/petty-cash'
import { useAuth } from '@/hooks/useAuth'
import { currentMonthYear, FULL_MONTH_NAMES, formatDate } from '@/lib/formatters'
import { pettyCashEntrySchema, type PettyCashEntryFormValues } from './schemas/petty-cash.schema'
import type { ColumnDef } from '@tanstack/react-table'
import type { PettyCashEntry } from '@/types'
import { toast } from 'sonner'
import { format } from 'date-fns'

export function PettyCashPage() {
  const { canRecordShared } = useAuth()
  const now = currentMonthYear()
  const [month, setMonth] = useState(now.month)
  const [year, setYear] = useState(now.year)
  const [dialogOpen, setDialogOpen] = useState(false)

  const { data: summary, isLoading } = usePettyCashSummary(month, year)
  const { mutateAsync: createEntry, isPending: creating } = useCreatePettyCashEntry(month, year)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PettyCashEntryFormValues>({
    resolver: zodResolver(pettyCashEntrySchema),
    defaultValues: {
      entry_type: 'cash_out',
      entry_date: format(new Date(), 'yyyy-MM-dd'),
    },
  })

  const onSubmit = async (values: PettyCashEntryFormValues) => {
    try {
      await createEntry(values)
      toast.success('Petty cash entry recorded')
      reset()
      setDialogOpen(false)
    } catch {
      toast.error('Failed to record petty cash entry')
    }
  }

  const columns: ColumnDef<PettyCashEntry, unknown>[] = [
    {
      header: 'Date',
      accessorKey: 'entry_date',
      cell: (info) => (
        <span className="text-sm text-muted">{formatDate(info.getValue() as string)}</span>
      ),
    },
    {
      header: 'Type',
      accessorKey: 'entry_type',
      cell: (info) => {
        const val = info.getValue() as string
        if (val === 'cash_in') return <span className="badge badge-green">Cash In</span>
        if (val === 'charge') return <span className="badge badge-red">Charge</span>
        return <span className="badge badge-blue">Cash Out</span>
      },
    },
    {
      header: 'Description',
      accessorKey: 'description',
      cell: (info) => (
        <span className="font-medium text-body">{info.getValue() as string}</span>
      ),
    },
    {
      header: 'Amount',
      accessorKey: 'amount',
      cell: (info) => {
        const entry = info.row.original
        const isPositive = entry.entry_type === 'cash_in'
        return (
          <span className={`font-semibold ${isPositive ? 'text-green-600' : 'text-body'}`}>
            {isPositive ? '+' : '-'} <CurrencyText amount={entry.amount} size="sm" />
          </span>
        )
      },
    },
    {
      header: 'Recorded By',
      accessorKey: 'created_by_name',
      cell: (info) => <span className="text-xs text-muted">{info.getValue() as string}</span>,
    },
  ]

  if (isLoading || !summary) {
    return <PageSkeleton />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Petty Cash"
        subtitle="Track petty cash balances, cash-in reimbursements, and operational cash-out"
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="input-base w-auto min-w-[150px] pr-8 text-sm font-medium text-body"
            >
              {FULL_MONTH_NAMES.map((m, idx) => (
                <option key={m} value={idx + 1}>
                  {m}
                </option>
              ))}
            </select>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="input-base w-auto min-w-[100px] pr-8 text-sm font-medium text-body"
            >
              {[2024, 2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <button
              onClick={() => setDialogOpen(true)}
              disabled={!canRecordShared}
              className="btn-primary whitespace-nowrap shrink-0"
              title={
                !canRecordShared
                  ? 'Requires Designated Expense Recorder permission'
                  : 'Add petty cash entry'
              }
            >
              <Plus size={16} className="shrink-0" />
              <span>Add Entry</span>
            </button>
          </div>
        }
      />

      {!canRecordShared && (
        <div className="flex items-center gap-2 rounded-xl border border-[#e0ecff] bg-tint p-4 text-xs text-muted">
          <Info size={16} className="text-primary flex-shrink-0" />
          <span>
            You have read-only access to Petty Cash. Adding or modifying entries requires the{' '}
            <strong>Designated Expense Recorder</strong> role.
          </span>
        </div>
      )}

      {/* Sheet Summary Strip (5 core numbers) */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          title="Balance Before Cash-In"
          value={<CurrencyText amount={summary.opening_balance} size="lg" />}
          subtitle="Previous closing"
          icon={<DollarSign size={18} />}
        />
        <StatCard
          title="Total Cash-In"
          value={<CurrencyText amount={summary.cash_in} size="lg" className="text-green-600" />}
          subtitle="Reimbursements"
          icon={<ArrowDownLeft size={18} className="text-green-600" />}
        />
        <StatCard
          title="Cash-Out (+ Charges)"
          value={<CurrencyText amount={summary.cash_out_total} size="lg" />}
          subtitle="Total disbursements"
          icon={<ArrowUpRight size={18} />}
        />
        <StatCard
          title="Balance After Cash-Out"
          value={<CurrencyText amount={summary.closing_balance} size="lg" className="text-white" />}
          subtitle="Month closing balance"
          variant="hero"
        />
        <StatCard
          title="Total Cash Used"
          value={<CurrencyText amount={summary.cash_used} size="lg" />}
          subtitle={`Without charges (${summary.charges > 0 ? `GH₵ ${summary.charges} charges` : 'no charges'})`}
          icon={<Percent size={18} />}
        />
      </div>

      {/* Ledger Table */}
      <div className="card p-0">
        <div className="p-5 border-b border-[#eaf1ff]">
          <h3 className="text-base font-semibold text-body">
            Petty Cash Ledger · {FULL_MONTH_NAMES[month - 1]} {year}
          </h3>
          <p className="text-xs text-muted mt-0.5">
            Individual transactions and cash movements recorded for this month
          </p>
        </div>

        <DataTable
          data={summary.entries}
          columns={columns}
          emptyTitle="No petty cash entries"
          emptyMessage="No cash-in or cash-out entries recorded for this month."
        />
      </div>

      {/* Add Entry Dialog */}
      {dialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setDialogOpen(false)}
          />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-body mb-1">Add Petty Cash Entry</h3>
            <p className="text-xs text-muted mb-4">Record a cash movement in the company ledger</p>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-muted mb-1">
                  Entry Type *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'cash_in', label: 'Cash In' },
                    { value: 'cash_out', label: 'Cash Out' },
                    { value: 'charge', label: 'Charge' },
                  ].map((t) => (
                    <label
                      key={t.value}
                      className="option-card flex items-center justify-center py-2.5 cursor-pointer text-xs font-semibold"
                    >
                      <input
                        type="radio"
                        value={t.value}
                        {...register('entry_type')}
                        className="sr-only"
                      />
                      {t.label}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-muted mb-1">
                  Amount (GH₵) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  {...register('amount', { valueAsNumber: true })}
                  className="input-base"
                />
                {errors.amount && (
                  <p className="text-xs text-red-600 mt-1">{errors.amount.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-muted mb-1">
                  Date *
                </label>
                <input type="date" {...register('entry_date')} className="input-base" />
                {errors.entry_date && (
                  <p className="text-xs text-red-600 mt-1">{errors.entry_date.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-muted mb-1">
                  Description *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Reimbursement for domain payment, Fuel cash..."
                  {...register('description')}
                  className="input-base"
                />
                {errors.description && (
                  <p className="text-xs text-red-600 mt-1">{errors.description.message}</p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDialogOpen(false)}
                  className="btn-outline"
                >
                  Cancel
                </button>
                <button type="submit" disabled={creating} className="btn-primary">
                  {creating ? 'Saving...' : 'Save Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
