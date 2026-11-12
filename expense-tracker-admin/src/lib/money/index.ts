/**
 * Money helpers. All arithmetic happens in integer pesewas (1 cedi = 100 pesewas)
 * to avoid floating point drift; values travel over the API as major-unit decimals.
 */

export type Pesewas = number

/** Convert a major-unit decimal (e.g. 12.5) to integer pesewas (1250). */
export function toPesewas(amount: number): Pesewas {
  if (!Number.isFinite(amount)) return 0
  // Round via string to avoid 1.005 * 100 = 100.49999 problems.
  return Math.round(Number(`${amount}e2`))
}

/** Convert integer pesewas to a major-unit decimal with at most 2 dp. */
export function fromPesewas(p: Pesewas): number {
  return Math.round(p) / 100
}

/** unit cost (major units) x quantity -> total in pesewas. Quantity may have up to 3 dp. */
export function lineTotalPesewas(unitCost: number, quantity: number): Pesewas {
  const unit = toPesewas(unitCost)
  const qtyMilli = Math.round(quantity * 1000)
  return Math.round((unit * qtyMilli) / 1000)
}

/** unit cost x quantity in major units, computed exactly. */
export function lineTotal(unitCost: number, quantity: number): number {
  return fromPesewas(lineTotalPesewas(unitCost, quantity))
}

/** Sum major-unit amounts exactly. */
export function sumMoney(values: readonly number[]): number {
  return fromPesewas(values.reduce((acc, v) => acc + toPesewas(v), 0))
}

export function addMoney(a: number, b: number): number {
  return fromPesewas(toPesewas(a) + toPesewas(b))
}

export function subtractMoney(a: number, b: number): number {
  return fromPesewas(toPesewas(a) - toPesewas(b))
}

const formatterCache = new Map<string, Intl.NumberFormat>()

function getFormatter(currency: string): Intl.NumberFormat {
  let f = formatterCache.get(currency)
  if (!f) {
    try {
      f = new Intl.NumberFormat('en-GH', {
        style: 'currency',
        currency,
        currencyDisplay: 'narrowSymbol',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    } catch {
      f = new Intl.NumberFormat('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    }
    formatterCache.set(currency, f)
  }
  return f
}

const plainFormatter = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Currency symbols we render ourselves so output is stable across ICU versions. */
const SYMBOLS: Record<string, string> = { GHS: 'GH₵', USD: '$', EUR: '€', GBP: '£', NGN: '₦' }

/**
 * Format a major-unit amount, e.g. formatMoney(1250) -> "GH₵ 1,250.00".
 */
export function formatMoney(amount: number, currency = 'GHS'): string {
  const value = fromPesewas(toPesewas(amount))
  const symbol = SYMBOLS[currency]
  if (symbol) {
    const sign = value < 0 ? '-' : ''
    return `${sign}${symbol} ${plainFormatter.format(Math.abs(value))}`
  }
  return getFormatter(currency).format(value)
}

export function currencySymbol(currency = 'GHS'): string {
  return SYMBOLS[currency] ?? currency
}

