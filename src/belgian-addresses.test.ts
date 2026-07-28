import { describe, expect, it } from 'vitest'
import { normalizeBelgianAddressResponse } from './belgian-addresses'

describe('Belgische adressen', () => {
  it('zet de online providerrespons om naar eenduidige BouwFlow-adressen', () => {
    const suggestions = normalizeBelgianAddressResponse({
      results: [
        { country: 'be', straat: 'Wetstraat', huisnummer: 16, postcode: '1000', plaats: 'Brussel', gemeente: 'Brussel', provincie: 'Brussels Hoofdstedelijk Gewest', lat: 50.8466, lon: 4.3678 },
        { country: 'nl', straat: 'Wetstraat', huisnummer: 16, postcode: '1012AB', plaats: 'Amsterdam' },
      ],
    }, 'Testbron')

    expect(suggestions).toEqual([expect.objectContaining({
      addressLine: 'Wetstraat 16',
      postalCode: '1000',
      city: 'Brussel',
      municipality: 'Brussel',
      province: 'Brussels Hoofdstedelijk Gewest',
      label: 'Wetstraat 16, 1000 Brussel',
      source: 'Testbron',
    })])
  })

  it('ondersteunt alternatieve Engelstalige veldnamen en verwijdert dubbels', () => {
    const result = normalizeBelgianAddressResponse({
      suggestions: [
        { countryCode: 'BE', streetName: 'Grote Markt', houseNumber: '1', postalCode: '2000', locality: 'Antwerpen' },
        { countryCode: 'BE', streetName: 'Grote Markt', houseNumber: '1', postalCode: '2000', locality: 'Antwerpen' },
      ],
    })

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ street: 'Grote Markt', houseNumber: '1', city: 'Antwerpen' })
  })
})
