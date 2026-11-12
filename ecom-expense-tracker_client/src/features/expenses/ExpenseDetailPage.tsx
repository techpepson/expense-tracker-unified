import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Edit2, Trash2, Calendar, User, Tag, FileText, Clock, Layers } from 'lucide-react'
import { useExpense, useDeleteExpense } from '@/api/expenses'
import { useCategories } from '@/api/categories'
import { useAuth } from '@/hooks/useAuth'
import { formatDate } from '@/lib/formatters'
import { CurrencyText } from '@/components/shared/CurrencyText'
import { PageHeader } from '@/components/shared/PageHeader'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { PageSkeleton } from '@/components/shared/LoadingSkeleton'
import { getInitials } from '@/lib/utils'
import { toast } from 'sonner'

export function ExpenseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [showDelete, setShowDelete] = useState(false)

  const { data: expense, isLoading } = useExpense(id ?? '')
  const { data: categories = [] } = useCategories()
  const { mutateAsync: deleteExpense, isPending: deleting } = useDeleteExpense()

  if (isLoading || !expense) {
    return <PageSkeleton />
  }

  const category = categories.find((c) => c.id === expense.category_id)
  const isOwner = expense.created_by === user?.id || user?.role === 'admin'

  const handleDelete = async () => {
    try {
      await deleteExpense(expense.id)
      toast.success('Expense deleted successfully')
      navigate('/expenses')
    } catch {
      toast.error('Failed to delete expense')
    }
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div>
        <Link
          to="/expenses"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-primary transition-colors"
        >
          <ArrowLeft size={16} /> Back to expenses
        </Link>
      </div>

      <PageHeader
        title={expense.item_name}
        subtitle={`Expense #${expense.id.slice(0, 8)} · Recorded on ${formatDate(expense.created_at)}`}
        actions={
          isOwner && (
            <div className="flex items-center gap-2">
              <Link to={`/expenses/${expense.id}/edit`} className="btn-outline">
                <Edit2 size={16} /> Edit
              </Link>
              <button onClick={() => setShowDelete(true)} className="btn-destructive">
                <Trash2 size={16} /> Delete
              </button>
            </div>
          )
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main Details Card */}
        <div className="card space-y-6 lg:col-span-2">
          {/* Hero amount & badges */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-[#eaf1ff] pb-6 gap-4">
            <div>
              <p className="text-xs uppercase font-semibold tracking-wider text-muted mb-1">
                Total Amount
              </p>
              <CurrencyText amount={expense.total} size="xl" className="text-navy" />
            </div>
            <div className="flex items-center gap-2">
              <span className="badge badge-blue text-sm py-1 px-3">
                {category?.name ?? 'Category'}
              </span>
              <span
                className={`badge text-sm py-1 px-3 ${
                  expense.expense_type === 'shared_operational' ? 'badge-sky' : 'badge-slate'
                }`}
              >
                {expense.expense_type === 'shared_operational' ? 'Shared Operational' : 'Individual'}
              </span>
            </div>
          </div>

          {/* Grid of properties */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-tint/60">
              <Tag size={18} className="text-primary mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">Unit Cost</p>
                <CurrencyText amount={expense.unit_cost} size="sm" className="font-semibold text-body" />
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-tint/60">
              <Layers size={18} className="text-primary mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">Quantity</p>
                <p className="text-sm font-semibold text-body">{expense.quantity}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-tint/60">
              <Calendar size={18} className="text-primary mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">
                  Expense Date
                </p>
                <p className="text-sm font-semibold text-body">{formatDate(expense.expense_date)}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-tint/60">
              <User size={18} className="text-primary mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">
                  Incurred By
                </p>
                <p className="text-sm font-semibold text-body">
                  {expense.incurred_by_name ?? expense.created_by_name}
                </p>
              </div>
            </div>
          </div>

          {/* Description */}
          {expense.description && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                Description
              </p>
              <p className="text-sm text-body bg-page-bg p-3.5 rounded-xl border border-[#e0ecff]">
                {expense.description}
              </p>
            </div>
          )}

          {/* Notes */}
          {expense.notes && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                Additional Notes
              </p>
              <p className="text-sm text-body bg-page-bg p-3.5 rounded-xl border border-[#e0ecff]">
                {expense.notes}
              </p>
            </div>
          )}
        </div>

        {/* Sidebar Info */}
        <div className="space-y-4">
          {/* Created By Card */}
          <div className="card space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Created By</p>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary font-bold text-white text-sm">
                {getInitials(expense.created_by_name)}
              </div>
              <div>
                <p className="text-sm font-semibold text-body">{expense.created_by_name}</p>
                <p className="text-xs text-muted">Employee Account</p>
              </div>
            </div>
          </div>

          {/* Record History Timeline */}
          <div className="card space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">
              Record History
            </p>
            <div className="space-y-3 text-xs">
              <div className="flex items-start gap-2">
                <Clock size={14} className="text-primary mt-0.5" />
                <div>
                  <p className="font-medium text-body">Created</p>
                  <p className="text-muted">{formatDate(expense.created_at, 'dd MMM yyyy, HH:mm')}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <FileText size={14} className="text-primary mt-0.5" />
                <div>
                  <p className="font-medium text-body">Last Updated</p>
                  <p className="text-muted">{formatDate(expense.updated_at, 'dd MMM yyyy, HH:mm')}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Permission Notice */}
          <div className="rounded-xl border border-[#e0ecff] bg-tint p-4 text-xs text-muted">
            <p className="font-medium text-body mb-1">Editing Permissions</p>
            Only the person who created this record can edit or delete it.
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={showDelete}
        title="Delete Expense"
        message="Are you sure you want to permanently delete this expense? This action cannot be undone."
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setShowDelete(false)}
      />
    </div>
  )
}

