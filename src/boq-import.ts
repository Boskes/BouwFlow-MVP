import type ExcelJS from 'exceljs'
import type { BoqImportError, BoqImportPreview, BoqImportRow } from './domain'

const MAX_FILE_SIZE = 10 * 1024 * 1024
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

export async function parseBoqFileLocally(file: File): Promise<BoqImportPreview> {
  const extension = file.name.toLowerCase().split('.').at(-1)
  if (!['xlsx', 'csv'].includes(extension ?? '')) return fileError(file.name, 'Alleen .xlsx- en .csv-bestanden worden ondersteund')
  if (file.size > MAX_FILE_SIZE) return fileError(file.name, 'Het bestand mag maximaal 10 MB groot zijn')

  try {
    if (extension === 'csv') {
      const contents = new TextDecoder('utf-8').decode(await file.arrayBuffer()).replace(/^\uFEFF/, '')
      return parseTable(parseCsv(contents), file.name, 'CSV')
    }

    const { default: ExcelJSRuntime } = await import('exceljs')
    const workbook = new ExcelJSRuntime.Workbook()
    await workbook.xlsx.load(await file.arrayBuffer())
    const worksheet = workbook.worksheets[0]
    if (!worksheet) return fileError(file.name, 'Het Excel-bestand bevat geen leesbaar werkblad')
    const table: string[][] = []
    worksheet.eachRow({ includeEmpty: true }, row => {
      const values: string[] = []
      for (let column = 1; column <= Math.max(worksheet.actualColumnCount, row.cellCount); column += 1) values.push(scalar(row.getCell(column).value))
      table.push(values)
    })
    return parseTable(table, file.name, worksheet.name)
  } catch {
    return fileError(file.name, 'Het bestand kon niet worden gelezen. Controleer of het een geldig Excel- of CSV-bestand is')
  }
}

function parseTable(table: string[][], fileName: string, sheetName: string): BoqImportPreview {
  const columns = mapColumns(table[0] ?? [])
  const errors: BoqImportError[] = []
  for (const required of ['code', 'description', 'quantity', 'unit'] as const) {
    if (columns[required] === undefined) errors.push({ row: 1, field: required, message: `Verplichte kolom ontbreekt: ${aliases[required][0]}` })
  }
  if (errors.length) return { fileName, sheetName, rows: [], chapterCount: 0, validRowCount: 0, errors }

  const rows: BoqImportRow[] = []
  const lastRow = Math.min(table.length, MAX_ROWS + 1)
  for (let index = 1; index < lastRow; index += 1) {
    const values = table[index] ?? []
    if (values.every(value => value.trim() === '')) continue
    const rowNumber = index + 1
    const code = textAt(values, columns.code)
    const description = textAt(values, columns.description)
    const quantity = numberAt(values, columns.quantity)
    const unit = textAt(values, columns.unit)
    const rowErrors: BoqImportError[] = []
    if (!code) rowErrors.push({ row: rowNumber, field: 'code', message: 'Postcode ontbreekt' })
    if (!description) rowErrors.push({ row: rowNumber, field: 'description', message: 'Omschrijving ontbreekt' })
    if (quantity === undefined || quantity < 0) rowErrors.push({ row: rowNumber, field: 'quantity', message: 'Hoeveelheid moet een positief getal of nul zijn' })
    if (!unit) rowErrors.push({ row: rowNumber, field: 'unit', message: 'Eenheid ontbreekt' })
    const costs = {
      labor: numberAt(values, columns.labor) ?? 0,
      material: numberAt(values, columns.material) ?? 0,
      equipment: numberAt(values, columns.equipment) ?? 0,
      subcontracting: numberAt(values, columns.subcontracting) ?? 0,
    }
    for (const [field, value] of Object.entries(costs)) if (value < 0) rowErrors.push({ row: rowNumber, field, message: 'Kostprijs mag niet negatief zijn' })
    if (rowErrors.length) { errors.push(...rowErrors); continue }
    rows.push({ chapterCode: textAt(values, columns.chapterCode) || '00', chapterName: textAt(values, columns.chapterName) || 'Algemeen', code, description, quantity: quantity!, unit, ...costs })
  }
  if (table.length > MAX_ROWS + 1) errors.push({ row: MAX_ROWS + 2, field: 'file', message: `De import is beperkt tot ${MAX_ROWS} gegevensrijen` })
  const chapters = new Set(rows.map(row => `${row.chapterCode}\u0000${row.chapterName}`))
  return { fileName, sheetName, rows, chapterCount: chapters.size, validRowCount: rows.length, errors }
}

function parseCsv(contents: string): string[][] {
  const firstLine = contents.split(/\r?\n/, 1)[0] ?? ''
  const delimiter = [';', ',', '\t'].sort((left, right) => countDelimiter(firstLine, right) - countDelimiter(firstLine, left))[0]
  const rows: string[][] = []
  let row: string[] = [], value = '', quoted = false
  for (let index = 0; index < contents.length; index += 1) {
    const character = contents[index]
    if (character === '"') {
      if (quoted && contents[index + 1] === '"') { value += '"'; index += 1 } else quoted = !quoted
    } else if (character === delimiter && !quoted) { row.push(value.trim()); value = '' }
    else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && contents[index + 1] === '\n') index += 1
      row.push(value.trim()); rows.push(row); row = []; value = ''
    } else value += character
  }
  if (value || row.length) { row.push(value.trim()); rows.push(row) }
  return rows
}

function countDelimiter(value: string, delimiter: string) { return value.split(delimiter).length - 1 }

function mapColumns(header: string[]): ColumnMap {
  const columns: ColumnMap = {}
  header.forEach((value, column) => {
    const normalized = normalize(value)
    for (const [field, names] of Object.entries(aliases) as Array<[ImportField, readonly string[]]>) {
      if (names.includes(normalized) && columns[field] === undefined) columns[field] = column
    }
  })
  return columns
}

function normalize(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '') }

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

function textAt(row: string[], column?: number) { return column === undefined ? '' : (row[column] ?? '').trim() }

function numberAt(row: string[], column?: number): number | undefined {
  if (column === undefined) return undefined
  const raw = (row[column] ?? '').replace(/[€\s]/g, '')
  if (!raw) return undefined
  let normalized = raw
  if (raw.includes(',') && raw.includes('.')) normalized = raw.lastIndexOf(',') > raw.lastIndexOf('.') ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(/,/g, '')
  else if (raw.includes(',')) normalized = raw.replace(/\./g, '').replace(',', '.')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : undefined
}

function fileError(fileName: string, message: string): BoqImportPreview {
  return { fileName, sheetName: '—', rows: [], chapterCount: 0, validRowCount: 0, errors: [{ row: 1, field: 'file', message }] }
}
