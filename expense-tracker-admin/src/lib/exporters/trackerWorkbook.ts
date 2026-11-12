import ExcelJS from 'exceljs'
import type { Category, Expense, Item, PettyCashEntry } from '@/types'
import { MONTH_NAMES } from '@/lib/formatters'
import { columnLetter } from '@/lib/importer/parseSheet'
import { fromPesewas, toPesewas } from '@/lib/money'
import { periodOf, sortEntries } from '@/lib/reports'

export interface TrackerMonthPettyCash {
  opening: number
  entries: PettyCashEntry[]
}

export interface TrackerInput {
  year: number
  /** Month numbers (1-12) to include as 5-column blocks, in order. */
  months: number[]
  categories: Category[]
  items: Item[]
  expenses: Expense[]
  pettyCash: Record<number, TrackerMonthPettyCash>
  organisationName: string
  currency: string
  startDay?: number
}

export const TRACKER_SHEET_NAME = 'Expenditure Tracker'
export const BLOCK_HEADERS = ['Unit Cost', 'Quantity', 'Description', 'Total Price', 'Date'] as const
export const GRAND_TOTAL_LABEL = 'GRAND TOTAL AMOUNT SPENT ON PURCHASE A MONTH'

const NAVY = 'FF1E3A8A'
const LIGHT = 'FFDBEAFE'
const TINT = 'FFEFF6FF'

function utcDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number]
  return new Date(Date.UTC(y, m - 1, d))
}

/**
 * Reproduces the original sheet layout: months as 5-column blocks, categories (merged) and
 * items down the left, stacked rows for repeated entries, a petty cash section and a grand
 * total row. Every amount is a numeric cell; totals are formulas with cached results.
 */
export function buildTrackerWorkbook(input: TrackerInput): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook()
  wb.creator = input.organisationName
  wb.created = new Date()
  const ws = wb.addWorksheet(TRACKER_SHEET_NAME, { views: [{ state: 'frozen', xSplit: 2, ySplit: 4 }] })
  const startDay = input.startDay ?? 1
  const months = [...input.months].sort((a, b) => a - b)
  const moneyFmt = `"${input.currency === 'GHS' ? 'GH₵' : input.currency}" #,##0.00`
  const blockCol = (i: number) => 3 + i * 5
  const lastCol = 2 + months.length * 5
  const L = columnLetter

  ws.getColumn(1).width = 26
  ws.getColumn(2).width = 28
  months.forEach((_, i) => {
    const c = blockCol(i)
    ws.getColumn(c).width = 13
    ws.getColumn(c + 1).width = 10
    ws.getColumn(c + 2).width = 34
    ws.getColumn(c + 3).width = 14
    ws.getColumn(c + 4).width = 12
  })

  // Title + headers
  ws.mergeCells(2, 1, 2, lastCol)
  const title = ws.getCell(2, 1)
  title.value = `${input.organisationName} — Expenditure Tracker ${input.year}`
  title.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } }
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
  title.alignment = { horizontal: 'center' }

  ws.mergeCells(3, 1, 3, 2)
  ws.getCell(3, 1).value = 'Month'
  months.forEach((m, i) => {
    const c = blockCol(i)
    ws.mergeCells(3, c, 3, c + 4)
    const cell = ws.getCell(3, c)
    cell.value = MONTH_NAMES[m - 1]
    cell.alignment = { horizontal: 'center' }
  })
  ws.getCell(4, 1).value = 'Category'
  ws.getCell(4, 2).value = 'Bill'
  months.forEach((_, i) => BLOCK_HEADERS.forEach((h, o) => (ws.getCell(4, blockCol(i) + o).value = h)))
  for (const r of [3, 4]) {
    ws.getRow(r).font = { bold: true, color: { argb: NAVY } }
    for (let c = 1; c <= lastCol; c++) ws.getCell(r, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT } }
  }

  const inMonth = (iso: string, m: number) => {
    const p = periodOf(iso, startDay)
    return p.year === input.year && p.month === m
  }

  // ---- Expenses ----
  let row = 5
  const cats = [...input.categories].sort((a, b) => a.sort_order - b.sort_order)
  for (const cat of cats) {
    const catItems = input.items.filter((it) => it.category_id === cat.id)
    const catStart = row
    for (const item of catItems) {
      const byMonth = months.map((m) =>
        input.expenses
          .filter((e) => e.item_id === item.id && inMonth(e.expense_date, m))
          .sort((a, b) => a.expense_date.localeCompare(b.expense_date) || a.id.localeCompare(b.id)),
      )
      const hasEntries = byMonth.some((l) => l.length > 0)
      if (!hasEntries && item.status !== 'approved') continue
      const height = Math.max(1, ...byMonth.map((l) => l.length))
      ws.getCell(row, 2).value = item.name
      for (let k = 0; k < height; k++) {
        const r = row + k
        months.forEach((_, i) => {
          const e = byMonth[i]![k]
          if (!e) return
          const c = blockCol(i)
          ws.getCell(r, c).value = e.unit_cost
          ws.getCell(r, c).numFmt = moneyFmt
          ws.getCell(r, c + 1).value = e.quantity
          ws.getCell(r, c + 2).value = e.description
          ws.getCell(r, c + 3).value = { formula: `${L(c)}${r}*${L(c + 1)}${r}`, result: e.total }
          ws.getCell(r, c + 3).numFmt = moneyFmt
          ws.getCell(r, c + 4).value = utcDate(e.expense_date)
          ws.getCell(r, c + 4).numFmt = 'dd/mm/yyyy'
        })
      }
      row += height
    }
    if (row > catStart) {
      if (row - 1 > catStart) ws.mergeCells(catStart, 1, row - 1, 1)
      const cell = ws.getCell(catStart, 1)
      cell.value = cat.name
      cell.font = { bold: true }
      cell.alignment = { vertical: 'middle' }
    }
  }
  const expensesEnd = Math.max(5, row - 1)

  // ---- Petty cash ----
  row += 1
  const pcStart = row
  const label = (r: number, text: string) => {
    ws.getCell(r, 2).value = text
    ws.getCell(r, 2).font = { bold: true }
  }
  const monthPc = months.map((m) => input.pettyCash[m] ?? { opening: 0, entries: [] })

  const openingRow = row
  label(openingRow, 'Balance before CASH-IN')
  months.forEach((_, i) => {
    const c = blockCol(i) + 3
    ws.getCell(openingRow, c).value = monthPc[i]!.opening
    ws.getCell(openingRow, c).numFmt = moneyFmt
  })
  row += 1

  const stacked = (title: string, pick: (e: PettyCashEntry) => boolean) => {
    const lists = monthPc.map((pc) => sortEntries(pc.entries.filter(pick)))
    const height = Math.max(1, ...lists.map((l) => l.length))
    const start = row
    label(start, title)
    for (let k = 0; k < height; k++) {
      months.forEach((_, i) => {
        const e = lists[i]![k]
        if (!e) return
        const c = blockCol(i)
        ws.getCell(start + k, c + 2).value = e.description
        ws.getCell(start + k, c + 3).value = e.amount
        ws.getCell(start + k, c + 3).numFmt = moneyFmt
        ws.getCell(start + k, c + 4).value = utcDate(e.entry_date)
        ws.getCell(start + k, c + 4).numFmt = 'dd/mm/yyyy'
      })
    }
    row += height
    return { start, end: start + height - 1, lists }
  }
  const cashIn = stacked('CASH-IN', (e) => e.entry_type === 'cash_in')
  const cashOut = stacked('CASH-OUT', (e) => e.entry_type === 'cash_out')
  const charges = stacked('CHARGES', (e) => e.entry_type === 'charge')

  const sumOf = (lists: PettyCashEntry[][], i: number) =>
    fromPesewas(lists[i]!.reduce((s, e) => s + toPesewas(e.amount), 0))

  const outTotalRow = row
  label(outTotalRow, 'CASH-OUT (+ Charges)')
  const balanceRow = row + 1
  label(balanceRow, 'BALANCE AFTER CASH-OUT')
  const usedRow = row + 2
  label(usedRow, 'TOTAL (Cash Used without charges)')
  months.forEach((_, i) => {
    const c = blockCol(i) + 3
    const col = L(c)
    const outT = fromPesewas(toPesewas(sumOf(cashOut.lists, i)) + toPesewas(sumOf(charges.lists, i)))
    const chargeT = sumOf(charges.lists, i)
    ws.getCell(outTotalRow, c).value = {
      formula: `SUM(${col}${cashOut.start}:${col}${cashOut.end})+SUM(${col}${charges.start}:${col}${charges.end})`,
      result: outT,
    }
    ws.getCell(balanceRow, c).value = {
      formula: `${col}${openingRow}+SUM(${col}${cashIn.start}:${col}${cashIn.end})-${col}${outTotalRow}`,
      result: fromPesewas(toPesewas(monthPc[i]!.opening) + toPesewas(sumOf(cashIn.lists, i)) - toPesewas(outT)),
    }
    ws.getCell(usedRow, c).value = {
      formula: `${col}${outTotalRow}-SUM(${col}${charges.start}:${col}${charges.end})`,
      result: fromPesewas(toPesewas(outT) - toPesewas(chargeT)),
    }
    for (const r of [outTotalRow, balanceRow, usedRow]) {
      ws.getCell(r, c).numFmt = moneyFmt
      ws.getCell(r, c).font = { bold: true }
    }
  })
  row += 3
  ws.mergeCells(pcStart, 1, row - 1, 1)
  ws.getCell(pcStart, 1).value = 'PETTY CASH'
  ws.getCell(pcStart, 1).font = { bold: true }
  ws.getCell(pcStart, 1).alignment = { vertical: 'middle' }

  // ---- Grand total ----
  row += 1
  const gtRow = row
  ws.mergeCells(gtRow, 1, gtRow, 2)
  ws.getCell(gtRow, 1).value = GRAND_TOTAL_LABEL
  months.forEach((m, i) => {
    const c = blockCol(i) + 3
    const total = fromPesewas(
      input.expenses.filter((e) => inMonth(e.expense_date, m)).reduce((s, e) => s + toPesewas(e.total), 0),
    )
    ws.getCell(gtRow, c).value = { formula: `SUM(${L(c)}5:${L(c)}${expensesEnd})`, result: total }
    ws.getCell(gtRow, c).numFmt = moneyFmt
  })
  ws.getRow(gtRow).font = { bold: true, color: { argb: NAVY } }
  for (let c = 1; c <= lastCol; c++) ws.getCell(gtRow, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TINT } }

  return wb
}

export async function workbookToBlob(wb: ExcelJS.Workbook): Promise<Blob> {
  const buf = await wb.xlsx.writeBuffer()
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

