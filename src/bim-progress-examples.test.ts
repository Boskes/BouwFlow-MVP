import { describe, expect, it } from 'vitest'
import { bimProgressExamples } from './bim-progress-examples'

describe('professionele BIM-vorderingsvoorbeelden',()=>{
  it('bevat vijf uitgebreide en unieke projectscenario’s',()=>{
    expect(bimProgressExamples).toHaveLength(5)
    expect(new Set(bimProgressExamples.map(item=>item.id)).size).toBe(5)
    expect(bimProgressExamples.every(item=>item.elements.length>=80)).toBe(true)
  })

  it('bevat controleerbare hoeveelheden, zones en unieke modelelementen',()=>{
    for(const example of bimProgressExamples){
      expect(example.modelVersion.length).toBeGreaterThan(8)
      expect(example.coordinationStatus.length).toBeGreaterThan(12)
      expect(new Set(example.elements.map(item=>item.id)).size).toBe(example.elements.length)
      expect(new Set(example.elements.map(item=>item.storey)).size).toBeGreaterThan(1)
      expect(example.elements.every(item=>item.quantity>0&&item.completedProgressPct>=0&&item.completedProgressPct<=100)).toBe(true)
    }
  })
})
