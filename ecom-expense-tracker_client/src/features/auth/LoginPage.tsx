import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, Check, ExternalLink } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import axios from 'axios'
import { loginSchema, type LoginFormValues } from './schemas/login.schema'
import { useLogin } from '@/api/auth'
import { useAuth } from '@/hooks/useAuth'
import { APP_NAME } from '@/lib/constants'

const FEATURES = [
  'Record expenses in seconds',
  'Monthly totals calculated automatically',
  'Download PDF and Excel reports',
]

const ADMIN_APP_URL = import.meta.env.VITE_ADMIN_APP_URL as string | undefined

export function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [adminError, setAdminError] = useState(false)
  const { mutateAsync: loginFn, isPending } = useLogin()
  const { setAuth } = useAuth()
  const navigate = useNavigate()

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) })

  const onSubmit = async (values: LoginFormValues) => {
    setAdminError(false)
    try {
      const { user, token } = await loginFn(values)
      setAuth(user, token)
      toast.success(`Welcome back, ${user.full_name.split(' ')[0]}!`)
      navigate('/dashboard')
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status
        const code = (err.response?.data as { code?: string } | undefined)?.code
        if (status === 403 && code === 'admin_account') {
          setAdminError(true)
          return
        }
        if (status === 401 || status === 400) {
          setError('password', {
            message: 'Invalid email or password. Please try again.',
          })
          return
        }
      }
      setError('password', { message: 'An unexpected error occurred.' })
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* ── Brand panel ── */}
      <div
        className="hidden flex-col justify-between p-12 lg:flex lg:w-5/12"
        style={{ background: 'linear-gradient(145deg, #1e3a8a 0%, #172554 100%)' }}
      >
        {/* Decorative circles */}
        <div className="pointer-events-none absolute left-0 top-0 h-72 w-72 rounded-full bg-white/5 -translate-x-1/2 -translate-y-1/2" />
        <div className="pointer-events-none absolute bottom-20 left-20 h-56 w-56 rounded-full bg-sky/10" />
        <div className="pointer-events-none absolute right-0 top-1/3 h-96 w-96 rounded-full bg-primary/20 translate-x-1/2" />

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-xl"
            style={{ background: 'linear-gradient(135deg, #38bdf8 0%, #2563eb 100%)' }}
          >
            <span className="text-lg font-bold text-white">e</span>
          </div>
          <span className="text-lg font-semibold text-white">{APP_NAME}</span>
        </div>

        {/* Headline */}
        <div className="relative">
          <h1 className="text-4xl font-bold leading-tight text-white">
            Every company expense,<br />in one place.
          </h1>
          <div className="mt-8 space-y-4">
            {FEATURES.map((f) => (
              <div key={f} className="flex items-center gap-3">
                <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-sky/20">
                  <Check size={13} className="text-sky" />
                </div>
                <span className="text-blue-100">{f}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-sm text-blue-300">
          © {new Date().getFullYear()} e-COM Services
        </p>
      </div>

      {/* ── Login card ── */}
      <div className="flex flex-1 items-center justify-center bg-page-bg p-6">
        <div className="card w-full max-w-md">
          <div className="mb-6">
            {/* Mobile logo */}
            <div className="mb-5 flex items-center gap-2 lg:hidden">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-lg"
                style={{ background: 'linear-gradient(135deg, #38bdf8 0%, #2563eb 100%)' }}
              >
                <span className="text-sm font-bold text-white">e</span>
              </div>
              <span className="font-semibold text-navy">{APP_NAME}</span>
            </div>
            <h2 className="text-2xl font-bold text-body">Welcome back</h2>
            <p className="mt-1 text-sm text-muted">Sign in to your employee account</p>
          </div>

          {/* Admin account error */}
          {adminError && (
            <div className="mb-4 rounded-xl border border-[#fca5a5] bg-red-50 p-4 text-sm">
              <p className="font-semibold text-red-700">Administrator accounts sign in on the admin site.</p>
              {ADMIN_APP_URL && (
                <a
                  href={ADMIN_APP_URL}
                  className="mt-1 inline-flex items-center gap-1 text-red-600 underline hover:no-underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Go to admin portal <ExternalLink size={12} />
                </a>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-body">
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                className="input-base"
                placeholder="you@ecom.com"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? 'email-error' : undefined}
                {...register('email')}
              />
              {errors.email && (
                <p id="email-error" className="mt-1 text-xs text-red-600" role="alert">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-body">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="input-base pr-11"
                  placeholder="••••••••"
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? 'password-error' : undefined}
                  {...register('password')}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-body"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
              {errors.password && (
                <p id="password-error" className="mt-1 text-xs text-red-600" role="alert">
                  {errors.password.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="btn-primary w-full justify-center"
            >
              {isPending ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          {/* Demo hint */}
          <div className="mt-5 rounded-xl bg-tint px-4 py-3 text-xs text-muted">
            <span className="font-semibold text-navy">Demo:</span>{' '}
            employee@ecom.com · password123
          </div>
        </div>
      </div>
    </div>
  )
}

