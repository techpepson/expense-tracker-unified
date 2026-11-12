// Domain types shared by the API layer, the mock server and the UI.
// Money fields are decimal numbers in major units (e.g. 1250.5 = GH₵ 1,250.50) on the wire;
// all arithmetic is done in integer pesewas via `@/lib/money`.

export type ID = string

export interface Category {
  id: ID
  name: string
  description: string
  is_active: boolean
  sort_order: number
  created_at: string
  /** Read-only, computed by the server. */
  item_count?: number
}

export type ItemStatus = 'approved' | 'pending' | 'inactive'

export interface Item {
  id: ID
  category_id: ID
  name: string
  status: ItemStatus
  usage_count: number
  /** User who suggested the item (pending suggestions come from the employee app). */
  suggested_by?: ID | null
  created_at?: string
}

export type ExpenseType = 'individual' | 'shared_operational'

export interface Expense {
  id: ID
  category_id: ID
  item_id: ID
  item_name: string
  unit_cost: number
  quantity: number
  /** Always computed by the server as unit_cost x quantity. */
  total: number
  description: string
  expense_date: string
  expense_type: ExpenseType
  created_by: ID
  incurred_by?: string | null
  notes?: string | null
  created_at: string
  updated_at: string
  updated_by?: ID | null
  /** Deterministic key set by the importer so re-imports are idempotent. */
  import_key?: string | null
}

export type PettyCashEntryType = 'cash_in' | 'cash_out' | 'charge'

export interface PettyCashEntry {
  id: ID
  entry_type: PettyCashEntryType
  amount: number
  entry_date: string
  description: string
  created_by: ID
  created_at: string
  import_key?: string | null
}

export type Role = 'employee' | 'admin'

export interface User {
  id: ID
  full_name: string
  email: string
  role: Role
  can_record_shared: boolean
  profile_picture?: string | null
  is_active: boolean
  created_at: string
}

export interface Settings {
  organisation_name: string
  currency: string
  period_start_day: number
}

export interface Paginated<T> {
  data: T[]
  page: number
  limit: number
  total: number
  /** Sum of `total` across all filtered rows (not just the page). */
  total_amount?: number
}

export interface ApiErrorBody {
  message: string
  code?: string
  errors?: Record<string, string[]>
}

// ---- Petty cash summary (the sheet's five figures) ----
export interface PettyCashSummary {
  opening_balance: number
  cash_in: number
  cash_out_total: number
  charges: number
  cash_used: number
  closing_balance: number
}

export interface PettyCashLedgerRow extends PettyCashEntry {
  running_balance: number
}

export interface PettyCashMonth {
  month: number
  year: number
  summary: PettyCashSummary
  entries: PettyCashLedgerRow[]
  /** True when no earlier month exists, so the opening balance must be set manually. */
  is_first_month: boolean
  opening_balance_set: boolean
}

// ---- Dashboard ----
export interface CategorySpend {
  category_id: ID
  name: string
  total: number
  count: number
  percent: number
}

export interface EmployeeSpend {
  user_id: ID
  full_name: string
  total: number
  count: number
}

export interface MonthTotal {
  month: number
  total: number
}

export interface DashboardData {
  month: number
  year: number
  total_spent: number
  record_count: number
  largest_category: CategorySpend | null
  individual_total: number
  shared_total: number
  petty_cash_balance: number
  active_users: number
  active_categories: number
  pending_items: number
  by_category: CategorySpend[]
  monthly_trend: MonthTotal[]
  by_employee: EmployeeSpend[]
  recent_expenses: Expense[]
  pending_suggestions: Item[]
}

// ---- Reports ----
export interface ReportItemGroup {
  item_id: ID
  item_name: string
  entries: Expense[]
  subtotal: number
}

export interface ReportCategoryGroup {
  category_id: ID
  name: string
  items: ReportItemGroup[]
  subtotal: number
}

export interface MonthlyReport {
  month: number
  year: number
  organisation_name: string
  currency: string
  categories: ReportCategoryGroup[]
  grand_total: number
  record_count: number
  individual_total: number
  shared_total: number
  petty_cash: PettyCashSummary
  by_category: CategorySpend[]
}

export interface AnnualRow {
  category_id: ID
  category_name: string
  item_id: ID
  item_name: string
  months: number[]
  total: number
}

export interface AnnualReport {
  year: number
  rows: AnnualRow[]
  category_totals: { category_id: ID; name: string; months: number[]; total: number }[]
  month_totals: number[]
  grand_total: number
}

// ---- Auth ----
export interface LoginResponse {
  token: string
  user: User
}

// ---- Import ----
export interface ImportPayload {
  categories: { name: string; sort_order: number }[]
  items: { key: string; category: string; name: string }[]
  expenses: {
    import_key: string
    category: string
    item_key: string
    unit_cost: number
    quantity: number
    description: string
    expense_date: string
  }[]
  petty_cash: {
    import_key: string
    entry_type: PettyCashEntryType
    amount: number
    entry_date: string
    description: string
  }[]
  opening_balance: { amount: number; month: number; year: number } | null
}

export interface ImportResultCounts {
  categories_created: number
  items_created: number
  expenses_created: number
  petty_cash_created: number
  skipped_duplicates: number
}

