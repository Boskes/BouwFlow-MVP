import { describe, expect, it } from 'vitest'
import {
  BOSMANS_TAVERNIERS_CALCULATION_NUMBER,
  BOSMANS_TAVERNIERS_PROJECT_NUMBER,
  bosmansTaverniersBimElements,
  buildBosmansTaverniersCalculation,
  buildBosmansTaverniersProgressStatement,
  buildBosmansTaverniersProject,
} from './bosmans-taverniers-bim'
import { BOSMANS_TAVERNIERS_SOURCE_TOTAL_EXCL_VAT } from './bosmans-taverniers-bim.generated'
import { directCost } from './domain'

describe('Woning Bosmans-Taverniers BIM',()=>{
  it('neemt de echte DWG-wandstructuur als 3D-basis',()=>{
    const walls=bosmansTaverniersBimElements.filter(element=>element.ifcType==='IfcWall')
    expect(walls).toHaveLength(88)
    expect(walls.some(element=>element.storey==='Gelijkvloers')).toBe(true)
    expect(walls.some(element=>element.storey==='Verdieping 1')).toBe(true)
    expect(walls.every(element=>element.geometry.size.every(value=>value>0))).toBe(true)
    expect(bosmansTaverniersBimElements.filter(element=>element.ifcType==='IfcColumn')).toHaveLength(3)
  })

  it('behoudt alle geprijsde Excel-meetstaatregels en het brontotaal',()=>{
    const calculation=buildBosmansTaverniersCalculation()
    const sourceTotal=directCost(calculation)
    expect(calculation.number).toBe(BOSMANS_TAVERNIERS_CALCULATION_NUMBER)
    expect(calculation.items).toHaveLength(56)
    expect(calculation.chapters).toHaveLength(17)
    expect(calculation.items.every(item=>calculation.chapters.some(chapter=>chapter.id===item.chapterId))).toBe(true)
    expect(sourceTotal).toBeCloseTo(BOSMANS_TAVERNIERS_SOURCE_TOTAL_EXCL_VAT,4)
    expect(calculation.items.some(item=>item.description.includes('Vloerplaat')&&item.notes?.includes('negatieve hoeveelheid')&&item.priceAdjustments?.some(rule=>rule.type==='Markdown'))).toBe(true)
  })

  it('koppelt calculatie, voorstelplanning en conceptvordering',()=>{
    const project=buildBosmansTaverniersProject()
    const statement=buildBosmansTaverniersProgressStatement()
    const modelTotal=bosmansTaverniersBimElements.reduce((sum,item)=>sum+item.quantity*item.unitCost,0)
    expect(project.number).toBe(BOSMANS_TAVERNIERS_PROJECT_NUMBER)
    expect(project.planning.status).toBe('Concept')
    expect(project.planning.activities).toHaveLength(8)
    expect(statement.projectId).toBe(project.id)
    expect(statement.status).toBe('Concept')
    expect(modelTotal).toBeCloseTo(BOSMANS_TAVERNIERS_SOURCE_TOTAL_EXCL_VAT,1)
  })
})
