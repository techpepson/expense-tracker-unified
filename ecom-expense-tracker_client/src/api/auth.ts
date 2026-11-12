import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from './client'
import type { User, AuthTokens, LoginRequest } from '@/types'

export const authKeys = {
  me: ['auth', 'me'] as const,
}

export function normalizeUser(raw: any): User {
  return {
    id: String(raw.id),
    full_name: raw.full_name,
    email: raw.email,
    role: raw.role,
    can_record_shared: Boolean(raw.can_record_shared || raw.role === 'admin'),
    is_active: raw.is_active ?? true,
    profile_picture: raw.profile_picture ?? undefined,
    created_at: raw.created_at ?? new Date().toISOString(),
  }
}

export async function login(data: LoginRequest): Promise<{ user: User; token: string }> {
  const res = await apiClient.post<AuthTokens>('/api/auth/login', data)
  const token = res.data.access_token
  if (res.data.user) {
    return { user: normalizeUser(res.data.user), token }
  }
  const meRes = await apiClient.get<User>('/api/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  })
  return { user: normalizeUser(meRes.data), token }
}

export async function getMe(): Promise<User> {
  const res = await apiClient.get<User>('/api/auth/me')
  return normalizeUser(res.data)
}

export function useMe() {
  return useQuery({ queryKey: authKeys.me, queryFn: getMe, retry: false })
}

export function useLogin() {
  return useMutation({ mutationFn: login })
}

export function useLogout() {
  const qc = useQueryClient()
  return () => {
    qc.clear()
    window.location.href = '/login'
  }
}
