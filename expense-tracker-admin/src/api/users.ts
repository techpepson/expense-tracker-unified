import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Role, User } from '@/types'
import { api } from './client'
import { qk } from './queryKeys'
import { invalidateDerived } from './dashboard'

export interface UserFilters {
  search?: string
  role?: Role | ''
  status?: 'active' | 'inactive' | ''
}

export interface UserInput {
  full_name: string
  email: string
  password?: string
  role: Role
  can_record_shared: boolean
  is_active: boolean
}

export async function fetchUsers(f: UserFilters = {}): Promise<User[]> {
  const params = Object.fromEntries(Object.entries(f).filter(([, v]) => v))
  const { data } = await api.get<User[]>('/api/admin/users', { params })
  return data
}

export function useUsers(f: UserFilters = {}) {
  return useQuery({ queryKey: qk.users(f), queryFn: () => fetchUsers(f), staleTime: 60_000 })
}

function useInvalidateUsers() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: qk.usersAll })
    invalidateDerived(qc)
  }
}

export function useCreateUser() {
  const invalidate = useInvalidateUsers()
  return useMutation({
    mutationFn: async (input: UserInput) => (await api.post<User>('/api/admin/users', input)).data,
    onSuccess: invalidate,
  })
}

export function useUpdateUser() {
  const invalidate = useInvalidateUsers()
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<UserInput> & { id: string }) => (await api.put<User>(`/api/admin/users/${id}`, input)).data,
    onSuccess: invalidate,
  })
}

export function useResetPassword() {
  return useMutation({
    mutationFn: async (id: string) =>
      (await api.post<{ temporary_password: string }>(`/api/admin/users/${id}/reset-password`)).data,
  })
}

