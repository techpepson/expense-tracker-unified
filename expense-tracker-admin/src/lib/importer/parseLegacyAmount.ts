/**
 * Parses the hand-typed amounts found in the legacy "Expenditure Tracker" sheet.
 *
 * Accepts values such as "Ghc 1,250", "Ghc  6, 258.50", "Ghc 20 ", "GHC 112", "Ghc38",
 * "Ghc Ghc 61" and plain numbers. Returns the value in major units together with notes
 * describing any formatting quirk so the importer can surface them (never hide them).
 */

export type LegacyAmountResult =
  | { status: 'ok'; value: number; pesewas: number; notes: string[] }
  | { status: 'empty' }
  | { status: 'invalid'; raw: string; reason: string }

const CURRENCY_TOKEN = /gh\s*[c₵¢]\.?|ghs|₵|¢/gi

export function parseLegacyAmount(input: unknown): LegacyAmountResult {
  if (input === null || input === undefined) return { status: 'empty' }

  if (typeof input === 'number') {
    if (!Number.isFinite(input)) return { status: 'invalid', raw: String(input), reason: 'Not a finite number' }
    const pesewas = Math.round(input * 100)
    const notes: string[] = []
    if (Math.abs(input * 100 - pesewas) > 1e-6) notes.push('More than 2 decimal places; rounded to pesewas')
    return { status: 'ok', value: pesewas / 100, pesewas, notes }
  }

  if (typeof input !== 'string') {
    return { status: 'invalid', raw: String(input), reason: 'Unsupported cell type' }
  }

  const raw = input
  const trimmed = raw.trim()
  if (trimmed === '') return { status: 'empty' }

  const notes: string[] = []
  const prefixMatches = trimmed.match(CURRENCY_TOKEN) ?? []
  if (prefixMatches.length > 1) notes.push(`Currency prefix repeated ${prefixMatches.length} times`)

  let body = trimmed.replace(CURRENCY_TOKEN, ' ').trim()
  if (body === '') return { status: 'invalid', raw, reason: 'No digits found' }

  // Whitespace between digit groups ("6, 258.50", "3, 510") is a typing slip, not two numbers.
  if (/[\d,.]\s+[\d,.]/.test(body)) notes.push('Spaces inside the number')
  body = body.replace(/\s+/g, '')

  // Thousands separators.
  if (body.includes(',')) {
    const commaPattern = /^-?\d{1,3}(,\d{3})+(\.\d+)?$/
    if (!commaPattern.test(body)) notes.push('Irregular thousands separator')
    body = body.replace(/,/g, '')
  }

  if (!/^-?\d+(\.\d+)?$/.test(body)) {
    return { status: 'invalid', raw, reason: `"${trimmed}" is not a number` }
  }

  const num = Number(body)
  if (!Number.isFinite(num)) return { status: 'invalid', raw, reason: 'Not a finite number' }
  const decimals = body.split('.')[1]?.length ?? 0
  if (decimals > 2) notes.push('More than 2 decimal places; rounded to pesewas')
  const pesewas = Math.round(Number(`${num}e2`))
  return { status: 'ok', value: pesewas / 100, pesewas, notes }
}

/** Parses a quantity cell (number or numeric text). */
export function parseQuantity(input: unknown): LegacyAmountResult {
  if (input === null || input === undefined) return { status: 'empty' }
  if (typeof input === 'number') {
    return Number.isFinite(input) && input > 0
      ? { status: 'ok', value: input, pesewas: Math.round(input * 100), notes: [] }
      : { status: 'invalid', raw: String(input), reason: 'Quantity must be greater than zero' }
  }
  if (typeof input === 'string') {
    const t = input.trim()
    if (t === '') return { status: 'empty' }
    const n = Number(t.replace(/,/g, ''))
    if (Number.isFinite(n) && n > 0) {
      return { status: 'ok', value: n, pesewas: Math.round(n * 100), notes: ['Quantity stored as text'] }
    }
    return { status: 'invalid', raw: input, reason: `"${t}" is not a quantity` }
  }
  return { status: 'invalid', raw: String(input), reason: 'Unsupported cell type' }
}

