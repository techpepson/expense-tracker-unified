import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import {
  Check,
  GitMerge,
  Package,
  Pencil,
  Plus,
  Power,
  RotateCcw,
  Search,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  errorMessage,
  useApproveItem,
  useCategories,
  useCreateItem,
  useItems,
  useMergeItem,
  useRejectItem,
  useUpdateItem,
} from '@/api'
import type { Item, ItemStatus } from '@/types'
import { useDebounce } from '@/hooks/useDebounce'
import { pluralize } from '@/lib/formatters'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/controls'
import { Badge } from '@/components/ui/badge'
import { Combobox } from '@/components/ui/combobox'
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
  DataTable,
  FormField,
  PageHeader,
} from '@/components/shared'

export function ItemsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') === 'pending' ? 'pending' : 'all'

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 200)
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<ItemStatus | ''>('')

  const { data: categories } = useCategories()
  const { data: allItems, isLoading } = useItems()

  const createItem = useCreateItem()
  const updateItem = useUpdateItem()
  const mergeItem = useMergeItem()
  const approveItem = useApproveItem()
  const rejectItem = useRejectItem()

  // Dialog states
  const [addOpen, setAddOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newCategoryId, setNewCategoryId] = useState('')

  const [editItem, setEditItem] = useState<Item | null>(null)
  const [editName, setEditName] = useState('')
  const [editCategoryId, setEditCategoryId] = useState('')

  const [mergeSource, setMergeSource] = useState<Item | null>(null)
  const [mergeTargetId, setMergeTargetId] = useState('')

  const [rejectTarget, setRejectTarget] = useState<Item | null>(null)

  const categoryNameById = useMemo(
    () => new Map((categories ?? []).map((c) => [c.id, c.name])),
    [categories],
  )

  const pendingCount = useMemo(
    () => (allItems ?? []).filter((i) => i.status === 'pending').length,
    [allItems],
  )

  const approvedCount = useMemo(
    () => (allItems ?? []).filter((i) => i.status === 'approved').length,
    [allItems],
  )

  const hasActiveFilters = Boolean(search.trim() || categoryFilter || statusFilter)

  const resetFilters = () => {
    setSearch('')
    setCategoryFilter('')
    setStatusFilter('')
  }

  const filteredItems = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    return (allItems ?? [])
      .filter((i) => (activeTab === 'pending' ? i.status === 'pending' : true))
      .filter((i) => !categoryFilter || i.category_id === categoryFilter)
      .filter((i) => (activeTab === 'pending' ? true : !statusFilter || i.status === statusFilter))
      .filter((i) => !q || i.name.toLowerCase().includes(q))
  }, [activeTab, allItems, categoryFilter, debouncedSearch, statusFilter])

  const mergeTargetOptions = useMemo(
    () =>
      (allItems ?? [])
        .filter((i) => i.id !== mergeSource?.id && i.status === 'approved')
        .map((i) => ({
          value: i.id,
          label: `${i.name} (${categoryNameById.get(i.category_id) ?? 'Category'})`,
          hint: pluralize(i.usage_count, 'record'),
        })),
    [allItems, categoryNameById, mergeSource?.id],
  )

  const mergeTarget = useMemo(
    () => (allItems ?? []).find((i) => i.id === mergeTargetId) ?? null,
    [allItems, mergeTargetId],
  )

  const handleCreate = async () => {
    if (!newName.trim() || !newCategoryId) {
      toast.error('Enter an item name and choose a category')
      return
    }
    try {
      await createItem.mutateAsync({ name: newName.trim(), category_id: newCategoryId })
      toast.success(`Added "${newName.trim()}" to catalog`)
      setNewName('')
      setAddOpen(false)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const handleSaveEdit = async () => {
    if (!editItem) return
    try {
      await updateItem.mutateAsync({
        id: editItem.id,
        name: editName.trim(),
        category_id: editCategoryId,
      })
      toast.success('Item updated')
      setEditItem(null)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const handleToggleActive = async (item: Item) => {
    const nextStatus: ItemStatus = item.status === 'inactive' ? 'approved' : 'inactive'
    try {
      await updateItem.mutateAsync({ id: item.id, status: nextStatus })
      toast.success(
        nextStatus === 'approved' ? `Activated "${item.name}"` : `Deactivated "${item.name}"`,
      )
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const handleConfirmMerge = async () => {
    if (!mergeSource || !mergeTargetId) return
    try {
      const res = await mergeItem.mutateAsync({
        id: mergeSource.id,
        target_id: mergeTargetId,
      })
      toast.success(
        `Merged "${mergeSource.name}" into "${res.target.name}" (${pluralize(res.moved, 'record')} reassigned)`,
      )
      setMergeSource(null)
      setMergeTargetId('')
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const handleApprove = async (item: Item) => {
    try {
      await approveItem.mutateAsync(item.id)
      toast.success(`Approved "${item.name}"`)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const handleConfirmReject = async () => {
    if (!rejectTarget) return
    try {
      await rejectItem.mutateAsync(rejectTarget.id)
      toast.success(`Rejected suggestion "${rejectTarget.name}"`)
      setRejectTarget(null)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const columns = useMemo<ColumnDef<Item>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Item name (Bill)',
        cell: ({ row }) => (
          <span className="font-semibold text-[#1E3A8A] dark:text-[#DBEAFE]">
            {row.original.name}
          </span>
        ),
      },
      {
        accessorKey: 'category_id',
        header: 'Category',
        cell: ({ row }) => (
          <Badge variant="category">
            {categoryNameById.get(row.original.category_id) ?? 'Category'}
          </Badge>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant={row.original.status}>
            {row.original.status === 'approved'
              ? 'Approved'
              : row.original.status === 'pending'
                ? 'Pending'
                : 'Inactive'}
          </Badge>
        ),
      },
      {
        accessorKey: 'usage_count',
        header: 'Records using it',
        cell: ({ row }) => (
          <span className="tabular-nums font-medium">
            {pluralize(row.original.usage_count, 'record')}
          </span>
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        enableSorting: false,
        cell: ({ row }) => {
          const item = row.original
          if (item.status === 'pending') {
            return (
              <div className="flex flex-wrap items-center gap-1.5">
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => handleApprove(item)}
                  disabled={approveItem.isPending}
                >
                  <Check className="h-3.5 w-3.5" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setMergeSource(item)
                    setMergeTargetId('')
                  }}
                >
                  <GitMerge className="h-3.5 w-3.5" />
                  Merge into existing
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setRejectTarget(item)}
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Reject
                </Button>
              </div>
            )
          }

          return (
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditItem(item)
                  setEditName(item.name)
                  setEditCategoryId(item.category_id)
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setMergeSource(item)
                  setMergeTargetId('')
                }}
              >
                <GitMerge className="h-3.5 w-3.5" />
                Merge
              </Button>
              <Button
                size="sm"
                variant={item.status === 'inactive' ? 'secondary' : 'destructive'}
                onClick={() => handleToggleActive(item)}
              >
                <Power className="h-3.5 w-3.5" />
                {item.status === 'inactive' ? 'Activate' : 'Deactivate'}
              </Button>
            </div>
          )
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [categoryNameById],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Items Catalog"
        subtitle='The catalog behind the "Bill" column — approve suggestions, rename items, or merge duplicates'
        actions={
          <Button
            onClick={() => {
              setNewName('')
              setNewCategoryId(categories?.[0]?.id ?? '')
              setAddOpen(true)
            }}
          >
            <Plus className="h-4 w-4" />
            Add Item
          </Button>
        }
      />

      {/* Tabs + Filters */}
      <div className="app-card space-y-4">
        <div className="flex flex-col gap-3 border-b border-[var(--border-divider)] pb-4 lg:flex-row lg:items-center lg:justify-between">
          <Tabs
            value={activeTab}
            onValueChange={(v) =>
              setSearchParams(v === 'pending' ? { tab: 'pending' } : {})
            }
          >
            <TabsList>
              <TabsTrigger value="all">All items ({(allItems ?? []).length})</TabsTrigger>
              <TabsTrigger value="pending">
                Pending suggestions ({pendingCount})
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EFF6FF] dark:bg-[#172554] px-3 py-1 font-semibold text-[#1E3A8A] dark:text-[#DBEAFE]">
              <Package className="h-3.5 w-3.5 text-[#2563EB]" />
              {approvedCount} approved
            </span>
            {pendingCount > 0 && (
              <Badge variant="pending">{pendingCount} awaiting review</Badge>
            )}
            <span className="text-[var(--text-secondary)]">
              · Showing <strong className="text-[var(--text-primary)]">{filteredItems.length}</strong>{' '}
              {pluralize(filteredItems.length, 'item')}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-1 flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] flex-1 max-w-sm">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#475569]" />
              <Input
                aria-label="Search items"
                placeholder="Search item name…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="w-52">
              <Select
                aria-label="Filter items by category"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="">All categories</option>
                {(categories ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>

            {activeTab === 'all' && (
              <div className="w-44">
                <Select
                  aria-label="Filter items by status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as ItemStatus | '')}
                >
                  <option value="">All statuses</option>
                  <option value="approved">Approved</option>
                  <option value="pending">Pending</option>
                  <option value="inactive">Inactive</option>
                </Select>
              </div>
            )}

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                <RotateCcw className="h-3.5 w-3.5" />
                Reset filters
              </Button>
            )}
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filteredItems}
          loading={isLoading}
          emptyTitle={
            activeTab === 'pending' ? 'No pending suggestions' : 'No matching catalog items'
          }
          emptyDescription={
            activeTab === 'pending'
              ? 'All employee item suggestions have been reviewed.'
              : 'Try clearing your search or category filter.'
          }
        />
      </div>

      {/* + Add Item Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add catalog item</DialogTitle>
            <DialogDescription>
              Create a new approved item in the catalog so it can be selected when recording expenses.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <FormField label="Category" htmlFor="add-item-cat" required>
              <Select
                id="add-item-cat"
                value={newCategoryId}
                onChange={(e) => setNewCategoryId(e.target.value)}
              >
                <option value="">Choose category…</option>
                {(categories ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Item name" htmlFor="add-item-name" required>
              <Input
                id="add-item-name"
                placeholder="e.g. A4 Sheet, Printer Toner"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </FormField>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={createItem.isPending}>
              <Plus className="h-4 w-4" />
              Add Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Item Dialog */}
      <Dialog open={!!editItem} onOpenChange={(open) => !open && setEditItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit catalog item</DialogTitle>
            <DialogDescription>
              Renaming or moving an item automatically updates all linked expense records.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <FormField label="Item name" htmlFor="edit-item-name" required>
              <Input
                id="edit-item-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </FormField>
            <FormField label="Category" htmlFor="edit-item-cat" required>
              <Select
                id="edit-item-cat"
                value={editCategoryId}
                onChange={(e) => setEditCategoryId(e.target.value)}
              >
                {(categories ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItem(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={updateItem.isPending}>
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Merge Item Dialog */}
      <Dialog open={!!mergeSource} onOpenChange={(open) => !open && setMergeSource(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Merge "{mergeSource?.name}" into another item</DialogTitle>
            <DialogDescription>
              Use this to consolidate typos or duplicate items (for example, "Bottled Water" vs "Bottled water"). The source item will be removed after reassigning its records.
            </DialogDescription>
          </DialogHeader>
          {mergeSource && (
            <div className="space-y-4">
              <FormField label="Target item to keep" required>
                <Combobox
                  ariaLabel="Target item"
                  value={mergeTargetId}
                  onChange={setMergeTargetId}
                  options={mergeTargetOptions}
                  placeholder="Search target item…"
                />
              </FormField>

              <div className="rounded-[12px] border border-[#BFDBFE] bg-[#EFF6FF] dark:bg-[#172554] p-3.5 text-xs space-y-1">
                <div className="font-semibold text-[#1E3A8A] dark:text-[#DBEAFE]">
                  Preview of changes
                </div>
                <p>
                  • <strong>{pluralize(mergeSource.usage_count, 'expense record')}</strong> currently using{' '}
                  <strong>"{mergeSource.name}"</strong> will be reassigned to{' '}
                  <strong>"{mergeTarget?.name ?? '…'}"</strong>.
                </p>
                {mergeTarget && (
                  <p>
                    • Target item total usage will become{' '}
                    <strong>
                      {pluralize(mergeTarget.usage_count + mergeSource.usage_count, 'record')}
                    </strong>
                    .
                  </p>
                )}
                <p>• Source item "{mergeSource.name}" will be permanently removed.</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setMergeSource(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmMerge}
              disabled={!mergeTargetId || mergeItem.isPending}
            >
              Confirm merge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!rejectTarget}
        onOpenChange={(open) => !open && setRejectTarget(null)}
        title={`Reject "${rejectTarget?.name}"?`}
        description="This removes the pending item suggestion from the catalog."
        confirmLabel="Reject suggestion"
        destructive
        loading={rejectItem.isPending}
        onConfirm={handleConfirmReject}
      />
    </div>
  )
}

