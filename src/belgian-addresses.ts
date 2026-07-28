import type { BelgianAddressSuggestion } from './domain.js'

export const BELGIAN_ADDRESS_DEMO_URL = 'https://gratis-postcodedata.nl/api/suggest'

const text = (value: unknown) => typeof value === 'string' || typeof value === 'number' ? String(value).trim() : ''
const coordinate = (value: unknown) => {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

const recordList = (payload: unknown): Record<string, unknown>[] => {
  if (Array.isArray(payload)) return payload.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
  if (!payload || typeof payload !== 'object') return []
  const root = payload as Record<string, unknown>
  for (const key of ['results', 'suggestions', 'addresses', 'items', 'data']) {
    if (Array.isArray(root[key])) return recordList(root[key])
  }
  return []
}

const houseNumberOf = (item: Record<string, unknown>) => {
  const number = text(item.huisnummer ?? item.houseNumber ?? item.number)
  const letter = text(item.huisletter ?? item.houseLetter)
  const addition = text(item.huisnummertoevoeging ?? item.houseNumberAddition ?? item.boxNumber)
  return [number + letter, addition].filter(Boolean).join(' ').trim()
}

export function normalizeBelgianAddressResponse(payload: unknown, source = 'Belgische adresbron'): BelgianAddressSuggestion[] {
  const unique = new Map<string, BelgianAddressSuggestion>()
  for (const item of recordList(payload)) {
    const country = text(item.country ?? item.countryCode ?? item.land).toLocaleLowerCase()
    if (country && !['be', 'bel', 'belgië', 'belgie', 'belgium'].includes(country)) continue
    const street = text(item.straat ?? item.street ?? item.streetName)
    const houseNumber = houseNumberOf(item)
    const postalCode = text(item.postcode ?? item.postalCode ?? item.zipCode)
    const city = text(item.plaats ?? item.city ?? item.locality ?? item.municipality ?? item.gemeente)
    const municipality = text(item.gemeente ?? item.municipality) || city
    if (!street || !postalCode || !city) continue
    const addressLine = [street, houseNumber].filter(Boolean).join(' ')
    const key = `${addressLine}|${postalCode}|${city}`.toLocaleLowerCase()
    if (unique.has(key)) continue
    unique.set(key, {
      id: key,
      label: `${addressLine}, ${postalCode} ${city}`,
      addressLine,
      street,
      houseNumber,
      postalCode,
      city,
      municipality,
      province: text(item.provincie ?? item.province ?? item.region) || undefined,
      latitude: coordinate(item.lat ?? item.latitude),
      longitude: coordinate(item.lon ?? item.lng ?? item.longitude),
      source,
    })
  }
  return [...unique.values()]
}

export async function searchBelgianAddressesOnline(
  query: string,
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<BelgianAddressSuggestion[]> {
  const normalized = query.trim()
  if (normalized.length < 2) return []
  const url = new URL(BELGIAN_ADDRESS_DEMO_URL)
  url.searchParams.set('q', normalized)
  url.searchParams.set('country', 'be')
  url.searchParams.set('limit', '12')
  const response = await fetcher(url, { signal, headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(`Belgische adresdienst antwoordde met status ${response.status}`)
  return normalizeBelgianAddressResponse(await response.json(), 'Online Belgische adresdata')
}
