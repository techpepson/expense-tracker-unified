import { useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Search, Trash2, Edit2, Eye, Filter, FileSpreadsheet, FileText } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable } from '@/components/shared/DataTable'
import { CurrencyText } from '@/components/shared/CurrencyText'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { useExpenses, useDeleteExpense } from '@/api/expenses'
import { useCategories } from '@/api/categories'
import { useAuth } from '@/hooks/useAuth'
import { useDebounce } from '@/hooks/useDebounce'
import { formatDate, FULL_MONTH_NAMES } from '@/lib/formatters'
import { exportExpensesExcel, exportExpensesPdf } from '@/lib/exporters'
import type { Expense } from '@/types'
import { toast } from 'sonner'

export function ExpenseListPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  // Default to undefined so all expenses across all periods are shown by default
  const [month, setMonth] = useState<number | undefined>(undefined)
  const [year, setYear] = useState<number | undefined>(undefined)
  const [categoryId, setCategoryId] = useState<string>('')
  const [expenseType, setExpenseType] = useState<string>('')
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebounce(searchInput)

  const [page, setPage] = useState(1)
  const limit = 15

  const { data: categories = [] } = useCategories()
  const { data, isLoading } = useExpenses({
    month: month || undefined,
    year: year || undefined,
    category_id: categoryId || undefined,
    expense_type: expenseType || undefined,
    search: debouncedSearch || undefined,
    page,
    limit,
  })

  const { mutateAsync: deleteExpense, isPending: deleting } = useDeleteExpense()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const expenses = useMemo(() => data?.items ?? [], [data?.items])
  const totalCount = data?.total ?? 0

  const filteredTotal = useMemo(
    () => expenses.reduce((sum, item) => sum + item.total, 0),
    [expenses]
  )

  const handleExportExcel = async () => {
    if (expenses.length === 0) {
      toast.error('No expenses to export')
      return
    }
    try {
      await exportExpensesExcel(expenses, categories)
      toast.success('Expenses exported to Excel')
    } catch {
      toast.error('Failed to export to Excel')
    }
  }

  const handleExportPdf = () => {
    if (expenses.length === 0) {
      toast.error('No expenses to export')
      return
    }
    try {
      exportExpensesPdf(expenses, categories)
      toast.success('Expenses exported to PDF')
    } catch {
      toast.error('Failed to export to PDF')
    }
  }

  const handleDelete = async () => {
    if (!deletingId) return
    try {
      await deleteExpense(deletingId)
      toast.success('Expense deleted')
      setDeletingId(null)
    } catch {
      toast.error('Failed to delete expense')
    }
  }

  const columns: ColumnDef<Expense, unknown>[] = [
    {
      header: 'Date',
      accessorKey: 'expense_date',
      cell: (info) => (
        <span className="text-sm text-muted">{formatDate(info.getValue() as string)}</span>
      ),
    },
    {
      header: 'Item',
      accessorKey: 'item_name',
      cell: (info) => (
        <div className="flex flex-col">
          <span className="font-semibold text-body">{info.getValue() as string}</span>
          {info.row.original.description && (
            <span className="text-xs text-muted truncate max-w-[200px]">
              {info.row.original.description}
            </span>
          )}
        </div>
      ),
    },
    {
      header: 'Category',
      accessorKey: 'category_id',
      cell: (info) => {
        const cat = categories.find((c) => c.id === info.getValue())
        return (
          <span className="badge badge-blue">
            {cat?.name ?? info.row.original.category_name ?? 'Category'}
          </span>
        )
      },
    },
    {
      header: 'Type',
      accessorKey: 'expense_type',
      cell: (info) => {
        const type = info.getValue() as string
        return (
          <span className={type === 'shared_operational' ? 'badge badge-sky' : 'badge badge-slate'}>
            {type === 'shared_operational' ? 'Shared' : 'Individual'}
          </span>
        )
      },
    },
    {
      header: 'Qty',
      accessorKey: 'quantity',
      cell: (info) => <span className="text-sm">{info.getValue() as number}</span>,
    },
    {
      header: 'Unit Cost',
      accessorKey: 'unit_cost',
      cell: (info) => <CurrencyText amount={info.getValue() as number} size="sm" />,
    },
    {
      header: 'Total',
      accessorKey: 'total',
      cell: (info) => (
        <CurrencyText amount={info.getValue() as number} size="sm" className="font-bold text-navy" />
      ),
    },
    {
      header: 'Created By',
      accessorKey: 'created_by_name',
      cell: (info) => <span className="text-xs text-muted">{info.getValue() as string}</span>,
    },
    {
      header: 'Actions',
      id: 'actions',
      cell: (info) => {
        const record = info.row.original
        const isOwner = record.created_by === user?.id || user?.role === 'admin'

        return (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => navigate(`/expenses/${record.id}`)}
              className="p-1 text-muted hover:text-primary rounded"
              title="View details"
            >
              <Eye size={16} />
            </button>
            {isOwner && (
              <>
                <button
                  onClick={() => navigate(`/expenses/${record.id}/edit`)}
                  className="p-1 text-muted hover:text-primary rounded"
                  title="Edit expense"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={() => setDeletingId(record.id)}
                  className="p-1 text-muted hover:text-red-600 rounded"
                  title="Delete expense"
                >
                  <Trash2 size={16} />
                </button>
              </>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expenses"
        subtitle="Manage and track company expense records"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportExcel}
              disabled={expenses.length === 0}
              className="btn-outline text-sm"
              title="Download Excel spreadsheet"
            >
              <FileSpreadsheet size={15} /> Export Excel
            </button>
            <button
              onClick={handleExportPdf}
              disabled={expenses.length === 0}
              className="btn-outline text-sm"
              title="Download PDF document"
            >
              <FileText size={15} /> Export PDF
            </button>
            <Link to="/expenses/new" className="btn-primary text-sm">
              <Plus size={16} /> Add Expense
            </Link>
          </div>
        }
      />

      {/* Filter bar */}
      <div className="card space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-5">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
              size={16}
            />
            <input
              type="text"
              placeholder="Search expenses..."
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value)
                setPage(1)
              }}
              className="input-base pl-10 text-sm"
            />
          </div>

          <select
            value={month ?? ''}
            onChange={(e) => {
              const nextMonth = e.target.value ? Number(e.target.value) : undefined
              setMonth(nextMonth)
              if (nextMonth && !year) {
                setYear(new Date().getFullYear())
              }
              setPage(1)
            }}
            className="input-base text-sm"
          >
            <option value="">All Months</option>
            {FULL_MONTH_NAMES.map((m, idx) => (
              <option key={m} value={idx + 1}>
                {m}
              </option>
            ))}
          </select>

          <select
            value={year ?? ''}
            onChange={(e) => {
              setYear(e.target.value ? Number(e.target.value) : undefined)
              setPage(1)
            }}
            className="input-base text-sm"
          >
            <option value="">All Years</option>
            {[2024, 2025, 2026, 2027].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          <select
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value)
              setPage(1)
            }}
            className="input-base text-sm"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={expenseType}
            onChange={(e) => {
              setExpenseType(e.target.value)
              setPage(1)
            }}
            className="input-base text-sm"
          >
            <option value="">All Types</option>
            <option value="individual">Individual</option>
            <option value="shared_operational">Shared Operational</option>
          </select>
        </div>

        <div className="flex items-center justify-between border-t border-[#eaf1ff] pt-3 text-sm">
          <div className="flex items-center gap-2 text-muted">
            <Filter size={15} />
            <span>
              Found <strong>{totalCount}</strong> records
            </span>
          </div>
          <div>
            <span className="text-muted mr-2">Page Total:</span>
            <CurrencyText amount={filteredTotal} size="sm" className="font-bold text-navy" />
          </div>
        </div>
      </div>

      {/* Data Table */}
      <DataTable
        data={expenses}
        columns={columns}
        loading={isLoading}
        pageSize={limit}
        totalCount={totalCount}
        page={page}
        onPageChange={setPage}
        onRowClick={(row) => navigate(`/expenses/${row.id}`)}
        emptyTitle="No expenses found"
        emptyMessage="Try adjusting your filters or record a new expense."
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deletingId}
        title="Delete Expense"
        message="Are you sure you want to delete this expense record? This action cannot be undone."
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeletingId(null)}
      />
    </div>
  )
}

