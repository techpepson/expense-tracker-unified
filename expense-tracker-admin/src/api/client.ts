import axios, { AxiosError } from 'axios'
import type { ApiErrorBody } from '@/types'
import { env } from '@/lib/env'
import { useAuthStore } from '@/stores/auth'

/**
 * Shared Axios instance. Auth is a Bearer token in the Authorization header — no cookies,
 * so the admin app can live on a different domain from the employee app.
 */
export const api = axios.create({
  baseURL: env.apiBaseUrl,
  headers: {
    Accept: 'application/json',
    'X-Client-App': 'admin',
  },
  withCredentials: false,
  timeout: 30_000,
})

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.set('Authorization', `Bearer ${token}`)
  return config
})

type UnauthorizedListener = () => void
let onUnauthorized: UnauthorizedListener | null = null
export function setUnauthorizedHandler(fn: UnauthorizedListener | null): void {
  onUnauthorized = fn
}

type RawServerError = ApiErrorBody & {
  detail?: string | { loc?: (string | number)[]; msg?: string }[] | { message?: string; code?: string }
}

api.interceptors.response.use(
  (r) => r,
  (error: AxiosError<RawServerError>) => {
    const status = error.response?.status
    const isLogin = error.config?.url?.includes('/api/auth/login')
    const data = error.response?.data
    const code = data?.code ?? (typeof data?.detail === 'object' && !Array.isArray(data.detail) ? data.detail?.code : undefined)
    // 401 anywhere (or a non-admin token on a protected route) ends the session.
    if (!isLogin && (status === 401 || (status === 403 && code === 'employee_account'))) {
      useAuthStore.getState().clear()
      onUnauthorized?.()
    }
    return Promise.reject(error)
  },
)

export class ApiError extends Error {
  status: number
  code?: string
  fieldErrors: Record<string, string[]>
  constructor(message: string, status: number, code?: string, fieldErrors: Record<string, string[]> = {}) {
    super(message)
    this.status = status
    this.code = code
    this.fieldErrors = fieldErrors
  }
}

export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err
  if (axios.isAxiosError<RawServerError>(err)) {
    const data = err.response?.data
    if (!err.response) return new ApiError('Cannot reach the server. Check your connection.', 0, 'network_error')
    const fieldErrors: Record<string, string[]> = { ...(data?.errors ?? {}) }
    let detailMessage: string | undefined
    if (typeof data?.detail === 'string') {
      detailMessage = data.detail
    } else if (Array.isArray(data?.detail)) {
      for (const item of data.detail) {
        const field = String(item.loc?.[item.loc.length - 1] ?? 'form')
        const msg = item.msg ?? 'Invalid value'
        fieldErrors[field] = [...(fieldErrors[field] ?? []), msg]
        if (!detailMessage) detailMessage = msg
      }
    } else if (data?.detail && typeof data.detail === 'object') {
      detailMessage = data.detail.message
    }
    const message = data?.message ?? detailMessage ?? err.message
    const code = data?.code ?? (typeof data?.detail === 'object' && !Array.isArray(data.detail) ? data?.detail?.code : undefined)
    return new ApiError(message, err.response.status, code, fieldErrors)
  }
  return new ApiError(err instanceof Error ? err.message : 'Something went wrong', 0)
}

export function errorMessage(err: unknown): string {
  return toApiError(err).message
}
