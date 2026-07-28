import type { LegalEntity, Organization, ProgressStatement, Project, SalesInvoice } from './domain.js'
import { organizationAddress } from './domain.js'

export interface InvoiceExportContext {
  invoice: SalesInvoice
  entity: LegalEntity
  customer: Organization
  project: Project
  statement: ProgressStatement
}

const validBelgianEndpoint = (endpoint: string, scheme: string) => {
  if (!endpoint || !scheme) return false
  if (scheme !== '0208') return true
  const digits = endpoint.replace(/\D/g, '')
  return /^[01]\d{9}$/.test(digits) && 97 - (Number(digits.slice(0, 8)) % 97) === Number(digits.slice(8))
}

export function invoiceExportReadiness(context: InvoiceExportContext) {
  const customerAddress = organizationAddress(context.customer, 'Facturatieadres')
  const checks = [
    { label: 'Verkoper en btw-nummer', ready: Boolean(context.entity.name && context.entity.vatNumber) },
    { label: 'Volledig verkopersadres', ready: Boolean(context.entity.addressLine && context.entity.postalCode && context.entity.city && context.entity.countryCode) },
    { label: 'Geldig Peppol-endpoint verkoper', ready: validBelgianEndpoint(context.entity.peppolEndpointId, context.entity.peppolSchemeId) },
    { label: 'Ontvangstrekening', ready: Boolean(context.entity.iban) },
    { label: 'Klant, btw-nummer en e-mailadres', ready: Boolean(context.customer.name && context.customer.vatNumber && context.customer.email) },
    { label: 'Volledig klantadres', ready: Boolean(customerAddress.addressLine && customerAddress.postalCode && customerAddress.city && customerAddress.countryCode) },
    { label: 'Geldig Peppol-endpoint klant', ready: validBelgianEndpoint(context.customer.peppolEndpointId, context.customer.peppolSchemeId) },
    { label: 'Project- en factuurreferentie', ready: Boolean(context.project.number && context.invoice.number) },
  ]
  return { checks, ready: checks.every(check => check.ready) }
}
