import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { Quote } from '../../src/domain.js'
import { renderQuotePdf } from './quote-pdf.js'

const descriptions = [
  'Opbraak bestaande asfaltverharding, inclusief laden en afvoer',
  'Uitgraving voor wegkoffer volgens het goedgekeurde uitvoeringsplan',
  'Fundering in steenslag type II, geleverd en verdicht',
  'Plaatsen van lijnvormige elementen in prefab beton',
  'Onderlaag in asfaltbeton met voorafgaande kleeflaag',
  'Toplaag in asfaltbeton met aangepaste korrelverdeling',
  'Aanbrengen van wegmarkeringen en lokale signalisatie',
  'Herprofileren van bermen en herstel van de groenzone',
]

const lines = Array.from({ length: 15 }, (_, index) => {
  const quantity = 125 + index * 37.5
  const unitPrice = 18.5 + index * 2.35
  return {
    chapterCode: String(Math.floor(index / 4) + 1).padStart(2, '0'),
    code: `${String(Math.floor(index / 4) + 1).padStart(2, '0')}.${String(index + 1).padStart(2, '0')}`,
    description: descriptions[index % descriptions.length],
    quantity,
    unit: index % 3 === 0 ? 'm3' : 'm2',
    unitPrice,
    total: Number((quantity * unitPrice).toFixed(2)),
  }
})
const total = Number(lines.reduce((sum, line) => sum + line.total, 0).toFixed(2))

const quote: Quote = {
  id: 'sample-quote', number: 'OFF-2026-041', calculationId: 'sample-calculation', scenarioId: 'sample-scenario', version: 2, total, createdAt: '2026-07-19T10:00:00.000Z',
  content: {
    subject: 'Offerte herinrichting N72 - fase 2',
    introduction: 'Geachte, hierbij bezorgen wij u onze prijsopgave voor de herinrichting van de N72. Deze offerte is gebaseerd op de aangeleverde meetstaat en het gekozen verwachte uitvoeringsscenario.',
    executionTerm: '120 werkdagen vanaf het schriftelijke aanvangsbevel, volgens de gezamenlijk goedgekeurde fasering.',
    paymentTerms: 'Maandelijkse vorderingsstaten, betaalbaar binnen 30 kalenderdagen na factuurdatum.',
    validityDays: 45,
    priceRevision: 'Volgens de prijsherzieningsformule opgenomen in het bijzonder bestek.',
    exclusions: ['Sanering van niet vooraf gemelde bodemverontreiniging.', 'Verlegging van onbekende nutsleidingen.', 'Nacht- en weekendwerk buiten de beschreven fasering.'],
    notes: 'Definitieve uitvoering is onder voorbehoud van tijdige vergunningen, planvrijgave en beschikbaarheid van de werfzone.',
  },
  snapshot: {
    supplierName: 'BouwFlow Wegenbouw NV', clientName: 'Agentschap Wegen en Verkeer', clientContact: 'Peter Vrancken', projectTitle: 'Herinrichting N72 - fase 2', projectNumber: 'OPP-2026-041', location: 'Limburg', scenarioName: 'Verwacht', lines, directCost: Number((total * 0.79).toFixed(2)), overheadPct: 8, riskPct: 3, marginPct: 10, total,
  },
}

const outputDirectory = resolve('output', 'pdf')
await mkdir(outputDirectory, { recursive: true })
const outputPath = resolve(outputDirectory, 'bouwflow-offerte-voorbeeld.pdf')
await writeFile(outputPath, await renderQuotePdf(quote))
console.log(outputPath)
