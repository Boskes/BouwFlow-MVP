import PDFDocument from 'pdfkit'
import type { Quote } from '../../src/domain.js'

const colors = {
  ink: '#17212b', muted: '#6f7d89', line: '#dfe5e9', soft: '#f5f7f8', orange: '#f5a623', orangeSoft: '#fff6e5', white: '#ffffff',
}

const currency = (value: number) => new Intl.NumberFormat('nl-BE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
const quantity = (value: number) => new Intl.NumberFormat('nl-BE', { maximumFractionDigits: 3 }).format(value)
const cleanText = (value: string) => value.replace(/[\u2010-\u2015]/g, '-').replace(/\u00a0/g, ' ')

export async function renderQuotePdf(quote: Quote): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margins: { top: 46, right: 46, bottom: 54, left: 46 }, bufferPages: true, info: { Title: `${quote.number} - ${quote.snapshot.projectTitle}`, Author: quote.snapshot.supplierName, Subject: quote.content.subject } })
  const chunks: Buffer[] = []
  doc.on('data', chunk => chunks.push(Buffer.from(chunk)))
  const completed = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
  })

  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right
  const ensureSpace = (height: number) => {
    if (doc.y + height > doc.page.height - doc.page.margins.bottom - 24) doc.addPage()
  }
  const sectionTitle = (title: string) => {
    ensureSpace(34)
    doc.moveDown(0.7)
    doc.font('Helvetica-Bold').fontSize(9).fillColor(colors.muted).text(cleanText(title).toUpperCase(), 46, doc.y, { width: pageWidth, characterSpacing: 1.2 })
    doc.moveDown(0.45)
  }

  doc.roundedRect(46, 42, 42, 42, 10).fill(colors.orange)
  doc.font('Helvetica-Bold').fontSize(15).fillColor(colors.ink).text('BF', 57, 55)
  doc.font('Helvetica-Bold').fontSize(19).fillColor(colors.ink).text(cleanText(quote.snapshot.supplierName), 101, 46)
  doc.font('Helvetica').fontSize(8).fillColor(colors.muted).text('BOUW- EN INFRASTRUCTUURPROJECTEN', 101, 70, { characterSpacing: 0.8 })
  doc.font('Helvetica-Bold').fontSize(25).fillColor(colors.ink).text('OFFERTE', 405, 47, { width: 144, align: 'right' })
  doc.font('Helvetica').fontSize(9).fillColor(colors.muted).text(`${quote.number}  |  versie ${quote.version}`, 380, 76, { width: 169, align: 'right' })

  doc.moveTo(46, 101).lineTo(549, 101).lineWidth(1.2).strokeColor(colors.orange).stroke()

  const infoY = 120
  doc.roundedRect(46, infoY, pageWidth, 112, 8).fillAndStroke(colors.soft, colors.line)
  doc.font('Helvetica-Bold').fontSize(8).fillColor(colors.muted).text('AAN', 62, infoY + 17, { characterSpacing: 1 })
  doc.font('Helvetica-Bold').fontSize(12).fillColor(colors.ink).text(cleanText(quote.snapshot.clientName), 62, infoY + 34, { width: 205 })
  doc.font('Helvetica').fontSize(9).fillColor(colors.muted).text(cleanText(quote.snapshot.clientContact), 62, infoY + 53, { width: 205 })
  doc.font('Helvetica-Bold').fontSize(8).fillColor(colors.muted).text('PROJECT', 300, infoY + 17, { characterSpacing: 1 })
  doc.font('Helvetica-Bold').fontSize(12).fillColor(colors.ink).text(cleanText(quote.snapshot.projectTitle), 300, infoY + 34, { width: 230 })
  doc.font('Helvetica').fontSize(9).fillColor(colors.muted).text(`${cleanText(quote.snapshot.projectNumber)}  |  ${cleanText(quote.snapshot.location)}`, 300, infoY + 70, { width: 230 })
  if (quote.snapshot.scenarioName) doc.font('Helvetica-Bold').fontSize(8).fillColor('#9a6505').text(`Scenario: ${cleanText(quote.snapshot.scenarioName)}`, 300, infoY + 88, { width: 230 })

  doc.y = 251
  doc.font('Helvetica-Bold').fontSize(16).fillColor(colors.ink).text(cleanText(quote.content.subject), 46, doc.y, { width: pageWidth })
  doc.moveDown(0.6).font('Helvetica').fontSize(10).fillColor(colors.muted).text(cleanText(quote.content.introduction), 46, doc.y, { width: pageWidth, lineGap: 3 })

  sectionTitle('Prijsopgave')
  const tableX = 46
  const columns = [
    { key: 'code', label: 'POST', x: tableX, width: 50, align: 'left' as const },
    { key: 'description', label: 'OMSCHRIJVING', x: tableX + 50, width: 205, align: 'left' as const },
    { key: 'quantity', label: 'HOEV.', x: tableX + 255, width: 48, align: 'right' as const },
    { key: 'unit', label: 'EH.', x: tableX + 303, width: 34, align: 'center' as const },
    { key: 'unitPrice', label: 'EENHEIDSPRIJS', x: tableX + 337, width: 78, align: 'right' as const },
    { key: 'total', label: 'TOTAAL', x: tableX + 415, width: 88, align: 'right' as const },
  ]
  const drawTableHeader = () => {
    const y = doc.y
    doc.rect(tableX, y, pageWidth, 25).fill(colors.ink)
    for (const column of columns) doc.font('Helvetica-Bold').fontSize(7).fillColor(colors.white).text(column.label, column.x + 5, y + 9, { width: column.width - 10, align: column.align })
    doc.y = y + 25
  }
  drawTableHeader()
  quote.snapshot.lines.forEach((line, index) => {
    const description = cleanText(line.description)
    const rowHeight = Math.max(31, doc.font('Helvetica').fontSize(8.5).heightOfString(description, { width: 195, lineGap: 1 }) + 14)
    if (doc.y + rowHeight > doc.page.height - doc.page.margins.bottom - 82) {
      doc.addPage()
      doc.y = 54
      drawTableHeader()
    }
    const y = doc.y
    if (index % 2 === 1) doc.rect(tableX, y, pageWidth, rowHeight).fill(colors.soft)
    doc.moveTo(tableX, y + rowHeight).lineTo(tableX + pageWidth, y + rowHeight).lineWidth(0.5).strokeColor(colors.line).stroke()
    const values = [cleanText(line.code), description, quantity(line.quantity), cleanText(line.unit), currency(line.unitPrice), currency(line.total)]
    columns.forEach((column, columnIndex) => doc.font(columnIndex === 1 ? 'Helvetica' : 'Helvetica-Bold').fontSize(8.5).fillColor(colors.ink).text(values[columnIndex], column.x + 5, y + 10, { width: column.width - 10, align: column.align, lineGap: 1 }))
    doc.y = y + rowHeight
  })

  ensureSpace(132)
  doc.moveDown(0.8)
  const totalsX = 330
  const totalRows = [
    ['Directe kost', currency(quote.snapshot.directCost)],
    [`Algemene kosten (${quantity(quote.snapshot.overheadPct)}%)`, 'inbegrepen'],
    [`Risico (${quantity(quote.snapshot.riskPct)}%)`, 'inbegrepen'],
    [`Marge (${quantity(quote.snapshot.marginPct)}%)`, 'inbegrepen'],
  ]
  totalRows.forEach(([label, value]) => {
    const y = doc.y
    doc.font('Helvetica').fontSize(9).fillColor(colors.muted).text(label, totalsX, y, { width: 125 })
    doc.font('Helvetica-Bold').fillColor(colors.ink).text(value, totalsX + 125, y, { width: 94, align: 'right' })
    doc.y = y + 18
  })
  const grandY = doc.y + 3
  doc.roundedRect(totalsX - 8, grandY, 227, 38, 6).fill(colors.orangeSoft)
  doc.font('Helvetica-Bold').fontSize(10).fillColor(colors.ink).text('TOTAAL EXCL. BTW', totalsX + 3, grandY + 14, { width: 120 })
  doc.font('Helvetica-Bold').fontSize(13).text(currency(quote.total), totalsX + 122, grandY + 11, { width: 86, align: 'right' })
  doc.y = grandY + 45

  sectionTitle('Commerciele voorwaarden')
  const validityDate = new Date(quote.createdAt)
  validityDate.setDate(validityDate.getDate() + quote.content.validityDays)
  const conditions = [
    ['Uitvoeringstermijn', quote.content.executionTerm],
    ['Betalingsvoorwaarden', quote.content.paymentTerms],
    ['Geldigheid', `${quote.content.validityDays} dagen - tot ${new Intl.DateTimeFormat('nl-BE').format(validityDate)}`],
    ['Prijsherziening', quote.content.priceRevision],
  ]
  conditions.forEach(([label, value]) => {
    ensureSpace(42)
    const y = doc.y
    doc.font('Helvetica-Bold').fontSize(9).fillColor(colors.ink).text(label, 46, y, { width: 125 })
    doc.font('Helvetica').fontSize(9).fillColor(colors.muted).text(cleanText(value), 176, y, { width: 373, lineGap: 2 })
    doc.y = Math.max(y + 26, doc.y + 5)
  })

  if (quote.content.exclusions.length) {
    sectionTitle('Uitsluitingen')
    for (const exclusion of quote.content.exclusions) {
      const textHeight = doc.font('Helvetica').fontSize(9).heightOfString(cleanText(exclusion), { width: 475, lineGap: 2 })
      ensureSpace(textHeight + 8)
      const y = doc.y
      doc.font('Helvetica-Bold').fontSize(9).fillColor(colors.orange).text('-', 50, y, { width: 10, lineBreak: false })
      doc.font('Helvetica').fontSize(9).fillColor(colors.muted).text(cleanText(exclusion), 64, y, { width: 475, lineGap: 2 })
      doc.y = y + textHeight + 6
    }
  }
  if (quote.content.notes) {
    sectionTitle('Opmerkingen')
    doc.font('Helvetica').fontSize(9).fillColor(colors.muted).text(cleanText(quote.content.notes), { lineGap: 2 })
  }

  ensureSpace(75)
  doc.moveDown(1.2)
  const signatureY = doc.y
  doc.roundedRect(46, signatureY, pageWidth, 55, 7).fillAndStroke(colors.soft, colors.line)
  doc.font('Helvetica-Bold').fontSize(10).fillColor(colors.ink).text('Voor akkoord', 61, signatureY + 14)
  doc.font('Helvetica').fontSize(8).fillColor(colors.muted).text('Naam, datum en handtekening opdrachtgever', 61, signatureY + 31)

  const range = doc.bufferedPageRange()
  for (let pageIndex = range.start; pageIndex < range.start + range.count; pageIndex += 1) {
    doc.switchToPage(pageIndex)
    const footerY = doc.page.height - doc.page.margins.bottom - 12
    doc.moveTo(46, footerY - 8).lineTo(549, footerY - 8).lineWidth(0.5).strokeColor(colors.line).stroke()
    doc.font('Helvetica').fontSize(7.5).fillColor(colors.muted).text(`${cleanText(quote.snapshot.supplierName)}  |  ${quote.number}`, 46, footerY, { width: 360, lineBreak: false })
    doc.text(`Pagina ${pageIndex - range.start + 1} van ${range.count}`, 430, footerY, { width: 119, align: 'right', lineBreak: false })
  }

  doc.end()
  return completed
}
