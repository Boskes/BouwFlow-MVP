import type { BelgianAddressSuggestion } from '../src/domain.js'
import { BELGIAN_ADDRESS_DEMO_URL, normalizeBelgianAddressResponse } from '../src/belgian-addresses.js'

export interface BelgianAddressSearch {
  search(query: string, limit?: number): Promise<BelgianAddressSuggestion[]>
}

interface CacheEntry {
  expiresAt: number
  suggestions: BelgianAddressSuggestion[]
}

export class HttpBelgianAddressSearch implements BelgianAddressSearch {
  private readonly cache = new Map<string, CacheEntry>()

  constructor(
    private readonly endpoint = process.env.BELGIAN_ADDRESS_API_URL?.trim() || BELGIAN_ADDRESS_DEMO_URL,
    private readonly apiKey = process.env.BELGIAN_ADDRESS_API_KEY?.trim(),
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async search(query: string, limit = 10): Promise<BelgianAddressSuggestion[]> {
    const normalized = query.trim()
    const boundedLimit = Math.min(20, Math.max(1, limit))
    const cacheKey = `${normalized.toLocaleLowerCase()}|${boundedLimit}`
    const cached = this.cache.get(cacheKey)
    if (cached && cached.expiresAt > Date.now()) return cached.suggestions

    const url = new URL(this.endpoint)
    url.searchParams.set('q', normalized)
    url.searchParams.set('country', 'be')
    url.searchParams.set('limit', String(boundedLimit))
    const response = await this.fetcher(url, {
      signal: AbortSignal.timeout(5_000),
      headers: {
        Accept: 'application/json',
        ...(this.apiKey ? { 'X-API-Key': this.apiKey } : {}),
      },
    })
    if (!response.ok) throw new Error(`Adresprovider antwoordde met status ${response.status}`)
    const suggestions = normalizeBelgianAddressResponse(await response.json(), 'Belgische adresdienst').slice(0, boundedLimit)
    this.cache.set(cacheKey, { expiresAt: Date.now() + 12 * 60 * 60 * 1_000, suggestions })
    if (this.cache.size > 300) this.cache.delete(this.cache.keys().next().value as string)
    return suggestions
  }
}
