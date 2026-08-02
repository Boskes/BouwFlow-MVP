import { describe, expect, it } from 'vitest'
import {
  FAMILY_HOME_CALCULATION_NUMBER,
  FAMILY_HOME_MODEL_NAME,
  FAMILY_HOME_PROJECT_NUMBER,
  buildFamilyHomeBimCalculation,
  buildFamilyHomeBimProgressStatement,
  buildFamilyHomeBimProject,
  familyHomeBimElements,
  familyHomeBimPhases,
} from './family-home-bim'

describe('gezinswoning BIM 3D/4D/5D',()=>{
  it('levert een volledig, uniek en gepland woningmodel',()=>{
    expect(familyHomeBimElements).toHaveLength(163)
    expect(new Set(familyHomeBimElements.map(element=>element.id)).size).toBe(163)
    expect(familyHomeBimPhases).toHaveLength(8)
    expect(familyHomeBimElements.every(element=>element.x>=0&&element.y>=0&&element.width>0&&element.height>0)).toBe(true)
    expect(familyHomeBimElements.every(element=>element.plannedStart<=element.plannedEnd&&element.unitCost>0)).toBe(true)
  })

  it('koppelt calculatie, project en vordering aan hetzelfde BIM-dossier',()=>{
    const calculation=buildFamilyHomeBimCalculation()
    const project=buildFamilyHomeBimProject()
    const statement=buildFamilyHomeBimProgressStatement()

    expect(calculation.number).toBe(FAMILY_HOME_CALCULATION_NUMBER)
    expect(calculation.items).toHaveLength(23)
    expect(project.number).toBe(FAMILY_HOME_PROJECT_NUMBER)
    expect(project.workPackages).toHaveLength(8)
    expect(project.planning.activities).toHaveLength(8)
    expect(statement.projectId).toBe(project.id)
    expect(statement.lines).toHaveLength(8)
    expect(statement.lines.filter(line=>line.bimEvidence)).toHaveLength(6)
    expect(statement.lines.flatMap(line=>line.bimEvidence?.modelName??[])).toContain(FAMILY_HOME_MODEL_NAME)
  })
})
