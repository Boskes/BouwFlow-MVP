import { access, mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { resolve, sep } from 'node:path'

export interface ObjectStorage {
  put(key: string, data: Buffer): Promise<void>
  get(key: string): Promise<Buffer>
  delete(key: string): Promise<void>
  healthcheck(): Promise<void>
}

export class LocalObjectStorage implements ObjectStorage {
  private readonly root: string

  constructor(root = process.env.UPLOAD_DIR ?? resolve('.data', 'uploads')) {
    this.root = resolve(root)
  }

  private path(key: string) {
    const target = resolve(this.root, key)
    if (target !== this.root && !target.startsWith(`${this.root}${sep}`)) throw new Error('Ongeldige opslagsleutel')
    return target
  }

  async put(key: string, data: Buffer) {
    const target = this.path(key)
    await mkdir(resolve(target, '..'), { recursive: true })
    await writeFile(target, data, { flag: 'wx' })
  }

  get(key: string) {
    return readFile(this.path(key))
  }

  async delete(key: string) {
    await unlink(this.path(key)).catch(error => { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error })
  }

  async healthcheck() {
    await mkdir(this.root, { recursive: true })
    await access(this.root, constants.R_OK | constants.W_OK)
  }
}

export class MemoryObjectStorage implements ObjectStorage {
  private readonly objects = new Map<string, Buffer>()
  async put(key: string, data: Buffer) { this.objects.set(key, Buffer.from(data)) }
  async get(key: string) { const data = this.objects.get(key); if (!data) throw new Error('Bestand niet gevonden'); return Buffer.from(data) }
  async delete(key: string) { this.objects.delete(key) }
  async healthcheck() {}
}
