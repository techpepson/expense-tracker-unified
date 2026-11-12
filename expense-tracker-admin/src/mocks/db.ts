import type { Category, Expense, Item, PettyCashEntry, Settings } from '@/types'
import { lineTotal } from '@/lib/money'
import type { OpeningBalance } from '@/lib/reports'
import seedCategories from './seed/categories.json'
import seedItems from './seed/items.json'
import seedExpenses from './seed/expenses.json'
import seedPettyCash from './seed/petty-cash.json'
import seedOpening from './seed/opening-balance.json'
import { DEMO_EXPENSE_LINES, SEED_USERS, demoPendingItems, type SeedUser } from './seed/demo'

export interface MockDb {
  version: number
  users: SeedUser[]
  categories: Category[]
  items: Item[]
  expenses: Expense[]
  pettyCash: PettyCashEntry[]
  opening: OpeningBalance | null
  settings: Settings
  tokens: Record<string, string>
  seq: number
}

export const DB_VERSION = 1
export const STORAGE_KEY = 'ecom-admin-mock-db'

export function createSeedDb(): MockDb {
  const categories = structuredClone(seedCategories as Category[])
  const catIds = new Map(categories.map((c) => [c.name, c.id]))
  const items = [...structuredClone(seedItems as Item[]), ...demoPendingItems(catIds)]
  const expenses = structuredClone(seedExpenses as Expense[])

  DEMO_EXPENSE_LINES.forEach((l, i) => {
    const item = items.find((it) => it.name === l.item && it.status === 'approved')
    if (!item) return
    const at = `${l.date}T09:${String(10 + i).padStart(2, '0')}:00.000Z`
    expenses.push({
      id: `exp_demo_${i + 1}`,
      category_id: item.category_id,
      item_id: item.id,
      item_name: item.name,
      unit_cost: l.unit,
      quantity: l.qty,
      total: lineTotal(l.unit, l.qty),
      description: l.description,
      expense_date: l.date,
      expense_type: l.type,
      created_by: l.user,
      incurred_by: l.incurred_by ?? null,
      notes: null,
      created_at: at,
      updated_at: at,
      updated_by: null,
      import_key: null,
    })
  })

  const db: MockDb = {
    version: DB_VERSION,
    users: structuredClone(SEED_USERS),
    categories,
    items,
    expenses,
    pettyCash: structuredClone(seedPettyCash as PettyCashEntry[]),
    opening: (seedOpening as OpeningBalance | null) ?? null,
    settings: { organisation_name: 'e-COM Services', currency: 'GHS', period_start_day: 1 },
    tokens: {},
    seq: 1000,
  }
  recountUsage(db)
  return db
}

export function recountUsage(db: MockDb): void {
  const counts = new Map<string, number>()
  for (const e of db.expenses) counts.set(e.item_id, (counts.get(e.item_id) ?? 0) + 1)
  for (const it of db.items) it.usage_count = counts.get(it.id) ?? 0
}

let memory: MockDb | null = null

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export function loadDb(): MockDb {
  if (memory) return memory
  const raw = storage()?.getItem(STORAGE_KEY)
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as MockDb
      if (parsed.version === DB_VERSION) {
        memory = parsed
        return parsed
      }
    } catch {
      /* fall through to reseed */
    }
  }
  memory = createSeedDb()
  saveDb(memory)
  return memory
}

export function saveDb(db: MockDb): void {
  memory = db
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(db))
  } catch {
    /* quota exceeded: keep in memory only */
  }
}

export function resetDb(): MockDb {
  memory = createSeedDb()
  saveDb(memory)
  return memory
}

/** For tests: use an explicit in-memory database. */
export function setDb(db: MockDb | null): void {
  memory = db
}

export function nextId(db: MockDb, prefix: string): string {
  db.seq += 1
  return `${prefix}_${db.seq}`
}

