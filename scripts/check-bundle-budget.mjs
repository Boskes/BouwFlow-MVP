import { readFile, stat } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'
import path from 'node:path'

const root = process.cwd()
const html = await readFile(path.join(root, 'dist', 'index.html'), 'utf8')
const initialFiles = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.(?:js|css))"/g)].map(match => match[1].slice(1))
if (!initialFiles.length) throw new Error('Geen productie-assets gevonden. Voer eerst npm run build uit.')

// Raw ceilings include the production planning workbench; gzip remains the
// strict transfer-size guard and prevents silent payload growth.
const budgets = { initialJsRaw: 1_275 * 1024, initialJsGzip: 310 * 1024, initialCssRaw: 260 * 1024, lazyChunkRaw: 1_000 * 1024 }
let initialJsRaw = 0
let initialJsGzip = 0
let initialCssRaw = 0
for (const relative of initialFiles) {
  const file = path.join(root, 'dist', relative)
  const contents = await readFile(file)
  if (relative.endsWith('.js')) { initialJsRaw += contents.length; initialJsGzip += gzipSync(contents).length }
  if (relative.endsWith('.css')) initialCssRaw += contents.length
}
const assetDirectory = path.join(root, 'dist', 'assets')
const { readdir } = await import('node:fs/promises')
const chunks = (await readdir(assetDirectory)).filter(name => name.endsWith('.js'))
const chunkSizes = await Promise.all(chunks.map(async name => ({ name, size: (await stat(path.join(assetDirectory, name))).size })))
const largestChunk = chunkSizes.sort((left, right) => right.size - left.size)[0]

const failures = []
if (initialJsRaw > budgets.initialJsRaw) failures.push(`initiële JavaScript ${initialJsRaw} > ${budgets.initialJsRaw} bytes`)
if (initialJsGzip > budgets.initialJsGzip) failures.push(`initiële JavaScript gzip ${initialJsGzip} > ${budgets.initialJsGzip} bytes`)
if (initialCssRaw > budgets.initialCssRaw) failures.push(`initiële CSS ${initialCssRaw} > ${budgets.initialCssRaw} bytes`)
if (largestChunk?.size > budgets.lazyChunkRaw) failures.push(`grootste chunk ${largestChunk.name} ${largestChunk.size} > ${budgets.lazyChunkRaw} bytes`)
if (failures.length) throw new Error(`Bundlebudget overschreden:\n- ${failures.join('\n- ')}`)
console.log(JSON.stringify({ initialJsRaw, initialJsGzip, initialCssRaw, largestChunk }, null, 2))
