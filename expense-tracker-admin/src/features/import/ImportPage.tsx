import { useMemo, useState, type ChangeEvent } from 'react'
import ExcelJS from 'exceljs'
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Search,
  Upload,
} from 'lucide-react'
import { toast } from 'sonner'
import { errorMessage, useImport } from '@/api'
import type { ImportResultCounts } from '@/types'
import {
  anomaliesToCsv,
  parseExpenditureSheet,
  pickWorksheet,
  toImportPayload,
  worksheetToGrid,
  type ParseResult,
  type Severity,
} from '@/lib/importer'
import { MONTH_NAMES } from '@/lib/formatters'
import { downloadText } from '@/lib/exporters/download'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  ConfirmDialog,
  CurrencyText,
  EmptyState,
  PageHeader,
  StatCard,
} from '@/components/shared'

export function ImportPage() {
  const [fileName, setFileName] = useState<string | null>(null)
  const [parsing, setParsing] = useState(false)
  const [preview, setPreview] = useState<ParseResult | null>(null)
  const [lastResult, setLastResult] = useState<ImportResultCounts | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  // Anomaly filters
  const [severityFilter, setSeverityFilter] = useState<Severity | ''>('')
  const [monthFilter, setMonthFilter] = useState<number | ''>('')
  const [searchFilter, setSearchFilter] = useState('')

  const importMutation = useImport()

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setParsing(true)
    setLastResult(null)
    try {
      const buffer = await file.arrayBuffer()
      const wb = new ExcelJS.Workbook()
      await wb.xlsx.load(buffer)
      const ws = pickWorksheet(wb)
      if (!ws) throw new Error('No worksheet found in the uploaded workbook.')
      const parsed = parseExpenditureSheet(worksheetToGrid(ws))
      setFileName(file.name)
      setPreview(parsed)
      toast.success(`Parsed "${file.name}" — review the dry-run preview below`)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setParsing(false)
    }
  }

  const filteredAnomalies = useMemo(() => {
    if (!preview) return []
    const q = searchFilter.trim().toLowerCase()
    return preview.anomalies
      .filter((a) => !severityFilter || a.severity === severityFilter)
      .filter((a) => !monthFilter || a.month === monthFilter)
      .filter(
        (a) =>
          !q ||
          a.location.toLowerCase().includes(q) ||
          a.problem.toLowerCase().includes(q) ||
          a.kind.toLowerCase().includes(q),
      )
  }, [monthFilter, preview, searchFilter, severityFilter])

  const handleDownloadCsv = () => {
    if (!preview) return
    const csv = anomaliesToCsv(preview.anomalies)
    downloadText(csv, `import-anomalies-${preview.year}.csv`)
    toast.success('Downloaded anomaly report CSV')
  }

  const handleConfirmImport = async () => {
    if (!preview) return
    try {
      const payload = toImportPayload(preview)
      const counts = await importMutation.mutateAsync(payload)
      setLastResult(counts)
      setConfirmOpen(false)
      toast.success(
        `Import complete: ${counts.expenses_created} expenses, ${counts.petty_cash_created} petty cash entries added (${counts.skipped_duplicates} duplicates skipped)`,
      )
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Data Import"
        subtitle="Upload an Expenditure Tracker .xlsx file for a dry-run preview and anomaly inspection before committing"
      />

      {/* Upload Box */}
      <div className="app-card flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-[#DBEAFE] text-[#2563EB] dark:bg-[#1E3A8A] dark:text-[#38BDF8]">
            <FileSpreadsheet className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#1E3A8A] dark:text-[#DBEAFE]">
              Upload Expenditure Tracker spreadsheet (.xlsx)
            </h2>
            <p className="text-xs text-[var(--text-secondary)]">
              Uses the exact same parser (`parseLegacyAmount`, month-block date rules, case-insensitive item de-duplication) as `scripts/import-xlsx.ts`. Nothing is saved until you confirm.
            </p>
          </div>
        </div>

        <label className="inline-flex h-[44px] shrink-0 cursor-pointer items-center gap-2 rounded-[10px] bg-[#2563EB] px-4 py-2 text-sm font-medium text-white shadow-[0_4px_12px_rgba(37,99,235,0.28)] hover:bg-[#1D4ED8]">
          <Upload className="h-4 w-4" />
          <span>{parsing ? 'Parsing…' : fileName ? 'Choose another .xlsx' : 'Select .xlsx file'}</span>
          <input
            type="file"
            accept=".xlsx"
            onChange={handleFileChange}
            className="sr-only"
            aria-label="Upload Excel file"
          />
        </label>
      </div>

      {lastResult && (
        <div
          role="status"
          className="app-card border-[#2563EB] bg-[#EFF6FF] dark:bg-[#172554] flex flex-wrap items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-[#2563EB]" />
            <div className="text-sm">
              <strong>Import committed ({fileName}):</strong> {lastResult.categories_created} new categories,{' '}
              {lastResult.items_created} new items, {lastResult.expenses_created} new expenses,{' '}
              {lastResult.petty_cash_created} new petty cash entries —{' '}
              <strong>{lastResult.skipped_duplicates} duplicate records skipped</strong> (idempotent).
            </div>
          </div>
        </div>
      )}

      {!preview ? (
        <div className="app-card">
          <EmptyState
            icon={<FileSpreadsheet className="h-6 w-6" />}
            title="No spreadsheet loaded for dry-run"
            description="Upload docs/expenditure.xlsx (or any workbook in the Expenditure Tracker format) to inspect monthly counts and data anomalies before importing."
          />
        </div>
      ) : (
        <>
          {/* Dry-run summary cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard
              label="Categories detected"
              value={preview.categories.length}
              subtext="Seed categories matched"
            />
            <StatCard
              label="Catalog items"
              value={preview.items.length}
              subtext="Trimmed & de-duplicated"
            />
            <StatCard
              label="Valid expenses"
              value={preview.expenses.length}
              subtext={`Across ${preview.year}`}
            />
            <StatCard
              label="Petty cash entries"
              value={preview.petty_cash.length}
              subtext={
                preview.opening_balance
                  ? `Opening: GH₵ ${preview.opening_balance.amount.toFixed(2)}`
                  : 'No opening balance'
              }
            />
            <StatCard
              hero
              label="Anomalies flagged"
              value={preview.anomalies.length}
              subtext={`${preview.anomalies.filter((a) => a.severity === 'error').length} errors · ${preview.anomalies.filter((a) => a.severity === 'warning').length} warnings`}
            />
          </div>

          {/* Action Bar */}
          <div className="app-card flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-[#1E3A8A] dark:text-[#DBEAFE]">
                Dry-run preview for <span className="font-mono">{fileName}</span> (sheet "{preview.sheet_name}")
              </h3>
              <p className="text-xs text-[var(--text-secondary)]">
                Re-importing the same file is idempotent — existing records with matching import keys are skipped automatically.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <Button variant="outline" onClick={handleDownloadCsv}>
                <Download className="h-4 w-4" />
                Download anomaly report (CSV)
              </Button>
              <Button onClick={() => setConfirmOpen(true)} disabled={importMutation.isPending}>
                Import into database
              </Button>
            </div>
          </div>

          {/* Counts by Month */}
          <div className="app-card space-y-3">
            <h3 className="text-base font-bold text-[#1E3A8A] dark:text-[#DBEAFE]">
              Dry-run breakdown by month ({preview.year})
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--border-divider)] font-semibold uppercase tracking-wider text-[#475569]">
                    <th className="py-2.5 pr-3">Month</th>
                    <th className="py-2.5 px-3 text-right">Expenses</th>
                    <th className="py-2.5 px-3 text-right">Computed Total</th>
                    <th className="py-2.5 px-3 text-right">Sheet Grand Total</th>
                    <th className="py-2.5 px-3 text-right">Petty Cash Entries</th>
                    <th className="py-2.5 px-3 text-right">Cash-in</th>
                    <th className="py-2.5 pl-3 text-right">Cash-out</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-divider)]">
                  {preview.months
                    .filter((m) => m.expenses > 0 || m.petty_cash_entries > 0 || m.sheet_grand_total !== null)
                    .map((m) => (
                      <tr key={m.month}>
                        <td className="py-2.5 pr-3 font-semibold">{MONTH_NAMES[m.month - 1]}</td>
                        <td className="py-2.5 px-3 text-right tabular-nums">{m.expenses}</td>
                        <td className="py-2.5 px-3 text-right font-semibold">
                          <CurrencyText amount={m.expense_total} />
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {m.sheet_grand_total !== null ? (
                            <CurrencyText amount={m.sheet_grand_total} />
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums">{m.petty_cash_entries}</td>
                        <td className="py-2.5 px-3 text-right">
                          <CurrencyText amount={m.cash_in} />
                        </td>
                        <td className="py-2.5 pl-3 text-right">
                          <CurrencyText amount={m.cash_out} />
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Filterable Anomalies Table */}
          <div className="app-card space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-[#1E3A8A] dark:text-[#DBEAFE]">
                  Anomalies ({filteredAnomalies.length} of {preview.anomalies.length})
                </h3>
                <p className="text-xs text-[var(--text-secondary)]">
                  Every formatting quirk, total mismatch, date disagreement, and skipped row is surfaced visibly
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative w-56">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#475569]" />
                  <Input
                    aria-label="Filter anomalies"
                    placeholder="Cell, problem, type…"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="w-40">
                  <Select
                    aria-label="Filter anomalies by severity"
                    value={severityFilter}
                    onChange={(e) => setSeverityFilter(e.target.value as Severity | '')}
                  >
                    <option value="">All severities</option>
                    <option value="error">Error</option>
                    <option value="warning">Warning</option>
                    <option value="info">Info</option>
                  </Select>
                </div>
                <div className="w-40">
                  <Select
                    aria-label="Filter anomalies by month"
                    value={monthFilter}
                    onChange={(e) => setMonthFilter(e.target.value ? Number(e.target.value) : '')}
                  >
                    <option value="">All months</option>
                    {MONTH_NAMES.map((m, idx) => (
                      <option key={m} value={idx + 1}>
                        {m}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--border-divider)] font-semibold uppercase tracking-wider text-[#475569]">
                    <th className="py-2.5 pr-3">Severity</th>
                    <th className="py-2.5 px-3">Location</th>
                    <th className="py-2.5 px-3">Month</th>
                    <th className="py-2.5 px-3">Problem</th>
                    <th className="py-2.5 pl-3">Suggested action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-divider)]">
                  {filteredAnomalies.map((a) => (
                    <tr key={a.id} className="hover:bg-[var(--surface-hover)]">
                      <td className="py-2.5 pr-3">
                        <Badge
                          variant={
                            a.severity === 'error'
                              ? 'danger'
                              : a.severity === 'warning'
                                ? 'pending'
                                : 'category'
                          }
                        >
                          <AlertTriangle className="h-3 w-3" />
                          {a.severity.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 font-mono font-semibold whitespace-nowrap">
                        {a.location}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {a.month ? MONTH_NAMES[a.month - 1] : '—'}
                      </td>
                      <td className="py-2.5 px-3">{a.problem}</td>
                      <td className="py-2.5 pl-3 text-[var(--text-secondary)]">{a.suggestion}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Commit data import?"
        description={
          preview ? (
            <span>
              This will import <strong>{preview.categories.length}</strong> categories,{' '}
              <strong>{preview.items.length}</strong> items,{' '}
              <strong>{preview.expenses.length}</strong> expenses, and{' '}
              <strong>{preview.petty_cash.length}</strong> petty cash entries. Any records already imported will be skipped automatically.
            </span>
          ) : null
        }
        confirmLabel="Import now"
        loading={importMutation.isPending}
        onConfirm={handleConfirmImport}
      />
    </div>
  )
}

