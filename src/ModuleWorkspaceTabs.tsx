import type { ComponentType } from 'react'
import { ExternalLink } from 'lucide-react'
import type { Page } from './domain'
import { openWorkspaceWindow } from './workspace-window'

export type ModuleWorkspaceItem = {
  id: Page
  label: string
  icon: ComponentType<{ size?: number }>
}

type Props = {
  groupLabel: string
  items: ModuleWorkspaceItem[]
  activePage: Page
  onNavigate: (page: Page) => void
}

const descriptions: Partial<Record<Page, string>> = {
  calculations: 'Meer ruimte voor meetstaat, bronnen en prijsopbouw',
  planning: 'Volledige breedte voor Gantt, resources en kritisch pad',
  documents: 'Documenten en revisies naast elkaar beoordelen',
  control: 'Kosten, prognose en verplichtingen gelijktijdig opvolgen',
  cashflow: 'Facturen en betaalstromen in een aparte financiële werkruimte',
  mailbox: 'E-mail naast het actieve project- of calculatiedossier gebruiken',
  qhse: 'Inspecties en bewijsstukken zonder de projectcontext te verliezen',
  'cost-library': 'Kostbronnen vergelijken terwijl de calculatie open blijft',
}

export default function ModuleWorkspaceTabs({
  groupLabel,
  items,
  activePage,
  onNavigate,
}: Props) {
  const activeItem = items.find((item) => item.id === activePage)
  const description = descriptions[activePage]
  return (
    <section className="module-workspace-bar" aria-label={`${groupLabel} modules`}>
      <div className="module-workspace-caption">
        <span>{groupLabel}</span>
        <strong>{activeItem?.label ?? groupLabel}</strong>
      </div>
      <nav className="module-workspace-tabs" aria-label={`Navigatie binnen ${groupLabel}`}>
        {items.map((item) => {
          const Icon = item.icon
          const active = item.id === activePage
          return (
            <button
              type="button"
              key={item.id}
              className={active ? 'active' : ''}
              aria-current={active ? 'page' : undefined}
              onClick={() => onNavigate(item.id)}
            >
              <Icon size={15}/>
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>
      {description && (
        <button type="button" className="module-window-action" onClick={() => openWorkspaceWindow(activePage)}>
          <ExternalLink size={16}/>
          <span>
            <strong>Open in nieuw venster</strong>
            <small>{description}</small>
          </span>
        </button>
      )}
    </section>
  )
}
