import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  Info,
  KeyRound,
  ShieldCheck,
  Sparkles,
  User as UserIcon,
  UserPlus,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  errorMessage,
  useCreateUser,
  useUpdateUser,
  useUsers,
} from '@/api'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge, OptionCard } from '@/components/ui/badge'
import { FormField, PageHeader, UserChip } from '@/components/shared'

const createUserSchema = z.object({
  full_name: z.string().min(2, 'Full name is required'),
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(8, 'Temporary password must be at least 8 characters'),
  role: z.enum(['employee', 'admin']),
  can_record_shared: z.boolean().default(false),
  is_active: z.boolean().default(true),
})

const editUserSchema = createUserSchema.extend({
  password: z.string().optional(),
})

type UserFormValues = z.infer<typeof createUserSchema>

export function UserFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const currentUser = useAuthStore((s) => s.user)

  const { data: users } = useUsers()
  const existing = users?.find((u) => u.id === id)
  const createUser = useCreateUser()
  const updateUser = useUpdateUser()

  const isSelf = isEdit && Boolean(currentUser && existing && currentUser.id === existing.id)
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    control,
    formState: { errors },
  } = useForm<UserFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(isEdit ? editUserSchema : createUserSchema) as any,
    defaultValues: {
      full_name: '',
      email: '',
      password: '',
      role: 'employee',
      can_record_shared: false,
      is_active: true,
    },
  })

  useEffect(() => {
    if (existing) {
      reset({
        full_name: existing.full_name,
        email: existing.email,
        password: '',
        role: existing.role,
        can_record_shared: existing.can_record_shared,
        is_active: existing.is_active,
      })
    }
  }, [existing, reset])

  const fullNameVal = useWatch({ control, name: 'full_name' })
  const emailVal = useWatch({ control, name: 'email' })
  const roleVal = useWatch({ control, name: 'role' })
  const sharedVal = useWatch({ control, name: 'can_record_shared' })
  const activeVal = useWatch({ control, name: 'is_active' })

  const handleGeneratePassword = () => {
    const token = `Ecom#${Math.random().toString(36).slice(2, 8).toUpperCase()}26`
    setValue('password', token, { shouldValidate: true })
    setShowPassword(true)
    toast.success('Generated temporary password')
  }

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (isEdit && id) {
        const { password: _p, ...rest } = values
        await updateUser.mutateAsync({ id, ...rest })
        toast.success('User updated')
      } else {
        await createUser.mutateAsync(values)
        toast.success('User created')
      }
      navigate('/users')
    } catch (err) {
      toast.error(errorMessage(err))
    }
  })

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/users"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#2563EB] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Users
        </Link>
      </div>

      <PageHeader
        title={isEdit ? 'Edit User' : 'Add User'}
        subtitle="Configure role, designated shared expense recording permissions, and account status"
      />

      <div className="grid gap-6 lg:grid-cols-12">
        <form onSubmit={onSubmit} noValidate className="app-card lg:col-span-8 space-y-6">
          <div className="space-y-4">
            <div className="border-b border-[var(--border-divider)] pb-2.5">
              <h2 className="text-sm font-bold text-[#1E3A8A] dark:text-[#DBEAFE]">
                Identity & Sign-in Credentials
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Name and email used to attribute expenses and authenticate across e-COM portals.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                label="Full name"
                htmlFor="user-name"
                required
                error={errors.full_name?.message}
              >
                <Input id="user-name" placeholder="e.g. Efua Boateng" {...register('full_name')} />
              </FormField>

              <FormField
                label="Email address"
                htmlFor="user-email"
                required
                error={errors.email?.message}
              >
                <Input
                  id="user-email"
                  type="email"
                  placeholder="efua@ecom.com"
                  {...register('email')}
                />
              </FormField>
            </div>

            {!isEdit && (
              <FormField
                label="Temporary password"
                htmlFor="user-password"
                required
                hint="Minimum 8 characters. Share this temporary password securely with the user."
                error={errors.password?.message}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 min-w-[220px]">
                    <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#475569]" />
                    <Input
                      id="user-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="At least 8 characters"
                      className="pl-10 pr-10"
                      {...register('password')}
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? 'Hide temporary password' : 'Show temporary password'}
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#475569] hover:text-[#1E3A8A] cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleGeneratePassword}>
                    <Sparkles className="h-3.5 w-3.5 text-[#2563EB]" />
                    Generate password
                  </Button>
                </div>
              </FormField>
            )}
          </div>

          <div className="space-y-4">
            <div className="border-b border-[var(--border-divider)] pb-2.5">
              <h2 className="text-sm font-bold text-[#1E3A8A] dark:text-[#DBEAFE]">
                Role & Portal Access
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Determines whether this account signs in on the Employee app or this Admin portal.
              </p>
            </div>

            <FormField
              label="Role"
              required
              hint={isSelf ? 'You cannot demote your own administrator account.' : undefined}
            >
              <div role="radiogroup" aria-label="User role" className="grid gap-3 sm:grid-cols-2">
                <OptionCard
                  selected={roleVal === 'employee'}
                  onSelect={() => !isSelf && setValue('role', 'employee')}
                  disabled={isSelf}
                  title="Employee"
                  description="Signs in on the employee site to record personal or designated shared expenses."
                  icon={<UserIcon className="h-4 w-4 text-[#2563EB]" />}
                />
                <OptionCard
                  selected={roleVal === 'admin'}
                  onSelect={() => setValue('role', 'admin')}
                  title="Administrator"
                  description="Full access to this admin portal: users, catalog, all expenses, petty cash & reports."
                  icon={<ShieldCheck className="h-4 w-4 text-[#2563EB]" />}
                />
              </div>
            </FormField>
          </div>

          <div className="space-y-3">
            <div className="border-b border-[var(--border-divider)] pb-2.5">
              <h2 className="text-sm font-bold text-[#1E3A8A] dark:text-[#DBEAFE]">
                Permissions & Account Status
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Control shared operational recording privileges and sign-in availability.
              </p>
            </div>

            <OptionCard
              role="checkbox"
              selected={sharedVal}
              onSelect={() => setValue('can_record_shared', !sharedVal)}
              title="Designated expense recorder"
              description="Allows this user to record shared operational expenses and petty cash disbursements on the employee app."
            />

            <OptionCard
              role="checkbox"
              selected={activeVal}
              onSelect={() => !isSelf && setValue('is_active', !activeVal)}
              disabled={isSelf}
              title="Active account"
              description={
                isSelf
                  ? 'You cannot deactivate your own administrator account.'
                  : 'When unchecked, sign-in is blocked immediately while all historical records are preserved.'
              }
            />
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-[var(--border-divider)] pt-4">
            <Button variant="outline" asChild>
              <Link to="/users">Cancel</Link>
            </Button>
            <Button type="submit" disabled={createUser.isPending || updateUser.isPending}>
              {isEdit ? <Check className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
              {isEdit ? 'Save Changes' : 'Create User'}
            </Button>
          </div>
        </form>

        {/* Side Card: Live Preview */}
        <div className="lg:col-span-4 space-y-4">
          <div className="app-card space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              <UserIcon className="h-3.5 w-3.5 text-[#2563EB]" />
              <span>Live user preview</span>
            </div>

            <div className="rounded-[12px] border border-[var(--border-card)] bg-[var(--surface-tint)] p-4 space-y-3">
              <UserChip
                name={fullNameVal.trim() || 'Full Name'}
                email={emailVal.trim() || 'user@ecom.com'}
                avatarUrl={existing?.profile_picture}
              />
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Badge variant={roleVal === 'admin' ? 'admin' : 'employee'}>
                  {roleVal === 'admin' ? 'Admin' : 'Employee'}
                </Badge>
                {sharedVal && <Badge variant="shared">Shared recorder</Badge>}
                <Badge variant={activeVal ? 'active' : 'inactive'}>
                  {activeVal ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </div>

            <div className="rounded-[12px] border border-[var(--border-divider)] p-3.5 space-y-2 text-xs">
              <div className="font-semibold text-[#1E3A8A] dark:text-[#DBEAFE]">
                Effective capabilities
              </div>
              <ul className="space-y-1.5 text-[var(--text-secondary)]">
                <li className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-[#2563EB]" />
                  <span>
                    {roleVal === 'admin'
                      ? 'Full administrator portal access'
                      : 'Employee portal sign-in'}
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-[#2563EB]" />
                  <span>
                    {sharedVal || roleVal === 'admin'
                      ? 'Can record shared operational expenses'
                      : 'Individual expense recording only'}
                  </span>
                </li>
              </ul>
            </div>

            <div className="flex items-start gap-2 text-xs text-[var(--text-secondary)]">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#2563EB]" />
              <span>
                Deactivating an account blocks sign-in immediately and revokes active tokens, but keeps every past expense and petty cash record attributed to the user.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

