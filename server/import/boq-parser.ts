import { Readable } from 'node:stream'
import ExcelJS from 'exceljs'
import type { BoqImportError, BoqImportPreview, BoqImportRow } from '../../src/domain.js'

const MAX_ROWS = 5000

const aliases = {
  chapterCode: ['hoofdstuk', 'hoofdstukcode', 'chapter', 'chaptercode'],
  chapterName: ['hoofdstuknaam', 'naamhoofdstuk', 'chaptername'],
  code: ['code', 'post', 'postnummer', 'postnr', 'item'],
  description: ['omschrijving', 'beschrijving', 'description'],
  quantity: ['hoeveelheid', 'aantal', 'quantity', 'qty'],
  unit: ['eenheid', 'unit'],
  labor: ['arbeid', 'loonkost', 'labor', 'labour'],
  material: ['materiaal', 'material'],
  equipment: ['materieel', 'machine', 'equipment'],
  subcontracting: ['onderaanneming', 'onderaannemer', 'subcontracting'],
} as const

type ImportField = keyof typeof aliases
type ColumnMap = Partial<Record<ImportField, number>>

export async function parseBoqFile(buffer: Buffer, fileName: string): Promise<BoqImportPreview> {
  const extension = fileName.toLowerCase().split('.').at(-1)
  if (!['xlsx', 'csv'].includes(extension ?? '')) throw new BoqFileError('Alleen .xlsx- en .csv-bestanden worden ondersteund')

  const workbook = new ExcelJS.Workbook()
  let worksheet: ExcelJS.Worksheet | undefined
  if (extension === 'csv') {
    const firstLine = buffer.toString('utf8').split(/\r?\n/, 1)[0] ?? ''
    const delimiter = [';', ',', '\t'].sort((left, right) => firstLine.split(right).length - firstLine.split(left).length)[0]
    worksheet = await workbook.csv.read(Readable.from([buffer]), {
      parserOptions: { delimiter },
      // Codes zoals 01.01 en 01 zijn identificatoren, geen getallen.
      map: value => value,
    })
  }
  else {
    await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0])
    worksheet = workbook.worksheets[0]
  }
  if (!worksheet) throw new BoqFileError('Het bestand bevat geen leesbaar werkblad')

  const columns = mapColumns(worksheet.getRow(1))
  const errors: BoqImportError[] = []
  for (const required of ['code', 'description', 'quantity', 'unit'] as const) {
    if (!columns[required]) errors.push({ row: 1, field: required, message: `Verplichte kolom ontbreekt: ${aliases[required][0]}` })
  }
  if (errors.length) return { fileName, sheetName: worksheet.name, rows: [], chapterCount: 0, validRowCount: 0, errors }

  const rows: BoqImportRow[] = []
  const lastRow = Math.min(worksheet.actualRowCount, MAX_ROWS + 1)
  for (let rowNumber = 2; rowNumber <= lastRow; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber)
    const values = Object.values(columns).map(column => scalar(row.getCell(column!).value))
    if (values.every(value => value === '')) continue

    const code = textAt(row, columns.code)
    const description = textAt(row, columns.description)
    const quantity = numberAt(row, columns.quantity)
    const unit = textAt(row, columns.unit)
    const rowErrors: BoqImportError[] = []
    if (!code) rowErrors.push({ row: rowNumber, field: 'code', message: 'Postcode ontbreekt' })
    if (!description) rowErrors.push({ row: rowNumber, field: 'description', message: 'Omschrijving ontbreekt' })
    if (quantity === undefined || quantity < 0) rowErrors.push({ row: rowNumber, field: 'quantity', message: 'Hoeveelheid moet een positief getal of nul zijn' })
    if (!unit) rowErrors.push({ row: rowNumber, field: 'unit', message: 'Eenheid ontbreekt' })

    const costs = {
      labor: numberAt(row, columns.labor) ?? 0,
      material: numberAt(row, columns.material) ?? 0,
      equipment: numberAt(row, columns.equipment) ?? 0,
      subcontracting: numberAt(row, columns.subcontracting) ?? 0,
    }
    for (const [field, value] of Object.entries(costs)) {
      if (value < 0) rowErrors.push({ row: rowNumber, field, message: 'Kostprijs mag niet negatief zijn' })
    }
    if (rowErrors.length) {
      errors.push(...rowErrors)
      continue
    }

    rows.push({
      chapterCode: textAt(row, columns.chapterCode) || '00',
      chapterName: textAt(row, columns.chapterName) || 'Algemeen',
      code, description, quantity: quantity!, unit, ...costs,
    })
  }
  if (worksheet.actualRowCount > MAX_ROWS + 1) errors.push({ row: MAX_ROWS + 2, field: 'file', message: `De import is beperkt tot ${MAX_ROWS} gegevensrijen` })
  const chapters = new Set(rows.map(row => `${row.chapterCode}\u0000${row.chapterName}`))
  return { fileName, sheetName: worksheet.name, rows, chapterCount: chapters.size, validRowCount: rows.length, errors }
}

function mapColumns(header: ExcelJS.Row): ColumnMap {
  const columns: ColumnMap = {}
  header.eachCell((cell, column) => {
    const normalized = normalize(scalar(cell.value))
    for (const [field, names] of Object.entries(aliases) as Array<[ImportField, readonly string[]]>) {
      if (names.includes(normalized) && !columns[field]) columns[field] = column
    }
  })
  return columns
}

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function scalar(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object') {
    if ('result' in value) return scalar(value.result as ExcelJS.CellValue)
    if ('richText' in value) return value.richText.map(part => part.text).join('')
    if ('text' in value) return String(value.text)
  }
  return String(value).trim()
}

function textAt(row: ExcelJS.Row, column?: number) {
  return column ? scalar(row.getCell(column).value).trim() : ''
}

function numberAt(row: ExcelJS.Row, column?: number): number | undefined {
  if (!column) return undefined
  const value = row.getCell(column).value
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  const raw = scalar(value).replace(/[€\s]/g, '')
  if (!raw) return undefined
  let normalized = raw
  if (raw.includes(',') && raw.includes('.')) normalized = raw.lastIndexOf(',') > raw.lastIndexOf('.') ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(/,/g, '')
  else if (raw.includes(',')) normalized = raw.replace(/\./g, '').replace(',', '.')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : undefined
}

export class BoqFileError extends Error {
  readonly statusCode = 400
}
