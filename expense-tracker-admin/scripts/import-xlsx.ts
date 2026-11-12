/**
 * Parses docs/expenditure.xlsx (the legacy "Expenditure Tracker") into seed JSON for the mock API
 * and writes docs/import-report.md listing every anomaly.
 *
 *   npm run import:xlsx                       # defaults
 *   npm run import:xlsx -- path/to/file.xlsx  # another file
 *
 * Uses exactly the same parser as the in-app Data Import screen (src/lib/importer).
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ExcelJS from 'exceljs'
import {
  buildImportReport,
  parseExpenditureSheet,
  pickWorksheet,
  worksheetToGrid,
} from '../src/lib/importer/index'
import type { ParseResult } from '../src/lib/importer/types'
import type { Category, Expense, Item, PettyCashEntry } from '../src/types/index'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ADMIN_ID = 'usr_admin'

export interface SeedData {
  categories: Category[]
  items: Item[]
  expenses: Expense[]
  pettyCash: PettyCashEntry[]
  openingBalance: { amount: number; month: number; year: number } | null
}

/** Converts a parse result into API-shaped seed records with deterministic ids. */
export function toSeed(result: ParseResult, importedAt: string): SeedData {
  const categories: Category[] = result.categories.map((c, i) => ({
    id: `cat_${i + 1}`,
    name: c.name,
    description: '',
    is_active: true,
    sort_order: c.sort_order,
    created_at: importedAt,
  }))
  const catId = new Map(categories.map((c) => [c.name, c.id]))

  const usage = new Map<string, number>()
  for (const e of result.expenses) usage.set(e.item_key, (usage.get(e.item_key) ?? 0) + 1)

  const items: Item[] = result.items.map((it, i) => ({
    id: `itm_${i + 1}`,
    category_id: catId.get(it.category)!,
    name: it.name,
    status: 'approved',
    usage_count: usage.get(it.key) ?? 0,
    suggested_by: null,
    created_at: importedAt,
  }))
  const itemByKey = new Map(result.items.map((it, i) => [it.key, items[i]!]))

  const expenses: Expense[] = result.expenses.map((e, i) => {
    const item = itemByKey.get(e.item_key)!
    return {
      id: `exp_${String(i + 1).padStart(4, '0')}`,
      category_id: catId.get(e.category)!,
      item_id: item.id,
      item_name: item.name,
      unit_cost: e.unit_cost,
      quantity: e.quantity,
      total: e.total,
      description: e.description,
      expense_date: e.expense_date,
      expense_type: 'shared_operational',
      created_by: ADMIN_ID,
      incurred_by: null,
      notes: e.sheet_total !== null && e.sheet_total !== e.total ? `Imported: sheet total was ${e.sheet_total.toFixed(2)} (${e.location})` : null,
      created_at: importedAt,
      updated_at: importedAt,
      updated_by: null,
      import_key: e.import_key,
    }
  })

  const pettyCash: PettyCashEntry[] = result.petty_cash.map((p, i) => ({
    id: `pc_${String(i + 1).padStart(4, '0')}`,
    entry_type: p.entry_type,
    amount: p.amount,
    entry_date: p.entry_date,
    description: p.description,
    created_by: ADMIN_ID,
    created_at: importedAt,
    import_key: p.import_key,
  }))

  return { categories, items, expenses, pettyCash, openingBalance: result.opening_balance }
}

async function main() {
  const input = path.resolve(root, process.argv[2] ?? 'docs/expenditure.xlsx')
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(input)
  const ws = pickWorksheet(wb)
  if (!ws) throw new Error(`No worksheet found in ${input}`)

  const result = parseExpenditureSheet(worksheetToGrid(ws))
  const importedAt = new Date().toISOString()
  const seed = toSeed(result, importedAt)

  const seedDir = path.join(root, 'src/mocks/seed')
  await mkdir(seedDir, { recursive: true })
  const write = (name: string, data: unknown) =>
    writeFile(path.join(seedDir, name), `${JSON.stringify(data, null, 2)}\n`, 'utf8')
  await write('categories.json', seed.categories)
  await write('items.json', seed.items)
  await write('expenses.json', seed.expenses)
  await write('petty-cash.json', seed.pettyCash)
  await write('opening-balance.json', seed.openingBalance)

  const report = buildImportReport(result, path.relative(root, input).replace(/\\/g, '/'), importedAt)
  await writeFile(path.join(root, 'docs/import-report.md'), `${report}\n`, 'utf8')

  const errors = result.anomalies.filter((a) => a.severity === 'error').length
  const warnings = result.anomalies.filter((a) => a.severity === 'warning').length
  console.log(
    `Parsed ${seed.categories.length} categories, ${seed.items.length} items, ${seed.expenses.length} expenses, ` +
      `${seed.pettyCash.length} petty cash entries. Anomalies: ${result.anomalies.length} (${errors} errors, ${warnings} warnings).`,
  )
  console.log('Seed JSON -> src/mocks/seed/, report -> docs/import-report.md')
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) {
  main().catch((err: unknown) => {
    console.error(err)
    process.exit(1)
  })
}

