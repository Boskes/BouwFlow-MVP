import { readFile, stat } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'
import path from 'node:path'

const root = process.cwd()
const html = await readFile(path.join(root, 'dist', 'index.html'), 'utf8')
const initialFiles = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.(?:js|css))"/g)].map(match => match[1].slice(1))
if (!initialFiles.length) throw new Error('Geen productie-assets gevonden. Voer eerst npm run build uit.')

// Ceilings track the integrated project-workflow and compliance baseline;
// gzip remains the strict transfer-size guard and Checkinatwork stays lazy.
const budgets = { initialJsRaw: 1_400 * 1024, initialJsGzip: 335 * 1024, initialCssRaw: 300 * 1024, lazyChunkRaw: 1_040 * 1024, bimWebIfcRaw: 3_600 * 1024 }
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
const bimWebIfcChunk = chunkSizes.find(chunk => chunk.name.startsWith('bim-web-ifc-'))
const largestChunk = chunkSizes.filter(chunk => !chunk.name.startsWith('bim-web-ifc-')).sort((left, right) => right.size - left.size)[0]

const failures = []
if (initialJsRaw > budgets.initialJsRaw) failures.push(`initiële JavaScript ${initialJsRaw} > ${budgets.initialJsRaw} bytes`)
if (initialJsGzip > budgets.initialJsGzip) failures.push(`initiële JavaScript gzip ${initialJsGzip} > ${budgets.initialJsGzip} bytes`)
if (initialCssRaw > budgets.initialCssRaw) failures.push(`initiële CSS ${initialCssRaw} > ${budgets.initialCssRaw} bytes`)
if (largestChunk?.size > budgets.lazyChunkRaw) failures.push(`grootste chunk ${largestChunk.name} ${largestChunk.size} > ${budgets.lazyChunkRaw} bytes`)
if (bimWebIfcChunk?.size > budgets.bimWebIfcRaw) failures.push(`lazy WebIFC-engine ${bimWebIfcChunk.name} ${bimWebIfcChunk.size} > ${budgets.bimWebIfcRaw} bytes`)
if (failures.length) throw new Error(`Bundlebudget overschreden:\n- ${failures.join('\n- ')}`)
console.log(JSON.stringify({ initialJsRaw, initialJsGzip, initialCssRaw, largestChunk, bimWebIfcChunk }, null, 2))
