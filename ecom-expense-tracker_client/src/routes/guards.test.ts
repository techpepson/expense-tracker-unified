import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore } from '@/stores/authStore'

describe('Employee authentication store and permissions', () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuth()
  })

  it('initializes as unauthenticated with null user and token', () => {
    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.token).toBeNull()
  })

  it('stores authenticated employee and can_record_shared permission correctly', () => {
    const regularEmployee = {
      id: 'usr-regular',
      full_name: 'Regular Employee',
      email: 'employee@ecom.com',
      can_record_shared: false,
      created_at: new Date().toISOString(),
    }

    useAuthStore.getState().setAuth(regularEmployee, 'token-123')
    let state = useAuthStore.getState()
    expect(state.user?.id).toBe('usr-regular')
    expect(state.token).toBe('token-123')
    expect(state.user?.can_record_shared).toBe(false)

    // Designated expense recorder
    const designatedRecorder = {
      ...regularEmployee,
      id: 'usr-designated',
      can_record_shared: true,
    }
    useAuthStore.getState().setAuth(designatedRecorder, 'token-456')
    state = useAuthStore.getState()
    expect(state.user?.can_record_shared).toBe(true)
  })

  it('clears session on logout', () => {
    useAuthStore.getState().setAuth(
      {
        id: 'usr-1',
        full_name: 'Test',
        email: 'test@ecom.com',
        can_record_shared: false,
        created_at: new Date().toISOString(),
      },
      'token-test'
    )
    expect(useAuthStore.getState().token).toBe('token-test')

    useAuthStore.getState().clearAuth()
    expect(useAuthStore.getState().user).toBeNull()
    expect(useAuthStore.getState().token).toBeNull()
  })
})

