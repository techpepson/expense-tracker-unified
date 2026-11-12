import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { LoginResponse, User } from '@/types'
import { api, ApiError } from './client'
import { qk } from './queryKeys'
import { useAuthStore } from '@/stores/auth'

type RawLoginPayload = {
  token?: string
  access_token?: string
  user: User & { id: string | number }
}

export function normalizeUser(u: User & { id: string | number }): User {
  return {
    ...u,
    id: String(u.id),
  }
}

export async function loginRequest(email: string, password: string): Promise<LoginResponse> {
  const { data } = await api.post<RawLoginPayload>('/api/auth/login', { email, password, portal: 'admin' })
  const user = normalizeUser(data.user)
  if (user.role !== 'admin') {
    throw new ApiError('Employee accounts sign in on the employee site', 403, 'employee_account')
  }
  const token = data.token ?? data.access_token ?? ''
  return { token, user }
}

export async function fetchMe(): Promise<User> {
  const { data } = await api.get<User & { id: string | number }>('/api/auth/me')
  const user = normalizeUser(data)
  if (user.role !== 'admin') {
    throw new ApiError('Employee accounts sign in on the employee site', 403, 'employee_account')
  }
  return user
}

export function useMe(enabled: boolean) {
  const setUser = useAuthStore((s) => s.setUser)
  return useQuery({
    queryKey: qk.me,
    queryFn: async () => {
      const u = await fetchMe()
      setUser(u)
      return u
    },
    enabled,
    staleTime: 5 * 60_000,
    retry: false,
  })
}

export function useLogin() {
  const setSession = useAuthStore((s) => s.setSession)
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) => loginRequest(email, password),
    onSuccess: (res) => {
      qc.clear()
      setSession(res.token, res.user)
      qc.setQueryData(qk.me, res.user)
    },
  })
}

export function useLogout() {
  const qc = useQueryClient()
  const clear = useAuthStore((s) => s.clear)
  return async () => {
    try {
      await api.post('/api/auth/logout')
    } catch {
      /* token may already be invalid */
    }
    clear()
    qc.clear()
  }
}
