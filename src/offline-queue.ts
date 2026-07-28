export interface QueuedMutation {
  id: string
  scope: string
  url: string
  method: string
  headers: Record<string, string>
  body?: string
  formData?: Array<{ name: string; value: string | Blob; fileName?: string }>
  createdAt: string
  attempts: number
  status: 'pending' | 'blocked'
  lastError?: string
}

const DATABASE_NAME = 'bouwflow-offline'
const STORE_NAME = 'mutations'
const SNAPSHOT_STORE_NAME = 'snapshots'
const DATABASE_VERSION = 3

const database = () => new Promise<IDBDatabase>((resolve, reject) => {
  if (!globalThis.indexedDB) return reject(new Error('Offline opslag is niet beschikbaar in deze browser'))
  const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
  request.onupgradeneeded = () => {
    const db = request.result
    const mutationStore = db.objectStoreNames.contains(STORE_NAME) ? request.transaction!.objectStore(STORE_NAME) : db.createObjectStore(STORE_NAME, { keyPath: 'id' })
    if (!mutationStore.indexNames.contains('createdAt')) mutationStore.createIndex('createdAt', 'createdAt')
    if (!mutationStore.indexNames.contains('scope')) mutationStore.createIndex('scope', 'scope')
    if (!db.objectStoreNames.contains(SNAPSHOT_STORE_NAME)) db.createObjectStore(SNAPSHOT_STORE_NAME, { keyPath: 'id' })
  }
  request.onsuccess = () => resolve(request.result)
  request.onerror = () => reject(request.error ?? new Error('Offline opslag kon niet worden geopend'))
})

const transaction = async <T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore, complete: (value: T) => void, fail: (error: unknown) => void) => void) => {
  const db = await database()
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode)
    const store = tx.objectStore(STORE_NAME)
    let result!: T
    operation(store, value => { result = value }, reject)
    tx.oncomplete = () => { db.close(); resolve(result) }
    tx.onerror = () => { db.close(); reject(tx.error ?? new Error('Offline transactie is mislukt')) }
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error('Offline transactie is afgebroken')) }
  })
}

export const canQueueOffline = () => typeof globalThis.indexedDB !== 'undefined'

export const enqueueMutation = (mutation: QueuedMutation) => transaction<void>('readwrite', (store, complete, fail) => {
  const request = store.put(mutation)
  request.onsuccess = () => complete(undefined)
  request.onerror = () => fail(request.error)
})

export const queuedMutations = (scope: string) => transaction<QueuedMutation[]>('readonly', (store, complete, fail) => {
  const request = store.index('scope').getAll(scope)
  request.onsuccess = () => complete((request.result as QueuedMutation[]).sort((a, b) => a.createdAt.localeCompare(b.createdAt)))
  request.onerror = () => fail(request.error)
})

export const removeQueuedMutation = (id: string) => transaction<void>('readwrite', (store, complete, fail) => {
  const request = store.delete(id)
  request.onsuccess = () => complete(undefined)
  request.onerror = () => fail(request.error)
})

export const updateQueuedMutation = (mutation: QueuedMutation) => enqueueMutation(mutation)

export const countQueuedMutations = (scope: string) => transaction<number>('readonly', (store, complete, fail) => {
  const request = store.index('scope').count(scope)
  request.onsuccess = () => complete(request.result)
  request.onerror = () => fail(request.error)
})

interface OfflineSnapshot<T> {
  id: string
  savedAt: string
  data: T
}

export const saveOfflineSnapshot = async <T>(scope: string, data: T) => {
  const db = await database()
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(SNAPSHOT_STORE_NAME, 'readwrite')
    tx.objectStore(SNAPSHOT_STORE_NAME).put({ id: scope, savedAt: new Date().toISOString(), data } satisfies OfflineSnapshot<T>)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error ?? new Error('Offline momentopname kon niet worden bewaard')) }
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error('Offline momentopname werd afgebroken')) }
  })
}

export const readOfflineSnapshot = async <T>(scope: string) => {
  const db = await database()
  return new Promise<OfflineSnapshot<T> | undefined>((resolve, reject) => {
    const tx = db.transaction(SNAPSHOT_STORE_NAME, 'readonly')
    const request = tx.objectStore(SNAPSHOT_STORE_NAME).get(scope)
    let result: OfflineSnapshot<T> | undefined
    request.onsuccess = () => { result = request.result as OfflineSnapshot<T> | undefined }
    request.onerror = () => reject(request.error ?? new Error('Offline momentopname kon niet worden gelezen'))
    tx.oncomplete = () => { db.close(); resolve(result) }
    tx.onerror = () => { db.close(); reject(tx.error ?? new Error('Offline momentopname kon niet worden gelezen')) }
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error('Offline momentopname werd afgebroken')) }
  })
}
