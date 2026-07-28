import { invoiceExportReadiness, type InvoiceExportContext } from './invoice-readiness.js'
import { organizationAddress } from './domain.js'
export { invoiceExportReadiness, type InvoiceExportContext } from './invoice-readiness.js'

const xml = (value: string | number) => String(value).replace(/[<>&"']/g, character => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[character]!)
const amount = (value: number) => value.toFixed(2)
const countryCode = (country: string) => ({ 'België': 'BE', Belgium: 'BE', Nederland: 'NL', Netherlands: 'NL', Frankrijk: 'FR', France: 'FR', Duitsland: 'DE', Germany: 'DE' })[country] ?? country.slice(0, 2).toUpperCase()
const taxCategory = (vatPct: number) => vatPct === 0 ? 'Z' : 'S'
export function buildInvoiceUblDraft({ invoice, entity, customer, project, statement }: InvoiceExportContext) {
  const currency = entity.currency || 'EUR'
  const supplierCountry = entity.countryCode || countryCode(entity.country)
  const customerAddress = organizationAddress(customer, 'Facturatieadres')
  const readiness = invoiceExportReadiness({ invoice, entity, customer, project, statement })
  const peppolProfile = readiness.ready ? `
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0</cbc:CustomizationID>
  <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>` : ''
  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>${peppolProfile}
  <cbc:ID>${xml(invoice.number)}</cbc:ID>
  <cbc:IssueDate>${xml(invoice.invoiceDate)}</cbc:IssueDate>
  <cbc:DueDate>${xml(invoice.dueDate)}</cbc:DueDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>${xml(currency)}</cbc:DocumentCurrencyCode>
  <cbc:BuyerReference>${xml(project.number)}</cbc:BuyerReference>
  <cac:OrderReference><cbc:ID>${xml(project.number)}</cbc:ID></cac:OrderReference>
  <cac:AccountingSupplierParty>
    <cac:Party>
      ${entity.peppolEndpointId ? `<cbc:EndpointID schemeID="${xml(entity.peppolSchemeId)}">${xml(entity.peppolEndpointId.replace(/\D/g, ''))}</cbc:EndpointID>` : ''}
      <cac:PartyName><cbc:Name>${xml(entity.name)}</cbc:Name></cac:PartyName>
      <cac:PostalAddress><cbc:StreetName>${xml(entity.addressLine)}</cbc:StreetName><cbc:CityName>${xml(entity.city)}</cbc:CityName><cbc:PostalZone>${xml(entity.postalCode)}</cbc:PostalZone><cac:Country><cbc:IdentificationCode>${xml(supplierCountry)}</cbc:IdentificationCode></cac:Country></cac:PostalAddress>
      <cac:PartyTaxScheme><cbc:CompanyID>${xml(entity.vatNumber)}</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>
      <cac:PartyLegalEntity><cbc:RegistrationName>${xml(entity.name)}</cbc:RegistrationName><cbc:CompanyID${entity.peppolEndpointId ? ` schemeID="${xml(entity.peppolSchemeId)}"` : ''}>${xml(entity.peppolEndpointId ? entity.peppolEndpointId.replace(/\D/g, '') : entity.vatNumber)}</cbc:CompanyID></cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      ${customer.peppolEndpointId ? `<cbc:EndpointID schemeID="${xml(customer.peppolSchemeId)}">${xml(customer.peppolEndpointId.replace(/\D/g, ''))}</cbc:EndpointID>` : ''}
      <cac:PartyName><cbc:Name>${xml(customer.name)}</cbc:Name></cac:PartyName>
      <cac:PostalAddress><cbc:StreetName>${xml(customerAddress.addressLine)}</cbc:StreetName><cbc:CityName>${xml(customerAddress.city)}</cbc:CityName><cbc:PostalZone>${xml(customerAddress.postalCode)}</cbc:PostalZone><cac:Country><cbc:IdentificationCode>${xml(customerAddress.countryCode)}</cbc:IdentificationCode></cac:Country></cac:PostalAddress>
      <cac:PartyTaxScheme><cbc:CompanyID>${xml(customer.vatNumber)}</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>
      <cac:PartyLegalEntity><cbc:RegistrationName>${xml(customer.name)}</cbc:RegistrationName><cbc:CompanyID${customer.peppolEndpointId ? ` schemeID="${xml(customer.peppolSchemeId)}"` : ''}>${xml(customer.peppolEndpointId ? customer.peppolEndpointId.replace(/\D/g, '') : customer.vatNumber)}</cbc:CompanyID></cac:PartyLegalEntity>
      <cac:Contact><cbc:Name>${xml(customer.contactName)}</cbc:Name><cbc:ElectronicMail>${xml(customer.email)}</cbc:ElectronicMail></cac:Contact>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:PaymentMeans>
    <cbc:PaymentMeansCode name="Credit transfer">30</cbc:PaymentMeansCode>
    <cbc:PaymentDueDate>${xml(invoice.dueDate)}</cbc:PaymentDueDate>
    <cbc:PaymentID>${xml(invoice.number)}</cbc:PaymentID>
    <cac:PayeeFinancialAccount><cbc:ID>${xml(entity.iban.replace(/\s/g, ''))}</cbc:ID>${entity.bic ? `<cac:FinancialInstitutionBranch><cbc:ID>${xml(entity.bic)}</cbc:ID></cac:FinancialInstitutionBranch>` : ''}</cac:PayeeFinancialAccount>
  </cac:PaymentMeans>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${xml(currency)}">${amount(invoice.vatAmount)}</cbc:TaxAmount>
    <cac:TaxSubtotal><cbc:TaxableAmount currencyID="${xml(currency)}">${amount(invoice.subtotal)}</cbc:TaxableAmount><cbc:TaxAmount currencyID="${xml(currency)}">${amount(invoice.vatAmount)}</cbc:TaxAmount><cac:TaxCategory><cbc:ID>${taxCategory(invoice.vatPct)}</cbc:ID><cbc:Percent>${amount(invoice.vatPct)}</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${xml(currency)}">${amount(invoice.subtotal)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${xml(currency)}">${amount(invoice.subtotal)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${xml(currency)}">${amount(invoice.total)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="${xml(currency)}">${amount(invoice.total)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  <cac:InvoiceLine>
    <cbc:ID>1</cbc:ID><cbc:InvoicedQuantity unitCode="C62">1</cbc:InvoicedQuantity><cbc:LineExtensionAmount currencyID="${xml(currency)}">${amount(invoice.subtotal)}</cbc:LineExtensionAmount>
    <cac:Item><cbc:Description>${xml(`Vorderingsstaat ${statement.number}, periode ${statement.periodStart} tot ${statement.periodEnd}`)}</cbc:Description><cbc:Name>${xml(project.name)}</cbc:Name><cac:ClassifiedTaxCategory><cbc:ID>${taxCategory(invoice.vatPct)}</cbc:ID><cbc:Percent>${amount(invoice.vatPct)}</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:ClassifiedTaxCategory></cac:Item>
    <cac:Price><cbc:PriceAmount currencyID="${xml(currency)}">${amount(invoice.subtotal)}</cbc:PriceAmount></cac:Price>
  </cac:InvoiceLine>
</Invoice>`
}

const csvCell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`

export function buildAccountingCsv(context: InvoiceExportContext) {
  const { invoice, entity, customer, project, statement } = context
  const columns = ['Factuurnummer', 'Factuurdatum', 'Vervaldatum', 'Entiteit', 'Btw-nummer verkoper', 'Klant', 'Project', 'Vorderingsstaat', 'Valuta', 'Netto', 'Btw-percentage', 'Btw-bedrag', 'Totaal', 'IBAN', 'Status']
  const values = [invoice.number, invoice.invoiceDate, invoice.dueDate, entity.name, entity.vatNumber, customer.name, project.number, statement.number, entity.currency, amount(invoice.subtotal), amount(invoice.vatPct), amount(invoice.vatAmount), amount(invoice.total), entity.iban, invoice.status]
  return `\uFEFF${columns.map(csvCell).join(';')}\r\n${values.map(csvCell).join(';')}\r\n`
}
