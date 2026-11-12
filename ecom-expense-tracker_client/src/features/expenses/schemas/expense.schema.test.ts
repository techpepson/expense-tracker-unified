import { describe, it, expect } from 'vitest'
import { expenseSchema } from '@/features/expenses/schemas/expense.schema'

describe('Expense validation schema', () => {
  it('validates a correct expense', () => {
    const valid = {
      category_id: 'cat-1',
      item_id: 'item-1',
      unit_cost: 15.5,
      quantity: 2,
      expense_date: '2026-03-15',
      expense_type: 'individual',
    }
    const result = expenseSchema.safeParse(valid)
    expect(result.success).toBe(true)
  })

  it('rejects negative or zero amounts and quantities', () => {
    const invalid = {
      category_id: 'cat-1',
      item_id: 'item-1',
      unit_cost: -5,
      quantity: 0,
      expense_date: '2026-03-15',
      expense_type: 'individual',
    }
    const result = expenseSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })
})

