import type {
  Category,
  DashboardData,
  Expense,
  ExpenseType,
  ImportPayload,
  ImportResultCounts,
  Item,
  ItemStatus,
  Paginated,
  PettyCashEntry,
  PettyCashEntryType,
  PettyCashMonth,
  Role,
  Settings,
  User,
} from '@/types'
import { lineTotal } from '@/lib/money'
import {
  buildAnnualReport,
  buildMonthlyReport,
  computePettyCashMonth,
  expensesInPeriod,
  monthlyTrend,
  spendByCategory,
  spendByEmployee,
  splitByType,
  sumTotals,
} from '@/lib/reports'
import { nameKey } from '@/lib/importer/names'
import { nextId, recountUsage, type MockDb } from './db'
import type { SeedUser } from './seed/demo'

export class ServiceError extends Error {
  status: number
  code?: string
  errors?: Record<string, string[]>
  constructor(status: number, message: string, code?: string, errors?: Record<string, string[]>) {
    super(message)
    this.status = status
    this.code = code
    this.errors = errors
  }
}

const now = () => new Date().toISOString()
const publicUser = ({ password: _p, ...u }: SeedUser): User => u
const invalid = (field: string, message: string) => new ServiceError(422, message, 'validation_error', { [field]: [message] })
const notFound = (what: string) => new ServiceError(404, `${what} not found`, 'not_found')

// ---------------- Auth ----------------
export function login(db: MockDb, email: string, password: string): { token: string; user: User } {
  const user = db.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase())
  if (!user || user.password !== password) throw new ServiceError(401, 'Invalid email or password', 'invalid_credentials')
  if (user.role !== 'admin') {
    throw new ServiceError(403, 'Employee accounts sign in on the employee site', 'employee_account')
  }
  if (!user.is_active) throw new ServiceError(403, 'This account has been deactivated', 'account_inactive')
  const token = `mock.${user.id}.${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
  db.tokens[token] = user.id
  return { token, user: publicUser(user) }
}

export function userForToken(db: MockDb, token: string | null): SeedUser {
  const id = token ? db.tokens[token] : undefined
  const user = id ? db.users.find((u) => u.id === id) : undefined
  if (!user || !user.is_active) throw new ServiceError(401, 'Session expired', 'unauthenticated')
  return user
}

export function requireAdmin(db: MockDb, token: string | null): SeedUser {
  const user = userForToken(db, token)
  if (user.role !== 'admin') throw new ServiceError(403, 'Employee accounts sign in on the employee site', 'employee_account')
  return user
}

export function me(db: MockDb, token: string | null): User {
  return publicUser(requireAdmin(db, token))
}

export function logout(db: MockDb, token: string | null): void {
  if (token) delete db.tokens[token]
}

// ---------------- Categories ----------------
export function listCategories(db: MockDb): Category[] {
  return [...db.categories]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((c) => ({ ...c, item_count: db.items.filter((i) => i.category_id === c.id && i.status !== 'inactive').length }))
}

export interface CategoryInput {
  name: string
  description?: string
  is_active?: boolean
}

function assertUniqueCategory(db: MockDb, name: string, exceptId?: string) {
  const trimmed = name.trim()
  if (!trimmed) throw invalid('name', 'Name is required')
  if (db.categories.some((c) => c.id !== exceptId && nameKey(c.name) === nameKey(trimmed))) {
    throw invalid('name', 'A category with this name already exists')
  }
}

export function createCategory(db: MockDb, input: CategoryInput): Category {
  assertUniqueCategory(db, input.name)
  const cat: Category = {
    id: nextId(db, 'cat'),
    name: input.name.trim(),
    description: input.description?.trim() ?? '',
    is_active: input.is_active ?? true,
    sort_order: Math.max(0, ...db.categories.map((c) => c.sort_order)) + 1,
    created_at: now(),
  }
  db.categories.push(cat)
  return cat
}

export function updateCategory(db: MockDb, id: string, input: Partial<CategoryInput>): Category {
  const cat = db.categories.find((c) => c.id === id)
  if (!cat) throw notFound('Category')
  if (input.name !== undefined) {
    assertUniqueCategory(db, input.name, id)
    cat.name = input.name.trim()
  }
  if (input.description !== undefined) cat.description = input.description.trim()
  if (input.is_active !== undefined) cat.is_active = input.is_active
  return cat
}

export function reorderCategories(db: MockDb, ids: string[]): Category[] {
  const known = new Set(db.categories.map((c) => c.id))
  if (ids.length !== known.size || !ids.every((id) => known.has(id))) {
    throw invalid('ids', 'The reorder list must contain every category exactly once')
  }
  ids.forEach((id, i) => {
    db.categories.find((c) => c.id === id)!.sort_order = i + 1
  })
  return listCategories(db)
}

// ---------------- Items ----------------
export interface ItemFilters {
  status?: ItemStatus | ''
  category_id?: string
  search?: string
}

export function listItems(db: MockDb, f: ItemFilters = {}): Item[] {
  recountUsage(db)
  const order = new Map(db.categories.map((c) => [c.id, c.sort_order]))
  return db.items
    .filter((i) => !f.status || i.status === f.status)
    .filter((i) => !f.category_id || i.category_id === f.category_id)
    .filter((i) => !f.search || i.name.toLowerCase().includes(f.search.toLowerCase()))
    .sort((a, b) => (order.get(a.category_id) ?? 0) - (order.get(b.category_id) ?? 0))
}

function assertUniqueItem(db: MockDb, categoryId: string, name: string, exceptId?: string) {
  if (!name.trim()) throw invalid('name', 'Name is required')
  const clash = db.items.find(
    (i) => i.id !== exceptId && i.category_id === categoryId && i.status !== 'pending' && nameKey(i.name) === nameKey(name),
  )
  if (clash) throw invalid('name', `"${clash.name}" already exists in this category — merge instead`)
}

export function createItem(db: MockDb, input: { name: string; category_id: string; status?: ItemStatus }): Item {
  if (!db.categories.some((c) => c.id === input.category_id)) throw invalid('category_id', 'Choose a category')
  assertUniqueItem(db, input.category_id, input.name)
  const item: Item = {
    id: nextId(db, 'itm'),
    category_id: input.category_id,
    name: input.name.replace(/\s+/g, ' ').trim(),
    status: input.status ?? 'approved',
    usage_count: 0,
    suggested_by: null,
    created_at: now(),
  }
  db.items.push(item)
  return item
}

export function updateItem(db: MockDb, id: string, input: { name?: string; category_id?: string; status?: ItemStatus }): Item {
  const item = db.items.find((i) => i.id === id)
  if (!item) throw notFound('Item')
  const categoryId = input.category_id ?? item.category_id
  const name = input.name ?? item.name
  if (input.category_id && !db.categories.some((c) => c.id === input.category_id)) throw invalid('category_id', 'Choose a category')
  if (input.name !== undefined || input.category_id !== undefined) assertUniqueItem(db, categoryId, name, id)
  item.name = name.replace(/\s+/g, ' ').trim()
  if (categoryId !== item.category_id) {
    item.category_id = categoryId
    for (const e of db.expenses) if (e.item_id === id) e.category_id = categoryId
  }
  for (const e of db.expenses) if (e.item_id === id) e.item_name = item.name
  if (input.status) item.status = input.status
  return item
}

/** Reassigns every expense from `sourceId` to `targetId`, then removes the source item. */
export function mergeItem(db: MockDb, sourceId: string, targetId: string): { moved: number; target: Item } {
  if (sourceId === targetId) throw invalid('target_id', 'Choose a different item to merge into')
  const source = db.items.find((i) => i.id === sourceId)
  const target = db.items.find((i) => i.id === targetId)
  if (!source) throw notFound('Item')
  if (!target) throw invalid('target_id', 'Target item not found')
  let moved = 0
  for (const e of db.expenses) {
    if (e.item_id === sourceId) {
      e.item_id = target.id
      e.item_name = target.name
      e.category_id = target.category_id
      e.updated_at = now()
      moved += 1
    }
  }
  db.items = db.items.filter((i) => i.id !== sourceId)
  recountUsage(db)
  return { moved, target }
}

export function approveItem(db: MockDb, id: string): Item {
  const item = db.items.find((i) => i.id === id)
  if (!item) throw notFound('Item')
  assertUniqueItem(db, item.category_id, item.name, id)
  item.status = 'approved'
  return item
}

export function rejectItem(db: MockDb, id: string): void {
  const item = db.items.find((i) => i.id === id)
  if (!item) throw notFound('Item')
  if (item.status !== 'pending') throw new ServiceError(409, 'Only pending suggestions can be rejected', 'conflict')
  if (db.expenses.some((e) => e.item_id === id)) {
    throw new ServiceError(409, 'This suggestion is used by expense records — merge it into an existing item instead', 'conflict')
  }
  db.items = db.items.filter((i) => i.id !== id)
}

// ---------------- Users ----------------
export function listUsers(db: MockDb, f: { search?: string; role?: Role | ''; status?: 'active' | 'inactive' | '' } = {}): User[] {
  const q = f.search?.toLowerCase() ?? ''
  return db.users
    .filter((u) => !q || u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
    .filter((u) => !f.role || u.role === f.role)
    .filter((u) => !f.status || (f.status === 'active' ? u.is_active : !u.is_active))
    .map(publicUser)
}

export interface UserInput {
  full_name: string
  email: string
  password?: string
  role: Role
  can_record_shared: boolean
  is_active: boolean
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function createUser(db: MockDb, input: UserInput): User {
  if (!input.full_name?.trim()) throw invalid('full_name', 'Full name is required')
  if (!EMAIL.test(input.email ?? '')) throw invalid('email', 'Enter a valid email address')
  if (db.users.some((u) => u.email.toLowerCase() === input.email.toLowerCase())) throw invalid('email', 'This email is already in use')
  if (!input.password || input.password.length < 8) throw invalid('password', 'Temporary password must be at least 8 characters')
  const user: SeedUser = {
    id: nextId(db, 'usr'),
    full_name: input.full_name.trim(),
    email: input.email.trim().toLowerCase(),
    role: input.role,
    can_record_shared: input.can_record_shared,
    is_active: input.is_active,
    profile_picture: null,
    created_at: now(),
    password: input.password,
  }
  db.users.push(user)
  return publicUser(user)
}

export function updateUser(db: MockDb, id: string, input: Partial<UserInput>, actorId: string): User {
  const user = db.users.find((u) => u.id === id)
  if (!user) throw notFound('User')
  if (id === actorId) {
    if (input.is_active === false) throw invalid('is_active', 'You cannot deactivate your own account')
    if (input.role && input.role !== 'admin') throw invalid('role', 'You cannot remove your own administrator role')
  }
  if (input.email !== undefined) {
    if (!EMAIL.test(input.email)) throw invalid('email', 'Enter a valid email address')
    if (db.users.some((u) => u.id !== id && u.email.toLowerCase() === input.email!.toLowerCase())) throw invalid('email', 'This email is already in use')
    user.email = input.email.trim().toLowerCase()
  }
  if (input.full_name !== undefined) {
    if (!input.full_name.trim()) throw invalid('full_name', 'Full name is required')
    user.full_name = input.full_name.trim()
  }
  if (input.role) user.role = input.role
  if (input.can_record_shared !== undefined) user.can_record_shared = input.can_record_shared
  if (input.is_active !== undefined) {
    user.is_active = input.is_active
    if (!input.is_active) for (const [t, uid] of Object.entries(db.tokens)) if (uid === id) delete db.tokens[t]
  }
  return publicUser(user)
}

export function resetPassword(db: MockDb, id: string): { temporary_password: string } {
  const user = db.users.find((u) => u.id === id)
  if (!user) throw notFound('User')
  const temp = `Tmp-${Math.random().toString(36).slice(2, 8)}${Math.floor(Math.random() * 90 + 10)}`
  user.password = temp
  return { temporary_password: temp }
}

// ---------------- Expenses ----------------
export interface ExpenseFilters {
  month?: number
  year?: number
  category_id?: string
  item_id?: string
  expense_type?: ExpenseType | ''
  created_by?: string
  search?: string
  page?: number
  limit?: number
  sort?: string
}

type SortKey = 'expense_date' | 'total' | 'unit_cost' | 'quantity' | 'item_name' | 'created_at'
const SORT_KEYS: SortKey[] = ['expense_date', 'total', 'unit_cost', 'quantity', 'item_name', 'created_at']

export function filterExpenses(db: MockDb, f: ExpenseFilters): Expense[] {
  const startDay = db.settings.period_start_day
  let list: Expense[] = db.expenses
  if (f.month && f.year) list = expensesInPeriod(list, f.month, f.year, startDay)
  else if (f.year) list = list.filter((e) => e.expense_date.startsWith(String(f.year)))
  if (f.category_id) list = list.filter((e) => e.category_id === f.category_id)
  if (f.item_id) list = list.filter((e) => e.item_id === f.item_id)
  if (f.expense_type) list = list.filter((e) => e.expense_type === f.expense_type)
  if (f.created_by) list = list.filter((e) => e.created_by === f.created_by)
  if (f.search) {
    const q = f.search.toLowerCase()
    list = list.filter(
      (e) =>
        e.item_name.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        (e.incurred_by ?? '').toLowerCase().includes(q) ||
        (e.notes ?? '').toLowerCase().includes(q),
    )
  }
  const [rawKey, rawDir] = (f.sort ?? 'expense_date:desc').split(':')
  const key: SortKey = SORT_KEYS.includes(rawKey as SortKey) ? (rawKey as SortKey) : 'expense_date'
  const dir = rawDir === 'asc' ? 1 : -1
  return [...list].sort((a, b) => {
    const x = a[key]
    const y = b[key]
    const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))
    return c * dir || b.created_at.localeCompare(a.created_at)
  })
}

export function listExpenses(db: MockDb, f: ExpenseFilters): Paginated<Expense> {
  const all = filterExpenses(db, f)
  const limit = Math.min(Math.max(1, f.limit ?? 20), 10000)
  const page = Math.max(1, f.page ?? 1)
  return {
    data: all.slice((page - 1) * limit, page * limit),
    page,
    limit,
    total: all.length,
    total_amount: sumTotals(all),
  }
}

export function getExpense(db: MockDb, id: string): Expense {
  const e = db.expenses.find((x) => x.id === id)
  if (!e) throw notFound('Expense')
  return e
}

export interface ExpenseInput {
  category_id: string
  item_id: string
  unit_cost: number
  quantity: number
  description?: string
  expense_date: string
  expense_type: ExpenseType
  incurred_by?: string | null
  notes?: string | null
}

function validateExpense(db: MockDb, input: ExpenseInput, existing?: Expense): Item {
  const cat = db.categories.find((c) => c.id === input.category_id)
  if (!cat) throw invalid('category_id', 'Choose a category')
  const keepingCategory = existing && existing.category_id === input.category_id
  if (!cat.is_active && !keepingCategory) throw invalid('category_id', 'This category is inactive')
  const item = db.items.find((i) => i.id === input.item_id)
  if (!item || item.category_id !== input.category_id) throw invalid('item_id', 'Choose an item from this category')
  const keepingItem = existing && existing.item_id === input.item_id
  if (item.status !== 'approved' && !keepingItem) throw invalid('item_id', 'Only approved items can be used')
  if (!(input.unit_cost > 0)) throw invalid('unit_cost', 'Unit cost must be greater than zero')
  if (!(input.quantity > 0)) throw invalid('quantity', 'Quantity must be greater than zero')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.expense_date ?? '')) throw invalid('expense_date', 'Enter a valid date')
  if (input.expense_type !== 'individual' && input.expense_type !== 'shared_operational') throw invalid('expense_type', 'Choose an expense type')
  return item
}

export function createExpense(db: MockDb, input: ExpenseInput, actorId: string): Expense {
  const item = validateExpense(db, input)
  const at = now()
  const e: Expense = {
    id: nextId(db, 'exp'),
    category_id: input.category_id,
    item_id: item.id,
    item_name: item.name,
    unit_cost: input.unit_cost,
    quantity: input.quantity,
    total: lineTotal(input.unit_cost, input.quantity), // server is the authority for totals
    description: input.description?.trim() ?? '',
    expense_date: input.expense_date,
    expense_type: input.expense_type,
    created_by: actorId,
    incurred_by: input.incurred_by?.trim() || null,
    notes: input.notes?.trim() || null,
    created_at: at,
    updated_at: at,
    updated_by: null,
    import_key: null,
  }
  db.expenses.push(e)
  recountUsage(db)
  return e
}

export function createExpensesBulk(db: MockDb, inputs: ExpenseInput[], actorId: string): Expense[] {
  if (!inputs.length) throw invalid('lines', 'Add at least one line')
  inputs.forEach((i) => validateExpense(db, i)) // validate all before writing any
  return inputs.map((i) => createExpense(db, i, actorId))
}

export function updateExpense(db: MockDb, id: string, input: ExpenseInput, actorId: string): Expense {
  const e = getExpense(db, id)
  const item = validateExpense(db, input, e)
  Object.assign(e, {
    category_id: input.category_id,
    item_id: item.id,
    item_name: item.name,
    unit_cost: input.unit_cost,
    quantity: input.quantity,
    total: lineTotal(input.unit_cost, input.quantity),
    description: input.description?.trim() ?? '',
    expense_date: input.expense_date,
    expense_type: input.expense_type,
    incurred_by: input.incurred_by?.trim() || null,
    notes: input.notes?.trim() || null,
    updated_at: now(),
    updated_by: actorId,
  })
  recountUsage(db)
  return e
}

export function deleteExpense(db: MockDb, id: string): void {
  getExpense(db, id)
  db.expenses = db.expenses.filter((e) => e.id !== id)
  recountUsage(db)
}

// ---------------- Petty cash ----------------
export function pettyCashMonth(db: MockDb, month: number, year: number): PettyCashMonth {
  return computePettyCashMonth(db.pettyCash, db.opening, month, year, db.settings.period_start_day)
}

export interface PettyCashInput {
  entry_type: PettyCashEntryType
  amount: number
  entry_date: string
  description: string
}

function validatePetty(input: PettyCashInput) {
  if (!['cash_in', 'cash_out', 'charge'].includes(input.entry_type)) throw invalid('entry_type', 'Choose an entry type')
  if (!(input.amount > 0)) throw invalid('amount', 'Amount must be greater than zero')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.entry_date ?? '')) throw invalid('entry_date', 'Enter a valid date')
}

export function createPettyCash(db: MockDb, input: PettyCashInput, actorId: string): PettyCashEntry {
  validatePetty(input)
  const e: PettyCashEntry = {
    id: nextId(db, 'pc'),
    entry_type: input.entry_type,
    amount: input.amount,
    entry_date: input.entry_date,
    description: input.description?.trim() ?? '',
    created_by: actorId,
    created_at: now(),
    import_key: null,
  }
  db.pettyCash.push(e)
  return e
}

export function updatePettyCash(db: MockDb, id: string, input: PettyCashInput): PettyCashEntry {
  const e = db.pettyCash.find((p) => p.id === id)
  if (!e) throw notFound('Entry')
  validatePetty(input)
  Object.assign(e, { ...input, description: input.description?.trim() ?? '' })
  return e
}

export function deletePettyCash(db: MockDb, id: string): void {
  if (!db.pettyCash.some((p) => p.id === id)) throw notFound('Entry')
  db.pettyCash = db.pettyCash.filter((p) => p.id !== id)
}

export function setOpeningBalance(db: MockDb, input: { amount: number; month: number; year: number }) {
  if (!Number.isFinite(input.amount)) throw invalid('amount', 'Enter an amount')
  if (!(input.month >= 1 && input.month <= 12)) throw invalid('month', 'Choose a month')
  db.opening = { amount: input.amount, month: input.month, year: input.year }
  return db.opening
}

// ---------------- Dashboard & reports ----------------
export function dashboard(db: MockDb, month: number, year: number): DashboardData {
  const startDay = db.settings.period_start_day
  const monthExpenses = expensesInPeriod(db.expenses, month, year, startDay)
  const byCategory = spendByCategory(monthExpenses, db.categories)
  const split = splitByType(monthExpenses)
  const pc = pettyCashMonth(db, month, year)
  const pending = db.items.filter((i) => i.status === 'pending')
  return {
    month,
    year,
    total_spent: sumTotals(monthExpenses),
    record_count: monthExpenses.length,
    largest_category: byCategory[0] ?? null,
    individual_total: split.individual,
    shared_total: split.shared,
    petty_cash_balance: pc.summary.closing_balance,
    active_users: db.users.filter((u) => u.is_active).length,
    active_categories: db.categories.filter((c) => c.is_active).length,
    pending_items: pending.length,
    by_category: byCategory,
    monthly_trend: monthlyTrend(db.expenses, year, startDay),
    by_employee: spendByEmployee(monthExpenses, db.users),
    recent_expenses: [...monthExpenses].sort((a, b) => b.expense_date.localeCompare(a.expense_date) || b.created_at.localeCompare(a.created_at)).slice(0, 6),
    pending_suggestions: pending.slice(0, 5),
  }
}

export function monthlyReport(db: MockDb, month: number, year: number, createdBy?: string) {
  const expenses = createdBy ? db.expenses.filter((e) => e.created_by === createdBy) : db.expenses
  return buildMonthlyReport({
    expenses,
    categories: db.categories,
    items: db.items,
    month,
    year,
    pettyCash: pettyCashMonth(db, month, year).summary,
    organisationName: db.settings.organisation_name,
    currency: db.settings.currency,
    startDay: db.settings.period_start_day,
  })
}

export function annualReport(db: MockDb, year: number) {
  return buildAnnualReport({ expenses: db.expenses, categories: db.categories, items: db.items, year, startDay: db.settings.period_start_day })
}

// ---------------- Import (idempotent) ----------------
export function applyImport(db: MockDb, payload: ImportPayload, actorId: string): ImportResultCounts {
  const counts: ImportResultCounts = { categories_created: 0, items_created: 0, expenses_created: 0, petty_cash_created: 0, skipped_duplicates: 0 }
  const catIdByName = new Map<string, string>()
  for (const c of payload.categories) {
    let cat = db.categories.find((x) => nameKey(x.name) === nameKey(c.name))
    if (!cat) {
      cat = createCategory(db, { name: c.name })
      counts.categories_created += 1
    }
    catIdByName.set(c.name, cat.id)
  }
  const itemIdByKey = new Map<string, { id: string; name: string; category_id: string }>()
  for (const it of payload.items) {
    const categoryId = catIdByName.get(it.category)
    if (!categoryId) continue
    let item = db.items.find((x) => x.category_id === categoryId && nameKey(x.name) === nameKey(it.name))
    if (!item) {
      item = { id: nextId(db, 'itm'), category_id: categoryId, name: it.name, status: 'approved', usage_count: 0, suggested_by: null, created_at: now() }
      db.items.push(item)
      counts.items_created += 1
    }
    itemIdByKey.set(it.key, { id: item.id, name: item.name, category_id: categoryId })
  }
  const existingKeys = new Set(db.expenses.map((e) => e.import_key).filter(Boolean))
  for (const e of payload.expenses) {
    if (existingKeys.has(e.import_key)) {
      counts.skipped_duplicates += 1
      continue
    }
    const item = itemIdByKey.get(e.item_key)
    if (!item) continue
    const at = now()
    db.expenses.push({
      id: nextId(db, 'exp'),
      category_id: item.category_id,
      item_id: item.id,
      item_name: item.name,
      unit_cost: e.unit_cost,
      quantity: e.quantity,
      total: lineTotal(e.unit_cost, e.quantity),
      description: e.description,
      expense_date: e.expense_date,
      expense_type: 'shared_operational',
      created_by: actorId,
      incurred_by: null,
      notes: null,
      created_at: at,
      updated_at: at,
      updated_by: null,
      import_key: e.import_key,
    })
    existingKeys.add(e.import_key)
    counts.expenses_created += 1
  }
  const pcKeys = new Set(db.pettyCash.map((p) => p.import_key).filter(Boolean))
  for (const p of payload.petty_cash) {
    if (pcKeys.has(p.import_key)) {
      counts.skipped_duplicates += 1
      continue
    }
    db.pettyCash.push({ id: nextId(db, 'pc'), ...p, created_by: actorId, created_at: now() })
    pcKeys.add(p.import_key)
    counts.petty_cash_created += 1
  }
  if (payload.opening_balance && !db.opening) db.opening = payload.opening_balance
  recountUsage(db)
  return counts
}

// ---------------- Settings & profile ----------------
export function updateSettings(db: MockDb, input: Partial<Settings>): Settings {
  if (input.organisation_name !== undefined) {
    if (!input.organisation_name.trim()) throw invalid('organisation_name', 'Organisation name is required')
    db.settings.organisation_name = input.organisation_name.trim()
  }
  if (input.currency !== undefined) {
    if (!/^[A-Z]{3}$/.test(input.currency)) throw invalid('currency', 'Use a 3-letter currency code')
    db.settings.currency = input.currency
  }
  if (input.period_start_day !== undefined) {
    if (!(input.period_start_day >= 1 && input.period_start_day <= 28)) throw invalid('period_start_day', 'Choose a day between 1 and 28')
    db.settings.period_start_day = Math.round(input.period_start_day)
  }
  return db.settings
}

export function updateProfile(db: MockDb, actorId: string, input: { full_name?: string; email?: string }): User {
  return updateUser(db, actorId, input, actorId)
}

export function changePassword(db: MockDb, actorId: string, current: string, next: string): void {
  const user = db.users.find((u) => u.id === actorId)
  if (!user) throw notFound('User')
  if (user.password !== current) throw invalid('current_password', 'Current password is incorrect')
  if (!next || next.length < 8) throw invalid('new_password', 'New password must be at least 8 characters')
  user.password = next
}

export function setAvatar(db: MockDb, actorId: string, dataUrl: string | null): User {
  const user = db.users.find((u) => u.id === actorId)
  if (!user) throw notFound('User')
  user.profile_picture = dataUrl
  return publicUser(user)
}

