import type { Workbook, Worksheet, CellValue as ExcelCellValue } from 'exceljs'
import type { CellValue, SheetGrid } from './types'

/** Flatten ExcelJS cell values (rich text, formulas, hyperlinks) into plain values. */
export function normaliseCell(value: ExcelCellValue | undefined): CellValue {
  if (value === null || value === undefined) return null
  if (typeof value === 'string' || typeof value === 'number') return value
  if (typeof value === 'boolean') return String(value)
  if (value instanceof Date) return value
  if (typeof value === 'object') {
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((r) => r.text).join('')
    }
    if ('formula' in value || 'sharedFormula' in value) {
      const result = (value as { result?: ExcelCellValue }).result
      return normaliseCell(result)
    }
    if ('text' in value && typeof value.text === 'string') return value.text
    if ('error' in value) return null
  }
  return null
}

export function worksheetToGrid(ws: Worksheet): SheetGrid {
  return {
    name: ws.name,
    rowCount: ws.rowCount,
    columnCount: ws.columnCount,
    getCell: (row, col) => normaliseCell(ws.getCell(row, col).value),
  }
}

/** Picks the "Sheet1"/first worksheet that looks like the Expenditure Tracker. */
export function pickWorksheet(wb: Workbook): Worksheet | undefined {
  return wb.getWorksheet('Sheet1') ?? wb.getWorksheet('Expenditure Tracker') ?? wb.worksheets[0]
}

