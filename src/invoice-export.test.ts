import { describe, expect, it } from 'vitest'
import { buildAccountingCsv, buildInvoiceUblDraft, invoiceExportReadiness, type InvoiceExportContext } from './invoice-export'

const context: InvoiceExportContext = {
  entity: { id: 'entity-1', name: 'Bouw & Flow NV', vatNumber: 'BE0123456749', country: 'België', currency: 'EUR', active: true, invoicePrefix: 'BF', nextInvoiceNumber: 2, defaultVatPct: 21, iban: 'BE68 5390 0754 7034', bic: 'KREDBEBB', paymentTermsDays: 30, addressLine: 'Industrieweg 42', postalCode: '3500', city: 'Hasselt', countryCode: 'BE', peppolEndpointId: '0123456749', peppolSchemeId: '0208', createdAt: '2026-01-01' },
  customer: { id: 'customer-1', name: 'Gemeente Test', type: 'Overheid', contactName: 'Els Janssens', email: 'els@example.be', vatNumber: 'BE0200000043', addressLine: 'Markt 1', postalCode: '1000', city: 'Brussel', countryCode: 'BE', peppolEndpointId: '0200000043', peppolSchemeId: '0208' },
  project: { id: 'project-1', number: 'PRJ-001', name: 'Brug & tunnel', organizationId: 'customer-1', legalEntityId: 'entity-1', sourceCalculationId: 'calc-1', contractValue: 100000, costBudget: 80000, marginPct: 20, progress: 30, status: 'Op schema', handover: { status: 'Concept', projectManager: '', plannedStart: '', plannedEnd: '', notes: '', risks: [], checklist: { scopeReviewed: false, budgetReviewed: false, contractReviewed: false, documentsTransferred: false, risksReviewed: false, kickoffPlanned: false } }, workPackages: [], planning: { status: 'Concept', baselineVersion: 0, activities: [], updatedAt: '2026-01-01' } },
  statement: { id: 'statement-1', number: 'VS-001', projectId: 'project-1', periodStart: '2026-06-01', periodEnd: '2026-06-30', lines: [], changeOrderIds: [], workAmount: 1000, changeOrderAmount: 0, priceRevisionAmount: 0, grossAmount: 1000, retentionPct: 0, retentionAmount: 0, netAmount: 1000, status: 'Factuurconcept', notes: '', createdAt: '2026-07-01' },
  invoice: { id: 'invoice-1', number: 'BF-2026-00001', legalEntityId: 'entity-1', projectId: 'project-1', progressStatementId: 'statement-1', invoiceDate: '2026-07-01', dueDate: '2026-07-31', subtotal: 1000, vatPct: 21, vatAmount: 210, total: 1210, status: 'Concept', createdAt: '2026-07-01' },
}

describe('invoice exports', () => {
  it('builds a UBL 2.1 invoice draft with escaped values and balanced totals', () => {
    const result = buildInvoiceUblDraft(context)
    expect(result).toContain('<cbc:UBLVersionID>2.1</cbc:UBLVersionID>')
    expect(result).toContain('poacc:billing:3.0')
    expect(result).toContain('<cbc:EndpointID schemeID="0208">0123456749</cbc:EndpointID>')
    expect(result).toContain('<cbc:ID>BF-2026-00001</cbc:ID>')
    expect(result).toContain('Bouw &amp; Flow NV')
    expect(result).toContain('Brug &amp; tunnel')
    expect(result).toContain('<cbc:PayableAmount currencyID="EUR">1210.00</cbc:PayableAmount>')
    expect(result).toContain('<cbc:ID>BE68539007547034</cbc:ID>')
  })

  it('builds a semicolon-delimited accounting export', () => {
    const result = buildAccountingCsv(context)
    expect(result.startsWith('\uFEFF')).toBe(true)
    expect(result).toContain('"Factuurnummer";"Factuurdatum"')
    expect(result).toContain('"BF-2026-00001"')
    expect(result).toContain('"1210.00"')
  })

  it('reports missing export master data', () => {
    expect(invoiceExportReadiness(context).ready).toBe(true)
    const incomplete = { ...context, entity: { ...context.entity, iban: '' } }
    expect(invoiceExportReadiness(incomplete)).toMatchObject({ ready: false })
    const invalidEndpoint = { ...context, customer: { ...context.customer, peppolEndpointId: '0200000044' } }
    expect(invoiceExportReadiness(invalidEndpoint).ready).toBe(false)
    expect(buildInvoiceUblDraft(invalidEndpoint)).not.toContain('<cbc:CustomizationID>')
  })

  it('uses the typed billing address instead of the primary visiting address', () => {
    const typedAddressContext: InvoiceExportContext = {
      ...context,
      customer: {
        ...context.customer,
        addresses: [
          { id: 'visit-1', type: 'Bezoekadres', label: 'Kantoor', addressLine: 'Werflaan 10', postalCode: '2000', city: 'Antwerpen', countryCode: 'BE', isPrimary: true, notes: '' },
          { id: 'billing-1', type: 'Facturatieadres', label: 'Boekhouding', addressLine: 'Factuurstraat 25', postalCode: '9000', city: 'Gent', countryCode: 'BE', isPrimary: false, notes: '' },
        ],
      },
    }
    const result = buildInvoiceUblDraft(typedAddressContext)
    expect(invoiceExportReadiness(typedAddressContext).ready).toBe(true)
    expect(result).toContain('<cbc:StreetName>Factuurstraat 25</cbc:StreetName>')
    expect(result).toContain('<cbc:CityName>Gent</cbc:CityName>')
    expect(result).not.toContain('<cbc:StreetName>Werflaan 10</cbc:StreetName>')
  })
})
