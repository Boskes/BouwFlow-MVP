import type { ReactNode } from 'react'
import { ExternalLink } from 'lucide-react'
import type { Page } from './domain'
import { openWorkspaceWindow } from './workspace-window'

export default function WorkspaceWindowButton({ page, parameters, className, children }: {
  page: Page
  parameters?: Record<string, string>
  className?: string
  children: ReactNode
}) {
  return <button type="button" className={className} onClick={() => openWorkspaceWindow(page, parameters)}><ExternalLink size={15}/>{children}</button>
}
