import axios from 'axios'
import { useAuthStore } from '@/stores/authStore'

// In mock mode, use relative URL so requests hit the local service worker cleanly.
// In real API mode, use VITE_API_BASE_URL (defaults to http://localhost:8000).
const API_BASE_URL =
  import.meta.env.VITE_USE_MOCKS === 'true'
    ? ''
    : (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000')

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT token
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle 401 → logout
apiClient.interceptors.response.use(
  (res) => res,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      useAuthStore.getState().clearAuth()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

