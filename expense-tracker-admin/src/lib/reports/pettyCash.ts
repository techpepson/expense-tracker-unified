import type { PettyCashEntry, PettyCashLedgerRow, PettyCashMonth, PettyCashSummary } from '@/types'
import { fromPesewas, toPesewas } from '@/lib/money'
import { comparePeriods, inPeriod, periodOf, periodRange } from './period'

export interface OpeningBalance {
  amount: number
  month: number
  year: number
}

/**
 * The sheet's five figures:
 *   cash_out_total = cash-out + charges
 *   cash_used      = cash_out_total - charges
 *   closing        = opening + cash_in - cash_out_total
 */
export function computePettyCashSummary(opening: number, entries: readonly PettyCashEntry[]): PettyCashSummary {
  let inP = 0
  let outP = 0
  let chargeP = 0
  for (const e of entries) {
    const p = toPesewas(e.amount)
    if (e.entry_type === 'cash_in') inP += p
    else if (e.entry_type === 'cash_out') outP += p
    else chargeP += p
  }
  const openP = toPesewas(opening)
  const cashOutTotalP = outP + chargeP
  return {
    opening_balance: fromPesewas(openP),
    cash_in: fromPesewas(inP),
    cash_out_total: fromPesewas(cashOutTotalP),
    charges: fromPesewas(chargeP),
    cash_used: fromPesewas(cashOutTotalP - chargeP),
    closing_balance: fromPesewas(openP + inP - cashOutTotalP),
  }
}

export function sortEntries<T extends PettyCashEntry>(entries: readonly T[]): T[] {
  return [...entries].sort(
    (a, b) => a.entry_date.localeCompare(b.entry_date) || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
  )
}

/** Ledger rows with a running balance after each entry. */
export function buildLedger(opening: number, entries: readonly PettyCashEntry[]): PettyCashLedgerRow[] {
  let bal = toPesewas(opening)
  return sortEntries(entries).map((e) => {
    const p = toPesewas(e.amount)
    bal += e.entry_type === 'cash_in' ? p : -p
    return { ...e, running_balance: fromPesewas(bal) }
  })
}

/**
 * Builds a month's petty cash view. The opening balance of a month is the previous month's
 * closing balance, chained from the configured opening balance (or from zero when none is set).
 */
export function computePettyCashMonth(
  allEntries: readonly PettyCashEntry[],
  opening: OpeningBalance | null,
  month: number,
  year: number,
  startDay = 1,
): PettyCashMonth {
  const firstEntry = sortEntries(allEntries)[0]
  const anchor = opening ?? (firstEntry ? { amount: 0, ...periodOf(firstEntry.entry_date, startDay) } : { amount: 0, month, year })

  const target = { month, year }
  let openingAmount = 0
  if (comparePeriods(target, anchor) >= 0) {
    const anchorStart = periodRange(anchor.month, anchor.year, startDay).start
    const targetStart = periodRange(month, year, startDay).start
    let bal = toPesewas(anchor.amount)
    for (const e of allEntries) {
      if (e.entry_date >= anchorStart && e.entry_date < targetStart) {
        bal += e.entry_type === 'cash_in' ? toPesewas(e.amount) : -toPesewas(e.amount)
      }
    }
    openingAmount = fromPesewas(bal)
  }

  const period = periodRange(month, year, startDay)
  const monthEntries = allEntries.filter((e) => inPeriod(e.entry_date, period))
  return {
    month,
    year,
    summary: computePettyCashSummary(openingAmount, monthEntries),
    entries: buildLedger(openingAmount, monthEntries),
    is_first_month: comparePeriods(target, anchor) <= 0,
    opening_balance_set: opening !== null,
  }
}

