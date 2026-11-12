export const APP_NAME = 'e-COM Expenses'
export const COMPANY_NAME = 'e-COM Services'
export const CURRENCY = 'GHS'
export const CURRENCY_SYMBOL = 'GH₵'

export const EXPENSE_TYPES = [
  { value: 'individual', label: 'Individual' },
  { value: 'shared_operational', label: 'Shared Operational' },
] as const

export const PETTY_CASH_ENTRY_TYPES = [
  { value: 'cash_in', label: 'Cash In' },
  { value: 'cash_out', label: 'Cash Out' },
  { value: 'charge', label: 'Charge' },
] as const

export const DEFAULT_PAGE_LIMIT = 15
export const DEFAULT_YEAR = new Date().getFullYear()

export const CHART_COLORS = [
  '#1E3A8A',
  '#2563EB',
  '#60A5FA',
  '#38BDF8',
  '#BFDBFE',
  '#3B82F6',
  '#93C5FD',
  '#BAE6FD',
]

