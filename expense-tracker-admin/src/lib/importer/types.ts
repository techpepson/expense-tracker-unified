export type Severity = 'error' | 'warning' | 'info'

export type AnomalyKind =
  | 'unparseable_amount'
  | 'amount_format'
  | 'total_mismatch'
  | 'missing_total'
  | 'missing_value'
  | 'text_date'
  | 'odd_date'
  | 'month_mismatch'
  | 'unparseable_date'
  | 'name_whitespace'
  | 'name_case_variant'
  | 'near_duplicate'
  | 'duplicate_across_categories'
  | 'category_mapped'
  | 'category_new'
  | 'orphan_entry'
  | 'grand_total_mismatch'
  | 'petty_cash_mismatch'
  | 'opening_balance'
  | 'layout'

export interface Anomaly {
  id: string
  severity: Severity
  kind: AnomalyKind
  /** Cell or range, e.g. "Sheet1!P20". */
  location: string
  month: number | null
  problem: string
  suggestion: string
  raw?: string
}

/** Normalised cell value as read from ExcelJS (rich text flattened, formulas resolved). */
export type CellValue = string | number | Date | null

/** Minimal grid interface so the parser works with ExcelJS in Node, in the browser and in tests. */
export interface SheetGrid {
  name: string
  rowCount: number
  columnCount: number
  getCell(row: number, col: number): CellValue
}

export interface ParsedCategory {
  name: string
  sort_order: number
  sheet_label: string
}

export interface ParsedItem {
  key: string
  category: string
  name: string
  first_cell: string
}

export interface ParsedExpense {
  import_key: string
  category: string
  item_key: string
  item_name: string
  unit_cost: number
  quantity: number
  /** Computed: unit_cost x quantity. Never the sheet value. */
  total: number
  /** The hand-typed total from the sheet (for reference only), null when blank/unparseable. */
  sheet_total: number | null
  description: string
  expense_date: string
  month: number
  location: string
}

export interface ParsedPettyCashEntry {
  import_key: string
  entry_type: 'cash_in' | 'cash_out' | 'charge'
  amount: number
  entry_date: string
  description: string
  month: number
  location: string
}

export interface MonthSummary {
  month: number
  expenses: number
  expense_total: number
  petty_cash_entries: number
  cash_in: number
  cash_out: number
  sheet_grand_total: number | null
  sheet_cash_used: number | null
}

export interface ParseResult {
  sheet_name: string
  year: number
  categories: ParsedCategory[]
  items: ParsedItem[]
  expenses: ParsedExpense[]
  petty_cash: ParsedPettyCashEntry[]
  opening_balance: { amount: number; month: number; year: number } | null
  anomalies: Anomaly[]
  months: MonthSummary[]
}

