import { describe, expect, it, vi } from 'vitest'
import { HttpPeppolValidator, PreflightPeppolValidator } from './validator'

const completeUbl = `<?xml version="1.0"?>
<Invoice xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2">
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0</cbc:CustomizationID>
  <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>
  <cbc:EndpointID schemeID="0208">0123456749</cbc:EndpointID>
  <cbc:EndpointID schemeID="0208">0200000043</cbc:EndpointID>
  <cac:PaymentMeans><cac:PayeeFinancialAccount><cbc:ID>BE68539007547034</cbc:ID></cac:PayeeFinancialAccount></cac:PaymentMeans>
  <cac:InvoiceLine><cbc:ID>1</cbc:ID></cac:InvoiceLine><cbc:PayableAmount currencyID="EUR">121.00</cbc:PayableAmount>
</Invoice>`

describe('Peppol-validatie', () => {
  it('onderscheidt een geslaagde lokale preflight van netwerkklare Schematron-validatie', async () => {
    const validator = new PreflightPeppolValidator()
    const report = await validator.validate(completeUbl)

    expect(validator.networkReady).toBe(false)
    expect(report).toMatchObject({ status: 'Geslaagd', source: 'Preflight', networkReady: false, issues: [] })
  })

  it('rapporteert ontbrekende technische basisgegevens als afzonderlijke fouten', async () => {
    const report = await new PreflightPeppolValidator().validate('<Invoice />')

    expect(report.status).toBe('Afgekeurd')
    expect(report.issues).toHaveLength(5)
    expect(report.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'BF-PRE-001' }), expect.objectContaining({ code: 'BF-PRE-003' })]))
  })

  it('markeert alleen een geslaagde externe controle zonder fouten als netwerk-klaar', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ valid: true, engine: 'Test Schematron 3.0.20', issues: [{ code: 'TEST-WARN', severity: 'warning', message: 'Niet-blokkerende melding' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as unknown as typeof fetch
    const validator = new HttpPeppolValidator('https://validator.example.test', fetcher)
    const report = await validator.validate(completeUbl)

    expect(validator.networkReady).toBe(true)
    expect(fetcher).toHaveBeenCalledWith('https://validator.example.test', expect.objectContaining({ method: 'POST', body: completeUbl }))
    expect(report).toMatchObject({ status: 'Geslaagd', source: 'Extern', engine: 'Test Schematron 3.0.20', networkReady: true })
    expect(report.issues[0]).toMatchObject({ code: 'TEST-WARN', severity: 'Waarschuwing' })
  })
})
