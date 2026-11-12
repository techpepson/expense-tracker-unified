import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from './client'
import type { User, UserLookup } from '@/types'
import { authKeys, normalizeUser } from './auth'
import { useAuthStore } from '@/stores/authStore'

export const profileKeys = {
  lookup: ['users', 'lookup'] as const,
}

export interface UpdateProfileDto {
  full_name?: string
  email?: string
}

export interface UpdatePasswordDto {
  current_password: string
  new_password: string
}

export async function updateProfile(data: UpdateProfileDto): Promise<User> {
  const res = await apiClient.put<any>('/api/me', data)
  const user = normalizeUser(res.data)
  const token = useAuthStore.getState().token
  if (token) {
    useAuthStore.getState().setAuth(user, token)
  }
  return user
}

export async function updatePassword(data: UpdatePasswordDto): Promise<void> {
  await apiClient.put('/api/me/password', data)
}

export async function uploadAvatar(file: File): Promise<User> {
  const form = new FormData()
  form.append('file', file)
  const res = await apiClient.post<any>('/api/me/avatar', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  const user = normalizeUser(res.data)
  const token = useAuthStore.getState().token
  if (token) {
    useAuthStore.getState().setAuth(user, token)
  }
  return user
}

export async function getUsersLookup(): Promise<UserLookup[]> {
  const res = await apiClient.get<any[]>('/api/users/lookup')
  return res.data.map((u) => ({
    id: String(u.id),
    full_name: u.full_name,
  }))
}

export function useUsersLookup() {
  return useQuery({
    queryKey: profileKeys.lookup,
    queryFn: getUsersLookup,
    staleTime: 5 * 60 * 1000,
  })
}

export function useUpdateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: updateProfile,
    onSuccess: () => void qc.invalidateQueries({ queryKey: authKeys.me }),
  })
}

export function useUpdatePassword() {
  return useMutation({ mutationFn: updatePassword })
}

export function useUploadAvatar() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: uploadAvatar,
    onSuccess: () => void qc.invalidateQueries({ queryKey: authKeys.me }),
  })
}
