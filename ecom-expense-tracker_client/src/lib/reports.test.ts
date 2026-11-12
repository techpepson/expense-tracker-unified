import { describe, it, expect } from 'vitest'
import { toPesewas, fromPesewas, computeTotal } from '@/lib/money'

describe('Petty cash balance formulas and report calculations', () => {
  it('computes closing balance correctly (opening + cash_in - cash_out_total)', () => {
    const opening = 500
    const cashIn = 1200
    const cashOutOnly = 650
    const charges = 25
    const cashOutTotal = cashOutOnly + charges

    // Formula: closing = opening + cash_in - cash_out_total
    const closingPesewas = toPesewas(opening) + toPesewas(cashIn) - toPesewas(cashOutTotal)
    const closing = fromPesewas(closingPesewas)
    expect(closing).toBe(1025)

    // Formula: cash_used = cash_out_total - charges = 650
    const cashUsedPesewas = toPesewas(cashOutTotal) - toPesewas(charges)
    const cashUsed = fromPesewas(cashUsedPesewas)
    expect(cashUsed).toBe(650)
  })

  it('aggregates category subtotals and grand totals accurately', () => {
    const sampleExpenses = [
      { unit_cost: 45.5, quantity: 2 }, // 91.00
      { unit_cost: 120.0, quantity: 1 }, // 120.00
      { unit_cost: 15.25, quantity: 4 }, // 61.00
    ]

    const totals = sampleExpenses.map((e) => computeTotal(e.unit_cost, e.quantity))
    const grandTotal = totals.reduce((sum, t) => fromPesewas(toPesewas(sum) + toPesewas(t)), 0)

    expect(totals).toEqual([91, 120, 61])
    expect(grandTotal).toBe(272)
  })
})

