import { describe, expect, it } from 'vitest'
import { bimProgressExamples } from './bim-progress-examples'

describe('professionele BIM-vorderingsvoorbeelden',()=>{
  it('bevat zes uitgebreide en unieke projectscenario’s',()=>{
    expect(bimProgressExamples).toHaveLength(6)
    expect(new Set(bimProgressExamples.map(item=>item.id)).size).toBe(6)
    expect(bimProgressExamples.every(item=>item.elements.length>=80)).toBe(true)
  })

  it('bevat controleerbare hoeveelheden, zones en unieke modelelementen',()=>{
    for(const example of bimProgressExamples){
      expect(example.modelVersion.length).toBeGreaterThan(8)
      expect(example.coordinationStatus.length).toBeGreaterThan(12)
      expect(new Set(example.elements.map(item=>item.id)).size).toBe(example.elements.length)
      expect(new Set(example.elements.map(item=>item.storey)).size).toBeGreaterThan(1)
      expect(example.elements.every(item=>item.quantity>0&&item.completedProgressPct>=0&&item.completedProgressPct<=100)).toBe(true)
      expect(example.elements.every(item=>item.phase&&item.plannedStart&&item.plannedEnd&&item.costValue>0)).toBe(true)
    }
  })

  it('bevat een woningmodel met gekoppelde 3D-, 4D- en 5D-data',()=>{
    const house=bimProgressExamples.find(item=>item.id==='family-home-bim-3d4d5d')
    expect(house).toBeDefined()
    expect(house?.elements.length).toBeGreaterThan(120)
    expect(new Set(house?.elements.map(item=>item.phase)).size).toBeGreaterThanOrEqual(6)
    expect(house?.elements.some(item=>item.x!=null&&item.y!=null&&item.width!=null&&item.height!=null)).toBe(true)
  })
})
