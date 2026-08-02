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
    expect(familyHomeBimElements.every(element=>element.geometry.size.every(size=>size>0)&&element.geometry.position.every(Number.isFinite))).toBe(true)
  })

  it('vormt geometrisch één herkenbare tweelaagse woning met zadeldak',()=>{
    const walls=familyHomeBimElements.filter(element=>element.ifcType==='IfcWall')
    const roof=familyHomeBimElements.filter(element=>element.shape==='roof')
    const windows=familyHomeBimElements.filter(element=>element.shape==='window')
    const doors=familyHomeBimElements.filter(element=>element.shape==='door')
    const floors=familyHomeBimElements.filter(element=>element.ifcType==='IfcSlab')

    expect(walls.some(element=>Math.abs(element.geometry.position[0])>=5)).toBe(true)
    expect(walls.some(element=>Math.abs(element.geometry.position[2])>=4)).toBe(true)
    expect(floors.some(element=>element.geometry.position[1]<1)).toBe(true)
    expect(floors.some(element=>element.geometry.position[1]>3)).toBe(true)
    expect(windows).toHaveLength(14)
    expect(windows.some(element=>element.geometry.position[1]>4)).toBe(true)
    expect(doors.some(element=>element.geometry.position[2]<-4)).toBe(true)
    expect(roof).toHaveLength(12)
    expect(roof.some(element=>(element.geometry.rotation?.[2]??0)>.5)).toBe(true)
    expect(roof.some(element=>(element.geometry.rotation?.[2]??0)<-.5)).toBe(true)
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
