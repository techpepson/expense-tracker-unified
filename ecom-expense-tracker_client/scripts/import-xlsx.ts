import { parseLegacyAmount } from '../src/lib/money'
import ExcelJS from 'exceljs'
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

interface Anomaly {
  type: string
  details: string
  month?: string
  row?: number
  cell?: string
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

async function runImport() {
  const filePath = resolve(process.cwd(), 'docs/expenditure.xlsx')
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(filePath)
  const sheet = workbook.getWorksheet('Sheet1') || workbook.worksheets[0]

  const anomalies: Anomaly[] = []

  // Step 1: Detect categories and items
  // Categories in Col A (merged vertically), Items in Col B
  const categoriesMap = new Map<string, string>() // Name -> id
  const itemsMap = new Map<string, { id: string; category_id: string; name: string }>() // normalizedName -> Item
  const expenses: any[] = []
  const pettyCashEntries: any[] = []

  // Ensure default categories exist
  const knownCategories = [
    'Office Supplies',
    'Kitchen Supplies',
    'Cleaning & Hygiene Supplies',
    'Other',
  ]
  knownCategories.forEach((catName, index) => {
    categoriesMap.set(catName, `cat-${index + 1}`)
  })

  // Pre-seed default users
  const defaultUser = {
    id: 'usr-1',
    full_name: 'John Doe',
    email: 'employee@ecom.com',
    can_record_shared: true,
  }

  let currentCategory = 'Office Supplies'

  // Rows 5 through 133 are expense items
  for (let r = 5; r <= 133; r++) {
    const row = sheet.getRow(r)
    const catVal = String(row.getCell(1).value ?? '').trim()
    if (catVal && knownCategories.includes(catVal)) {
      currentCategory = catVal
    } else if (catVal && !categoriesMap.has(catVal)) {
      // If new category appears
      const newCatId = `cat-${categoriesMap.size + 1}`
      categoriesMap.set(catVal, newCatId)
      currentCategory = catVal
    }

    const itemRaw = String(row.getCell(2).value ?? '').trim()
    if (!itemRaw) continue

    const normalizedItemName = itemRaw.toLowerCase()
    let itemObj = itemsMap.get(normalizedItemName)
    if (!itemObj) {
      itemObj = {
        id: `item-${itemsMap.size + 1}`,
        category_id: categoriesMap.get(currentCategory)!,
        name: itemRaw,
      }
      itemsMap.set(normalizedItemName, itemObj)
    }

    // Now loop over 12 months (5 columns each, starting from Col 3 / 'C')
    // Jan: C-G (3-7), Feb: H-L (8-12), ...
    for (let m = 0; m < 12; m++) {
      const monthName = MONTH_NAMES[m]
      const startCol = 3 + m * 5

      const rawUnitCost = row.getCell(startCol).value
      const rawQty = row.getCell(startCol + 1).value
      const rawDesc = row.getCell(startCol + 2).value
      const rawTotal = row.getCell(startCol + 3).value
      const rawDate = row.getCell(startCol + 4).value

      const hasAnyValue =
        rawUnitCost != null ||
        rawQty != null ||
        rawDesc != null ||
        rawTotal != null ||
        rawDate != null

      if (!hasAnyValue) continue

      const parsedUnitCost = parseLegacyAmount(rawUnitCost as string | number)
      const parsedTotal = parseLegacyAmount(rawTotal as string | number)
      const qty = typeof rawQty === 'number' ? rawQty : parseInt(String(rawQty ?? '1'), 10) || 1
      const desc = rawDesc ? String(rawDesc).trim() : ''

      let dateStr = ''
      if (rawDate instanceof Date) {
        dateStr = rawDate.toISOString().slice(0, 10)
      } else if (rawDate) {
        const dText = String(rawDate).trim()
        // parse text dates if possible
        dateStr = `2026-${String(m + 1).padStart(2, '0')}-15`
        anomalies.push({
          type: 'Text/Ambiguous Date',
          details: `Date text '${dText}' normalized to ${dateStr}`,
          month: monthName,
          row: r,
        })
      } else {
        dateStr = `2026-${String(m + 1).padStart(2, '0')}-01`
      }

      // Check total mismatch
      const calculatedTotal = parsedUnitCost ? Number((parsedUnitCost * qty).toFixed(2)) : 0
      let finalTotal = parsedTotal ?? calculatedTotal
      let finalUnitCost = parsedUnitCost ?? (qty > 0 && finalTotal ? Number((finalTotal / qty).toFixed(2)) : 0)

      if (parsedUnitCost != null && parsedTotal != null && Math.abs(calculatedTotal - parsedTotal) > 0.05) {
        anomalies.push({
          type: 'Total Mismatch',
          details: `Unit Cost (${parsedUnitCost}) * Qty (${qty}) = ${calculatedTotal}, but recorded as ${parsedTotal}`,
          month: monthName,
          row: r,
        })
        finalTotal = calculatedTotal // Rule: app always computes the total itself
      }

      if (finalTotal > 0) {
        expenses.push({
          id: `exp-${expenses.length + 1}`,
          category_id: categoriesMap.get(currentCategory)!,
          item_id: itemObj.id,
          item_name: itemObj.name,
          unit_cost: finalUnitCost,
          quantity: qty,
          total: finalTotal,
          description: desc,
          expense_date: dateStr,
          expense_type: 'individual',
          created_by: defaultUser.id,
          created_by_name: defaultUser.full_name,
          created_at: new Date(2026, m, 15).toISOString(),
          updated_at: new Date(2026, m, 15).toISOString(),
        })
      }
    }
  }

  // Parse Petty Cash rows from 134 to 190
  for (let r = 138; r <= 150; r++) {
    const row = sheet.getRow(r)
    const typeLabel = String(row.getCell(2).value ?? '').trim()
    for (let m = 0; m < 12; m++) {
      const col = 3 + m * 5
      const val = row.getCell(col).value
      const amount = parseLegacyAmount(val as string | number)
      if (amount && amount > 0) {
        const isCashIn = typeLabel.includes('CASH-IN')
        pettyCashEntries.push({
          id: `pc-${pettyCashEntries.length + 1}`,
          entry_type: isCashIn ? 'cash_in' : 'cash_out',
          amount,
          entry_date: `2026-${String(m + 1).padStart(2, '0')}-10`,
          description: typeLabel || (isCashIn ? 'Cash In Reimbursement' : 'Cash Out Expense'),
          created_by: defaultUser.id,
          created_by_name: defaultUser.full_name,
          created_at: new Date(2026, m, 10).toISOString(),
        })
      }
    }
  }

  // Step 4: Write JSON Seed Files
  mkdirSync(resolve(process.cwd(), 'src/mocks/seed'), { recursive: true })

  const categoriesJson = Array.from(categoriesMap.entries()).map(([name, id]) => ({
    id,
    name,
    is_active: true,
  }))

  const itemsJson = Array.from(itemsMap.values()).map((it) => ({
    ...it,
    status: 'approved',
  }))

  const usersJson = [
    defaultUser,
    {
      id: 'usr-2',
      full_name: 'Jane Smith',
      email: 'jane@ecom.com',
      can_record_shared: false,
    },
  ]

  writeFileSync(
    resolve(process.cwd(), 'src/mocks/seed/categories.json'),
    JSON.stringify(categoriesJson, null, 2)
  )
  writeFileSync(
    resolve(process.cwd(), 'src/mocks/seed/items.json'),
    JSON.stringify(itemsJson, null, 2)
  )
  writeFileSync(
    resolve(process.cwd(), 'src/mocks/seed/expenses.json'),
    JSON.stringify(expenses, null, 2)
  )
  writeFileSync(
    resolve(process.cwd(), 'src/mocks/seed/petty-cash.json'),
    JSON.stringify(pettyCashEntries, null, 2)
  )
  writeFileSync(
    resolve(process.cwd(), 'src/mocks/seed/users.json'),
    JSON.stringify(usersJson, null, 2)
  )

  // Step 5: Write docs/import-report.md
  let reportMd = `# Expenditure Tracker - Import Report\n\n`
  reportMd += `Generated on: ${new Date().toISOString()}\n\n`
  reportMd += `## Summary\n`
  reportMd += `- Categories extracted: **${categoriesJson.length}**\n`
  reportMd += `- Items extracted: **${itemsJson.length}**\n`
  reportMd += `- Expenses imported: **${expenses.length}**\n`
  reportMd += `- Petty cash entries: **${pettyCashEntries.length}**\n`
  reportMd += `- Anomalies flagged: **${anomalies.length}**\n\n`
  reportMd += `## Anomalies List\n\n`
  reportMd += `| Month | Row | Type | Details |\n`
  reportMd += `|---|---|---|---|\n`
  anomalies.forEach((a) => {
    reportMd += `| ${a.month ?? '—'} | ${a.row ?? '—'} | ${a.type} | ${a.details} |\n`
  })

  writeFileSync(resolve(process.cwd(), 'docs/import-report.md'), reportMd)

  console.log(`Successfully generated seed data and docs/import-report.md!`)
}

runImport().catch(console.error)

