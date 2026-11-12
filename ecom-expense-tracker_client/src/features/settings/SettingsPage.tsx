import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { User, Lock, Upload } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { useAuth } from '@/hooks/useAuth'
import { useUpdateProfile, useUpdatePassword, useUploadAvatar } from '@/api/profile'
import {
  profileSchema,
  passwordSchema,
  type ProfileFormValues,
  type PasswordFormValues,
} from './schemas/settings.schema'
import { getInitials } from '@/lib/utils'
import { toast } from 'sonner'

export function SettingsPage() {
  const { user } = useAuth()
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    user?.profile_picture ?? null
  )

  const { mutateAsync: updateProfile, isPending: updatingProfile } = useUpdateProfile()
  const { mutateAsync: updatePassword, isPending: updatingPassword } = useUpdatePassword()
  const { mutateAsync: uploadAvatar, isPending: uploadingAvatar } = useUploadAvatar()

  const {
    register: regProfile,
    handleSubmit: handleProfileSubmit,
    formState: { errors: profileErrors },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: user?.full_name ?? '',
      email: user?.email ?? '',
    },
  })

  const {
    register: regPassword,
    handleSubmit: handlePasswordSubmit,
    reset: resetPassword,
    formState: { errors: passwordErrors },
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
  })

  const onProfileSubmit = async (values: ProfileFormValues) => {
    try {
      await updateProfile(values)
      toast.success('Profile updated successfully')
    } catch {
      toast.error('Failed to update profile')
    }
  }

  const onPasswordSubmit = async (values: PasswordFormValues) => {
    try {
      await updatePassword({
        current_password: values.current_password,
        new_password: values.new_password,
      })
      toast.success('Password changed successfully')
      resetPassword()
    } catch {
      toast.error('Failed to update password. Check current password.')
    }
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Show preview
    const reader = new FileReader()
    reader.onload = () => setAvatarPreview(reader.result as string)
    reader.readAsDataURL(file)

    try {
      await uploadAvatar(file)
      toast.success('Profile picture updated')
    } catch {
      toast.error('Failed to upload picture')
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="Settings"
        subtitle="Manage your employee profile and account security"
      />

      {/* Profile Details Card */}
      <div className="card space-y-6">
        <div className="flex items-center gap-2 border-b border-[#eaf1ff] pb-4">
          <User className="text-primary" size={20} />
          <h3 className="font-semibold text-body">Personal Information</h3>
        </div>

        {/* Avatar Upload */}
        <div className="flex items-center gap-6">
          <div className="relative">
            {avatarPreview ? (
              <img
                src={avatarPreview}
                alt="Profile"
                className="h-20 w-20 rounded-full object-cover border-2 border-primary"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-xl font-bold text-white shadow-md">
                {user ? getInitials(user.full_name) : 'U'}
              </div>
            )}
            <label
              htmlFor="avatar-input"
              className="absolute bottom-0 right-0 p-1.5 bg-primary text-white rounded-full shadow-md cursor-pointer hover:bg-blue-700 transition"
              title="Change photo"
            >
              <Upload size={14} />
              <input
                id="avatar-input"
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={handleAvatarChange}
                disabled={uploadingAvatar}
              />
            </label>
          </div>
          <div>
            <h4 className="font-medium text-body text-sm">Profile Picture</h4>
            <p className="text-xs text-muted mt-0.5">
              PNG, JPG or WEBP. Max 2MB. Click the icon to upload.
            </p>
          </div>
        </div>

        <form onSubmit={handleProfileSubmit(onProfileSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold uppercase text-muted mb-1">
                Full Name *
              </label>
              <input type="text" {...regProfile('full_name')} className="input-base" />
              {profileErrors.full_name && (
                <p className="text-xs text-red-600 mt-1">
                  {profileErrors.full_name.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-muted mb-1">
                Email Address *
              </label>
              <input type="email" {...regProfile('email')} className="input-base" />
              {profileErrors.email && (
                <p className="text-xs text-red-600 mt-1">
                  {profileErrors.email.message}
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button type="submit" disabled={updatingProfile} className="btn-primary">
              {updatingProfile ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>

      {/* Security Card */}
      <div className="card space-y-6">
        <div className="flex items-center gap-2 border-b border-[#eaf1ff] pb-4">
          <Lock className="text-primary" size={20} />
          <h3 className="font-semibold text-body">Security & Password</h3>
        </div>

        <form onSubmit={handlePasswordSubmit(onPasswordSubmit)} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-muted mb-1">
              Current Password *
            </label>
            <input
              type="password"
              placeholder="••••••••"
              {...regPassword('current_password')}
              className="input-base sm:w-80"
            />
            {passwordErrors.current_password && (
              <p className="text-xs text-red-600 mt-1">
                {passwordErrors.current_password.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold uppercase text-muted mb-1">
                New Password *
              </label>
              <input
                type="password"
                placeholder="At least 8 characters"
                {...regPassword('new_password')}
                className="input-base"
              />
              {passwordErrors.new_password && (
                <p className="text-xs text-red-600 mt-1">
                  {passwordErrors.new_password.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-muted mb-1">
                Confirm New Password *
              </label>
              <input
                type="password"
                placeholder="Confirm password"
                {...regPassword('confirm_password')}
                className="input-base"
              />
              {passwordErrors.confirm_password && (
                <p className="text-xs text-red-600 mt-1">
                  {passwordErrors.confirm_password.message}
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button type="submit" disabled={updatingPassword} className="btn-primary">
              {updatingPassword ? 'Updating...' : 'Change Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
