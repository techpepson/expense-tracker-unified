import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Calendar, Clock, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  errorMessage,
  useCategories,
  useDeleteExpense,
  useExpense,
  useUsers,
} from '@/api'
import { EXPENSE_TYPE_LABEL, formatDate, formatDateTime } from '@/lib/formatters'
import { Button } from '@/components/ui/button'
import { Badge, Skeleton } from '@/components/ui/badge'
import {
  ConfirmDialog,
  CurrencyText,
  EmptyState,
  PageHeader,
  UserChip,
} from '@/components/shared'

export function ExpenseDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const { data: expense, isLoading } = useExpense(id)
  const { data: categories } = useCategories()
  const { data: users } = useUsers()
  const deleteMutation = useDeleteExpense()

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-80 w-full" />
      </div>
    )
  }

  if (!expense) {
    return (
      <EmptyState
        title="Expense record not found"
        description="The requested expense may have been deleted."
        action={
          <Button asChild variant="outline">
            <Link to="/expenses">Back to Expenses</Link>
          </Button>
        }
      />
    )
  }

  const categoryName = categories?.find((c) => c.id === expense.category_id)?.name ?? 'Category'
  const creator = users?.find((u) => u.id === expense.created_by)
  const updater = expense.updated_by ? users?.find((u) => u.id === expense.updated_by) : creator

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(expense.id)
      toast.success('Expense deleted')
      navigate('/expenses', { replace: true })
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/expenses"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#2563EB] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Expenses
        </Link>
      </div>

      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span>{expense.item_name}</span>
            <span className="rounded-md bg-[#EFF6FF] dark:bg-[#172554] px-2.5 py-0.5 text-xs font-mono font-medium text-[#2563EB]">
              #{expense.id}
            </span>
          </span>
        }
        subtitle={`Recorded for ${formatDate(expense.expense_date)}`}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to={`/expenses/${expense.id}/edit`}>
                <Pencil className="h-4 w-4" />
                Edit
              </Link>
            </Button>
            <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8 space-y-6">
          {/* Summary Banner */}
          <div className="hero-card flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-[#DBEAFE]">
                Computed Line Total
              </div>
              <div className="mt-1 text-3xl sm:text-4xl font-extrabold">
                <CurrencyText amount={expense.total} />
              </div>
              <p className="mt-1 text-xs text-[#DBEAFE]">
                <CurrencyText amount={expense.unit_cost} /> × {expense.quantity} unit(s)
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="category" className="bg-white/20 text-white">
                {categoryName}
              </Badge>
              <Badge variant={expense.expense_type === 'shared_operational' ? 'shared' : 'individual'}>
                {EXPENSE_TYPE_LABEL[expense.expense_type]}
              </Badge>
            </div>
          </div>

          {/* Field Grid */}
          <div className="app-card">
            <h2 className="mb-4 text-base font-bold text-[#1E3A8A] dark:text-[#DBEAFE]">
              Expense details
            </h2>
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-sm">
              <div className="rounded-[12px] bg-[var(--surface-tint)] p-3.5">
                <dt className="text-xs text-[var(--text-secondary)]">Category</dt>
                <dd className="mt-1 font-semibold">{categoryName}</dd>
              </div>
              <div className="rounded-[12px] bg-[var(--surface-tint)] p-3.5">
                <dt className="text-xs text-[var(--text-secondary)]">Catalog Item ("Bill")</dt>
                <dd className="mt-1 font-semibold">{expense.item_name}</dd>
              </div>
              <div className="rounded-[12px] bg-[var(--surface-tint)] p-3.5">
                <dt className="text-xs text-[var(--text-secondary)]">Expense Date</dt>
                <dd className="mt-1 font-semibold">{formatDate(expense.expense_date)}</dd>
              </div>
              <div className="rounded-[12px] bg-[var(--surface-tint)] p-3.5">
                <dt className="text-xs text-[var(--text-secondary)]">Unit Cost</dt>
                <dd className="mt-1 font-semibold">
                  <CurrencyText amount={expense.unit_cost} />
                </dd>
              </div>
              <div className="rounded-[12px] bg-[var(--surface-tint)] p-3.5">
                <dt className="text-xs text-[var(--text-secondary)]">Quantity</dt>
                <dd className="mt-1 font-semibold tabular-nums">{expense.quantity}</dd>
              </div>
              <div className="rounded-[12px] bg-[var(--surface-tint)] p-3.5">
                <dt className="text-xs text-[var(--text-secondary)]">Total Price</dt>
                <dd className="mt-1 font-bold text-[#2563EB]">
                  <CurrencyText amount={expense.total} />
                </dd>
              </div>
              <div className="rounded-[12px] bg-[var(--surface-tint)] p-3.5">
                <dt className="text-xs text-[var(--text-secondary)]">Created By</dt>
                <dd className="mt-1.5">
                  <UserChip
                    name={creator?.full_name ?? 'Administrator'}
                    email={creator?.email}
                    avatarUrl={creator?.profile_picture}
                  />
                </dd>
              </div>
              <div className="rounded-[12px] bg-[var(--surface-tint)] p-3.5">
                <dt className="text-xs text-[var(--text-secondary)]">Incurred By</dt>
                <dd className="mt-1 font-semibold">{expense.incurred_by || 'Organisation / Shared'}</dd>
              </div>
              <div className="rounded-[12px] bg-[var(--surface-tint)] p-3.5">
                <dt className="text-xs text-[var(--text-secondary)]">Expense Type</dt>
                <dd className="mt-1 font-semibold">{EXPENSE_TYPE_LABEL[expense.expense_type]}</dd>
              </div>
              <div className="sm:col-span-2 lg:col-span-3 rounded-[12px] bg-[var(--surface-tint)] p-3.5">
                <dt className="text-xs text-[var(--text-secondary)]">Description</dt>
                <dd className="mt-1">{expense.description || 'No description provided.'}</dd>
              </div>
              <div className="sm:col-span-2 lg:col-span-3 rounded-[12px] bg-[var(--surface-tint)] p-3.5">
                <dt className="text-xs text-[var(--text-secondary)]">Notes</dt>
                <dd className="mt-1 text-[var(--text-secondary)]">{expense.notes || 'None'}</dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Record History Timeline */}
        <div className="lg:col-span-4">
          <div className="app-card space-y-4">
            <h2 className="text-base font-bold text-[#1E3A8A] dark:text-[#DBEAFE]">
              Record history
            </h2>
            <ol className="relative ml-3 border-l-2 border-[#BFDBFE] dark:border-[#1E3A8A] space-y-6 py-1">
              <li className="ml-5">
                <span className="absolute -left-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#2563EB] text-white">
                  <Calendar className="h-3 w-3" />
                </span>
                <div className="text-xs font-semibold uppercase tracking-wider text-[#2563EB]">
                  Record created
                </div>
                <p className="mt-0.5 text-sm font-medium">
                  By {creator?.full_name ?? 'Administrator'}
                </p>
                <p className="text-xs text-[var(--text-secondary)]">
                  {formatDateTime(expense.created_at)}
                </p>
              </li>

              <li className="ml-5">
                <span className="absolute -left-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#1E3A8A] text-white">
                  <Clock className="h-3 w-3" />
                </span>
                <div className="text-xs font-semibold uppercase tracking-wider text-[#1E3A8A] dark:text-[#38BDF8]">
                  Last updated
                </div>
                <p className="mt-0.5 text-sm font-medium">
                  By {updater?.full_name ?? 'Administrator'}
                </p>
                <p className="text-xs text-[var(--text-secondary)]">
                  {formatDateTime(expense.updated_at)}
                </p>
              </li>
            </ol>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete this expense record?"
        description="This action permanently deletes the expense record and updates monthly totals."
        confirmLabel="Delete record"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={handleDelete}
      />
    </div>
  )
}

