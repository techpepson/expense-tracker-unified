import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { MonthlyReport } from '@/types'
import { formatDate, monthLabel } from '@/lib/formatters'

// jsPDF's built-in fonts don't include "₵", so PDFs use the ISO code.
const amount = (n: number, currency: string) =>
  `${currency} ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

type DocWithTable = jsPDF & { lastAutoTable?: { finalY: number } }

export function buildMonthlyReportPdf(report: MonthlyReport, createdByLabel?: string): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' }) as DocWithTable
  const cur = report.currency
  const navy: [number, number, number] = [30, 58, 138]
  const width = doc.internal.pageSize.getWidth()

  doc.setFillColor(...navy)
  doc.rect(0, 0, width, 70, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16)
  doc.text(report.organisation_name, 40, 32)
  doc.setFontSize(11)
  doc.text(`Monthly Expense Report · ${monthLabel(report.month, report.year)}`, 40, 52)
  if (createdByLabel) doc.text(`Created by: ${createdByLabel}`, width - 40, 52, { align: 'right' })

  doc.setTextColor(15, 23, 42)
  doc.setFontSize(10)
  let y = 92
  const stats: [string, string][] = [
    ['Total spent on purchases', amount(report.grand_total, cur)],
    ['Records', String(report.record_count)],
    ['Individual', amount(report.individual_total, cur)],
    ['Shared operational', amount(report.shared_total, cur)],
  ]
  autoTable(doc, {
    startY: y,
    head: [stats.map((s) => s[0])],
    body: [stats.map((s) => s[1])],
    theme: 'grid',
    headStyles: { fillColor: [219, 234, 254], textColor: navy },
    styles: { fontSize: 9 },
  })
  y = (doc.lastAutoTable?.finalY ?? y) + 18

  for (const cat of report.categories) {
    const body: (string | { content: string; styles: object })[][] = []
    for (const item of cat.items) {
      item.entries.forEach((e, idx) => {
        body.push([
          idx === 0 ? item.item_name : '',
          amount(e.unit_cost, cur),
          String(e.quantity),
          e.description,
          amount(e.total, cur),
          formatDate(e.expense_date, 'dd/MM/yyyy'),
        ])
      })
    }
    body.push([
      { content: `${cat.name} subtotal`, styles: { fontStyle: 'bold' } },
      '',
      '',
      '',
      { content: amount(cat.subtotal, cur), styles: { fontStyle: 'bold' } },
      '',
    ])
    autoTable(doc, {
      startY: y,
      head: [[cat.name, 'Unit cost', 'Qty', 'Description', 'Total', 'Date']],
      body,
      theme: 'striped',
      headStyles: { fillColor: navy },
      styles: { fontSize: 8, cellPadding: 3 },
      columnStyles: { 0: { cellWidth: 100 }, 3: { cellWidth: 170 } },
    })
    y = (doc.lastAutoTable?.finalY ?? y) + 14
  }

  const pc = report.petty_cash
  autoTable(doc, {
    startY: y,
    head: [['Petty cash', 'Amount']],
    body: [
      ['Balance before cash-in', amount(pc.opening_balance, cur)],
      ['Cash-in', amount(pc.cash_in, cur)],
      ['Cash-out (including charges)', amount(pc.cash_out_total, cur)],
      ['Balance after cash-out', amount(pc.closing_balance, cur)],
      ['Total cash used without charges', amount(pc.cash_used, cur)],
    ],
    theme: 'grid',
    headStyles: { fillColor: navy },
    styles: { fontSize: 9 },
  })
  y = (doc.lastAutoTable?.finalY ?? y) + 14
  autoTable(doc, {
    startY: y,
    body: [['GRAND TOTAL SPENT ON PURCHASES', amount(report.grand_total, cur)]],
    theme: 'plain',
    styles: { fontSize: 11, fontStyle: 'bold', textColor: navy, fillColor: [239, 246, 255] },
  })
  return doc
}

