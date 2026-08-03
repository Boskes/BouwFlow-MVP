import type { Page } from './domain'
import { workspacePath } from './routing'

export function openWorkspaceWindow(page: Page, parameters: Record<string, string> = {}) {
  const search = new URLSearchParams(parameters)
  const current = new URLSearchParams(window.location.search)
  for (const key of ['mode', 'units']) {
    const value = current.get(key)
    if (value) search.set(key, value)
  }
  const query = search.toString()
  const width = Math.max(1180, Math.min(1800, window.screen.availWidth - 60))
  const height = Math.max(760, Math.min(1100, window.screen.availHeight - 80))
  window.open(`${workspacePath({ page })}${query ? `?${query}` : ''}`, '_blank', `popup=yes,width=${width},height=${height},left=30,top=30,noopener,noreferrer`)
}
