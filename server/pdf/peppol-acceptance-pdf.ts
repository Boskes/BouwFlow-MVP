import PDFDocument from 'pdfkit'
import type { PeppolAcceptanceRun } from '../../src/domain.js'

export interface PeppolAcceptancePdfContext {
  run: PeppolAcceptanceRun
  invoiceNumber: string
  projectNumber: string
  projectName: string
  senderName: string
  recipientName: string
}

const colors = { ink: '#17212b', muted: '#6f7d89', line: '#dfe5e9', soft: '#f5f7f8', orange: '#f5a623', green: '#28734d', greenSoft: '#eff8f2', red: '#a3473c', redSoft: '#fff4f2', amber: '#967025', amberSoft: '#fff8e8', white: '#ffffff' }
const clean = (value: string) => value.replace(/[\u2010-\u2015]/g, '-').replace(/\u00a0/g, ' ')
const dateTime = (value?: string) => value ? new Intl.DateTimeFormat('nl-BE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Brussels' }).format(new Date(value)) : '-'

export async function renderPeppolAcceptancePdf(context: PeppolAcceptancePdfContext): Promise<Buffer> {
  const { run } = context
  const doc = new PDFDocument({ size: 'A4', margins: { top: 42, right: 46, bottom: 48, left: 46 }, bufferPages: true, info: { Title: `Peppol acceptatierapport - ${context.invoiceNumber}`, Author: 'BouwFlow', Subject: `Run ${run.id}` } })
  const chunks: Buffer[] = []
  doc.on('data', chunk => chunks.push(Buffer.from(chunk)))
  const completed = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
  })
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right

  doc.roundedRect(46, 42, 42, 42, 10).fill(colors.orange)
  doc.font('Helvetica-Bold').fontSize(15).fillColor(colors.ink).text('BF', 57, 55)
  doc.font('Helvetica-Bold').fontSize(19).fillColor(colors.ink).text('PEPPOL ACCEPTATIERAPPORT', 101, 47, { width: 360 })
  doc.font('Helvetica').fontSize(8).fillColor(colors.muted).text('PRODUCTIEVRIJGAVE EN NETWERKBEWIJS', 101, 72, { characterSpacing: 0.8 })
  const statusColor = run.status === 'Geslaagd' ? colors.green : run.status === 'Mislukt' ? colors.red : colors.amber
  const statusSoft = run.status === 'Geslaagd' ? colors.greenSoft : run.status === 'Mislukt' ? colors.redSoft : colors.amberSoft
  doc.roundedRect(445, 49, 104, 28, 7).fill(statusSoft)
  doc.font('Helvetica-Bold').fontSize(9).fillColor(statusColor).text(clean(run.status).toUpperCase(), 451, 59, { width: 92, align: 'center' })
  doc.moveTo(46, 101).lineTo(549, 101).lineWidth(1.2).strokeColor(colors.orange).stroke()

  const infoY = 119
  doc.roundedRect(46, infoY, width, 126, 8).fillAndStroke(colors.soft, colors.line)
  const info = [
    ['FACTUUR', context.invoiceNumber, 62, infoY + 18],
    ['PROJECT', `${context.projectNumber} - ${context.projectName}`, 300, infoY + 18],
    ['VERZENDER', context.senderName, 62, infoY + 65],
    ['ONTVANGER', context.recipientName, 300, infoY + 65],
  ] as const
  for (const [label, value, x, y] of info) {
    doc.font('Helvetica-Bold').fontSize(7).fillColor(colors.muted).text(label, x, y, { width: 220, characterSpacing: 0.8 })
    doc.font('Helvetica-Bold').fontSize(10).fillColor(colors.ink).text(clean(value), x, y + 15, { width: 220 })
  }

  doc.y = 264
  doc.font('Helvetica-Bold').fontSize(9).fillColor(colors.muted).text('CONTROLESTAPPEN', 46, doc.y, { width, characterSpacing: 1.1 })
  doc.y += 19
  for (let index = 0; index < run.steps.length; index += 1) {
    const step = run.steps[index]
    const y = doc.y
    const stepColor = step.status === 'Geslaagd' ? colors.green : step.status === 'Mislukt' ? colors.red : colors.amber
    const stepSoft = step.status === 'Geslaagd' ? colors.greenSoft : step.status === 'Mislukt' ? colors.redSoft : colors.amberSoft
    doc.roundedRect(46, y, width, 54, 8).fillAndStroke(stepSoft, colors.line)
    doc.circle(68, y + 27, 12).fill(stepColor)
    doc.font('Helvetica-Bold').fontSize(9).fillColor(colors.white).text(String(index + 1), 61, y + 23, { width: 14, align: 'center' })
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(colors.ink).text(clean(step.label), 91, y + 10, { width: 210 })
    doc.font('Helvetica').fontSize(7.5).fillColor(colors.muted).text(clean(step.message), 91, y + 27, { width: 340, height: 20, ellipsis: true })
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(stepColor).text(clean(step.status).toUpperCase(), 440, y + 11, { width: 93, align: 'right' })
    doc.font('Helvetica').fontSize(6.8).fillColor(colors.muted).text(dateTime(step.at), 420, y + 30, { width: 113, align: 'right' })
    doc.y = y + 62
  }

  const releaseY = doc.y + 6
  const released = Boolean(run.releasedAt)
  doc.roundedRect(46, releaseY, width, released ? 91 : 72, 8).fillAndStroke(released ? colors.greenSoft : colors.redSoft, released ? '#b8dbc5' : '#e7bdb7')
  doc.font('Helvetica-Bold').fontSize(9).fillColor(released ? colors.green : colors.red).text(released ? 'VRIJGEGEVEN VOOR PRODUCTIE' : 'NIET VRIJGEGEVEN VOOR PRODUCTIE', 62, releaseY + 14, { width: 280, characterSpacing: 0.6 })
  if (released) {
    doc.font('Helvetica-Bold').fontSize(9).fillColor(colors.ink).text(clean(run.releasedBy ?? ''), 62, releaseY + 34, { width: 220 })
    doc.font('Helvetica').fontSize(7.5).fillColor(colors.muted).text(dateTime(run.releasedAt), 300, releaseY + 35, { width: 233, align: 'right' })
    doc.font('Helvetica').fontSize(7.5).fillColor(colors.muted).text(clean(run.releaseNotes ?? ''), 62, releaseY + 55, { width: 471, height: 24, ellipsis: true })
  } else {
    doc.font('Helvetica').fontSize(8).fillColor(colors.red).text('Dit rapport is bewijs van de technische run, maar vormt nog geen formele productievrijgave.', 62, releaseY + 37, { width: 471 })
  }

  const auditY = releaseY + (released ? 108 : 89)
  doc.font('Helvetica-Bold').fontSize(7).fillColor(colors.muted).text('AUDITREFERENTIES', 46, auditY, { characterSpacing: 0.8 })
  doc.font('Helvetica').fontSize(6.8).fillColor(colors.muted).text(`Run-ID: ${run.id}`, 46, auditY + 15, { width })
  doc.text(`Documentdigest: ${run.documentDigest}`, 46, auditY + 28, { width })
  doc.text(`Validatierapport: ${run.validationReportId ?? '-'}  |  Levering: ${run.deliveryId ?? '-'}`, 46, auditY + 41, { width })

  const footerY = doc.page.height - doc.page.margins.bottom - 12
  doc.moveTo(46, footerY - 8).lineTo(549, footerY - 8).lineWidth(0.5).strokeColor(colors.line).stroke()
  doc.font('Helvetica').fontSize(7).fillColor(colors.muted).text(`BouwFlow  |  gegenereerd ${dateTime(new Date().toISOString())}`, 46, footerY, { width: 370, lineBreak: false })
  doc.text('Pagina 1 van 1', 430, footerY, { width: 119, align: 'right', lineBreak: false })

  doc.end()
  return completed
}
