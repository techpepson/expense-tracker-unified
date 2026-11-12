import { useEffect, type ChangeEvent } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Building2, Camera, KeyRound, User as UserIcon } from 'lucide-react'
import { toast } from 'sonner'
import {
  errorMessage,
  useChangePassword,
  useSettings,
  useUpdateProfile,
  useUpdateSettings,
  useUploadAvatar,
} from '@/api'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { AvatarCircle, FormField, PageHeader } from '@/components/shared'

const profileSchema = z.object({
  full_name: z.string().min(2, 'Full name is required'),
  email: z.string().email('Enter a valid email address'),
})

const passwordSchema = z
  .object({
    current_password: z.string().min(1, 'Current password is required'),
    new_password: z.string().min(8, 'New password must be at least 8 characters'),
    confirm_password: z.string().min(8, 'Confirm your new password'),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    path: ['confirm_password'],
    message: 'Passwords do not match',
  })

const orgSchema = z.object({
  organisation_name: z.string().min(2, 'Organisation name is required'),
  currency: z.string().regex(/^[A-Z]{3}$/, 'Select a 3-letter currency'),
  period_start_day: z.coerce.number().int().min(1).max(28),
})

type ProfileValues = z.infer<typeof profileSchema>
type PasswordValues = z.infer<typeof passwordSchema>
type OrgValues = z.infer<typeof orgSchema>

export function SettingsPage() {
  const user = useAuthStore((s) => s.user)
  const { data: settings } = useSettings()

  const updateProfile = useUpdateProfile()
  const changePassword = useChangePassword()
  const uploadAvatar = useUploadAvatar()
  const updateSettings = useUpdateSettings()

  const profileForm = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: user?.full_name ?? '',
      email: user?.email ?? '',
    },
  })

  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      current_password: '',
      new_password: '',
      confirm_password: '',
    },
  })

  const orgForm = useForm<OrgValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(orgSchema) as any,
    defaultValues: {
      organisation_name: 'e-COM Services',
      currency: 'GHS',
      period_start_day: 1,
    },
  })

  useEffect(() => {
    if (user) {
      profileForm.reset({ full_name: user.full_name, email: user.email })
    }
  }, [profileForm, user])

  useEffect(() => {
    if (settings) {
      orgForm.reset(settings)
    }
  }, [orgForm, settings])

  const handleAvatarChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      await uploadAvatar.mutateAsync(file)
      toast.success('Profile picture updated')
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const onSaveProfile = profileForm.handleSubmit(async (values) => {
    try {
      await updateProfile.mutateAsync(values)
      toast.success('Profile saved')
    } catch (err) {
      toast.error(errorMessage(err))
    }
  })

  const onSavePassword = passwordForm.handleSubmit(async (values) => {
    try {
      await changePassword.mutateAsync({
        current_password: values.current_password,
        new_password: values.new_password,
      })
      passwordForm.reset()
      toast.success('Password updated')
    } catch (err) {
      toast.error(errorMessage(err))
    }
  })

  const onSaveOrg = orgForm.handleSubmit(async (values) => {
    try {
      await updateSettings.mutateAsync(values)
      toast.success('Organisation settings saved')
    } catch (err) {
      toast.error(errorMessage(err))
    }
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        subtitle="Manage your personal administrator profile, password, and organisation-wide reporting defaults"
      />

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Personal Profile + Avatar */}
        <div className="lg:col-span-6 space-y-6">
          <div className="app-card space-y-5">
            <div className="flex items-center gap-2 text-base font-bold text-[#1E3A8A] dark:text-[#DBEAFE]">
              <UserIcon className="h-4 w-4 text-[#2563EB]" />
              <h2>Personal profile</h2>
            </div>

            <div className="flex items-center gap-4 rounded-[12px] bg-[var(--surface-tint)] p-4">
              <AvatarCircle
                name={user?.full_name ?? 'Admin'}
                src={user?.profile_picture}
                size="lg"
              />
              <div className="space-y-1">
                <div className="text-sm font-semibold">{user?.full_name}</div>
                <p className="text-xs text-[var(--text-secondary)]">
                  PNG or JPG up to 2 MB. Shown in the page header and record history.
                </p>
                <label className="mt-1 inline-flex cursor-pointer items-center gap-1.5 rounded-[8px] border border-[#BFDBFE] bg-[var(--surface-card)] px-3 py-1.5 text-xs font-semibold text-[#1E3A8A] dark:text-[#DBEAFE] hover:bg-[#EFF6FF]">
                  <Camera className="h-3.5 w-3.5" />
                  <span>{uploadAvatar.isPending ? 'Uploading…' : 'Upload picture'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="sr-only"
                    aria-label="Upload profile picture"
                  />
                </label>
              </div>
            </div>

            <form onSubmit={onSaveProfile} noValidate className="space-y-4">
              <FormField
                label="Full name"
                htmlFor="prof-name"
                required
                error={profileForm.formState.errors.full_name?.message}
              >
                <Input id="prof-name" {...profileForm.register('full_name')} />
              </FormField>

              <FormField
                label="Email address"
                htmlFor="prof-email"
                required
                error={profileForm.formState.errors.email?.message}
              >
                <Input id="prof-email" type="email" {...profileForm.register('email')} />
              </FormField>

              <div className="flex justify-end">
                <Button type="submit" disabled={updateProfile.isPending}>
                  Save profile
                </Button>
              </div>
            </form>
          </div>

          {/* Change Password */}
          <div className="app-card space-y-5">
            <div className="flex items-center gap-2 text-base font-bold text-[#1E3A8A] dark:text-[#DBEAFE]">
              <KeyRound className="h-4 w-4 text-[#2563EB]" />
              <h2>Change password</h2>
            </div>

            <form onSubmit={onSavePassword} noValidate className="space-y-4">
              <FormField
                label="Current password"
                htmlFor="pwd-current"
                required
                error={passwordForm.formState.errors.current_password?.message}
              >
                <Input
                  id="pwd-current"
                  type="password"
                  {...passwordForm.register('current_password')}
                />
              </FormField>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  label="New password"
                  htmlFor="pwd-new"
                  required
                  error={passwordForm.formState.errors.new_password?.message}
                >
                  <Input
                    id="pwd-new"
                    type="password"
                    {...passwordForm.register('new_password')}
                  />
                </FormField>

                <FormField
                  label="Confirm new password"
                  htmlFor="pwd-confirm"
                  required
                  error={passwordForm.formState.errors.confirm_password?.message}
                >
                  <Input
                    id="pwd-confirm"
                    type="password"
                    {...passwordForm.register('confirm_password')}
                  />
                </FormField>
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={changePassword.isPending}>
                  Update password
                </Button>
              </div>
            </form>
          </div>
        </div>

        {/* Organisation Settings */}
        <div className="lg:col-span-6">
          <div className="app-card space-y-5">
            <div className="flex items-center gap-2 text-base font-bold text-[#1E3A8A] dark:text-[#DBEAFE]">
              <Building2 className="h-4 w-4 text-[#2563EB]" />
              <h2>Organisation settings</h2>
            </div>

            <form onSubmit={onSaveOrg} noValidate className="space-y-4">
              <FormField
                label="Organisation name"
                htmlFor="org-name"
                required
                hint="Printed on monthly reports, PDF headers, and exported Excel workbooks."
                error={orgForm.formState.errors.organisation_name?.message}
              >
                <Input id="org-name" {...orgForm.register('organisation_name')} />
              </FormField>

              <FormField
                label="Default currency"
                htmlFor="org-currency"
                required
                hint="Amounts are stored in minor units (pesewas/cents) and formatted with Intl.NumberFormat."
                error={orgForm.formState.errors.currency?.message}
              >
                <Select id="org-currency" {...orgForm.register('currency')}>
                  <option value="GHS">GHS — Ghana Cedi (GH₵)</option>
                  <option value="USD">USD — US Dollar ($)</option>
                  <option value="EUR">EUR — Euro (€)</option>
                  <option value="GBP">GBP — British Pound (£)</option>
                  <option value="NGN">NGN — Nigerian Naira (₦)</option>
                </Select>
              </FormField>

              <FormField
                label="Reporting period start day (1–28)"
                htmlFor="org-start-day"
                required
                hint="Day of the month on which each monthly reporting period begins (1 = calendar month)."
                error={orgForm.formState.errors.period_start_day?.message}
              >
                <Input
                  id="org-start-day"
                  type="number"
                  min={1}
                  max={28}
                  {...orgForm.register('period_start_day')}
                />
              </FormField>

              <div className="flex justify-end border-t border-[var(--border-divider)] pt-4">
                <Button type="submit" disabled={updateSettings.isPending}>
                  Save organisation settings
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

