/**
 * Parses legacy date cells. The month block a cell sits in is the source of truth for the
 * month and year; the cell only contributes the day. Every disagreement is reported.
 */

export interface DateIssue {
  kind: 'text_date' | 'odd_date' | 'month_mismatch'
  message: string
}

export type LegacyDateResult =
  | { status: 'ok'; iso: string; day: number; issues: DateIssue[] }
  | { status: 'empty' }
  | { status: 'invalid'; raw: string; reason: string }

const pad = (n: number) => String(n).padStart(2, '0')

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

export function isoDate(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`
}

interface RawDate {
  year: number | null
  month: number | null
  day: number
  issues: DateIssue[]
}

function fromDate(d: Date): RawDate {
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), issues: [] }
}

function excelSerialToDate(serial: number): Date {
  return new Date(Date.UTC(1899, 11, 30) + Math.round(serial) * 86_400_000)
}

function parseText(text: string): RawDate | null {
  const t = text.trim()
  const issues: DateIssue[] = [{ kind: 'text_date', message: `Date typed as text ("${t}")` }]

  // ISO yyyy-mm-dd
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (m) return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]), issues }

  // Day range "12-13/03/2026" -> first day.
  m = t.match(/^(\d{1,2})\s*-\s*(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{1,4})$/)
  if (m) {
    issues.push({ kind: 'odd_date', message: `Date range "${t}"; the first day (${m[1]}) was used` })
    return { year: yearOrNull(m[4]!, issues), month: Number(m[3]), day: Number(m[1]), issues }
  }

  // dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy (year may be malformed, e.g. "206")
  m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{1,4})$/)
  if (m) return { year: yearOrNull(m[3]!, issues), month: Number(m[2]), day: Number(m[1]), issues }

  // Missing separator "2702/2026" -> 27/02/2026
  m = t.match(/^(\d{2})(\d{2})\/(\d{4})$/)
  if (m) {
    issues.push({ kind: 'odd_date', message: `Missing separator in "${t}"; read as ${m[1]}/${m[2]}/${m[3]}` })
    return { year: Number(m[3]), month: Number(m[2]), day: Number(m[1]), issues }
  }

  return null
}

function yearOrNull(text: string, issues: DateIssue[]): number | null {
  if (text.length === 4) return Number(text)
  if (text.length === 2) return 2000 + Number(text)
  issues.push({ kind: 'odd_date', message: `Malformed year "${text}"` })
  return null
}

export function parseLegacyDate(input: unknown, blockMonth: number, blockYear: number): LegacyDateResult {
  if (input === null || input === undefined) return { status: 'empty' }
  if (typeof input === 'string' && input.trim() === '') return { status: 'empty' }

  let raw: RawDate
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) return { status: 'invalid', raw: String(input), reason: 'Invalid date' }
    raw = fromDate(input)
  } else if (typeof input === 'number') {
    if (input > 20000 && input < 80000) raw = fromDate(excelSerialToDate(input))
    else return { status: 'invalid', raw: String(input), reason: `${input} is not a date` }
  } else if (typeof input === 'string') {
    const parsed = parseText(input)
    if (!parsed) return { status: 'invalid', raw: input, reason: `"${input.trim()}" is not a recognisable date` }
    raw = parsed
  } else {
    return { status: 'invalid', raw: String(input), reason: 'Unsupported cell type' }
  }

  const issues = [...raw.issues]
  const shown = raw.year
    ? isoDate(raw.year, raw.month ?? blockMonth, raw.day)
    : `${pad(raw.day)}/${pad(raw.month ?? blockMonth)}/?`

  if (raw.month !== null && (raw.month < 1 || raw.month > 12)) {
    return { status: 'invalid', raw: String(input), reason: `Month ${raw.month} is out of range` }
  }
  const monthDiffers = raw.month !== null && raw.month !== blockMonth
  const yearDiffers = raw.year !== null && raw.year !== blockYear
  if (monthDiffers || yearDiffers) {
    issues.push({
      kind: 'month_mismatch',
      message: `Date ${shown} is outside its month block; ${isoDate(blockYear, blockMonth, Math.min(raw.day, 28)).slice(0, 7)} from the block was used`,
    })
  }

  const dim = daysInMonth(blockYear, blockMonth)
  if (raw.day < 1 || raw.day > dim) {
    return {
      status: 'invalid',
      raw: String(input),
      reason: `Day ${raw.day} does not exist in ${blockYear}-${pad(blockMonth)}`,
    }
  }

  return { status: 'ok', iso: isoDate(blockYear, blockMonth, raw.day), day: raw.day, issues }
}

