import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { countQueuedMutations, enqueueMutation, queuedMutations, readOfflineSnapshot, removeQueuedMutation, saveOfflineSnapshot, updateQueuedMutation } from './offline-queue'

describe('offline praktijkflow', () => {
  it('isoleert wachtrijen per tenant en gebruiker en bewaart de uitvoeringsvolgorde', async () => {
    const scopeA = `api|tenant-a|user-a-${crypto.randomUUID()}`
    const scopeB = `api|tenant-a|user-b-${crypto.randomUUID()}`
    const first = { id: crypto.randomUUID(), scope: scopeA, url: '/api/daily-reports', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"sequence":1}', createdAt: '2026-07-22T08:00:00.000Z', attempts: 0, status: 'pending' as const }
    const second = { ...first, id: crypto.randomUUID(), body: '{"sequence":2}', createdAt: '2026-07-22T08:01:00.000Z' }
    const otherUser = { ...first, id: crypto.randomUUID(), scope: scopeB }
    await enqueueMutation(second)
    await enqueueMutation(otherUser)
    await enqueueMutation(first)

    expect((await queuedMutations(scopeA)).map(item => item.id)).toEqual([first.id, second.id])
    expect(await countQueuedMutations(scopeA)).toBe(2)
    expect((await queuedMutations(scopeB)).map(item => item.id)).toEqual([otherUser.id])
  })

  it('bewaart foutstatus, ondersteunt herstel en levert een offline momentopname', async () => {
    const scope = `api|tenant-b|werf-${crypto.randomUUID()}`
    const mutation = { id: crypto.randomUUID(), scope, url: '/api/site-photos', method: 'POST', headers: {}, body: '{"caption":"offline foto"}', createdAt: new Date().toISOString(), attempts: 0, status: 'pending' as const }
    await enqueueMutation(mutation)
    await updateQueuedMutation({ ...mutation, attempts: 1, status: 'blocked', lastError: 'Validatie vereist' })
    expect(await queuedMutations(scope)).toEqual([expect.objectContaining({ status: 'blocked', attempts: 1, lastError: 'Validatie vereist' })])
    await removeQueuedMutation(mutation.id)
    expect(await countQueuedMutations(scope)).toBe(0)

    await saveOfflineSnapshot(scope, { projectId: 'werf-1', reports: 3 })
    expect(await readOfflineSnapshot<{ projectId: string; reports: number }>(scope)).toMatchObject({ data: { projectId: 'werf-1', reports: 3 }, savedAt: expect.any(String) })
  })
})
