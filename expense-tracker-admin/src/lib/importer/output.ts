import type { ImportPayload } from '../../types'
import type { Anomaly, ParseResult } from './types'
import { MONTH_NAMES } from '../formatters'

/** Normalised JSON sent to POST /api/admin/import. */
export function toImportPayload(result: ParseResult): ImportPayload {
  return {
    categories: result.categories.map((c) => ({ name: c.name, sort_order: c.sort_order })),
    items: result.items.map((i) => ({ key: i.key, category: i.category, name: i.name })),
    expenses: result.expenses.map((e) => ({
      import_key: e.import_key,
      category: e.category,
      item_key: e.item_key,
      unit_cost: e.unit_cost,
      quantity: e.quantity,
      description: e.description,
      expense_date: e.expense_date,
    })),
    petty_cash: result.petty_cash.map((p) => ({
      import_key: p.import_key,
      entry_type: p.entry_type,
      amount: p.amount,
      entry_date: p.entry_date,
      description: p.description,
    })),
    opening_balance: result.opening_balance,
  }
}

const csvCell = (v: string | number | null | undefined) => {
  const s = v === null || v === undefined ? '' : String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function anomaliesToCsv(anomalies: readonly Anomaly[]): string {
  const header = ['ID', 'Severity', 'Type', 'Location', 'Month', 'Problem', 'Suggested action', 'Raw value']
  const rows = anomalies.map((a) => [
    a.id,
    a.severity,
    a.kind,
    a.location,
    a.month ? MONTH_NAMES[a.month - 1] : '',
    a.problem,
    a.suggestion,
    a.raw ?? '',
  ])
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n')
}

const md = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ')
const ghs = (n: number | null) =>
  n === null ? '—' : `GH₵ ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** Markdown report written by scripts/import-xlsx.ts to docs/import-report.md. */
export function buildImportReport(result: ParseResult, source: string, generatedAt: string): string {
  const bySeverity = (s: Anomaly['severity']) => result.anomalies.filter((a) => a.severity === s).length
  const kinds = new Map<string, number>()
  for (const a of result.anomalies) kinds.set(a.kind, (kinds.get(a.kind) ?? 0) + 1)

  const lines: string[] = []
  lines.push('# Import report — Expenditure Tracker')
  lines.push('')
  lines.push(`- Source: \`${source}\` (sheet "${result.sheet_name}")`)
  lines.push(`- Year: ${result.year}`)
  lines.push(`- Generated: ${generatedAt}`)
  lines.push('')
  lines.push('## Rules applied')
  lines.push('')
  lines.push('- Amounts are parsed with `parseLegacyAmount()`; totals are always recomputed as unit cost × quantity.')
  lines.push('- The month block is the source of truth for the month/year; the date cell only supplies the day.')
  lines.push('- Item names are trimmed and de-duplicated case-insensitively within a category. Spelling is never corrected.')
  lines.push('- Missing values are never invented: rows without a unit cost, quantity, date or amount are skipped and listed below.')
  lines.push('')
  lines.push('## Summary')
  lines.push('')
  lines.push(`| Categories | Items | Expenses | Petty cash entries | Opening balance |`)
  lines.push(`|---|---|---|---|---|`)
  lines.push(
    `| ${result.categories.length} | ${result.items.length} | ${result.expenses.length} | ${result.petty_cash.length} | ${result.opening_balance ? `${ghs(result.opening_balance.amount)} (${MONTH_NAMES[result.opening_balance.month - 1]})` : 'not derived'} |`,
  )
  lines.push('')
  lines.push(`Anomalies: **${result.anomalies.length}** — ${bySeverity('error')} errors, ${bySeverity('warning')} warnings, ${bySeverity('info')} info.`)
  lines.push('')
  lines.push('| Type | Count |')
  lines.push('|---|---|')
  for (const [k, n] of [...kinds.entries()].sort((a, b) => b[1] - a[1])) lines.push(`| ${k} | ${n} |`)
  lines.push('')
  lines.push('## By month')
  lines.push('')
  lines.push('| Month | Expenses | Computed total | Sheet grand total | Difference | Petty cash entries | Cash-in | Cash-out |')
  lines.push('|---|---|---|---|---|---|---|---|')
  for (const m of result.months) {
    if (!m.expenses && !m.petty_cash_entries && m.sheet_grand_total === null) continue
    const diff = m.sheet_grand_total === null ? null : Math.round((m.sheet_grand_total - m.expense_total) * 100) / 100
    lines.push(
      `| ${MONTH_NAMES[m.month - 1]} | ${m.expenses} | ${ghs(m.expense_total)} | ${ghs(m.sheet_grand_total)} | ${diff === null ? '—' : ghs(diff)} | ${m.petty_cash_entries} | ${ghs(m.cash_in)} | ${ghs(m.cash_out)} |`,
    )
  }
  lines.push('')
  lines.push('## Categories')
  lines.push('')
  for (const c of result.categories) lines.push(`${c.sort_order}. ${c.name}${c.sheet_label !== c.name ? ` (sheet label: "${c.sheet_label}")` : ''}`)
  lines.push('')
  for (const sev of ['error', 'warning', 'info'] as const) {
    const list = result.anomalies.filter((a) => a.severity === sev)
    lines.push(`## ${sev === 'error' ? 'Errors (not imported or unreadable)' : sev === 'warning' ? 'Warnings' : 'Info'} (${list.length})`)
    lines.push('')
    if (!list.length) {
      lines.push('_None._')
      lines.push('')
      continue
    }
    lines.push('| ID | Location | Month | Type | Problem | Suggested action |')
    lines.push('|---|---|---|---|---|---|')
    for (const a of list) {
      lines.push(`| ${a.id} | ${a.location} | ${a.month ? MONTH_NAMES[a.month - 1] : '—'} | ${a.kind} | ${md(a.problem)} | ${md(a.suggestion)} |`)
    }
    lines.push('')
  }
  return lines.join('\n')
}
