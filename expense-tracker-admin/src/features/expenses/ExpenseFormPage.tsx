import { useEffect, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Layers, Plus, Trash2, User as UserIcon, Users } from 'lucide-react'
import { toast } from 'sonner'
import {
  errorMessage,
  selectActiveCategories,
  useCategories,
  useCreateExpense,
  useCreateExpensesBulk,
  useExpense,
  useItems,
  useUpdateExpense,
  useUsers,
} from '@/api'
import type { ExpenseType } from '@/types'
import { formatDate, todayISO } from '@/lib/formatters'
import { lineTotal, sumMoney } from '@/lib/money'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/controls'
import { OptionCard } from '@/components/ui/badge'
import { Combobox } from '@/components/ui/combobox'
import {
  CurrencyText,
  FormField,
  PageHeader,
  UserChip,
} from '@/components/shared'

const expenseSchema = z.object({
  category_id: z.string().min(1, 'Choose a category'),
  item_id: z.string().min(1, 'Choose an approved item'),
  unit_cost: z.coerce.number().positive('Unit cost must be greater than zero'),
  quantity: z.coerce.number().positive('Quantity must be greater than zero'),
  description: z.string().max(300).default(''),
  expense_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date'),
  expense_type: z.enum(['individual', 'shared_operational']),
  incurred_by: z.string().optional(),
  notes: z.string().optional(),
})

type ExpenseFormValues = z.infer<typeof expenseSchema>

interface QuickLine {
  key: string
  item_id: string
  unit_cost: string
  quantity: string
  description: string
}

export function ExpenseFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const currentUser = useAuthStore((s) => s.user)

  const [mode, setMode] = useState<'single' | 'quick'>('single')

  const { data: categories } = useCategories()
  const { data: allItems } = useItems()
  const { data: existing } = useExpense(id)
  const { data: users } = useUsers()

  const createMutation = useCreateExpense()
  const bulkMutation = useCreateExpensesBulk()
  const updateMutation = useUpdateExpense()

  const activeCategories = useMemo(() => selectActiveCategories(categories), [categories])

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    control,
    formState: { errors },
  } = useForm<ExpenseFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(expenseSchema) as any,
    defaultValues: {
      category_id: '',
      item_id: '',
      unit_cost: 0,
      quantity: 1,
      description: '',
      expense_date: todayISO(),
      expense_type: 'shared_operational',
      incurred_by: '',
      notes: '',
    },
  })

  useEffect(() => {
    if (isEdit && existing) {
      reset({
        category_id: existing.category_id,
        item_id: existing.item_id,
        unit_cost: existing.unit_cost,
        quantity: existing.quantity,
        description: existing.description,
        expense_date: existing.expense_date,
        expense_type: existing.expense_type,
        incurred_by: existing.incurred_by ?? '',
        notes: existing.notes ?? '',
      })
    }
  }, [existing, isEdit, reset])

  const selectedCategoryId = useWatch({ control, name: 'category_id' })
  const selectedItemId = useWatch({ control, name: 'item_id' })
  const unitCostVal = useWatch({ control, name: 'unit_cost' })
  const quantityVal = useWatch({ control, name: 'quantity' })
  const expenseTypeVal = useWatch({ control, name: 'expense_type' })

  const liveTotal = lineTotal(Number(unitCostVal) || 0, Number(quantityVal) || 0)

  const categoryOptions = useMemo(() => {
    if (isEdit && existing) {
      const current = categories?.find((c) => c.id === existing.category_id)
      if (current && !current.is_active) return [current, ...activeCategories]
    }
    return activeCategories
  }, [activeCategories, categories, existing, isEdit])

  const approvedItemsForCategory = useMemo(
    () =>
      (allItems ?? [])
        .filter((it) => it.category_id === selectedCategoryId && it.status === 'approved')
        .map((it) => ({ value: it.id, label: it.name })),
    [allItems, selectedCategoryId],
  )

  const creatorUser = isEdit && existing
    ? users?.find((u) => u.id === existing.created_by) ?? currentUser
    : currentUser

  const onSubmitSingle = handleSubmit(async (values) => {
    try {
      if (isEdit && id) {
        await updateMutation.mutateAsync({ id, ...values })
        toast.success('Expense updated')
        navigate(`/expenses/${id}`)
      } else {
        const created = await createMutation.mutateAsync(values)
        toast.success('Expense recorded')
        navigate(`/expenses/${created.id}`)
      }
    } catch (err) {
      toast.error(errorMessage(err))
    }
  })

  // Quick-entry state (several lines sharing one date and category)
  const [quickDate, setQuickDate] = useState(todayISO())
  const [quickCategoryId, setQuickCategoryId] = useState('')
  const [quickType, setQuickType] = useState<ExpenseType>('shared_operational')
  const [quickLines, setQuickLines] = useState<QuickLine[]>([
    { key: '1', item_id: '', unit_cost: '', quantity: '1', description: '' },
    { key: '2', item_id: '', unit_cost: '', quantity: '1', description: '' },
  ])
  const [quickError, setQuickError] = useState<string | null>(null)

  const quickItemOptions = useMemo(
    () =>
      (allItems ?? [])
        .filter((it) => it.category_id === quickCategoryId && it.status === 'approved')
        .map((it) => ({ value: it.id, label: it.name })),
    [allItems, quickCategoryId],
  )

  const quickGrandTotal = useMemo(
    () =>
      sumMoney(
        quickLines.map((l) => lineTotal(Number(l.unit_cost) || 0, Number(l.quantity) || 0)),
      ),
    [quickLines],
  )

  const handleQuickSave = async () => {
    setQuickError(null)
    if (!quickCategoryId) {
      setQuickError('Choose a category for the batch.')
      return
    }
    const payloadLines = quickLines.map((l) => ({
      category_id: quickCategoryId,
      item_id: l.item_id,
      unit_cost: Number(l.unit_cost),
      quantity: Number(l.quantity),
      description: l.description.trim(),
      expense_date: quickDate,
      expense_type: quickType,
    }))
    if (payloadLines.some((l) => !l.item_id || !(l.unit_cost > 0) || !(l.quantity > 0))) {
      setQuickError('Every row must have an item, a positive unit cost, and a positive quantity.')
      return
    }
    try {
      const created = await bulkMutation.mutateAsync(payloadLines)
      toast.success(`Recorded ${created.length} expenses`)
      navigate('/expenses')
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/expenses"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#2563EB] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Expenses
        </Link>

        {!isEdit && (
          <Tabs value={mode} onValueChange={(v) => setMode(v as 'single' | 'quick')}>
            <TabsList>
              <TabsTrigger value="single">Single expense</TabsTrigger>
              <TabsTrigger value="quick">
                <Layers className="h-3.5 w-3.5" />
                Quick entry (multi-line)
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}
      </div>

      <PageHeader
        title={isEdit ? 'Edit Expense' : mode === 'quick' ? 'Quick Entry — Multiple Lines' : 'Add Expense'}
        subtitle={
          mode === 'quick'
            ? 'Record several purchase items sharing one date and category'
            : 'Mirrors the Expenditure Tracker columns; total is always computed automatically'
        }
      />

      {mode === 'single' ? (
        <div className="grid gap-6 lg:grid-cols-12">
          <form onSubmit={onSubmitSingle} noValidate className="app-card lg:col-span-8 space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                label="Category"
                htmlFor="exp-category"
                required
                error={errors.category_id?.message}
              >
                <Select
                  id="exp-category"
                  value={selectedCategoryId}
                  onChange={(e) => {
                    setValue('category_id', e.target.value, { shouldValidate: true })
                    setValue('item_id', '')
                  }}
                >
                  <option value="">Select active category…</option>
                  {categoryOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField
                label="Item (Bill)"
                htmlFor="exp-item"
                required
                error={errors.item_id?.message}
                hint="Approved items in the selected category"
              >
                <Combobox
                  id="exp-item"
                  ariaLabel="Item"
                  value={selectedItemId}
                  onChange={(v) => setValue('item_id', v, { shouldValidate: true })}
                  options={approvedItemsForCategory}
                  disabled={!selectedCategoryId}
                  placeholder={selectedCategoryId ? 'Search and choose item…' : 'Choose category first'}
                />
              </FormField>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                label="Unit cost (GHS)"
                htmlFor="exp-unit-cost"
                required
                error={errors.unit_cost?.message}
              >
                <Input
                  id="exp-unit-cost"
                  type="number"
                  step="0.01"
                  min="0"
                  {...register('unit_cost')}
                />
              </FormField>

              <FormField
                label="Quantity"
                htmlFor="exp-quantity"
                required
                error={errors.quantity?.message}
              >
                <Input
                  id="exp-quantity"
                  type="number"
                  step="1"
                  min="1"
                  {...register('quantity')}
                />
              </FormField>

              <FormField
                label="Computed Total"
                hint="Read-only: unit cost × quantity"
              >
                <div
                  aria-label="Computed total"
                  className="flex h-[44px] items-center rounded-[10px] border border-[#BFDBFE] bg-[#EFF6FF] dark:bg-[#172554] px-3.5 text-base font-bold text-[#1E3A8A] dark:text-white"
                >
                  <CurrencyText amount={liveTotal} />
                </div>
              </FormField>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                label="Expense date"
                htmlFor="exp-date"
                required
                error={errors.expense_date?.message}
              >
                <Input id="exp-date" type="date" {...register('expense_date')} />
              </FormField>

              <FormField
                label="Incurred by (optional)"
                htmlFor="exp-incurred"
                hint="Person or team who incurred the expense"
              >
                <Input
                  id="exp-incurred"
                  placeholder="e.g. Technical team, Kofi Mensah"
                  {...register('incurred_by')}
                />
              </FormField>
            </div>

            <FormField label="Expense type" required error={errors.expense_type?.message}>
              <div role="radiogroup" aria-label="Expense type" className="grid gap-3 sm:grid-cols-2">
                <OptionCard
                  selected={expenseTypeVal === 'shared_operational'}
                  onSelect={() => setValue('expense_type', 'shared_operational')}
                  title="Shared operational"
                  description="Office supplies, utilities, shared transport, or company-wide bills."
                  icon={<Users className="h-4 w-4 text-[#2563EB]" />}
                />
                <OptionCard
                  selected={expenseTypeVal === 'individual'}
                  onSelect={() => setValue('expense_type', 'individual')}
                  title="Individual"
                  description="Expense tied to a specific staff member or individual assignment."
                  icon={<UserIcon className="h-4 w-4 text-[#2563EB]" />}
                />
              </div>
            </FormField>

            <FormField
              label="Description"
              htmlFor="exp-description"
              error={errors.description?.message}
            >
              <Input
                id="exp-description"
                placeholder="e.g. 10 Gallons for the office"
                {...register('description')}
              />
            </FormField>

            <FormField label="Notes (optional)" htmlFor="exp-notes">
              <Textarea
                id="exp-notes"
                placeholder="Additional audit notes or receipt reference…"
                {...register('notes')}
              />
            </FormField>

            <div className="flex items-center justify-end gap-3 border-t border-[var(--border-divider)] pt-4">
              <Button variant="outline" asChild>
                <Link to="/expenses">Cancel</Link>
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {isEdit ? 'Save changes' : 'Record expense'}
              </Button>
            </div>
          </form>

          {/* Side Card: Read-only Created By */}
          <div className="lg:col-span-4 space-y-4">
            <div className="app-card space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                Created by (read-only)
              </div>
              {creatorUser && (
                <UserChip
                  name={creatorUser.full_name}
                  email={creatorUser.email}
                  avatarUrl={creatorUser.profile_picture}
                />
              )}
              <p className="text-xs text-[var(--text-secondary)]">
                {isEdit && existing
                  ? `Originally recorded on ${formatDate(existing.created_at)}.`
                  : 'This expense will be logged under your administrator account.'}
              </p>
            </div>

            <div className="app-card space-y-2 bg-[var(--surface-tint)]">
              <h3 className="text-sm font-bold text-[#1E3A8A] dark:text-[#DBEAFE]">
                Server-computed totals
              </h3>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                In the legacy Excel sheet, hand-typed totals occasionally disagreed with unit cost × quantity. The system always calculates and stores the exact product in pesewas.
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* Quick Entry Mode */
        <div className="app-card space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label="Shared Expense Date" htmlFor="quick-date" required>
              <Input
                id="quick-date"
                type="date"
                value={quickDate}
                onChange={(e) => setQuickDate(e.target.value)}
              />
            </FormField>

            <FormField label="Shared Category" htmlFor="quick-cat" required>
              <Select
                id="quick-cat"
                value={quickCategoryId}
                onChange={(e) => {
                  setQuickCategoryId(e.target.value)
                  setQuickLines((lines) => lines.map((l) => ({ ...l, item_id: '' })))
                }}
              >
                <option value="">Select active category…</option>
                {activeCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Expense Type" htmlFor="quick-type" required>
              <Select
                id="quick-type"
                value={quickType}
                onChange={(e) => setQuickType(e.target.value as ExpenseType)}
              >
                <option value="shared_operational">Shared operational</option>
                <option value="individual">Individual</option>
              </Select>
            </FormField>
          </div>

          {quickError && (
            <p role="alert" className="text-xs font-medium text-[#B91C1C]">
              {quickError}
            </p>
          )}

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border-divider)] text-[12px] font-semibold uppercase tracking-wider text-[#475569]">
                  <th className="px-2 py-2 w-64">Item</th>
                  <th className="px-2 py-2 w-36">Unit Cost</th>
                  <th className="px-2 py-2 w-28">Qty</th>
                  <th className="px-2 py-2">Description</th>
                  <th className="px-2 py-2 w-36 text-right">Line Total</th>
                  <th className="px-2 py-2 w-12" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-divider)]">
                {quickLines.map((line, idx) => {
                  const rowTotal = lineTotal(Number(line.unit_cost) || 0, Number(line.quantity) || 0)
                  return (
                    <tr key={line.key}>
                      <td className="p-2">
                        <Select
                          aria-label={`Line ${idx + 1} item`}
                          value={line.item_id}
                          disabled={!quickCategoryId}
                          onChange={(e) =>
                            setQuickLines((rows) =>
                              rows.map((r) => (r.key === line.key ? { ...r, item_id: e.target.value } : r)),
                            )
                          }
                        >
                          <option value="">Select item…</option>
                          {quickItemOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td className="p-2">
                        <Input
                          aria-label={`Line ${idx + 1} unit cost`}
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={line.unit_cost}
                          onChange={(e) =>
                            setQuickLines((rows) =>
                              rows.map((r) => (r.key === line.key ? { ...r, unit_cost: e.target.value } : r)),
                            )
                          }
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          aria-label={`Line ${idx + 1} quantity`}
                          type="number"
                          step="1"
                          min="1"
                          value={line.quantity}
                          onChange={(e) =>
                            setQuickLines((rows) =>
                              rows.map((r) => (r.key === line.key ? { ...r, quantity: e.target.value } : r)),
                            )
                          }
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          aria-label={`Line ${idx + 1} description`}
                          placeholder="Description"
                          value={line.description}
                          onChange={(e) =>
                            setQuickLines((rows) =>
                              rows.map((r) => (r.key === line.key ? { ...r, description: e.target.value } : r)),
                            )
                          }
                        />
                      </td>
                      <td className="p-2 text-right font-semibold">
                        <CurrencyText amount={rowTotal} />
                      </td>
                      <td className="p-2 text-right">
                        {quickLines.length > 1 && (
                          <Button
                            variant="ghost"
                            size="iconSm"
                            aria-label={`Remove line ${idx + 1}`}
                            onClick={() =>
                              setQuickLines((rows) => rows.filter((r) => r.key !== line.key))
                            }
                          >
                            <Trash2 className="h-4 w-4 text-[#B91C1C]" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-divider)] pt-4">
            <Button
              variant="outline"
              onClick={() =>
                setQuickLines((rows) => [
                  ...rows,
                  { key: String(Date.now() + rows.length), item_id: '', unit_cost: '', quantity: '1', description: '' },
                ])
              }
            >
              <Plus className="h-4 w-4" />
              Add another row
            </Button>

            <div className="flex items-center gap-4">
              <div className="text-sm">
                Batch total:{' '}
                <CurrencyText amount={quickGrandTotal} className="text-base font-bold text-[#1E3A8A] dark:text-white" />
              </div>
              <Button onClick={handleQuickSave} disabled={bulkMutation.isPending}>
                {bulkMutation.isPending ? 'Saving…' : `Save ${quickLines.length} lines`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

