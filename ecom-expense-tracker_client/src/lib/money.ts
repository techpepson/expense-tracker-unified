// Money utilities — represent amounts as integer pesewas for arithmetic
// to avoid floating-point rounding errors. Display as GH₵ X,XXX.XX

import Decimal from 'decimal.js'

/** Convert GHS decimal to pesewas (integer) */
export function toPesewas(ghs: number | string): number {
  return new Decimal(ghs).times(100).round().toNumber()
}

/** Convert pesewas back to GHS decimal (number with 2dp) */
export function fromPesewas(pesewas: number): number {
  return new Decimal(pesewas).div(100).toDecimalPlaces(2).toNumber()
}

/** Multiply unit_cost × quantity in pesewas, return GHS */
export function computeTotal(unitCost: number, quantity: number): number {
  const ucPesewas = toPesewas(unitCost)
  const result = new Decimal(ucPesewas).times(quantity)
  return fromPesewas(result.round().toNumber())
}

/** Format a GHS amount for display */
export function formatGHS(amount: number): string {
  return new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: 'GHS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
    .format(amount)
    .replace('GHS', 'GH₵')
    .trim()
}

/**
 * Parse a legacy amount string from the spreadsheet.
 * Handles: "Ghc 1,250", "Ghc  6, 258.50", "Ghc 20 ", plain numbers.
 * Returns null if unparseable.
 */
export function parseLegacyAmount(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined || raw === '') return null
  if (typeof raw === 'number') {
    if (!isFinite(raw)) return null
    return parseFloat(raw.toFixed(10))
  }
  // Remove currency prefixes and trim
  const cleaned = String(raw)
    .replace(/ghc\.?/gi, '')
    .replace(/gh[₵c]/gi, '')
    .replace(/,/g, '')
    .replace(/\s+/g, '')
    .trim()
  if (cleaned === '' || cleaned === '-') return null
  const parsed = parseFloat(cleaned)
  if (isNaN(parsed)) return null
  return parsed
}

