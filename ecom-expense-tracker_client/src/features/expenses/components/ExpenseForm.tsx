import { useState, useEffect } from 'react'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Trash2, Info, Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { expenseSchema, quickEntrySchema, type ExpenseFormValues, type QuickEntryFormValues } from '../schemas/expense.schema'
import { useCreateExpense, useCreateExpensesBulk, useUpdateExpense } from '@/api/expenses'
import { useCategories } from '@/api/categories'
import { useItems, useSuggestItem } from '@/api/items'
import { useAuth } from '@/hooks/useAuth'
import { useDebounce } from '@/hooks/useDebounce'
import { computeTotal } from '@/lib/money'
import { CurrencyText } from '@/components/shared/CurrencyText'
import type { Expense } from '@/types'

interface ExpenseFormProps {
  expense?: Expense
  mode?: 'standard' | 'quick'
}

export function ExpenseForm({ expense, mode = 'standard' }: ExpenseFormProps) {
  const navigate = useNavigate()
  const { user, canRecordShared } = useAuth()
  const { data: categories = [] } = useCategories()
  const { mutateAsync: createExpense, isPending: creating } = useCreateExpense()
  const { mutateAsync: createBulk, isPending: creatingBulk } = useCreateExpensesBulk()
  const { mutateAsync: updateExpense, isPending: updating } = useUpdateExpense(expense?.id ?? '')
  const { mutateAsync: suggestItem } = useSuggestItem()

  const isEditing = !!expense
  const isLoading = creating || creatingBulk || updating

  // Standard form
  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: expense
      ? {
          category_id: expense.category_id,
          item_id: expense.item_id || '__existing__',
          unit_cost: expense.unit_cost,
          quantity: expense.quantity,
          description: expense.description ?? '',
          expense_date: expense.expense_date.slice(0, 10),
          expense_type: expense.expense_type,
          notes: expense.notes ?? '',
        }
      : {
          expense_type: 'individual',
          quantity: 1,
          expense_date: format(new Date(), 'yyyy-MM-dd'),
        },
  })

  const selectedCategoryId = watch('category_id')
  const unitCost = watch('unit_cost')
  const quantity = watch('quantity')
  const liveTotal = unitCost && quantity ? computeTotal(unitCost, quantity) : 0

  const [itemSearch, setItemSearch] = useState(expense?.item_name ?? '')
  const debouncedSearch = useDebounce(itemSearch)
  const [isNewItem, setIsNewItem] = useState(false)
  const [showItemDropdown, setShowItemDropdown] = useState(false)
  const selectedItemId = watch('item_id')

  const { data: items = [] } = useItems({
    category_id: selectedCategoryId || undefined,
    search: debouncedSearch || undefined,
  })

  // Reset item when category changes
  useEffect(() => {
    if (!isEditing) {
      setValue('item_id', '')
      setIsNewItem(false)
      setItemSearch('')
      setShowItemDropdown(false)
    }
  }, [selectedCategoryId, setValue, isEditing])

  const onSubmit = async (values: ExpenseFormValues) => {
    try {
      let resolvedItemId = values.item_id

      // If new item suggestion
      if (isNewItem && values.item_name_suggestion && selectedCategoryId) {
        const suggested = await suggestItem({
          category_id: selectedCategoryId,
          name: values.item_name_suggestion,
        })
        resolvedItemId = suggested.id
      }

      const effectiveItemId =
        resolvedItemId === '__existing__' || resolvedItemId === '__new__'
          ? ''
          : resolvedItemId
      const resolvedTitle = isNewItem
        ? values.item_name_suggestion?.trim()
        : itemSearch.trim() || expense?.item_name

      const payload = {
        category_id: values.category_id,
        item_id: effectiveItemId,
        title: resolvedTitle,
        unit_cost: values.unit_cost,
        quantity: values.quantity,
        description: values.description,
        expense_date: values.expense_date,
        expense_type: values.expense_type,
        notes: values.notes,
      }

      if (isEditing) {
        await updateExpense(payload)
        toast.success('Expense updated successfully')
        navigate(`/expenses/${expense.id}`)
      } else {
        await createExpense(payload)
        toast.success('Expense recorded!', {
          action: {
            label: 'View expenses',
            onClick: () => navigate('/expenses'),
          },
        })
        navigate('/expenses/new')
      }
    } catch {
      toast.error('Failed to save expense. Please try again.')
    }
  }

  // ── Quick entry form ────────────────────────────────────
  const {
    register: qRegister,
    control: qControl,
    handleSubmit: qHandleSubmit,
    watch: qWatch,
    formState: { errors: qErrors },
  } = useForm<QuickEntryFormValues>({
    resolver: zodResolver(quickEntrySchema),
    defaultValues: {
      expense_type: 'individual',
      expense_date: format(new Date(), 'yyyy-MM-dd'),
      rows: [{ item_id: '', unit_cost: 0, quantity: 1 }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control: qControl, name: 'rows' })
  const qCategoryId = qWatch('category_id')
  const { data: qItems = [] } = useItems({ category_id: qCategoryId || undefined })

  const onQuickSubmit = async (values: QuickEntryFormValues) => {
    try {
      const payloads = values.rows.map((row) => ({
        category_id: values.category_id,
        item_id: row.item_id,
        unit_cost: row.unit_cost,
        quantity: row.quantity,
        description: row.description,
        expense_date: values.expense_date,
        expense_type: values.expense_type,
      }))
      await createBulk(payloads)
      toast.success(`${payloads.length} expenses recorded!`)
      navigate('/expenses')
    } catch {
      toast.error('Failed to save expenses. Please try again.')
    }
  }

  if (mode === 'quick') {
    return (
      <form onSubmit={qHandleSubmit(onQuickSubmit)} className="space-y-5">
        {/* Shared fields */}
        <div className="card grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-body">Category *</label>
            <select {...qRegister('category_id')} className="input-base">
              <option value="">Select category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {qErrors.category_id && (
              <p className="mt-1 text-xs text-red-600">{qErrors.category_id.message}</p>
            )}
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-body">Date *</label>
            <input type="date" {...qRegister('expense_date')} className="input-base" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-body">Type *</label>
            <div className="flex gap-2">
              {(['individual', 'shared_operational'] as const).map((type) => {
                const isShared = type === 'shared_operational'
                const disabled = isShared && !canRecordShared
                return (
                  <label
                    key={type}
                    className={`option-card flex flex-1 items-center gap-2 text-sm ${
                      disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                    } ${qWatch('expense_type') === type ? 'selected' : ''}`}
                  >
                    <input
                      type="radio"
                      value={type}
                      disabled={disabled}
                      {...qRegister('expense_type')}
                      className="sr-only"
                    />
                    <span className="font-medium">
                      {type === 'individual' ? 'Individual' : 'Shared'}
                    </span>
                  </label>
                )
              })}
            </div>
          </div>
        </div>

        {/* Line items table */}
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-[#eaf1ff]">
                  {['Item', 'Unit Cost (GH₵)', 'Qty', 'Description', 'Total', ''].map((h) => (
                    <th key={h} className="table-header-cell">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fields.map((field, i) => {
                  const uc = qWatch(`rows.${i}.unit_cost`)
                  const qty = qWatch(`rows.${i}.quantity`)
                  const rowTotal = uc && qty ? computeTotal(uc, qty) : 0
                  return (
                    <tr key={field.id} className="border-b border-[#eaf1ff]">
                      <td className="p-2">
                        <select {...qRegister(`rows.${i}.item_id`)} className="input-base h-9 text-sm">
                          <option value="">Select item</option>
                          {qItems.map((it) => (
                            <option key={it.id} value={it.id}>{it.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="input-base h-9 w-28 text-sm"
                          {...qRegister(`rows.${i}.unit_cost`, { valueAsNumber: true })}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min="1"
                          className="input-base h-9 w-16 text-sm"
                          {...qRegister(`rows.${i}.quantity`, { valueAsNumber: true })}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          className="input-base h-9 text-sm"
                          placeholder="Optional"
                          {...qRegister(`rows.${i}.description`)}
                        />
                      </td>
                      <td className="p-2 text-sm font-medium">
                        {rowTotal > 0 && <CurrencyText amount={rowTotal} />}
                      </td>
                      <td className="p-2">
                        <button
                          type="button"
                          onClick={() => remove(i)}
                          disabled={fields.length === 1}
                          className="rounded p-1 text-muted hover:text-red-600 disabled:opacity-30"
                          aria-label="Remove row"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="p-3">
            <button
              type="button"
              onClick={() => append({ item_id: '', unit_cost: 0, quantity: 1 })}
              className="btn-outline h-9 text-sm"
            >
              <Plus size={15} />
              Add row
            </button>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate('/expenses')} className="btn-outline">
            Cancel
          </button>
          <button type="submit" disabled={creatingBulk} className="btn-primary">
            {creatingBulk ? <Loader2 size={16} className="animate-spin" /> : null}
            Save all ({fields.length})
          </button>
        </div>
      </form>
    )
  }

  // ── Standard form ────────────────────────────────────────
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="lg:col-span-2 space-y-5"
        noValidate
      >
        <div className="card space-y-4">
          {/* Category */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-body">Category *</label>
            <select
              {...register('category_id')}
              className="input-base"
              aria-invalid={!!errors.category_id}
            >
              <option value="">Select a category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {errors.category_id && (
              <p className="mt-1 text-xs text-red-600">{errors.category_id.message}</p>
            )}
          </div>

          {/* Item */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-body">Item *</label>
            {!isNewItem ? (
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={itemSearch}
                    onChange={(e) => {
                      setItemSearch(e.target.value)
                      setShowItemDropdown(true)
                      // Typing invalidates any previous selection
                      if (selectedItemId) setValue('item_id', '', { shouldValidate: true })
                    }}
                    onFocus={() => setShowItemDropdown(true)}
                    onBlur={() => setShowItemDropdown(false)}
                    className="input-base"
                    placeholder="Search items…"
                    disabled={!selectedCategoryId}
                  />
                  {showItemDropdown && items.length > 0 && (
                    <div className="absolute top-full z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-[#e0ecff] bg-white shadow-lg">
                      {items.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-tint ${
                            item.id === selectedItemId ? 'bg-tint font-medium' : ''
                          }`}
                          // Prevent input blur from closing the dropdown before the click registers
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setValue('item_id', item.id, { shouldValidate: true, shouldDirty: true })
                            setItemSearch(item.name)
                            setShowItemDropdown(false)
                          }}
                        >
                          {item.name}
                          {item.status === 'pending' && (
                            <span className="badge badge-slate text-[10px]">pending</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className="btn-outline whitespace-nowrap text-sm"
                  onClick={() => { setIsNewItem(true); setValue('item_id', '__new__') }}
                >
                  + New item
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  className="input-base"
                  placeholder="Enter new item name"
                  {...register('item_name_suggestion')}
                />
                <p className="flex items-center gap-1 text-xs text-muted">
                  <Info size={12} />
                  This suggestion will be sent for admin review. You can use it immediately.
                </p>
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => { setIsNewItem(false); setValue('item_id', ''); setItemSearch('') }}
                >
                  ← Pick from existing items
                </button>
              </div>
            )}
            <Controller name="item_id" control={control} render={() => <></>} />
            {errors.item_id && !isNewItem && (
              <p className="mt-1 text-xs text-red-600">{errors.item_id.message}</p>
            )}
          </div>

          {/* Unit cost + Quantity + live total */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-body">
                Unit Cost (GH₵) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="input-base"
                placeholder="0.00"
                {...register('unit_cost', { valueAsNumber: true })}
                aria-invalid={!!errors.unit_cost}
              />
              {errors.unit_cost && (
                <p className="mt-1 text-xs text-red-600">{errors.unit_cost.message}</p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-body">
                Quantity *
              </label>
              <input
                type="number"
                min="1"
                className="input-base"
                placeholder="1"
                {...register('quantity', { valueAsNumber: true })}
                aria-invalid={!!errors.quantity}
              />
              {errors.quantity && (
                <p className="mt-1 text-xs text-red-600">{errors.quantity.message}</p>
              )}
            </div>
          </div>

          {/* Live total */}
          {liveTotal > 0 && (
            <div className="flex items-center justify-between rounded-xl bg-tint px-4 py-3">
              <span className="text-sm font-medium text-muted">Total</span>
              <CurrencyText amount={liveTotal} size="lg" className="text-primary" />
            </div>
          )}
          <p className="text-xs text-muted">
            💡 Only have a total? Enter quantity 1 and the total as unit cost.
          </p>

          {/* Description */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-body">Description</label>
            <input
              type="text"
              className="input-base"
              placeholder="Brief description"
              {...register('description')}
            />
          </div>

          {/* Date */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-body">
              Expense Date *
            </label>
            <input
              type="date"
              className="input-base"
              {...register('expense_date')}
              aria-invalid={!!errors.expense_date}
            />
            {errors.expense_date && (
              <p className="mt-1 text-xs text-red-600">{errors.expense_date.message}</p>
            )}
          </div>

          {/* Expense type */}
          <div>
            <label className="mb-2 block text-sm font-medium text-body">Expense Type *</label>
            <div className="grid grid-cols-2 gap-3">
              {(['individual', 'shared_operational'] as const).map((type) => {
                const isShared = type === 'shared_operational'
                const disabled = isShared && !canRecordShared
                const checked = watch('expense_type') === type
                return (
                  <label
                    key={type}
                    className={`option-card ${checked ? 'selected' : ''} ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                  >
                    <input
                      type="radio"
                      value={type}
                      disabled={disabled}
                      {...register('expense_type')}
                      className="sr-only"
                    />
                    <div>
                      <p className="font-medium text-body">
                        {type === 'individual' ? 'Individual' : 'Shared Operational'}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        {type === 'individual'
                          ? 'Personal business expense'
                          : disabled
                          ? 'Requires Designated Recorder role'
                          : 'Shared team expense'}
                      </p>
                    </div>
                  </label>
                )
              })}
            </div>
            {errors.expense_type && (
              <p className="mt-1 text-xs text-red-600">{errors.expense_type.message}</p>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-body">Notes</label>
            <textarea
              className="input-base h-20 resize-none py-2"
              placeholder="Any additional notes…"
              {...register('notes')}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate(-1)} className="btn-outline">
            Cancel
          </button>
          <button type="submit" disabled={isLoading} className="btn-primary">
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : null}
            {isEditing ? 'Update expense' : 'Save expense'}
          </button>
        </div>
      </form>

      {/* Side card */}
      <div className="space-y-4">
        <div className="card">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">
            Record Info
          </p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">Created by</span>
              <span className="font-medium text-body">{user?.full_name}</span>
            </div>
            <p className="text-xs text-muted">
              This is set automatically to your account and cannot be changed.
            </p>
          </div>
        </div>
        {!canRecordShared && (
          <div className="rounded-xl border border-[#e0ecff] bg-tint p-4 text-sm text-muted">
            <Info size={15} className="mb-1 text-primary" />
            <p>
              <span className="font-medium text-body">Shared expenses</span> require the{' '}
              Designated Expense Recorder role. Contact your admin to enable this.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

