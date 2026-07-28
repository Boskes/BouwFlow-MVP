import { describe, expect, it } from 'vitest'
import { organizationSchema } from './schemas'

const organization = {
  name: 'Bouwpartner NV',
  type: 'Privaat' as const,
  contactName: 'Lies Janssens',
  email: 'lies@example.be',
  vatNumber: 'BE0200000043',
  addressLine: 'Hoofdstraat 1',
  postalCode: '1000',
  city: 'Brussel',
  countryCode: 'BE',
  peppolEndpointId: '',
  peppolSchemeId: '0208',
  roles: ['Klant' as const],
  contacts: [],
}

describe('organizationSchema addresses', () => {
  it('keeps legacy organization payloads compatible', () => {
    expect(organizationSchema.parse(organization).addresses).toEqual([])
  })

  it('accepts one primary typed address', () => {
    const result = organizationSchema.safeParse({
      ...organization,
      addresses: [
        { id: '10000000-0000-4000-8000-000000000001', type: 'Bezoekadres', label: 'Kantoor', addressLine: 'Kantoorstraat 2', postalCode: '2000', city: 'Antwerpen', countryCode: 'BE', isPrimary: true, notes: '' },
        { id: '10000000-0000-4000-8000-000000000002', type: 'Facturatieadres', label: 'Boekhouding', addressLine: 'Factuurstraat 3', postalCode: '9000', city: 'Gent', countryCode: 'BE', isPrimary: false, notes: '' },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('rejects several primary addresses', () => {
    const result = organizationSchema.safeParse({
      ...organization,
      addresses: [
        { id: '10000000-0000-4000-8000-000000000001', type: 'Bezoekadres', label: 'Kantoor', addressLine: 'Kantoorstraat 2', postalCode: '2000', city: 'Antwerpen', countryCode: 'BE', isPrimary: true, notes: '' },
        { id: '10000000-0000-4000-8000-000000000002', type: 'Facturatieadres', label: 'Boekhouding', addressLine: 'Factuurstraat 3', postalCode: '9000', city: 'Gent', countryCode: 'BE', isPrimary: true, notes: '' },
      ],
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues.some(issue => issue.path[0] === 'addresses')).toBe(true)
  })
})
