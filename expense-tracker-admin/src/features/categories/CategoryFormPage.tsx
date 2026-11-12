import { useEffect } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, FolderKanban, Info } from 'lucide-react'
import { toast } from 'sonner'
import {
  errorMessage,
  useCategories,
  useCreateCategory,
  useUpdateCategory,
} from '@/api'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { Switch } from '@/components/ui/controls'
import { Badge } from '@/components/ui/badge'
import { FormField, PageHeader } from '@/components/shared'

const categorySchema = z.object({
  name: z.string().min(2, 'Category name is required').max(80),
  description: z.string().max(240).default(''),
  is_active: z.boolean().default(true),
})

type CategoryFormValues = z.infer<typeof categorySchema>

export function CategoryFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const navigate = useNavigate()

  const { data: categories } = useCategories()
  const existing = categories?.find((c) => c.id === id)
  const createMutation = useCreateCategory()
  const updateMutation = useUpdateCategory()

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    control,
    formState: { errors },
  } = useForm<CategoryFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(categorySchema) as any,
    defaultValues: {
      name: '',
      description: '',
      is_active: true,
    },
  })

  useEffect(() => {
    if (existing) {
      reset({
        name: existing.name,
        description: existing.description,
        is_active: existing.is_active,
      })
    }
  }, [existing, reset])

  const nameVal = useWatch({ control, name: 'name' })
  const isActiveVal = useWatch({ control, name: 'is_active' })

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (isEdit && id) {
        await updateMutation.mutateAsync({ id, ...values })
        toast.success('Category updated')
      } else {
        await createMutation.mutateAsync(values)
        toast.success('Category created')
      }
      navigate('/categories')
    } catch (err) {
      toast.error(errorMessage(err))
    }
  })

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/categories"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#2563EB] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Categories
        </Link>
      </div>

      <PageHeader
        title={isEdit ? 'Edit Category' : 'Add Category'}
        subtitle="Manage top-level expenditure categories (column A in the Expenditure Tracker)"
      />

      <div className="grid gap-6 lg:grid-cols-12">
        <form onSubmit={onSubmit} noValidate className="app-card lg:col-span-8 space-y-5">
          <FormField
            label="Category name"
            htmlFor="cat-name"
            required
            hint="Must be unique (case-insensitive). Seed categories match column A of the original tracker."
            error={errors.name?.message}
          >
            <Input
              id="cat-name"
              placeholder="e.g. Office Supplies"
              {...register('name')}
            />
          </FormField>

          <FormField
            label="Description"
            htmlFor="cat-desc"
            hint="Optional guidance for employees & administrators when recording expenses."
            error={errors.description?.message}
          >
            <Textarea
              id="cat-desc"
              placeholder="What belongs in this category…"
              {...register('description')}
            />
          </FormField>

          <div className="flex items-center justify-between rounded-[12px] border border-[var(--border-card)] bg-[var(--surface-tint)] p-4">
            <div className="space-y-0.5 pr-4">
              <label htmlFor="cat-active-switch" className="text-sm font-semibold text-[var(--text-primary)]">
                Active category
              </label>
              <p className="text-xs text-[var(--text-secondary)]">
                Deactivating hides this category from new expense forms while preserving all historical records and reports.
              </p>
            </div>
            <Switch
              id="cat-active-switch"
              aria-label="Active category"
              checked={isActiveVal}
              onCheckedChange={(checked) => setValue('is_active', checked)}
            />
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-[var(--border-divider)] pt-4">
            <Button variant="outline" asChild>
              <Link to="/categories">Cancel</Link>
            </Button>
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
              <Check className="h-4 w-4" />
              {isEdit ? 'Save Changes' : 'Create Category'}
            </Button>
          </div>
        </form>

        {/* Live Badge Preview Card */}
        <div className="lg:col-span-4 space-y-4">
          <div className="app-card space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              <FolderKanban className="h-3.5 w-3.5 text-[#2563EB]" />
              <span>Live badge preview</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 rounded-[12px] border border-[var(--border-card)] bg-[var(--surface-tint)] p-4">
              <Badge variant="category">{nameVal.trim() || 'Category Name'}</Badge>
              <Badge variant={isActiveVal ? 'active' : 'inactive'}>
                {isActiveVal ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <div className="flex items-start gap-2 text-xs text-[var(--text-secondary)]">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#2563EB]" />
              <span>
                Deactivating a category never deletes historical expenses; past reports remain intact.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

