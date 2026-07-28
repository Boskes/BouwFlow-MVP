import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { PeppolAcceptanceRun } from '../../src/domain.js'
import { renderPeppolAcceptancePdf } from './peppol-acceptance-pdf.js'

const startedAt = '2027-06-01T08:15:00.000Z'
const run: PeppolAcceptanceRun = {
  id: '8cde9f46-42ee-4fbd-958d-26cc827a1976',
  invoiceId: 'a1f93de4-e16f-45fc-b659-9df6bfad2078',
  status: 'Geslaagd',
  documentDigest: '4af936b74c06678c6ad8220bb65bdb9318df731c9f351babc57fbbc609688ee8',
  validationReportId: '5a7a1080-8a21-4302-a0bd-cf6ec8a15dcc',
  deliveryId: '1e9f9a63-18f2-46df-b785-6c1839c9d3d6',
  steps: [
    { id: 'configuration', label: 'Productieconfiguratie', status: 'Geslaagd', message: 'Validator, accesspoint, webhook en statusmonitor zijn actief.', at: startedAt },
    { id: 'validation', label: 'Externe validatie', status: 'Geslaagd', message: 'Peppol Schematron 3.0.20 bevestigt het Peppol BIS Billing-profiel.', at: '2027-06-01T08:15:08.000Z', reference: '5a7a1080-8a21-4302-a0bd-cf6ec8a15dcc' },
    { id: 'submission', label: 'Aanlevering accesspoint', status: 'Geslaagd', message: 'Document door het gecertificeerde accesspoint geaccepteerd.', at: '2027-06-01T08:15:13.000Z', reference: 'AP-2027-0007788' },
    { id: 'delivery', label: 'Netwerkaflevering', status: 'Geslaagd', message: 'Positieve AS4-ontvangstbevestiging van het ontvangende accesspoint.', at: '2027-06-01T08:16:42.000Z', reference: 'AP-2027-0007788' },
  ],
  startedBy: '10000000-0000-4000-8000-000000000099',
  startedAt,
  completedAt: '2027-06-01T08:16:42.000Z',
  releasedBy: 'Karel De Smet',
  releasedAt: '2027-06-01T08:22:00.000Z',
  releaseNotes: 'Readiness, validatierapport en netwerkaflevering gecontroleerd. Productiegebruik goedgekeurd.',
}

const outputDirectory = resolve('output', 'pdf')
await mkdir(outputDirectory, { recursive: true })
const outputPath = resolve(outputDirectory, 'bouwflow-peppol-acceptatierapport-voorbeeld.pdf')
await writeFile(outputPath, await renderPeppolAcceptancePdf({ run, invoiceNumber: 'ACC-2027-00001', projectNumber: 'PRJ-2027-0042', projectName: 'Herinrichting Stationsomgeving', senderName: 'BouwFlow Construct NV', recipientName: 'Stad Voorbeeld' }))
console.log(outputPath)
