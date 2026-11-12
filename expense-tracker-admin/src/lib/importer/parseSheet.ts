import { parseLegacyAmount, parseQuantity, type LegacyAmountResult } from './parseLegacyAmount'
import { parseLegacyDate } from './parseLegacyDate'
import { cleanName, isNearDuplicate, levenshtein, nameKey } from './names'
import type {
  Anomaly,
  AnomalyKind,
  CellValue,
  MonthSummary,
  ParseResult,
  ParsedCategory,
  ParsedExpense,
  ParsedItem,
  ParsedPettyCashEntry,
  Severity,
  SheetGrid,
} from './types'
import { MONTH_NAMES } from '../formatters'

/** The four seed categories. The sheet's labels are matched to these, never extended silently. */
export const SEED_CATEGORIES = [
  'Office Supplies',
  'Kitchen Supplies',
  'Cleaning & Hygiene Supplies',
  'Other',
] as const

export interface ParseOptions {
  /** Year of the sheet. When omitted it is inferred from the dates (most common year), else 2026. */
  year?: number
  seedCategories?: readonly string[]
}

const BLOCK_WIDTH = 5
const HEADER_ROW = 3
const FIRST_DATA_ROW = 5

export function columnLetter(col: number): string {
  let s = ''
  let n = col
  while (n > 0) {
    const r = (n - 1) % 26
    s = String.fromCharCode(65 + r) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

const text = (v: CellValue): string => {
  if (v === null) return ''
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return String(v)
}

const isBlank = (v: CellValue) => v === null || (typeof v === 'string' && v.trim() === '')

const money = (p: number) => `GH₵ ${(p / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const lettersOnly = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '')

type PettySection = 'balance_before' | 'cash_in' | 'cash_out' | 'balance_after' | 'cash_used'

function pettySection(label: string): PettySection | null {
  const l = label.toLowerCase()
  if (/balance\s*before/.test(l)) return 'balance_before'
  if (/balance\s*after/.test(l)) return 'balance_after'
  if (/total.*cash\s*used/.test(l)) return 'cash_used'
  if (/cash\s*-?\s*out/.test(l)) return 'cash_out'
  if (/cash\s*-?\s*in/.test(l)) return 'cash_in'
  return null
}

interface MonthBlock {
  month: number
  col: number
}

export function parseExpenditureSheet(grid: SheetGrid, options: ParseOptions = {}): ParseResult {
  const seeds = options.seedCategories ?? SEED_CATEGORIES
  const anomalies: Anomaly[] = []
  const sheet = grid.name || 'Sheet1'
  const cellRef = (row: number, col: number) => `${sheet}!${columnLetter(col)}${row}`
  const rangeRef = (row: number, col: number, width: number) =>
    `${sheet}!${columnLetter(col)}${row}:${columnLetter(col + width - 1)}${row}`
  let seq = 0
  const flag = (
    severity: Severity,
    kind: AnomalyKind,
    location: string,
    month: number | null,
    problem: string,
    suggestion: string,
    raw?: string,
  ) => {
    seq += 1
    anomalies.push({ id: `A${String(seq).padStart(4, '0')}`, severity, kind, location, month, problem, suggestion, raw })
  }

  // ---- 1. Month blocks from the header row ----
  const blocks: MonthBlock[] = []
  let prevLabel = ''
  for (let c = 3; c <= Math.max(grid.columnCount, 3 + 12 * BLOCK_WIDTH); c++) {
    const label = text(grid.getCell(HEADER_ROW, c)).trim()
    const idx = MONTH_NAMES.findIndex((m) => m.toLowerCase() === label.toLowerCase())
    if (idx >= 0 && label.toLowerCase() !== prevLabel.toLowerCase()) blocks.push({ month: idx + 1, col: c })
    prevLabel = label
  }
  if (blocks.length === 0) {
    // Fall back to the documented layout (January in C, 5 columns per month).
    for (let m = 0; m < 12; m++) blocks.push({ month: m + 1, col: 3 + m * BLOCK_WIDTH })
    flag('error', 'layout', `${sheet}!C${HEADER_ROW}`, null, 'No month names found in row 3', 'Check that the file uses the Expenditure Tracker layout; the standard column positions were assumed')
  }
  blocks.forEach((b, i) => {
    const expected = 3 + (b.month - 1) * BLOCK_WIDTH
    if (b.col !== expected || (i > 0 && blocks[i - 1]!.month !== b.month - 1)) {
      flag('warning', 'layout', cellRef(HEADER_ROW, b.col), b.month, `${MONTH_NAMES[b.month - 1]} block starts at column ${columnLetter(b.col)} (expected ${columnLetter(expected)})`, 'Verify the month headers; the detected position was used')
    }
  })

  // ---- 2. Locate sections ----
  let pettyStart = grid.rowCount + 1
  let grandTotalRow = -1
  for (let r = FIRST_DATA_ROW; r <= grid.rowCount; r++) {
    const a = text(grid.getCell(r, 1))
    if (pettyStart > grid.rowCount && /petty\s*cash/i.test(a)) pettyStart = r
    if (/grand\s*total/i.test(a)) grandTotalRow = r
  }

  // ---- 3. Year ----
  let year = options.year
  if (!year) {
    const counts = new Map<number, number>()
    for (let r = FIRST_DATA_ROW; r <= grid.rowCount; r++) {
      for (const b of blocks) {
        const v = grid.getCell(r, b.col + 4)
        if (v instanceof Date) counts.set(v.getUTCFullYear(), (counts.get(v.getUTCFullYear()) ?? 0) + 1)
      }
    }
    year = [...counts.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] ?? 2026
  }

  // ---- 4. Categories ----
  const categories: ParsedCategory[] = []
  const categoryByLabel = new Map<string, string>()
  const resolveCategory = (label: string, row: number): string => {
    const clean = cleanName(label)
    const cached = categoryByLabel.get(clean.toLowerCase())
    if (cached) return cached
    const target = lettersOnly(clean)
    let match = seeds.find((s) => lettersOnly(s) === target)
    if (!match) {
      match = seeds.find((s) => levenshtein(lettersOnly(s), target) <= 2)
    }
    let name: string
    if (match) {
      name = match
      if (match !== clean) {
        flag('info', 'category_mapped', cellRef(row, 1), null, `Category label "${clean}" mapped to seed category "${match}"`, 'No action needed; fix the label in the sheet if it is a typo')
      }
    } else {
      name = clean
      flag('warning', 'category_new', cellRef(row, 1), null, `Category "${clean}" is not one of the seed categories`, 'It will be created on import; merge or rename it afterwards if needed', clean)
    }
    categoryByLabel.set(clean.toLowerCase(), name)
    if (!categories.some((c) => c.name === name)) {
      categories.push({ name, sort_order: categories.length + 1, sheet_label: clean })
    }
    return name
  }

  // ---- 5. Items + expenses ----
  const items = new Map<string, ParsedItem>()
  const itemNamesSeen = new Map<string, Set<string>>() // key -> raw variants
  const expenses: ParsedExpense[] = []
  const keyCounts = new Map<string, number>()
  const uniqueKey = (base: string) => {
    const n = (keyCounts.get(base) ?? 0) + 1
    keyCounts.set(base, n)
    return n === 1 ? base : `${base}#${n}`
  }

  const amountIssue = (res: LegacyAmountResult, row: number, col: number, month: number, what: string) => {
    if (res.status === 'invalid') {
      flag('error', 'unparseable_amount', cellRef(row, col), month, `${what} "${res.raw}" could not be read: ${res.reason}`, 'Correct the value in the sheet or enter the record manually', res.raw)
    } else if (res.status === 'ok' && res.notes.length) {
      flag('info', 'amount_format', cellRef(row, col), month, `${what} "${text(grid.getCell(row, col))}": ${res.notes.join('; ')}`, `Read as ${money(res.pesewas)}; verify`, text(grid.getCell(row, col)))
    }
  }

  let category: string | null = null
  let item: ParsedItem | null = null
  const lastDataRow = Math.min(pettyStart - 1, grandTotalRow > 0 ? grandTotalRow - 1 : grid.rowCount)

  for (let r = FIRST_DATA_ROW; r <= lastDataRow; r++) {
    const aVal = grid.getCell(r, 1)
    if (!isBlank(aVal)) {
      const next = resolveCategory(text(aVal), r)
      if (next !== category) item = null
      category = next
    }
    const bVal = grid.getCell(r, 2)
    if (!isBlank(bVal)) {
      if (!category) {
        flag('error', 'orphan_entry', cellRef(r, 2), null, `Item "${text(bVal)}" has no category above it`, 'Add the category in column A')
        continue
      }
      const rawName = text(bVal)
      const name = cleanName(rawName)
      const key = `${category.toLowerCase()}|${nameKey(name)}`
      if (rawName !== name) {
        flag('info', 'name_whitespace', cellRef(r, 2), null, `Item name "${rawName}" has extra spaces; stored as "${name}"`, 'No action needed')
      }
      const existing = items.get(key)
      if (existing) {
        if (existing.name !== name) {
          flag('info', 'name_case_variant', cellRef(r, 2), null, `"${name}" differs only in case from "${existing.name}" (${existing.first_cell}); treated as the same item`, 'No action needed')
        }
        item = existing
      } else {
        item = { key, category, name, first_cell: cellRef(r, 2) }
        items.set(key, item)
      }
      const variants = itemNamesSeen.get(key) ?? new Set<string>()
      variants.add(rawName)
      itemNamesSeen.set(key, variants)
    }

    for (const b of blocks) {
      const c = b.col
      const vals = [0, 1, 2, 3, 4].map((o) => grid.getCell(r, c + o))
      if (vals.every(isBlank)) continue
      const [uRaw, qRaw, dRaw, tRaw, dateRaw] = vals as [CellValue, CellValue, CellValue, CellValue, CellValue]
      const where = rangeRef(r, c, BLOCK_WIDTH)
      if (!item || !category) {
        flag('error', 'orphan_entry', where, b.month, 'Entry has no item in column B', 'Enter the record manually under the correct item')
        continue
      }
      const unit = parseLegacyAmount(uRaw)
      const qty = parseQuantity(qRaw)
      const total = parseLegacyAmount(tRaw)
      amountIssue(unit, r, c, b.month, 'Unit cost')
      amountIssue(total, r, c + 3, b.month, 'Total price')
      if (qty.status === 'invalid') {
        flag('error', 'unparseable_amount', cellRef(r, c + 1), b.month, `Quantity "${qty.raw}" could not be read`, 'Correct the quantity', qty.raw)
      }

      const date = parseLegacyDate(dateRaw, b.month, year)
      if (date.status === 'invalid') {
        flag('error', 'unparseable_date', cellRef(r, c + 4), b.month, `Date "${date.raw}" could not be read: ${date.reason}`, 'Enter the record manually with the correct date', date.raw)
      } else if (date.status === 'ok') {
        for (const issue of date.issues) {
          flag(issue.kind === 'month_mismatch' ? 'warning' : 'warning', issue.kind, cellRef(r, c + 4), b.month, issue.message, issue.kind === 'month_mismatch' ? 'Month block kept as the source of truth; check the original receipt' : 'Verify the date')
        }
      }

      const missing: string[] = []
      if (unit.status === 'empty') missing.push('unit cost')
      if (qty.status === 'empty') missing.push('quantity')
      if (date.status === 'empty') missing.push('date')
      if (missing.length) {
        flag('error', 'missing_value', where, b.month, `Entry for "${item.name}" is missing ${missing.join(', ')}; not imported`, 'Missing values are never invented — enter this record manually if it is real', vals.map(text).filter(Boolean).join(' | '))
        continue
      }
      if (unit.status !== 'ok' || qty.status !== 'ok' || date.status !== 'ok') {
        flag('error', 'missing_value', where, b.month, `Entry for "${item.name}" not imported because a value could not be read`, 'Fix the flagged cell and re-import, or enter the record manually')
        continue
      }

      const unitP = unit.pesewas
      const computedP = Math.round((unitP * Math.round(qty.value * 1000)) / 1000)
      let sheetTotal: number | null = null
      if (total.status === 'ok') {
        sheetTotal = total.value
        if (total.pesewas !== computedP) {
          flag('warning', 'total_mismatch', cellRef(r, c + 3), b.month, `Total ${money(total.pesewas)} ≠ ${money(unitP)} × ${qty.value} = ${money(computedP)}`, 'The computed total is used; check the receipt if the unit cost or quantity is wrong', text(tRaw))
        }
      } else if (total.status === 'empty') {
        flag('info', 'missing_total', cellRef(r, c + 3), b.month, 'Total price is blank', `Computed as ${money(computedP)}`)
      }

      const description = cleanName(text(dRaw))
      const base = `exp|${date.iso}|${category.toLowerCase()}|${nameKey(item.name)}|${unitP}|${qty.value}|${description.toLowerCase()}`
      expenses.push({
        import_key: uniqueKey(base),
        category,
        item_key: item.key,
        item_name: item.name,
        unit_cost: unitP / 100,
        quantity: qty.value,
        total: computedP / 100,
        sheet_total: sheetTotal,
        description,
        expense_date: date.iso,
        month: b.month,
        location: where,
      })
    }
  }

  // Duplicates across categories and near-duplicates.
  const itemList = [...items.values()]
  for (let i = 0; i < itemList.length; i++) {
    for (let j = i + 1; j < itemList.length; j++) {
      const x = itemList[i]!
      const y = itemList[j]!
      if (nameKey(x.name) === nameKey(y.name)) {
        flag('warning', 'duplicate_across_categories', y.first_cell, null, `"${y.name}" appears under both "${x.category}" (${x.first_cell}) and "${y.category}"`, 'Kept as two items; merge them on the Items screen if they are the same thing')
      } else if (isNearDuplicate(x.name, y.name)) {
        flag('info', 'near_duplicate', y.first_cell, null, `"${y.name}" looks similar to "${x.name}" (${x.first_cell})`, 'Possible duplicate or typo — review and merge on the Items screen if needed')
      }
    }
  }

  // ---- 6. Petty cash ----
  const petty: ParsedPettyCashEntry[] = []
  type Point = { amount: number; date: string; row: number; month: number }
  const balanceBefore: Point[] = []
  const balanceAfter: Point[] = []
  const cashUsed = new Map<number, number>()
  let section: PettySection | null = null
  const pettyEnd = grandTotalRow > 0 ? grandTotalRow - 1 : grid.rowCount

  for (let r = pettyStart; r <= pettyEnd; r++) {
    const label = text(grid.getCell(r, 2))
    if (label.trim()) {
      const s = pettySection(label)
      if (s) section = s
    }
    if (!section) continue
    for (const b of blocks) {
      const c = b.col
      const descRaw = grid.getCell(r, c + 2)
      const amtRaw = grid.getCell(r, c + 3)
      const dateRaw = grid.getCell(r, c + 4)
      if (isBlank(amtRaw) && isBlank(dateRaw) && isBlank(descRaw)) continue
      const amount = parseLegacyAmount(amtRaw)
      amountIssue(amount, r, c + 3, b.month, 'Petty cash amount')
      const date = parseLegacyDate(dateRaw, b.month, year)
      if (date.status === 'invalid') {
        flag('error', 'unparseable_date', cellRef(r, c + 4), b.month, `Petty cash date "${date.raw}" could not be read: ${date.reason}`, 'Enter the entry manually with the correct date', date.raw)
      } else if (date.status === 'ok') {
        for (const issue of date.issues) {
          flag('warning', issue.kind, cellRef(r, c + 4), b.month, `Petty cash: ${issue.message}`, issue.kind === 'month_mismatch' ? 'Month block kept as the source of truth' : 'Verify the date')
        }
      }
      if (amount.status !== 'ok' || date.status !== 'ok') {
        if (amount.status === 'empty' || date.status === 'empty') {
          flag('error', 'missing_value', rangeRef(r, c + 2, 3), b.month, `Petty cash row is missing ${amount.status === 'empty' ? 'an amount' : 'a date'}; not imported`, 'Missing values are never invented — enter manually if real')
        }
        continue
      }
      const point = { amount: amount.value, date: date.iso, row: r, month: b.month }
      if (section === 'balance_before') balanceBefore.push(point)
      else if (section === 'balance_after') balanceAfter.push(point)
      else if (section === 'cash_used') cashUsed.set(b.month, (cashUsed.get(b.month) ?? 0) + amount.pesewas)
      else {
        const description = cleanName(text(descRaw))
        const base = `pc|${section}|${date.iso}|${amount.pesewas}|${description.toLowerCase()}`
        petty.push({
          import_key: uniqueKey(base),
          entry_type: section,
          amount: amount.value,
          entry_date: date.iso,
          description,
          month: b.month,
          location: cellRef(r, c + 3),
        })
      }
    }
  }

  // ---- 7. Grand totals ----
  const grandTotals = new Map<number, number>()
  if (grandTotalRow > 0) {
    for (const b of blocks) {
      const raw = grid.getCell(grandTotalRow, b.col + 3)
      const res = parseLegacyAmount(raw)
      amountIssue(res, grandTotalRow, b.col + 3, b.month, 'Grand total')
      if (res.status === 'ok') grandTotals.set(b.month, res.pesewas)
    }
  } else {
    flag('info', 'layout', `${sheet}!A${grid.rowCount}`, null, 'No "GRAND TOTAL" row found', 'Totals are computed from the records')
  }

  // ---- 8. Opening balance + monthly reconciliation ----
  const pettyMonths = [...new Set([...petty.map((p) => p.month), ...balanceAfter.map((p) => p.month)])].sort((a, b) => a - b)
  let opening: ParseResult['opening_balance'] = null
  const firstMonth = pettyMonths[0]
  if (firstMonth !== undefined) {
    const afterPoints = balanceAfter
      .filter((p) => p.month === firstMonth)
      .sort((a, b) => a.date.localeCompare(b.date) || a.row - b.row)
    const first = afterPoints[0]
    if (first) {
      const upTo = petty.filter((p) => p.month === firstMonth && p.entry_date <= first.date)
      const outP = upTo.filter((p) => p.entry_type !== 'cash_in').reduce((s, p) => s + Math.round(p.amount * 100), 0)
      const inP = upTo.filter((p) => p.entry_type === 'cash_in').reduce((s, p) => s + Math.round(p.amount * 100), 0)
      const openingP = Math.round(first.amount * 100) + outP - inP
      opening = { amount: openingP / 100, month: firstMonth, year }
      flag('info', 'opening_balance', cellRef(first.row, blocks.find((b) => b.month === firstMonth)!.col + 3), firstMonth, `Opening balance derived as ${money(openingP)}: first "Balance after cash-out" (${money(Math.round(first.amount * 100))} on ${first.date}) plus cash-out minus cash-in recorded up to that date`, 'Confirm it on the Petty Cash screen ("Set opening balance")')
    } else {
      const bb = balanceBefore.filter((p) => p.month === firstMonth).sort((a, b) => a.date.localeCompare(b.date))[0]
      flag('warning', 'opening_balance', `${sheet}!B${pettyStart}`, firstMonth, bb ? `No "Balance after cash-out" to derive the opening balance from (first "Balance before cash-in" is ${money(Math.round(bb.amount * 100))})` : 'No balance figures found to derive the opening balance', 'Set the opening balance manually on the Petty Cash screen')
    }
  }

  const months: MonthSummary[] = []
  let runningP = opening ? Math.round(opening.amount * 100) : 0
  for (const b of blocks) {
    const m = b.month
    const monthExpenses = expenses.filter((e) => e.month === m)
    const expTotalP = monthExpenses.reduce((s, e) => s + Math.round(e.total * 100), 0)
    const monthPetty = petty.filter((p) => p.month === m)
    const inP = monthPetty.filter((p) => p.entry_type === 'cash_in').reduce((s, p) => s + Math.round(p.amount * 100), 0)
    const outP = monthPetty.filter((p) => p.entry_type !== 'cash_in').reduce((s, p) => s + Math.round(p.amount * 100), 0)
    const gt = grandTotals.get(m) ?? null
    const used = cashUsed.get(m) ?? null
    months.push({
      month: m,
      expenses: monthExpenses.length,
      expense_total: expTotalP / 100,
      petty_cash_entries: monthPetty.length,
      cash_in: inP / 100,
      cash_out: outP / 100,
      sheet_grand_total: gt === null ? null : gt / 100,
      sheet_cash_used: used === null ? null : used / 100,
    })
    const gtCol = b.col + 3
    if (gt !== null && gt !== expTotalP) {
      flag('warning', 'grand_total_mismatch', cellRef(grandTotalRow, gtCol), m, `${MONTH_NAMES[m - 1]}: hand-typed grand total ${money(gt)} ≠ computed sum of imported expenses ${money(expTotalP)} (difference ${money(gt - expTotalP)})`, 'The app always uses the computed total; review skipped or mismatched rows for this month')
    }
    if (gt !== null && used !== null && gt !== used) {
      flag('info', 'grand_total_mismatch', cellRef(grandTotalRow, gtCol), m, `${MONTH_NAMES[m - 1]}: grand total ${money(gt)} ≠ sum of the "TOTAL (Cash used)" rows ${money(used)}`, 'Informational — the hand-typed totals disagree with each other')
    }
    if (used !== null && outP > 0 && used !== outP) {
      flag('info', 'petty_cash_mismatch', `${sheet}!${columnLetter(gtCol)}${pettyStart}`, m, `${MONTH_NAMES[m - 1]}: "Cash used without charges" rows sum to ${money(used)} but cash-out rows sum to ${money(outP)}`, 'Charges were not itemised in the sheet; add charge entries on the Petty Cash screen if known')
    }
    if (monthPetty.length || balanceAfter.some((p) => p.month === m)) {
      runningP = runningP + inP - outP
      const lastAfter = balanceAfter
        .filter((p) => p.month === m)
        .sort((x, y) => x.date.localeCompare(y.date) || x.row - y.row)
        .at(-1)
      if (lastAfter && Math.round(lastAfter.amount * 100) !== runningP) {
        flag('warning', 'petty_cash_mismatch', cellRef(lastAfter.row, gtCol), m, `${MONTH_NAMES[m - 1]}: computed closing balance ${money(runningP)} ≠ sheet's last "Balance after cash-out" ${money(Math.round(lastAfter.amount * 100))}`, 'Cash-ins or cash-outs are probably missing from the sheet; reconcile on the Petty Cash screen')
      }
    }
  }

  return {
    sheet_name: sheet,
    year,
    categories,
    items: itemList,
    expenses,
    petty_cash: petty,
    opening_balance: opening,
    anomalies,
    months,
  }
}
