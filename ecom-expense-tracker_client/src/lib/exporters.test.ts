import { describe, it, expect } from 'vitest'
import { buildMonthlyWorkbook } from './exporters'
import type { MonthlyReport } from '@/types'

describe('Excel export workbook structure', () => {
  const mockReport: MonthlyReport = {
    month: 3,
    year: 2026,
    total_purchases: 250,
    record_count: 2,
    individual_total: 250,
    shared_total: 0,
    petty_cash: {
      opening_balance: 500,
      cash_in: 0,
      cash_out_total: 0,
      charges: 0,
      closing_balance: 500,
      cash_used: 0,
      entries: [],
    },
    categories: [
      {
        category_id: 'cat-1',
        category_name: 'Office Supplies',
        total: 250,
        items: [
          {
            item_id: 'item-1',
            item_name: 'A4 Sheet',
            subtotal: 250,
            entries: [
              {
                id: 'exp-1',
                category_id: 'cat-1',
                item_id: 'item-1',
                item_name: 'A4 Sheet',
                unit_cost: 50,
                quantity: 5,
                total: 250,
                description: 'Box of paper',
                expense_date: '2026-03-12',
                expense_type: 'individual',
                created_by: 'usr-1',
                created_by_name: 'John Doe',
                created_at: '2026-03-12T10:00:00Z',
                updated_at: '2026-03-12T10:00:00Z',
              },
            ],
          },
        ],
      },
    ],
    expenses: [],
  }

  it('generates an "Expenditure Tracker" sheet with correct headers, numeric cells, and SUM formula', () => {
    const workbook = buildMonthlyWorkbook(mockReport)
    const sheet = workbook.getWorksheet('Expenditure Tracker')

    expect(sheet).toBeDefined()
    expect(sheet?.name).toBe('Expenditure Tracker')

    // Header row (Row 3)
    const headerRow = sheet?.getRow(3)
    expect(headerRow?.getCell(1).value).toBe('Category')
    expect(headerRow?.getCell(2).value).toBe('Item')
    expect(headerRow?.getCell(3).value).toBe('Unit Cost (GH₵)')
    expect(headerRow?.getCell(4).value).toBe('Quantity')
    expect(headerRow?.getCell(6).value).toBe('Total Price (GH₵)')

    // Data row (Row 4)
    const dataRow = sheet?.getRow(4)
    expect(dataRow?.getCell(1).value).toBe('Office Supplies')
    expect(dataRow?.getCell(2).value).toBe('A4 Sheet')
    expect(typeof dataRow?.getCell(3).value).toBe('number') // Numeric cell
    expect(dataRow?.getCell(3).value).toBe(50)
    expect(typeof dataRow?.getCell(4).value).toBe('number') // Numeric cell
    expect(dataRow?.getCell(4).value).toBe(5)

    // Formula cell in total
    const totalCellVal = dataRow?.getCell(6).value as { formula?: string; result?: number }
    expect(totalCellVal).toHaveProperty('formula')
    expect(totalCellVal.formula).toBe('C4*D4')
    expect(totalCellVal.result).toBe(250)

    // Grand total row (Row 6)
    const grandTotalRow = sheet?.getRow(6)
    expect(grandTotalRow?.getCell(1).value).toBe('GRAND TOTAL AMOUNT SPENT ON PURCHASES')
    const grandFormulaVal = grandTotalRow?.getCell(6).value as { formula?: string; result?: number }
    expect(grandFormulaVal).toHaveProperty('formula')
    expect(grandFormulaVal.formula).toContain('SUM(F4:')
    expect(grandFormulaVal.result).toBe(250)
  })
})

