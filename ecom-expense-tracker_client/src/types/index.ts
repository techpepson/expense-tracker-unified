// ============================================================
// Shared TypeScript types for e-COM Expense Tracker
// ============================================================

export type UserRole = 'employee' | 'admin'

export interface User {
  id: string
  full_name: string
  email: string
  role?: UserRole
  can_record_shared: boolean
  is_active?: boolean
  profile_picture?: string
  created_at: string
}

export interface Category {
  id: string
  name: string
  is_active: boolean
}

export interface Item {
  id: string
  category_id: string
  name: string
  status: 'approved' | 'pending'
}

export type ExpenseType = 'individual' | 'shared_operational'

export interface Expense {
  id: string
  category_id: string
  category_name?: string
  item_id: string
  item_name: string
  unit_cost: number
  quantity: number
  total: number
  description?: string
  expense_date: string
  expense_type: ExpenseType
  created_by: string
  created_by_name: string
  incurred_by?: string
  incurred_by_name?: string
  notes?: string
  created_at: string
  updated_at: string
}

export type PettyCashEntryType = 'cash_in' | 'cash_out' | 'charge'

export interface PettyCashEntry {
  id: string
  entry_type: PettyCashEntryType
  amount: number
  entry_date: string
  description: string
  created_by: string
  created_by_name: string
  created_at: string
}

export interface PettyCashSummary {
  opening_balance: number
  cash_in: number
  cash_out_total: number
  charges: number
  closing_balance: number
  cash_used: number
  entries: PettyCashEntry[]
}

export interface MonthlyReport {
  month: number
  year: number
  total_purchases: number
  record_count: number
  individual_total: number
  shared_total: number
  petty_cash: PettyCashSummary
  categories: CategoryBreakdown[]
  expenses: Expense[]
}

export interface CategoryBreakdown {
  category_id: string
  category_name: string
  total: number
  items: ItemBreakdown[]
}

export interface ItemBreakdown {
  item_id: string
  item_name: string
  entries: Expense[]
  subtotal: number
}

export interface AnnualReport {
  year: number
  months: MonthlyTotal[]
  categories: AnnualCategoryRow[]
  grand_total: number
}

export interface MonthlyTotal {
  month: number
  total: number
}

export interface AnnualCategoryRow {
  category_id: string
  category_name: string
  items: AnnualItemRow[]
  monthly_totals: number[]
  year_total: number
}

export interface AnnualItemRow {
  item_id: string
  item_name: string
  monthly_totals: number[]
  year_total: number
}

export interface UserLookup {
  id: string
  full_name: string
}

export interface AuthTokens {
  access_token: string
  token_type: string
  user?: User
}

export interface LoginRequest {
  email: string
  password: string
}

export interface ApiError {
  detail: string
  code?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
}

