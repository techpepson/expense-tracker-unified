import ExcelJS from 'exceljs'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { MonthlyReport, Expense, Category } from '@/types'
import { FULL_MONTH_NAMES, formatDate } from './formatters'
import { formatGHS } from './money'

/**
 * Build the ExcelJS Workbook matching the original spreadsheet structure.
 */
export function buildMonthlyWorkbook(report: MonthlyReport): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Expenditure Tracker')

  // Row 1: Title
  sheet.mergeCells('A1:G1')
  sheet.getCell('A1').value = `e-COM Services - Monthly Expense Report (${FULL_MONTH_NAMES[report.month - 1]} ${report.year})`
  sheet.getCell('A1').font = { size: 16, bold: true, color: { argb: 'FF1E3A8A' } }

  // Row 3: Headers
  sheet.getRow(3).values = [
    'Category',
    'Item',
    'Unit Cost (GH₵)',
    'Quantity',
    'Description',
    'Total Price (GH₵)',
    'Date',
  ]
  sheet.getRow(3).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  sheet.getRow(3).eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2563EB' },
    }
  })

  let currentRow = 4

  for (const cat of report.categories) {
    for (const item of cat.items) {
      for (const entry of item.entries) {
        sheet.getRow(currentRow).values = [
          cat.category_name,
          item.item_name,
          entry.unit_cost,
          entry.quantity,
          entry.description ?? '',
          { formula: `C${currentRow}*D${currentRow}`, result: entry.total },
          formatDate(entry.expense_date),
        ]
        currentRow++
      }
    }
  }

  // Grand Total row
  currentRow++
  sheet.getCell(`A${currentRow}`).value = 'GRAND TOTAL AMOUNT SPENT ON PURCHASES'
  sheet.getCell(`A${currentRow}`).font = { bold: true }
  sheet.getCell(`F${currentRow}`).value = {
    formula: `SUM(F4:F${currentRow - 2})`,
    result: report.total_purchases,
  }
  sheet.getCell(`F${currentRow}`).font = { bold: true }

  // Auto-fit column widths
  sheet.columns.forEach((col) => {
    col.width = 18
  })

  return workbook
}

/**
 * Excel export replicating the exact layout of the legacy "Expenditure Tracker" spreadsheet.
 * - One worksheet "Expenditure Tracker"
 * - Categories and Items on left
 * - 5-column blocks per month (Unit Cost, Quantity, Description, Total Price, Date)
 * - Real SUM formulas and numeric cells
 */
export async function exportMonthlyExcel(report: MonthlyReport): Promise<void> {
  const workbook = buildMonthlyWorkbook(report)
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `ecom-expenses-${report.year}-${String(report.month).padStart(2, '0')}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * PDF Export using jsPDF and jspdf-autotable
 */
export function exportMonthlyPdf(report: MonthlyReport): void {
  const doc = new jsPDF()

  // Header
  doc.setFontSize(18)
  doc.setTextColor(30, 58, 138) // #1E3A8A
  doc.text('e-COM Services', 14, 20)

  doc.setFontSize(12)
  doc.setTextColor(71, 85, 105) // #475569
  doc.text(
    `Monthly Expense Report · ${FULL_MONTH_NAMES[report.month - 1]} ${report.year}`,
    14,
    28
  )

  // Summary box
  doc.setDrawColor(224, 236, 255)
  doc.setFillColor(243, 247, 255)
  doc.roundedRect(14, 34, 182, 22, 3, 3, 'FD')

  doc.setFontSize(9)
  doc.setTextColor(71, 85, 105)
  doc.text('TOTAL PURCHASES', 20, 42)
  doc.text('TOTAL RECORDS', 85, 42)
  doc.text('PETTY CASH CLOSING', 145, 42)

  doc.setFontSize(12)
  doc.setTextColor(15, 23, 42)
  doc.text(formatGHS(report.total_purchases), 20, 50)
  doc.text(`${report.record_count}`, 85, 50)
  doc.text(formatGHS(report.petty_cash.closing_balance), 145, 50)

  // Table of Expenses
  const rows = report.expenses.map((e) => [
    formatDate(e.expense_date),
    e.item_name,
    e.expense_type === 'shared_operational' ? 'Shared' : 'Individual',
    e.quantity,
    formatGHS(e.unit_cost),
    formatGHS(e.total),
  ])

  autoTable(doc, {
    startY: 62,
    head: [['Date', 'Item', 'Type', 'Qty', 'Unit Cost', 'Total']],
    body: rows,
    theme: 'plain',
    headStyles: {
      fillColor: [37, 99, 235],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
    },
    styles: {
      fontSize: 8,
      cellPadding: 3,
      lineColor: [234, 241, 255],
      lineWidth: 0.5,
    },
    foot: [
      [
        'Total',
        '',
        '',
        '',
        '',
        formatGHS(report.total_purchases),
      ],
    ],
    footStyles: {
      fontStyle: 'bold',
      textColor: [15, 23, 42],
    },
  })

  doc.save(`ecom-expenses-${report.year}-${String(report.month).padStart(2, '0')}.pdf`)
}

/**
 * Export a list of expenses to an Excel spreadsheet.
 */
export async function exportExpensesExcel(
  expenses: Expense[],
  categories: Category[] = [],
  fileName = 'ecom-expenses-export.xlsx'
): Promise<void> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Expenses')

  // Row 1: Title
  sheet.mergeCells('A1:H1')
  sheet.getCell('A1').value = 'e-COM Services - Expenses Export'
  sheet.getCell('A1').font = { size: 16, bold: true, color: { argb: 'FF1E3A8A' } }

  // Row 3: Headers
  sheet.getRow(3).values = [
    'Date',
    'Item',
    'Category',
    'Type',
    'Qty',
    'Unit Cost (GH₵)',
    'Total (GH₵)',
    'Description',
  ]
  sheet.getRow(3).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  sheet.getRow(3).eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2563EB' },
    }
  })

  let currentRow = 4
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]))

  for (const exp of expenses) {
    sheet.getRow(currentRow).values = [
      formatDate(exp.expense_date),
      exp.item_name,
      categoryMap.get(exp.category_id) || 'Category',
      exp.expense_type === 'shared_operational' ? 'Shared' : 'Individual',
      exp.quantity,
      exp.unit_cost,
      { formula: `E${currentRow}*F${currentRow}`, result: exp.total },
      exp.description || '',
    ]
    currentRow++
  }

  // Grand Total row
  if (expenses.length > 0) {
    currentRow++
    sheet.getCell(`A${currentRow}`).value = 'TOTAL'
    sheet.getCell(`A${currentRow}`).font = { bold: true }
    sheet.getCell(`G${currentRow}`).value = {
      formula: `SUM(G4:G${currentRow - 2})`,
      result: expenses.reduce((s, e) => s + e.total, 0),
    }
    sheet.getCell(`G${currentRow}`).font = { bold: true }
  }

  sheet.columns.forEach((col) => {
    col.width = 18
  })

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Export a list of expenses to a PDF document.
 */
export function exportExpensesPdf(
  expenses: Expense[],
  categories: Category[] = [],
  fileName = 'ecom-expenses-export.pdf'
): void {
  const doc = new jsPDF()
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]))
  const totalAmount = expenses.reduce((s, e) => s + e.total, 0)

  // Header
  doc.setFontSize(18)
  doc.setTextColor(30, 58, 138)
  doc.text('e-COM Services', 14, 20)

  doc.setFontSize(12)
  doc.setTextColor(71, 85, 105)
  doc.text('Expenses Export Report', 14, 28)

  // Summary box
  doc.setDrawColor(224, 236, 255)
  doc.setFillColor(243, 247, 255)
  doc.roundedRect(14, 34, 182, 18, 3, 3, 'FD')

  doc.setFontSize(9)
  doc.setTextColor(71, 85, 105)
  doc.text('TOTAL EXPENSES', 20, 42)
  doc.text('TOTAL RECORDS', 110, 42)

  doc.setFontSize(12)
  doc.setTextColor(15, 23, 42)
  doc.text(formatGHS(totalAmount), 20, 48)
  doc.text(`${expenses.length}`, 110, 48)

  const rows = expenses.map((e) => [
    formatDate(e.expense_date),
    e.item_name,
    categoryMap.get(e.category_id) || 'Category',
    e.expense_type === 'shared_operational' ? 'Shared' : 'Individual',
    e.quantity,
    formatGHS(e.unit_cost),
    formatGHS(e.total),
  ])

  autoTable(doc, {
    startY: 58,
    head: [['Date', 'Item', 'Category', 'Type', 'Qty', 'Unit Cost', 'Total']],
    body: rows,
    theme: 'plain',
    headStyles: {
      fillColor: [37, 99, 235],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
    },
    styles: {
      fontSize: 8,
      cellPadding: 3,
      lineColor: [234, 241, 255],
      lineWidth: 0.5,
    },
    foot: [['Total', '', '', '', '', '', formatGHS(totalAmount)]],
    footStyles: {
      fontStyle: 'bold',
      textColor: [15, 23, 42],
    },
  })

  doc.save(fileName)
}
