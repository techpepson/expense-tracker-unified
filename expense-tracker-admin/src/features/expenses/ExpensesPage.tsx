import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { Download, Pencil, Plus, RotateCcw, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  errorMessage,
  fetchExpenses,
  useCategories,
  useCurrency,
  useDeleteExpense,
  useExpenses,
  useItems,
  useUsers,
} from '@/api'
import type { Expense, ExpenseType } from '@/types'
import { useDebounce } from '@/hooks/useDebounce'
import { EXPENSE_TYPE_LABEL, formatDate, pluralize } from '@/lib/formatters'
import { buildExpensesWorkbook } from '@/lib/exporters/expensesWorkbook'
import { workbookToBlob } from '@/lib/exporters/trackerWorkbook'
import { downloadBlob } from '@/lib/exporters/download'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  ConfirmDialog,
  CurrencyText,
  DataTable,
  MonthYearPicker,
  PageHeader,
  UserChip,
} from '@/components/shared'

export function ExpensesPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const currency = useCurrency()

  const initialMonth = searchParams.get('month') ? Number(searchParams.get('month')) : undefined
  const initialYear = searchParams.get('year') ? Number(searchParams.get('year')) : 2026

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 250)
  const [month, setMonth] = useState<number | undefined>(initialMonth)
  const [year, setYear] = useState<number>(initialYear)
  const [categoryId, setCategoryId] = useState('')
  const [itemId, setItemId] = useState('')
  const [expenseType, setExpenseType] = useState<ExpenseType | ''>('')
  const [createdBy, setCreatedBy] = useState('')
  const [page, setPage] = useState(1)
  const [exporting, setExporting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null)

  const filters = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      month,
      year,
      category_id: categoryId || undefined,
      item_id: itemId || undefined,
      expense_type: expenseType || undefined,
      created_by: createdBy || undefined,
      page,
      limit: 15,
    }),
    [debouncedSearch, month, year, categoryId, itemId, expenseType, createdBy, page],
  )

  const { data: expensesRes, isLoading } = useExpenses(filters)
  const { data: categories } = useCategories()
  const { data: items } = useItems({ category_id: categoryId || undefined })
  const { data: users } = useUsers()
  const deleteMutation = useDeleteExpense()

  const categoryById = useMemo(
    () => new Map((categories ?? []).map((c) => [c.id, c.name])),
    [categories],
  )
  const userById = useMemo(() => new Map((users ?? []).map((u) => [u.id, u])), [users])

  const resetFilters = () => {
    setSearch('')
    setMonth(undefined)
    setYear(2026)
    setCategoryId('')
    setItemId('')
    setExpenseType('')
    setCreatedBy('')
    setPage(1)
  }

  const handleExport = async () => {
    try {
      setExporting(true)
      const full = await fetchExpenses({ ...filters, page: 1, limit: 10000 })
      const wb = buildExpensesWorkbook({
        expenses: full.data,
        categories: categories ?? [],
        users: users ?? [],
        currency,
        title: `e-COM Expenses (${year})`,
      })
      const blob = await workbookToBlob(wb)
      downloadBlob(blob, `ecom-expenses-${year}${month ? `-${String(month).padStart(2, '0')}` : ''}.xlsx`)
      toast.success(`Exported ${pluralize(full.data.length, 'record')} to Excel`)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setExporting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteMutation.mutateAsync(deleteTarget.id)
      toast.success(`Deleted "${deleteTarget.item_name}" expense`)
      setDeleteTarget(null)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const columns = useMemo<ColumnDef<Expense>[]>(
    () => [
      {
        accessorKey: 'expense_date',
        header: 'Date',
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-xs font-medium text-[var(--text-secondary)]">
            {formatDate(row.original.expense_date)}
          </span>
        ),
      },
      {
        accessorKey: 'item_name',
        header: 'Item',
        cell: ({ row }) => (
          <span className="font-semibold text-[#1E3A8A] dark:text-[#DBEAFE]">
            {row.original.item_name}
          </span>
        ),
      },
      {
        accessorKey: 'category_id',
        header: 'Category',
        cell: ({ row }) => (
          <Badge variant="category">
            {categoryById.get(row.original.category_id) ?? 'Category'}
          </Badge>
        ),
      },
      {
        accessorKey: 'description',
        header: 'Description',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="block max-w-[240px] truncate text-xs text-[var(--text-secondary)]">
            {row.original.description || '—'}
          </span>
        ),
      },
      {
        accessorKey: 'quantity',
        header: 'Qty',
        cell: ({ row }) => <span className="tabular-nums">{row.original.quantity}</span>,
      },
      {
        accessorKey: 'unit_cost',
        header: 'Unit cost',
        cell: ({ row }) => <CurrencyText amount={row.original.unit_cost} />,
      },
      {
        accessorKey: 'total',
        header: 'Total',
        cell: ({ row }) => (
          <CurrencyText amount={row.original.total} className="font-bold text-[#1E3A8A] dark:text-white" />
        ),
      },
      {
        accessorKey: 'expense_type',
        header: 'Type',
        cell: ({ row }) => (
          <Badge variant={row.original.expense_type === 'shared_operational' ? 'shared' : 'individual'}>
            {row.original.expense_type === 'shared_operational' ? 'Shared' : EXPENSE_TYPE_LABEL.individual}
          </Badge>
        ),
      },
      {
        accessorKey: 'created_by',
        header: 'Created by',
        enableSorting: false,
        cell: ({ row }) => {
          const u = userById.get(row.original.created_by)
          return <UserChip name={u?.full_name ?? 'Admin'} avatarUrl={u?.profile_picture} />
        },
      },
      {
        id: 'actions',
        header: 'Actions',
        enableSorting: false,
        cell: ({ row }) => (
          <div
            className="flex items-center gap-1.5"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              variant="outline"
              size="sm"
              aria-label={`Edit ${row.original.item_name}`}
              onClick={() => navigate(`/expenses/${row.original.id}/edit`)}
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
            <Button
              variant="destructive"
              size="sm"
              aria-label={`Delete ${row.original.item_name}`}
              onClick={() => setDeleteTarget(row.original)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
          </div>
        ),
      },
    ],
    [categoryById, navigate, userById],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expenses"
        subtitle="Review, filter, edit, or export all purchase records across the organisation"
        actions={
          <>
            <Button variant="outline" onClick={handleExport} disabled={exporting}>
              <Download className="h-4 w-4" />
              {exporting ? 'Exporting…' : 'Export to Excel'}
            </Button>
            <Button asChild>
              <Link to="/expenses/new">
                <Plus className="h-4 w-4" />
                Add Expense
              </Link>
            </Button>
          </>
        }
      />

      {/* Filter Bar */}
      <div className="app-card space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="relative lg:col-span-2">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#475569]" />
            <Input
              aria-label="Search expenses"
              placeholder="Search item, description, incurred by…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="pl-10"
            />
          </div>

          <div className="lg:col-span-2 flex items-center gap-2">
            <MonthYearPicker
              month={month}
              year={year}
              allowAllMonths
              onMonthChange={(m) => {
                setMonth(m)
                setPage(1)
              }}
              onYearChange={(y) => {
                setYear(y)
                setPage(1)
              }}
            />
          </div>

          <Select
            aria-label="Filter by category"
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value)
              setItemId('')
              setPage(1)
            }}
          >
            <option value="">All categories</option>
            {(categories ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>

          <Select
            aria-label="Filter by item"
            value={itemId}
            onChange={(e) => {
              setItemId(e.target.value)
              setPage(1)
            }}
          >
            <option value="">All items</option>
            {(items ?? []).map((it) => (
              <option key={it.id} value={it.id}>
                {it.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-divider)] pt-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-44">
              <Select
                aria-label="Filter by expense type"
                value={expenseType}
                onChange={(e) => {
                  setExpenseType(e.target.value as ExpenseType | '')
                  setPage(1)
                }}
              >
                <option value="">All types</option>
                <option value="shared_operational">Shared operational</option>
                <option value="individual">Individual</option>
              </Select>
            </div>
            <div className="w-48">
              <Select
                aria-label="Filter by creator"
                value={createdBy}
                onChange={(e) => {
                  setCreatedBy(e.target.value)
                  setPage(1)
                }}
              >
                <option value="">All creators</option>
                {(users ?? []).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name}
                  </option>
                ))}
              </Select>
            </div>
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              <RotateCcw className="h-3.5 w-3.5" />
              Reset filters
            </Button>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <span className="text-[var(--text-secondary)]">
              Showing <strong className="text-[var(--text-primary)]">{expensesRes?.total ?? 0}</strong> records
            </span>
            <span className="rounded-full bg-[#EFF6FF] dark:bg-[#172554] px-3 py-1 font-semibold text-[#1E3A8A] dark:text-[#DBEAFE]">
              Filtered total: <CurrencyText amount={expensesRes?.total_amount ?? 0} />
            </span>
          </div>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="app-card">
        <DataTable
          columns={columns}
          data={expensesRes?.data ?? []}
          loading={isLoading}
          onRowClick={(row) => navigate(`/expenses/${row.id}`)}
          serverPagination={{
            page: expensesRes?.page ?? 1,
            limit: expensesRes?.limit ?? 15,
            total: expensesRes?.total ?? 0,
            onPageChange: setPage,
          }}
        />
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete expense record?"
        description={
          deleteTarget ? (
            <span>
              This will permanently remove the <strong>{deleteTarget.item_name}</strong> record from{' '}
              {formatDate(deleteTarget.expense_date)} (<CurrencyText amount={deleteTarget.total} />
              ). This action cannot be undone.
            </span>
          ) : null
        }
        confirmLabel="Delete record"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={handleDelete}
      />
    </div>
  )
}

