import type { PeppolValidationIssue, PeppolValidationReportInput } from '../../src/domain.js'

export interface PeppolValidator {
  readonly networkReady?: boolean
  validate(xml: string): Promise<PeppolValidationReportInput>
}

const profile = 'Peppol BIS Billing 3.0 / UBL 2.1'
const issue = (code: string, message: string, path?: string): PeppolValidationIssue => ({ code, severity: 'Fout', message, path })

export class PreflightPeppolValidator implements PeppolValidator {
  readonly networkReady = false

  async validate(xml: string): Promise<PeppolValidationReportInput> {
    const issues: PeppolValidationIssue[] = []
    const requireValue = (present: boolean, code: string, message: string, path: string) => { if (!present) issues.push(issue(code, message, path)) }
    requireValue(xml.includes('<cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0</cbc:CustomizationID>'), 'BF-PRE-001', 'Peppol BIS CustomizationID ontbreekt', '/Invoice/CustomizationID')
    requireValue(xml.includes('<cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>'), 'BF-PRE-002', 'Peppol Billing ProfileID ontbreekt', '/Invoice/ProfileID')
    requireValue((xml.match(/<cbc:EndpointID schemeID=/g) ?? []).length === 2, 'BF-PRE-003', 'Verkoper en klant moeten elk een endpoint-ID hebben', '/Invoice/*/Party/EndpointID')
    requireValue(xml.includes('<cac:PaymentMeans>') && xml.includes('<cac:PayeeFinancialAccount>'), 'BF-PRE-004', 'Betaalinstructies of ontvangstrekening ontbreken', '/Invoice/PaymentMeans')
    requireValue(xml.includes('<cac:InvoiceLine>') && xml.includes('<cbc:PayableAmount'), 'BF-PRE-005', 'Factuurregel of te betalen totaal ontbreekt', '/Invoice')
    return { status: issues.length ? 'Afgekeurd' : 'Geslaagd', source: 'Preflight', engine: 'BouwFlow preflight 1.0', profile, networkReady: false, issues }
  }
}

interface ExternalValidationResponse {
  valid?: boolean
  status?: string
  engine?: string
  profile?: string
  issues?: Array<{ code?: string; severity?: string; message?: string; path?: string }>
}

export class HttpPeppolValidator implements PeppolValidator {
  readonly networkReady = true

  constructor(private readonly url: string, private readonly fetcher: typeof fetch = fetch) {}

  async validate(xml: string): Promise<PeppolValidationReportInput> {
    try {
      const response = await this.fetcher(this.url, { method: 'POST', headers: { 'Content-Type': 'application/xml; charset=utf-8', Accept: 'application/json' }, body: xml, signal: AbortSignal.timeout(20_000) })
      const body = await response.text()
      if (!response.ok) return { status: 'Fout', source: 'Extern', engine: 'Externe validator', profile, networkReady: false, issues: [issue(`HTTP-${response.status}`, `Validator antwoordde met HTTP ${response.status}: ${body.slice(0, 500)}`)] }
      const parsed = JSON.parse(body) as ExternalValidationResponse
      const issues = (parsed.issues ?? []).map(item => ({ code: item.code ?? 'EXTERNAL', severity: item.severity?.toLowerCase().includes('warn') ? 'Waarschuwing' as const : 'Fout' as const, message: item.message ?? 'Validatiemelding zonder omschrijving', path: item.path }))
      const valid = parsed.valid ?? (parsed.status?.toLowerCase() === 'valid')
      return { status: valid ? 'Geslaagd' : 'Afgekeurd', source: 'Extern', engine: parsed.engine ?? 'Externe Schematron-validator', profile: parsed.profile ?? profile, networkReady: valid && !issues.some(item => item.severity === 'Fout'), issues }
    } catch (error) {
      return { status: 'Fout', source: 'Extern', engine: 'Externe validator', profile, networkReady: false, issues: [issue('VALIDATOR-UNAVAILABLE', error instanceof Error ? error.message : 'De externe validator is niet bereikbaar')] }
    }
  }
}

export function createPeppolValidator(url = process.env.PEPPOL_VALIDATOR_URL): PeppolValidator {
  return url ? new HttpPeppolValidator(url) : new PreflightPeppolValidator()
}
