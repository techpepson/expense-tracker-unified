import ExcelJS from 'exceljs'
import type { Category, Expense, User } from '@/types'
import { EXPENSE_TYPE_LABEL } from '@/lib/formatters'
import { sumTotals } from '@/lib/reports'

function utcDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number]
  return new Date(Date.UTC(y, m - 1, d))
}

/** Flat export of a filtered expense list (Expenses screen "Export to Excel"). */
export function buildExpensesWorkbook(args: {
  expenses: Expense[]
  categories: Category[]
  users: Pick<User, 'id' | 'full_name'>[]
  currency: string
  title: string
}): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Expenses')
  const moneyFmt = `"${args.currency === 'GHS' ? 'GH₵' : args.currency}" #,##0.00`
  ws.columns = [
    { header: 'Date', key: 'date', width: 12 },
    { header: 'Item', key: 'item', width: 28 },
    { header: 'Category', key: 'category', width: 26 },
    { header: 'Description', key: 'description', width: 40 },
    { header: 'Quantity', key: 'quantity', width: 10 },
    { header: 'Unit cost', key: 'unit', width: 14 },
    { header: 'Total', key: 'total', width: 14 },
    { header: 'Type', key: 'type', width: 18 },
    { header: 'Created by', key: 'created', width: 22 },
    { header: 'Incurred by', key: 'incurred', width: 20 },
  ]
  ws.getRow(1).font = { bold: true, color: { argb: 'FF1E3A8A' } }
  args.expenses.forEach((e, i) => {
    const r = i + 2
    ws.addRow({
      date: utcDate(e.expense_date),
      item: e.item_name,
      category: args.categories.find((c) => c.id === e.category_id)?.name ?? '',
      description: e.description,
      quantity: e.quantity,
      unit: e.unit_cost,
      total: { formula: `E${r}*F${r}`, result: e.total },
      type: EXPENSE_TYPE_LABEL[e.expense_type],
      created: args.users.find((u) => u.id === e.created_by)?.full_name ?? '',
      incurred: e.incurred_by ?? '',
    })
  })
  const last = args.expenses.length + 1
  const totalRow = ws.addRow({ description: 'TOTAL', total: { formula: `SUM(G2:G${Math.max(2, last)})`, result: sumTotals(args.expenses) } })
  totalRow.font = { bold: true }
  ws.getColumn('date').numFmt = 'dd/mm/yyyy'
  ws.getColumn('unit').numFmt = moneyFmt
  ws.getColumn('total').numFmt = moneyFmt
  ws.views = [{ state: 'frozen', ySplit: 1 }]
  wb.title = args.title
  return wb
}

