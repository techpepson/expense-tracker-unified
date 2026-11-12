import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  ArrowDownLeft,
  ArrowUpRight,
  Coins,
  Pencil,
  Plus,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  errorMessage,
  useCreatePettyCash,
  useDeletePettyCash,
  usePettyCash,
  useSetOpeningBalance,
  useUpdatePettyCash,
} from '@/api'
import type { PettyCashEntryType, PettyCashLedgerRow } from '@/types'
import { ENTRY_TYPE_LABEL, formatDate, monthLabel, todayISO } from '@/lib/formatters'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge, OptionCard, Skeleton } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  ConfirmDialog,
  CurrencyText,
  EmptyState,
  FormField,
  MonthYearPicker,
  PageHeader,
  StatCard,
} from '@/components/shared'

const entrySchema = z.object({
  entry_type: z.enum(['cash_in', 'cash_out', 'charge']),
  amount: z.coerce.number().positive('Amount must be greater than zero'),
  entry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date'),
  description: z.string().max(300).default(''),
})

type EntryFormValues = z.infer<typeof entrySchema>

export function PettyCashPage() {
  const [month, setMonth] = useState<number>(1)
  const [year, setYear] = useState<number>(2026)

  const { data, isLoading } = usePettyCash(month, year)
  const createEntry = useCreatePettyCash()
  const updateEntry = useUpdatePettyCash()
  const deleteEntry = useDeletePettyCash()
  const setOpening = useSetOpeningBalance()

  const [entryDialogOpen, setEntryDialogOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<PettyCashLedgerRow | null>(null)
  const [deletingEntry, setDeletingEntry] = useState<PettyCashLedgerRow | null>(null)
  const [openingDialogOpen, setOpeningDialogOpen] = useState(false)
  const [openingAmount, setOpeningAmount] = useState('930.25')

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    control,
    formState: { errors },
  } = useForm<EntryFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(entrySchema) as any,
    defaultValues: {
      entry_type: 'cash_out',
      amount: 0,
      entry_date: todayISO(),
      description: '',
    },
  })

  const entryTypeVal = useWatch({ control, name: 'entry_type' })

  const openAddDialog = () => {
    setEditingEntry(null)
    reset({
      entry_type: 'cash_out',
      amount: 0,
      entry_date: `${year}-${String(month).padStart(2, '0')}-15`,
      description: '',
    })
    setEntryDialogOpen(true)
  }

  const openEditDialog = (row: PettyCashLedgerRow) => {
    setEditingEntry(row)
    reset({
      entry_type: row.entry_type,
      amount: row.amount,
      entry_date: row.entry_date,
      description: row.description,
    })
    setEntryDialogOpen(true)
  }

  const onSubmitEntry = handleSubmit(async (values) => {
    try {
      if (editingEntry) {
        await updateEntry.mutateAsync({ id: editingEntry.id, ...values })
        toast.success('Petty cash entry updated')
      } else {
        await createEntry.mutateAsync(values)
        toast.success('Petty cash entry added')
      }
      setEntryDialogOpen(false)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  })

  const handleConfirmDelete = async () => {
    if (!deletingEntry) return
    try {
      await deleteEntry.mutateAsync(deletingEntry.id)
      toast.success('Petty cash entry deleted')
      setDeletingEntry(null)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const handleSaveOpening = async () => {
    const num = Number(openingAmount)
    if (!Number.isFinite(num)) {
      toast.error('Enter a valid amount')
      return
    }
    try {
      await setOpening.mutateAsync({ amount: num, month, year })
      toast.success(`Opening balance set for ${monthLabel(month, year)}`)
      setOpeningDialogOpen(false)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const summary = data?.summary

  return (
    <div className="space-y-6">
      <PageHeader
        title="Petty Cash"
        subtitle={`Full ledger & reconciliation for ${monthLabel(month, year)}`}
        actions={
          <>
            <MonthYearPicker
              month={month}
              year={year}
              onMonthChange={(m) => m && setMonth(m)}
              onYearChange={setYear}
            />
            {data?.is_first_month && (
              <Button
                variant="outline"
                onClick={() => {
                  setOpeningAmount(String(summary?.opening_balance ?? 0))
                  setOpeningDialogOpen(true)
                }}
              >
                <SlidersHorizontal className="h-4 w-4" />
                Set opening balance
              </Button>
            )}
            <Button onClick={openAddDialog}>
              <Plus className="h-4 w-4" />
              Add entry
            </Button>
          </>
        }
      />

      {isLoading || !summary ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : (
        <>
          {/* Summary strip with the sheet's five figures */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard
              label="Balance before cash-in"
              value={<CurrencyText amount={summary.opening_balance} />}
              subtext={
                data.is_first_month
                  ? 'Initial opening balance'
                  : 'Previous month closing balance'
              }
            />
            <StatCard
              label="Cash-in"
              value={<CurrencyText amount={summary.cash_in} />}
              subtext="Imprest & reimbursements"
              icon={<ArrowDownLeft className="h-4 w-4" />}
            />
            <StatCard
              label="Cash-out (+ Charges)"
              value={<CurrencyText amount={summary.cash_out_total} />}
              subtext={
                <span>
                  Includes <CurrencyText amount={summary.charges} /> in charges
                </span>
              }
              icon={<ArrowUpRight className="h-4 w-4" />}
            />
            <StatCard
              hero
              label="Balance after cash-out"
              value={<CurrencyText amount={summary.closing_balance} />}
              subtext="Opening + Cash-in − Cash-out"
            />
            <StatCard
              label="Total (Cash used without charges)"
              value={<CurrencyText amount={summary.cash_used} />}
              subtext="Cash-out total − Charges"
              icon={<Coins className="h-4 w-4" />}
            />
          </div>

          {/* Ledger Table */}
          <div className="app-card">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-[#1E3A8A] dark:text-[#DBEAFE]">
                  Petty cash ledger · {monthLabel(month, year)}
                </h2>
                <p className="text-xs text-[var(--text-secondary)]">
                  Chronological cash-in, cash-out, and MoMo/withdrawal charge entries with running balance
                </p>
              </div>
              <span className="text-xs text-[var(--text-secondary)]">
                Opening: <CurrencyText amount={summary.opening_balance} className="text-[var(--text-primary)]" />
              </span>
            </div>

            {data.entries.length === 0 ? (
              <EmptyState
                title="No petty cash entries in this month"
                description="Add a cash-in, cash-out, or charge entry to begin tracking."
                action={
                  <Button onClick={openAddDialog}>
                    <Plus className="h-4 w-4" />
                    Add first entry
                  </Button>
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border-divider)] text-[12px] font-semibold uppercase tracking-wider text-[#475569]">
                      <th className="px-3.5 py-3">Date</th>
                      <th className="px-3.5 py-3">Type</th>
                      <th className="px-3.5 py-3">Description</th>
                      <th className="px-3.5 py-3 text-right">Amount</th>
                      <th className="px-3.5 py-3 text-right">Running balance</th>
                      <th className="px-3.5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-divider)]">
                    {data.entries.map((row) => (
                      <tr key={row.id} className="hover:bg-[var(--surface-hover)]">
                        <td className="px-3.5 py-3 whitespace-nowrap text-xs text-[var(--text-secondary)]">
                          {formatDate(row.entry_date)}
                        </td>
                        <td className="px-3.5 py-3">
                          <Badge
                            variant={
                              row.entry_type === 'cash_in'
                                ? 'shared'
                                : row.entry_type === 'charge'
                                  ? 'pending'
                                  : 'category'
                            }
                          >
                            {ENTRY_TYPE_LABEL[row.entry_type]}
                          </Badge>
                        </td>
                        <td className="px-3.5 py-3 text-[var(--text-secondary)]">
                          {row.description || '—'}
                        </td>
                        <td className="px-3.5 py-3 text-right font-semibold">
                          <span>{row.entry_type === 'cash_in' ? '+' : '−'} </span>
                          <CurrencyText amount={row.amount} />
                        </td>
                        <td className="px-3.5 py-3 text-right font-bold text-[#1E3A8A] dark:text-[#DBEAFE]">
                          <CurrencyText amount={row.running_balance} />
                        </td>
                        <td className="px-3.5 py-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              aria-label={`Edit entry on ${row.entry_date}`}
                              onClick={() => openEditDialog(row)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Edit
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              aria-label={`Delete entry on ${row.entry_date}`}
                              onClick={() => setDeletingEntry(row)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete
                            </Button>
                          </div>
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

      {/* Add / Edit Entry Dialog */}
      <Dialog open={entryDialogOpen} onOpenChange={setEntryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingEntry ? 'Edit petty cash entry' : 'Add petty cash entry'}</DialogTitle>
            <DialogDescription>
              Entries immediately update the running balance and subsequent months' opening balances.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmitEntry} noValidate className="space-y-4">
            <FormField label="Entry type" required>
              <div role="radiogroup" aria-label="Entry type" className="grid gap-2.5 sm:grid-cols-3">
                {(['cash_in', 'cash_out', 'charge'] as PettyCashEntryType[]).map((t) => (
                  <OptionCard
                    key={t}
                    selected={entryTypeVal === t}
                    onSelect={() => setValue('entry_type', t)}
                    title={ENTRY_TYPE_LABEL[t]}
                    description={
                      t === 'cash_in'
                        ? 'Top-up or reimbursement'
                        : t === 'cash_out'
                          ? 'Disbursement for purchases'
                          : 'MoMo / bank fee'
                    }
                  />
                ))}
              </div>
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Amount (GHS)" htmlFor="pc-amount" required error={errors.amount?.message}>
                <Input id="pc-amount" type="number" step="0.01" min="0" {...register('amount')} />
              </FormField>
              <FormField label="Date" htmlFor="pc-date" required error={errors.entry_date?.message}>
                <Input id="pc-date" type="date" {...register('entry_date')} />
              </FormField>
            </div>

            <FormField label="Description" htmlFor="pc-desc" error={errors.description?.message}>
              <Input
                id="pc-desc"
                placeholder="e.g. Imprest top-up, Reimbursement for Domain Payment"
                {...register('description')}
              />
            </FormField>

            <DialogFooter>
              <Button variant="outline" onClick={() => setEntryDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createEntry.isPending || updateEntry.isPending}>
                {editingEntry ? 'Save changes' : 'Add entry'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Set Opening Balance Dialog */}
      <Dialog open={openingDialogOpen} onOpenChange={setOpeningDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set opening balance</DialogTitle>
            <DialogDescription>
              Sets the starting petty cash balance before cash-in for {monthLabel(month, year)}. Later months chain from this figure automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <FormField label="Opening balance (GHS)" htmlFor="opening-input" required>
              <Input
                id="opening-input"
                type="number"
                step="0.01"
                value={openingAmount}
                onChange={(e) => setOpeningAmount(e.target.value)}
              />
            </FormField>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpeningDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveOpening} disabled={setOpening.isPending}>
              Save opening balance
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deletingEntry}
        onOpenChange={(open) => !open && setDeletingEntry(null)}
        title="Delete petty cash entry?"
        description="Deleting this entry recalculates the running balance and subsequent months."
        confirmLabel="Delete entry"
        destructive
        loading={deleteEntry.isPending}
        onConfirm={handleConfirmDelete}
      />
    </div>
  )
}

