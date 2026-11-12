/** Runtime configuration read from Vite env variables (see .env.example). */
export const env = {
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, ''),
  useMocks: import.meta.env.VITE_USE_MOCKS === 'true',
  employeeAppUrl: import.meta.env.VITE_EMPLOYEE_APP_URL || '#',
} as const

