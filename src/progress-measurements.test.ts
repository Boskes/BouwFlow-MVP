import { describe, expect, it } from 'vitest'
import { approvedDailyProduction, buildDailyReportEvidence, quantityProgress, workPackageBoqItems } from './progress-measurements'
import type { Calculation, DailyReport, Project, ProjectWorkPackage } from './domain'

const workPackage:ProjectWorkPackage={id:'10000000-0000-4000-8000-000000000001',code:'01',name:'Grondwerken',budget:10_000,plannedHours:100,status:'Klaar voor planning'}
const calculation:Calculation={id:'10000000-0000-4000-8000-000000000002',number:'CAL-001',opportunityId:'10000000-0000-4000-8000-000000000003',status:'In opmaak',overheadPct:0,riskPct:0,marginPct:0,chapters:[{id:'10000000-0000-4000-8000-000000000004',code:'1',name:'Grondwerken',sortOrder:0}],items:[
  {id:'10000000-0000-4000-8000-000000000005',chapterId:'10000000-0000-4000-8000-000000000004',code:'01.01',description:'Uitgraving',quantity:100,unit:'m³',labor:10,material:0,equipment:0,subcontracting:0},
  {id:'10000000-0000-4000-8000-000000000006',chapterId:'10000000-0000-4000-8000-000000000004',code:'01.02',description:'Fundering',quantity:100,unit:'m²',labor:30,material:0,equipment:0,subcontracting:0},
],updatedAt:'2026-08-02T00:00:00.000Z'}
const project:Project={id:'10000000-0000-4000-8000-000000000007',number:'PRJ-001',name:'Testproject',organizationId:'10000000-0000-4000-8000-000000000008',sourceCalculationId:calculation.id,contractValue:4_000,costBudget:4_000,marginPct:0,progress:0,status:'Op schema',handover:{status:'Aanvaard',projectManager:'Lena',plannedStart:'2026-01-01',plannedEnd:'2026-12-31',notes:'',risks:[],checklist:{scopeReviewed:true,budgetReviewed:true,contractReviewed:true,documentsTransferred:true,risksReviewed:true,kickoffPlanned:true}},workPackages:[workPackage],planning:{status:'Concept',baselineVersion:0,activities:[],updatedAt:'2026-01-01T00:00:00.000Z'}}
const report=(id:string,status:DailyReport['status'],quantity:number):DailyReport=>({id,projectId:project.id,date:'2026-07-15',workPackageId:workPackage.id,weather:'Droog',temperature:20,activities:'Productie',laborEntries:[],subcontractors:['Ploeg'],materials:[],machines:[],productionEntries:[{id:`${id.slice(0,-1)}9`,workPackageId:workPackage.id,boqItemId:calculation.items[0].id,description:'Uitgraving',quantity,unit:'m³'}],deliveries:'',delays:'',problems:'',visitors:'',notes:'',status,createdAt:'2026-07-15T16:00:00.000Z',signedBy:status==='Ondertekend'?'Controleur':undefined,signedAt:status==='Ondertekend'?'2026-07-16T08:00:00.000Z':undefined})

describe('automatische voortgangsmetingen',()=>{
  it('koppelt hoofdstukcode 1 en werkpakketcode 01',()=>{
    expect(workPackageBoqItems(calculation,workPackage)).toHaveLength(2)
  })

  it('weegt gemeten hoeveelheden volgens de calculatiewaarde',()=>{
    const result=quantityProgress(calculation,workPackage,[{boqItemId:calculation.items[0].id,cumulativeQuantity:100},{boqItemId:calculation.items[1].id,cumulativeQuantity:0}])
    expect(result.completionPct).toBe(25)
  })

  it('neemt uitsluitend ondertekende dagrapporten op',()=>{
    const signed=report('20000000-0000-4000-8000-000000000001','Ondertekend',40)
    const submitted=report('20000000-0000-4000-8000-000000000002','Ingediend',60)
    const approved=approvedDailyProduction([signed,submitted],project.id,workPackage.id,'2026-07-31')
    expect(approved.reports.map(item=>item.id)).toEqual([signed.id])
    const evidence=buildDailyReportEvidence(calculation,project,workPackage,[signed,submitted],'2026-07-31','2026-08-01T00:00:00.000Z')
    expect(evidence).toMatchObject({reportCount:1,productionEntryCount:1,completionPct:10})
  })
})
