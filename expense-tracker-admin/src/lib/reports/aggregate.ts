import type {
  AnnualReport,
  AnnualRow,
  Category,
  CategorySpend,
  EmployeeSpend,
  Expense,
  Item,
  MonthTotal,
  MonthlyReport,
  PettyCashSummary,
  ReportCategoryGroup,
  User,
} from '@/types'
import { fromPesewas, toPesewas } from '@/lib/money'
import { inPeriod, periodOf, periodRange } from './period'

export function expensesInPeriod(expenses: readonly Expense[], month: number, year: number, startDay = 1): Expense[] {
  const p = periodRange(month, year, startDay)
  return expenses.filter((e) => inPeriod(e.expense_date, p))
}

export function sumTotals(expenses: readonly Expense[]): number {
  return fromPesewas(expenses.reduce((s, e) => s + toPesewas(e.total), 0))
}

const bySort = (a: Category, b: Category) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)

export function spendByCategory(expenses: readonly Expense[], categories: readonly Category[]): CategorySpend[] {
  const totals = new Map<string, { p: number; n: number }>()
  for (const e of expenses) {
    const t = totals.get(e.category_id) ?? { p: 0, n: 0 }
    t.p += toPesewas(e.total)
    t.n += 1
    totals.set(e.category_id, t)
  }
  const grand = [...totals.values()].reduce((s, t) => s + t.p, 0)
  return [...categories]
    .sort(bySort)
    .filter((c) => totals.has(c.id))
    .map((c) => {
      const t = totals.get(c.id)!
      return {
        category_id: c.id,
        name: c.name,
        total: fromPesewas(t.p),
        count: t.n,
        percent: grand ? (t.p / grand) * 100 : 0,
      }
    })
    .sort((a, b) => b.total - a.total)
}

export function monthlyTrend(expenses: readonly Expense[], year: number, startDay = 1): MonthTotal[] {
  const months = Array.from({ length: 12 }, () => 0)
  for (const e of expenses) {
    const p = periodOf(e.expense_date, startDay)
    if (p.year === year) months[p.month - 1]! += toPesewas(e.total)
  }
  return months.map((p, i) => ({ month: i + 1, total: fromPesewas(p) }))
}

export function spendByEmployee(expenses: readonly Expense[], users: readonly Pick<User, 'id' | 'full_name'>[]): EmployeeSpend[] {
  const totals = new Map<string, { p: number; n: number }>()
  for (const e of expenses) {
    const t = totals.get(e.created_by) ?? { p: 0, n: 0 }
    t.p += toPesewas(e.total)
    t.n += 1
    totals.set(e.created_by, t)
  }
  return [...totals.entries()]
    .map(([id, t]) => ({
      user_id: id,
      full_name: users.find((u) => u.id === id)?.full_name ?? 'Unknown user',
      total: fromPesewas(t.p),
      count: t.n,
    }))
    .sort((a, b) => b.total - a.total)
}

export function splitByType(expenses: readonly Expense[]): { individual: number; shared: number } {
  let i = 0
  let s = 0
  for (const e of expenses) {
    if (e.expense_type === 'individual') i += toPesewas(e.total)
    else s += toPesewas(e.total)
  }
  return { individual: fromPesewas(i), shared: fromPesewas(s) }
}

/** Orders items by the catalog order (which follows the sheet's row order), then name. */
function itemOrder(items: readonly Item[]): Map<string, number> {
  return new Map(items.map((it, i) => [it.id, i]))
}

export function groupForReport(
  expenses: readonly Expense[],
  categories: readonly Category[],
  items: readonly Item[],
): ReportCategoryGroup[] {
  const order = itemOrder(items)
  return [...categories]
    .sort(bySort)
    .map((c) => {
      const catExpenses = expenses.filter((e) => e.category_id === c.id)
      const itemIds = [...new Set(catExpenses.map((e) => e.item_id))].sort(
        (a, b) => (order.get(a) ?? 1e9) - (order.get(b) ?? 1e9),
      )
      const groups = itemIds.map((id) => {
        const entries = catExpenses
          .filter((e) => e.item_id === id)
          .sort((a, b) => a.expense_date.localeCompare(b.expense_date) || a.id.localeCompare(b.id))
        return {
          item_id: id,
          item_name: items.find((i) => i.id === id)?.name ?? entries[0]?.item_name ?? 'Unknown item',
          entries,
          subtotal: sumTotals(entries),
        }
      })
      return { category_id: c.id, name: c.name, items: groups, subtotal: sumTotals(catExpenses) }
    })
    .filter((g) => g.items.length > 0)
}

export function buildMonthlyReport(args: {
  expenses: readonly Expense[]
  categories: readonly Category[]
  items: readonly Item[]
  month: number
  year: number
  pettyCash: PettyCashSummary
  organisationName: string
  currency: string
  startDay?: number
}): MonthlyReport {
  const monthExpenses = expensesInPeriod(args.expenses, args.month, args.year, args.startDay)
  const split = splitByType(monthExpenses)
  return {
    month: args.month,
    year: args.year,
    organisation_name: args.organisationName,
    currency: args.currency,
    categories: groupForReport(monthExpenses, args.categories, args.items),
    grand_total: sumTotals(monthExpenses),
    record_count: monthExpenses.length,
    individual_total: split.individual,
    shared_total: split.shared,
    petty_cash: args.pettyCash,
    by_category: spendByCategory(monthExpenses, args.categories),
  }
}

export function buildAnnualReport(args: {
  expenses: readonly Expense[]
  categories: readonly Category[]
  items: readonly Item[]
  year: number
  startDay?: number
}): AnnualReport {
  const order = itemOrder(args.items)
  const cats = [...args.categories].sort(bySort)
  const rowMap = new Map<string, { row: AnnualRow; p: number[] }>()
  for (const e of args.expenses) {
    const p = periodOf(e.expense_date, args.startDay)
    if (p.year !== args.year) continue
    const key = `${e.category_id}|${e.item_id}`
    let entry = rowMap.get(key)
    if (!entry) {
      const cat = cats.find((c) => c.id === e.category_id)
      entry = {
        row: {
          category_id: e.category_id,
          category_name: cat?.name ?? 'Unknown category',
          item_id: e.item_id,
          item_name: args.items.find((i) => i.id === e.item_id)?.name ?? e.item_name,
          months: [],
          total: 0,
        },
        p: Array.from({ length: 12 }, () => 0),
      }
      rowMap.set(key, entry)
    }
    entry.p[p.month - 1]! += toPesewas(e.total)
  }
  const catIndex = new Map(cats.map((c, i) => [c.id, i]))
  const rows = [...rowMap.values()]
    .map(({ row, p }) => ({ ...row, months: p.map(fromPesewas), total: fromPesewas(p.reduce((s, v) => s + v, 0)) }))
    .sort(
      (a, b) =>
        (catIndex.get(a.category_id) ?? 1e9) - (catIndex.get(b.category_id) ?? 1e9) ||
        (order.get(a.item_id) ?? 1e9) - (order.get(b.item_id) ?? 1e9),
    )

  const category_totals = cats
    .map((c) => {
      const catRows = rows.filter((r) => r.category_id === c.id)
      const months = Array.from({ length: 12 }, (_, m) => fromPesewas(catRows.reduce((s, r) => s + toPesewas(r.months[m]!), 0)))
      return { category_id: c.id, name: c.name, months, total: fromPesewas(catRows.reduce((s, r) => s + toPesewas(r.total), 0)) }
    })
    .filter((c) => rows.some((r) => r.category_id === c.category_id))

  const month_totals = Array.from({ length: 12 }, (_, m) => fromPesewas(rows.reduce((s, r) => s + toPesewas(r.months[m]!), 0)))
  return {
    year: args.year,
    rows,
    category_totals,
    month_totals,
    grand_total: fromPesewas(rows.reduce((s, r) => s + toPesewas(r.total), 0)),
  }
}

