import ExcelJS from 'exceljs'
import { resolve } from 'node:path'

async function inspect() {
  const filePath = resolve(process.cwd(), 'docs/expenditure.xlsx')
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(filePath)
  console.log('Worksheet names:', workbook.worksheets.map(w => w.name))

  const sheet = workbook.getWorksheet('Sheet1') || workbook.worksheets[0]
  console.log('Total rows:', sheet.rowCount, 'Total columns:', sheet.columnCount)

  // Print rows 1 to 6
  for (let r = 1; r <= 6; r++) {
    const row = sheet.getRow(r)
    const values: string[] = []
    for (let c = 1; c <= 20; c++) {
      values.push(String(row.getCell(c).value ?? ''))
    }
    console.log(`Row ${r}:`, values.slice(0, 15).join(' | '))
  }

  // Check row 130 to 145 for petty cash
  console.log('--- Checking rows around 130-150 ---')
  for (let r = 130; r <= 145; r++) {
    const row = sheet.getRow(r)
    const valA = String(row.getCell(1).value ?? '')
    const valB = String(row.getCell(2).value ?? '')
    if (valA || valB) {
      console.log(`Row ${r}: A=[${valA}] B=[${valB}] C=[${String(row.getCell(3).value ?? '')}] D=[${String(row.getCell(4).value ?? '')}]`)
    }
  }

  // Check last 5 rows
  console.log('--- Last rows ---')
  for (let r = sheet.rowCount - 5; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r)
    const valA = String(row.getCell(1).value ?? '')
    const valB = String(row.getCell(2).value ?? '')
    console.log(`Row ${r}: A=[${valA}] B=[${valB}] C=[${String(row.getCell(3).value ?? '')}]`)
  }
}

inspect().catch(console.error)

