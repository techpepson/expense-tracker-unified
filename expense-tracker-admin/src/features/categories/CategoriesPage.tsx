import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { FolderKanban, GripVertical, Pencil, Plus, Power } from 'lucide-react'
import { toast } from 'sonner'
import {
  errorMessage,
  useCategories,
  useReorderCategories,
  useUpdateCategory,
} from '@/api'
import type { Category } from '@/types'
import { formatDate, pluralize } from '@/lib/formatters'
import { Button } from '@/components/ui/button'
import { Badge, Skeleton } from '@/components/ui/badge'
import { ConfirmDialog, EmptyState, PageHeader } from '@/components/shared'

function SortableCategoryRow({
  category,
  onEdit,
  onToggleStatus,
}: {
  category: Category
  onEdit: (c: Category) => void
  onToggleStatus: (c: Category) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: category.id,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={
        isDragging
          ? 'bg-[#EFF6FF] dark:bg-[#172554] opacity-95 shadow-md'
          : 'transition-colors hover:bg-[var(--surface-hover)]'
      }
    >
      <td className="w-14 px-3.5 py-3.5 align-middle">
        <button
          type="button"
          aria-label={`Drag to reorder ${category.name}`}
          {...attributes}
          {...listeners}
          className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] border border-transparent text-[#475569] hover:border-[#BFDBFE] hover:bg-[#EFF6FF] hover:text-[#1E3A8A] dark:text-slate-300 dark:hover:bg-[#172554] cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </td>
      <td className="w-16 px-3.5 py-3.5 align-middle">
        <span className="inline-flex h-6 min-w-[28px] items-center justify-center rounded-md bg-[#EFF6FF] dark:bg-[#172554] px-2 font-mono text-xs font-semibold text-[#1E3A8A] dark:text-[#DBEAFE]">
          #{category.sort_order}
        </span>
      </td>
      <td className="px-3.5 py-3.5 align-middle">
        <div className="font-semibold text-[#1E3A8A] dark:text-[#DBEAFE]">{category.name}</div>
        {category.description ? (
          <div className="mt-0.5 text-xs text-[var(--text-secondary)] max-w-xl">
            {category.description}
          </div>
        ) : (
          <div className="mt-0.5 text-xs italic text-[var(--text-secondary)]/70">No description</div>
        )}
      </td>
      <td className="px-3.5 py-3.5 align-middle">
        <span className="inline-flex items-center rounded-full bg-[#EFF6FF] dark:bg-[#172554] px-2.5 py-0.5 text-xs font-semibold tabular-nums text-[#1E3A8A] dark:text-[#DBEAFE]">
          {pluralize(category.item_count ?? 0, 'item')}
        </span>
      </td>
      <td className="px-3.5 py-3.5 align-middle">
        <Badge variant={category.is_active ? 'active' : 'inactive'}>
          {category.is_active ? 'Active' : 'Inactive'}
        </Badge>
      </td>
      <td className="px-3.5 py-3.5 align-middle whitespace-nowrap text-xs text-[var(--text-secondary)]">
        {formatDate(category.created_at)}
      </td>
      <td className="px-3.5 py-3.5 align-middle text-right">
        <div className="inline-flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => onEdit(category)}>
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
          <Button
            variant={category.is_active ? 'destructive' : 'secondary'}
            size="sm"
            onClick={() => onToggleStatus(category)}
          >
            <Power className="h-3.5 w-3.5" />
            {category.is_active ? 'Deactivate' : 'Activate'}
          </Button>
        </div>
      </td>
    </tr>
  )
}

export function CategoriesPage() {
  const navigate = useNavigate()
  const { data: categories, isLoading } = useCategories()
  const reorder = useReorderCategories()
  const updateCategory = useUpdateCategory()
  const [toggleTarget, setToggleTarget] = useState<Category | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const list = useMemo(() => categories ?? [], [categories])
  const stats = useMemo(() => {
    const active = list.filter((c) => c.is_active).length
    const totalItems = list.reduce((acc, c) => acc + (c.item_count ?? 0), 0)
    return { total: list.length, active, inactive: list.length - active, totalItems }
  }, [list])

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = list.findIndex((c) => c.id === active.id)
    const newIndex = list.findIndex((c) => c.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const nextOrder = arrayMove(list, oldIndex, newIndex).map((c) => c.id)
    try {
      await reorder.mutateAsync(nextOrder)
      toast.success('Updated category display order')
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const handleConfirmToggle = async () => {
    if (!toggleTarget) return
    try {
      await updateCategory.mutateAsync({
        id: toggleTarget.id,
        is_active: !toggleTarget.is_active,
      })
      toast.success(
        toggleTarget.is_active
          ? `Deactivated "${toggleTarget.name}"`
          : `Activated "${toggleTarget.name}"`,
      )
      setToggleTarget(null)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Categories"
        subtitle="Drag to reorder categories. Display order drives monthly reports and Excel workbook ordering."
        actions={
          <Button asChild>
            <Link to="/categories/new">
              <Plus className="h-4 w-4" />
              Add Category
            </Link>
          </Button>
        }
      />

      <div className="app-card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-divider)] pb-3.5">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EFF6FF] dark:bg-[#172554] px-3 py-1 font-semibold text-[#1E3A8A] dark:text-[#DBEAFE]">
              <FolderKanban className="h-3.5 w-3.5 text-[#2563EB]" />
              {pluralize(stats.total, 'category', 'categories')}
            </span>
            <Badge variant="active">{stats.active} active</Badge>
            {stats.inactive > 0 && <Badge variant="inactive">{stats.inactive} inactive</Badge>}
            <span className="text-[var(--text-secondary)]">
              · <strong className="text-[var(--text-primary)]">{stats.totalItems}</strong> linked catalog items
            </span>
          </div>
          <span className="text-xs text-[var(--text-secondary)]">
            Tip: Use the <GripVertical className="inline h-3.5 w-3.5 align-text-bottom text-[#475569]" /> handle to change display order
          </span>
        </div>

        {isLoading ? (
          <div className="space-y-2.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <EmptyState
            title="No categories configured"
            description="Add your first expenditure category to organize catalog items and expenses."
            action={
              <Button asChild>
                <Link to="/categories/new">
                  <Plus className="h-4 w-4" />
                  Add Category
                </Link>
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-divider)] text-[12px] font-semibold uppercase tracking-wider text-[#475569]">
                    <th className="w-14 px-3.5 py-3">Order</th>
                    <th className="w-16 px-3.5 py-3">#</th>
                    <th className="px-3.5 py-3">Category</th>
                    <th className="px-3.5 py-3">Catalog items</th>
                    <th className="px-3.5 py-3">Status</th>
                    <th className="px-3.5 py-3">Created</th>
                    <th className="px-3.5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <SortableContext
                  items={list.map((c) => c.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <tbody className="divide-y divide-[var(--border-divider)]">
                    {list.map((cat) => (
                      <SortableCategoryRow
                        key={cat.id}
                        category={cat}
                        onEdit={(c) => navigate(`/categories/${c.id}/edit`)}
                        onToggleStatus={setToggleTarget}
                      />
                    ))}
                  </tbody>
                </SortableContext>
              </table>
            </DndContext>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!toggleTarget}
        onOpenChange={(open) => !open && setToggleTarget(null)}
        title={
          toggleTarget?.is_active
            ? `Deactivate "${toggleTarget.name}"?`
            : `Activate "${toggleTarget?.name}"?`
        }
        description={
          toggleTarget?.is_active
            ? 'Deactivating a category hides it from new expense forms while preserving all historical expense records and reports.'
            : 'Activating this category makes it selectable again on new expense forms.'
        }
        confirmLabel={toggleTarget?.is_active ? 'Deactivate category' : 'Activate category'}
        destructive={Boolean(toggleTarget?.is_active)}
        loading={updateCategory.isPending}
        onConfirm={handleConfirmToggle}
      />
    </div>
  )
}

