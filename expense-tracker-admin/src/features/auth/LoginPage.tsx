import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { AlertCircle, CheckCircle2, ExternalLink, Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { toApiError, useLogin } from '@/api'
import { env } from '@/lib/env'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/shared/FormField'

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

type LoginFormValues = z.infer<typeof loginSchema>

const FEATURES = [
  'Manage users and categories',
  'Review every record',
  'Export monthly reports',
] as const

export function LoginPage() {
  const token = useAuthStore((s) => s.token)
  const navigate = useNavigate()
  const location = useLocation()
  const login = useLogin()
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState<{ message: string; isEmployee: boolean } | null>(null)

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  if (token) {
    const dest = (location.state as { from?: string } | null)?.from ?? '/dashboard'
    return <Navigate to={dest} replace />
  }

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null)
    try {
      await login.mutateAsync(values)
      const dest = (location.state as { from?: string } | null)?.from ?? '/dashboard'
      navigate(dest, { replace: true })
    } catch (err) {
      const apiErr = toApiError(err)
      if (apiErr.status === 403 && apiErr.code === 'employee_account') {
        setServerError({
          message: 'Employee accounts sign in on the employee site',
          isEmployee: true,
        })
      } else {
        setServerError({
          message: apiErr.message || 'Invalid email or password',
          isEmployee: false,
        })
      }
    }
  })

  const fillDemo = (email: string) => {
    setServerError(null)
    setValue('email', email, { shouldValidate: true })
    setValue('password', 'password123', { shouldValidate: true })
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-12 bg-[var(--surface-page)]">
      {/* Gradient Brand Panel */}
      <div className="relative overflow-hidden lg:col-span-6 xl:col-span-7 flex flex-col justify-between p-8 sm:p-12 lg:p-16 text-white bg-gradient-to-br from-[#2563EB] via-[#1E3A8A] to-[#172554]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -left-24 h-80 w-80 rounded-full bg-white/10 blur-xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-1/3 -right-20 h-96 w-96 rounded-full bg-[#38BDF8]/15 blur-2xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-28 left-1/4 h-72 w-72 rounded-full bg-[#2563EB]/30 border border-white/10"
        />

        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-gradient-to-br from-[#38BDF8] to-[#2563EB] shadow-lg">
            <ShieldCheck className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold tracking-tight">e-COM Admin</span>
              <span className="rounded-full bg-[#38BDF8]/20 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[#38BDF8]">
                ADMIN
              </span>
            </div>
            <p className="text-xs text-[#DBEAFE]">e-COM Services · Internal Expenditure Control</p>
          </div>
        </div>

        <div className="relative z-10 my-12 max-w-xl">
          <h1 className="text-3xl sm:text-4xl lg:text-[42px] font-extrabold leading-[1.15] tracking-tight">
            Run the numbers behind every expense.
          </h1>
          <p className="mt-4 text-base text-[#DBEAFE]/90 leading-relaxed">
            Centralised administration for e-COM Services — replacing the manual Expenditure Tracker spreadsheet with live validation, computed totals, and full petty cash reconciliation.
          </p>

          <ul className="mt-8 space-y-3.5">
            {FEATURES.map((feat) => (
              <li key={feat} className="flex items-center gap-3 text-sm sm:text-base font-medium text-white">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#38BDF8]/25 text-[#38BDF8]">
                  <CheckCircle2 className="h-4 w-4" />
                </span>
                <span>{feat}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative z-10 text-xs text-[#BFDBFE]/80">
          © {new Date().getFullYear()} e-COM Services. Administrator portal only.
        </div>
      </div>

      {/* Sign-in Card Panel */}
      <div className="lg:col-span-6 xl:col-span-5 flex items-center justify-center p-6 sm:p-12">
        <div className="app-card w-full max-w-md">
          <div className="mb-6">
            <span className="inline-flex items-center rounded-full bg-[#DBEAFE] px-2.5 py-0.5 text-xs font-semibold text-[#1E3A8A] dark:bg-[#1E3A8A] dark:text-[#DBEAFE]">
              Administrators only
            </span>
            <h2 className="mt-2 text-2xl font-bold text-[#1E3A8A] dark:text-white">
              Administrator sign in
            </h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Sign in with your administrator credentials to manage the tracker.
            </p>
          </div>

          {serverError && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-3 rounded-[12px] border border-[#FCA5A5] bg-red-50/90 dark:bg-red-950/40 p-3.5 text-sm text-[#B91C1C] dark:text-red-200"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="space-y-1">
                <p className="font-medium">{serverError.message}</p>
                {serverError.isEmployee && (
                  <a
                    href={env.employeeAppUrl}
                    className="inline-flex items-center gap-1 font-semibold text-[#1E3A8A] dark:text-[#38BDF8] underline"
                  >
                    Go to employee app ({env.employeeAppUrl})
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            </div>
          )}

          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <FormField label="Email address" htmlFor="login-email" required error={errors.email?.message}>
              <Input
                id="login-email"
                type="email"
                autoComplete="email"
                placeholder="admin@ecom.com"
                {...register('email')}
              />
            </FormField>

            <FormField label="Password" htmlFor="login-password" required error={errors.password?.message}>
              <div className="relative">
                <Input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="pr-11"
                  {...register('password')}
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-[#475569] hover:text-[#1E3A8A] cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </FormField>

            <Button type="submit" className="w-full" disabled={login.isPending}>
              {login.isPending ? 'Signing in…' : 'Sign in to Admin'}
            </Button>
          </form>

          <div className="mt-6 rounded-[12px] border border-[var(--border-card)] bg-[var(--surface-tint)] p-3.5 text-xs">
            <div className="flex items-center justify-between gap-2">
              <div>
                <span className="font-semibold text-[#1E3A8A] dark:text-[#DBEAFE]">Demo credentials:</span>{' '}
                <code className="text-[var(--text-primary)]">admin@ecom.com / password123</code>
              </div>
              <button
                type="button"
                onClick={() => fillDemo('admin@ecom.com')}
                className="font-semibold text-[#2563EB] hover:underline cursor-pointer shrink-0"
              >
                Use demo
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

