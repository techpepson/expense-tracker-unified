import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import { useState } from 'react'
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { EmptyState } from './EmptyState'
import { LoadingSkeleton } from './LoadingSkeleton'
import { cn } from '@/lib/utils'

interface DataTableProps<T> {
  data: T[]
  columns: ColumnDef<T, unknown>[]
  loading?: boolean
  pageSize?: number
  totalCount?: number
  page?: number
  onPageChange?: (page: number) => void
  onRowClick?: (row: T) => void
  emptyTitle?: string
  emptyMessage?: string
}

export function DataTable<T>({
  data,
  columns,
  loading,
  pageSize = 15,
  totalCount,
  page = 1,
  onPageChange,
  onRowClick,
  emptyTitle,
  emptyMessage,
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([])

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: !!onPageChange,
    pageCount: totalCount ? Math.ceil(totalCount / pageSize) : undefined,
  })

  const total = totalCount ?? data.length
  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)
  const pageCount = Math.ceil(total / pageSize)

  if (loading) return <LoadingSkeleton />

  return (
    <div className="card overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-[#eaf1ff]">
                {hg.headers.map((header) => (
                  <th key={header.id} className="table-header-cell">
                    {header.isPlaceholder ? null : (
                      <button
                        className={cn(
                          'flex items-center gap-1',
                          header.column.getCanSort() && 'cursor-pointer select-none'
                        )}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === 'asc' && <ChevronUp size={12} />}
                        {header.column.getIsSorted() === 'desc' && <ChevronDown size={12} />}
                      </button>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="p-0">
                  <EmptyState title={emptyTitle} message={emptyMessage} />
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className={cn('table-row', onRowClick && 'cursor-pointer')}
                  onClick={() => onRowClick?.(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="table-cell">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > pageSize && (
        <div className="flex items-center justify-between border-t border-[#eaf1ff] px-4 py-3">
          <p className="text-sm text-muted">
            Showing {start}–{end} of {total}
          </p>
          <div className="flex items-center gap-1">
            <button
              className="rounded-lg p-1.5 text-muted hover:bg-light-blue disabled:opacity-40"
              onClick={() => onPageChange?.(page - 1)}
              disabled={page <= 1}
              aria-label="Previous page"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="px-2 text-sm text-body">
              {page} / {pageCount}
            </span>
            <button
              className="rounded-lg p-1.5 text-muted hover:bg-light-blue disabled:opacity-40"
              onClick={() => onPageChange?.(page + 1)}
              disabled={page >= pageCount}
              aria-label="Next page"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

