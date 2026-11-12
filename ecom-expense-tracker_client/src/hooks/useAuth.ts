import { useAuthStore } from '@/stores/authStore'

export function useAuth() {
  const user = useAuthStore((s) => s.user)
  const token = useAuthStore((s) => s.token)
  const setAuth = useAuthStore((s) => s.setAuth)
  const clearAuth = useAuthStore((s) => s.clearAuth)

  return {
    user,
    token,
    isAuthenticated: !!token && !!user,
    canRecordShared: Boolean(user?.can_record_shared || user?.role === 'admin'),
    setAuth,
    logout: clearAuth,
  }
}
