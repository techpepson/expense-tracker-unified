import type { ExpenseFilters } from './expenses'
import type { ItemFilters } from './items'
import type { UserFilters } from './users'

/** Central TanStack Query keys. Prefix arrays allow broad invalidation. */
export const qk = {
  me: ['me'] as const,
  dashboard: (month: number, year: number) => ['dashboard', month, year] as const,
  dashboardAll: ['dashboard'] as const,
  categories: ['categories'] as const,
  items: (f: ItemFilters = {}) => ['items', f] as const,
  itemsAll: ['items'] as const,
  users: (f: UserFilters = {}) => ['users', f] as const,
  usersAll: ['users'] as const,
  expenses: (f: ExpenseFilters) => ['expenses', 'list', f] as const,
  expensesAll: ['expenses'] as const,
  expense: (id: string) => ['expenses', 'detail', id] as const,
  pettyCash: (month: number, year: number) => ['petty-cash', month, year] as const,
  pettyCashAll: ['petty-cash'] as const,
  monthlyReport: (month: number, year: number, createdBy?: string) => ['reports', 'monthly', month, year, createdBy ?? ''] as const,
  annualReport: (year: number) => ['reports', 'annual', year] as const,
  reportsAll: ['reports'] as const,
  settings: ['settings'] as const,
}

