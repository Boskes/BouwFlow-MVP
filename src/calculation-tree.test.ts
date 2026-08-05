import { describe, expect, it } from 'vitest'
import type { Calculation } from './domain'
import { buildCalculationTree, chapterDescendantIds, filterCalculationTree, flattenCalculationTree, nodeDescendantItemIds } from './calculation-tree'

const calculation: Calculation = {
  id: 'calculation', number: 'CAL-TEST', opportunityId: 'opportunity', status: 'In opmaak', overheadPct: 8, riskPct: 3, marginPct: 12,
  updatedAt: '2026-08-05T00:00:00.000Z',
  chapters: [
    { id: 'parent', code: '10', name: 'Ruwbouw', sortOrder: 0, workflowStatus: 'In bewerking' },
    { id: 'child', code: '10.10', name: 'Beton', sortOrder: 1, parentChapterId: 'parent', workflowStatus: 'Ter controle' },
  ],
  items: [
    { id: 'bim', chapterId: 'child', code: '10.10.01', description: 'Betonwand uit IFC', quantity: 10, unit: 'm³', labor: 20, material: 80, equipment: 10, subcontracting: 0, notes: 'BIM-bron: woning.ifc', workflowStatus: 'Goedgekeurd' },
    { id: 'loose', code: '90.01', description: 'Losse post', quantity: 2, unit: 'st', labor: 5, material: 5, equipment: 0, subcontracting: 0 },
  ],
}

describe('calculation tree', () => {
  it('builds nested chapters with aggregated totals and integrations', () => {
    const root = buildCalculationTree(calculation)
    expect(root.itemCount).toBe(2)
    expect(root.directCost).toBe(1120)
    expect(root.children[0].children[0].chapter?.id).toBe('child')
    expect(root.children[0].integrations).toContain('BIM')
    expect(nodeDescendantItemIds(root.children[0])).toEqual(['bim'])
  })

  it('filters while retaining the full ancestor path', () => {
    const filtered = filterCalculationTree(buildCalculationTree(calculation), 'betonwand', '', 'BIM')
    expect(filtered.children).toHaveLength(1)
    expect(filtered.children[0].children[0].children[0].item?.id).toBe('bim')
  })

  it('flattens expanded nodes and resolves chapter descendants', () => {
    const root = buildCalculationTree(calculation)
    const flat = flattenCalculationTree(root, new Set(['chapter:parent', 'chapter:child']))
    expect(flat.map(node => node.id)).toEqual(['root', 'chapter:parent', 'chapter:child', 'item:bim', 'ungrouped'])
    expect(chapterDescendantIds('parent', calculation.chapters)).toEqual(new Set(['parent', 'child']))
  })
})
