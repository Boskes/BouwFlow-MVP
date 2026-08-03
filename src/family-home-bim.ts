import type { Calculation, ProgressStatement, Project } from './domain.js'

export type FamilyHomeBimUnit = 'm²' | 'm³' | 'm' | 'st'
export type FamilyHomeBimShape = 'plate' | 'wall' | 'column' | 'window' | 'door' | 'roof'

export interface FamilyHomeBimGeometry {
  position: [number, number, number]
  size: [number, number, number]
  rotation?: [number, number, number]
}

export interface FamilyHomeBimPhase {
  id: string
  sequence: number
  label: string
  workPackageCode: string
  startDate: string
  endDate: string
  budget: number
  progressPct: number
  color: string
}

export interface FamilyHomeBimElement {
  id: string
  code: string
  ifcType: string
  label: string
  category: 'Wanden' | 'Vloeren' | 'Kolommen' | 'Balken' | 'Ramen' | 'Deuren' | 'Daken' | 'Trappen' | 'Installaties' | 'Overig'
  storey: string
  quantity: number
  unit: FamilyHomeBimUnit
  unitCost: number
  x: number
  y: number
  width: number
  height: number
  shape: FamilyHomeBimShape
  geometry: FamilyHomeBimGeometry
  phaseId: string
  workPackageCode: string
  plannedStart: string
  plannedEnd: string
  completedProgressPct: number
  verified: boolean
  warning?: string
}

export const FAMILY_HOME_MODEL_ID = 'family-home-bim-3d4d5d'
export const FAMILY_HOME_MODEL_NAME = 'Gezinswoning-Bosveld-LOD350.ifc'
export const FAMILY_HOME_MODEL_VERSION = 'CDE-UIT-07 · 2026-12-18'
export const FAMILY_HOME_CALCULATION_NUMBER = 'CAL-WONING-BIM-001'
export const FAMILY_HOME_PROJECT_NUMBER = 'PRJ-WONING-BIM-001'

export const familyHomeBimPhases: FamilyHomeBimPhase[] = [
  { id:'site', sequence:1, label:'Terrein en grondwerken', workPackageCode:'01', startDate:'2026-09-01', endDate:'2026-09-18', budget:18_000, progressPct:100, color:'#8b765d' },
  { id:'foundation', sequence:2, label:'Funderingen en vloerplaat', workPackageCode:'02', startDate:'2026-09-21', endDate:'2026-10-16', budget:52_000, progressPct:100, color:'#647f85' },
  { id:'shell', sequence:3, label:'Ruwbouw en verdiepingsvloer', workPackageCode:'03', startDate:'2026-10-19', endDate:'2026-12-18', budget:78_000, progressPct:72, color:'#b26f44' },
  { id:'roof', sequence:4, label:'Dak en waterdichte schil', workPackageCode:'04', startDate:'2026-12-07', endDate:'2027-01-22', budget:51_000, progressPct:58, color:'#455f66' },
  { id:'facade', sequence:5, label:'Buitenschrijnwerk en gevel', workPackageCode:'05', startDate:'2027-01-11', endDate:'2027-02-19', budget:62_000, progressPct:25, color:'#4c9ab0' },
  { id:'mep', sequence:6, label:'Technieken', workPackageCode:'06', startDate:'2027-01-25', endDate:'2027-04-02', budget:56_000, progressPct:12, color:'#d28245' },
  { id:'finish', sequence:7, label:'Binnenafwerking', workPackageCode:'07', startDate:'2027-03-01', endDate:'2027-05-07', budget:72_000, progressPct:0, color:'#aa8b69' },
  { id:'external', sequence:8, label:'Buitenaanleg en oplevering', workPackageCode:'08', startDate:'2027-04-19', endDate:'2027-05-28', budget:21_000, progressPct:0, color:'#729267' },
]

type SeriesInput = Omit<FamilyHomeBimElement, 'id' | 'code' | 'label' | 'x' | 'y' | 'geometry' | 'plannedStart' | 'plannedEnd' | 'completedProgressPct'> & {
  prefix: string
  count: number
  labelPrefix: string
  baseX: number
  baseY: number
  columns: number
  stepX: number
  stepY: number
  quantityStep?: number
}

const panelPosition = (index:number, frontCount:number, sideCount:number, y:number):FamilyHomeBimGeometry => {
  if (index < frontCount) return { position:[-5 + (index + .5) * (10 / frontCount), y, -4.05], size:[10 / frontCount, 2.7, .24] }
  if (index < frontCount * 2) { const offset=index-frontCount; return { position:[-5 + (offset + .5) * (10 / frontCount), y, 4.05], size:[10 / frontCount, 2.7, .24] } }
  if (index < frontCount * 2 + sideCount) { const offset=index-frontCount*2; return { position:[-5.05, y, -4 + (offset + .5) * (8 / sideCount)], size:[.24, 2.7, 8 / sideCount] } }
  const offset=index-frontCount*2-sideCount
  return { position:[5.05, y, -4 + (offset + .5) * (8 / sideCount)], size:[.24, 2.7, 8 / sideCount] }
}

export const familyHomeElementGeometry = (prefix:string, index:number):FamilyHomeBimGeometry => {
  if (prefix==='grd') {
    const column=index%4, row=Math.floor(index/4)
    return { position:[-6 + column*4, -.45, -4 + row*4], size:[3.95,.18,3.95] }
  }
  if (prefix==='fun') {
    if(index<5)return {position:[-4+(index*2),-.12,-3.85],size:[2.1,.65,.65]}
    if(index<10)return {position:[-4+((index-5)*2),-.12,3.85],size:[2.1,.65,.65]}
    if(index<13)return {position:[-4.85,-.12,-2.6+((index-10)*2.6)],size:[.65,.65,2.75]}
    return {position:[4.85,-.12,-2.6+((index-13)*2.6)],size:[.65,.65,2.75]}
  }
  if (prefix==='vlr'||prefix==='vdp') {
    const column=index%4, row=Math.floor(index/4)
    return { position:[-3.75+column*2.5,prefix==='vlr'?.28:3.12,-2.67+row*2.67],size:[2.46,.28,2.63] }
  }
  if (prefix==='buw') return panelPosition(index,7,5,1.75)
  if (prefix==='afw') return panelPosition(index,6,3,4.52)
  if (prefix==='biw') {
    if(index<6)return {position:[-4.15+index*1.65,1.72,.55],size:[1.6,2.6,.14]}
    if(index<12)return {position:[-4.15+(index-6)*1.65,1.72,2.35],size:[1.6,2.6,.14]}
    return {position:[index<15?-1.65:1.65,1.72,-2.55+((index%3)*2.55)],size:[.14,2.6,2.45]}
  }
  if (prefix==='dak') {
    const left=index<6, offset=index%6
    return { position:[left?-2.5:2.5,6.02,-3.75+offset*1.5],size:[5.65,.22,1.46],rotation:[0,0,left?.52:-.52] }
  }
  if (prefix==='ram') {
    const front=index<8, upper=index%8>=4, slot=front?index%4:(index-8)%3
    const count=front?4:3
    return { position:[-4+(slot+.5)*(8/count),upper?4.55:1.82,front?-4.2:4.2],size:[front?1.35:1.55,1.3,.14] }
  }
  if (prefix==='deu') {
    if(index===0)return {position:[2.7,1.25,-4.22],size:[1.15,2.25,.16]}
    return {position:[index<3?-1.65:1.65,1.25,-1.8+((index%2)*3.6)],size:[.16,2.15,1.0]}
  }
  if (prefix==='mep') {
    const vertical=index%5===0
    return {position:[-3.6+(index%5)*1.8,.9+Math.floor(index/5)*1.25,-2.7+(index%4)*1.8],size:vertical?[.13,2.15,.13]:[1.55,.13,.13]}
  }
  return {position:[0,1,0],size:[1,1,1]}
}

const elementSeries = (input: SeriesInput): FamilyHomeBimElement[] => {
  const phase = familyHomeBimPhases.find(item => item.id === input.phaseId)!
  return Array.from({ length: input.count }, (_, index) => ({
    id:`home-${input.prefix}-${String(index + 1).padStart(3, '0')}`,
    code:`WON-${input.prefix.toUpperCase()}-${String(index + 1).padStart(3, '0')}`,
    ifcType:input.ifcType,
    label:`${input.labelPrefix} ${String(index + 1).padStart(2, '0')}`,
    category:input.category,
    storey:input.storey,
    quantity:Number((input.quantity + (index % 4) * (input.quantityStep ?? 0)).toFixed(2)),
    unit:input.unit,
    unitCost:input.unitCost,
    x:input.baseX + (index % input.columns) * input.stepX,
    y:input.baseY + Math.floor(index / input.columns) * input.stepY,
    width:input.width,
    height:input.height,
    shape:input.shape,
    geometry:familyHomeElementGeometry(input.prefix,index),
    phaseId:input.phaseId,
    workPackageCode:input.workPackageCode,
    plannedStart:phase.startDate,
    plannedEnd:phase.endDate,
    completedProgressPct:phase.progressPct,
    verified:index % 11 !== 0,
  }))
}

export const familyHomeBimElements: FamilyHomeBimElement[] = [
  ...elementSeries({ prefix:'grd', count:12, labelPrefix:'Grondwerkzone', ifcType:'IfcEarthworksCut', category:'Overig', storey:'Terrein', quantity:42, quantityStep:3, unit:'m³', unitCost:54, baseX:8, baseY:82, columns:6, stepX:14, stepY:6, width:12, height:5, shape:'plate', phaseId:'site', workPackageCode:'01', verified:true }),
  ...elementSeries({ prefix:'fun', count:16, labelPrefix:'Funderingssegment', ifcType:'IfcFooting', category:'Kolommen', storey:'Fundering', quantity:4.8, quantityStep:.35, unit:'m³', unitCost:525, baseX:11, baseY:73, columns:8, stepX:10, stepY:6, width:8, height:5, shape:'column', phaseId:'foundation', workPackageCode:'02', verified:true }),
  ...elementSeries({ prefix:'vlr', count:12, labelPrefix:'Vloerplaatveld', ifcType:'IfcSlab', category:'Vloeren', storey:'Gelijkvloers', quantity:11.8, quantityStep:.6, unit:'m²', unitCost:168, baseX:12, baseY:64, columns:6, stepX:13, stepY:5, width:12, height:6, shape:'plate', phaseId:'foundation', workPackageCode:'02', verified:true }),
  ...elementSeries({ prefix:'buw', count:24, labelPrefix:'Buitenwandpaneel', ifcType:'IfcWall', category:'Wanden', storey:'Gelijkvloers', quantity:7.6, quantityStep:.45, unit:'m²', unitCost:228, baseX:13, baseY:49, columns:12, stepX:6.4, stepY:13, width:5.8, height:12, shape:'wall', phaseId:'shell', workPackageCode:'03', verified:true }),
  ...elementSeries({ prefix:'biw', count:18, labelPrefix:'Binnenwand', ifcType:'IfcWall', category:'Wanden', storey:'Gelijkvloers', quantity:5.2, quantityStep:.4, unit:'m²', unitCost:98, baseX:23, baseY:52, columns:9, stepX:6.2, stepY:11, width:3.8, height:10, shape:'wall', phaseId:'shell', workPackageCode:'03', verified:true }),
  ...elementSeries({ prefix:'vdp', count:12, labelPrefix:'Verdiepingsvloerveld', ifcType:'IfcSlab', category:'Vloeren', storey:'Verdieping 1', quantity:10.7, quantityStep:.5, unit:'m²', unitCost:147, baseX:17, baseY:43, columns:6, stepX:12, stepY:5, width:11, height:5, shape:'plate', phaseId:'shell', workPackageCode:'03', verified:true }),
  ...elementSeries({ prefix:'dak', count:12, labelPrefix:'Dakvlak', ifcType:'IfcRoof', category:'Daken', storey:'Dak', quantity:12.4, quantityStep:.7, unit:'m²', unitCost:252, baseX:18, baseY:23, columns:6, stepX:11.5, stepY:7, width:11, height:7, shape:'roof', phaseId:'roof', workPackageCode:'04', verified:true }),
  ...elementSeries({ prefix:'ram', count:14, labelPrefix:'Raam- en schuifraamgeheel', ifcType:'IfcWindow', category:'Ramen', storey:'Gevel', quantity:1, unit:'st', unitCost:1_875, baseX:17, baseY:46, columns:7, stepX:10, stepY:13, width:6, height:6, shape:'window', phaseId:'facade', workPackageCode:'05', verified:true }),
  ...elementSeries({ prefix:'deu', count:5, labelPrefix:'Buiten- of binnendeur', ifcType:'IfcDoor', category:'Deuren', storey:'Gelijkvloers', quantity:1, unit:'st', unitCost:1_460, baseX:25, baseY:57, columns:5, stepX:12, stepY:0, width:5, height:9, shape:'door', phaseId:'facade', workPackageCode:'05', verified:true }),
  ...elementSeries({ prefix:'mep', count:20, labelPrefix:'Technisch tracé', ifcType:'IfcDistributionFlowElement', category:'Installaties', storey:'Technieken', quantity:8.5, quantityStep:.75, unit:'m', unitCost:182, baseX:20, baseY:39, columns:10, stepX:6, stepY:18, width:4, height:3, shape:'wall', phaseId:'mep', workPackageCode:'06', verified:true }),
  ...elementSeries({ prefix:'afw', count:18, labelPrefix:'Afwerkingszone', ifcType:'IfcCovering', category:'Wanden', storey:'Interieur', quantity:7.4, quantityStep:.5, unit:'m²', unitCost:122, baseX:22, baseY:50, columns:9, stepX:6.3, stepY:12, width:4.5, height:10, shape:'wall', phaseId:'finish', workPackageCode:'07', verified:true }),
]

const familyHomeCalculationItems: Calculation['items'] = [
  ['01.01','BIM grondverzet en nivellering',620,'m³',8,0,11,0,'site'],
  ['01.02','BIM riolering en huisaansluitingen',86,'m',34,48,18,0,'site'],
  ['02.01','BIM funderingsstroken gewapend beton',84,'m³',112,185,48,0,'foundation'],
  ['02.02','BIM vloerplaat op volle grond',148,'m²',38,82,18,0,'foundation'],
  ['02.03','BIM isolatie onder vloerplaat',148,'m²',12,31,2,0,'foundation'],
  ['03.01','BIM dragend metselwerk',184,'m²',54,76,9,0,'shell'],
  ['03.02','BIM binnenmetselwerk en lichte wanden',128,'m²',42,39,5,0,'shell'],
  ['03.03','BIM predallen en druklaag verdieping',132,'m²',28,74,16,0,'shell'],
  ['03.04','BIM trap in prefab beton',1,'st',1450,3850,480,0,'shell'],
  ['04.01','BIM hellend dak en timmerwerk',154,'m²',46,98,12,0,'roof'],
  ['04.02','BIM dakisolatie en luchtdichting',154,'m²',21,54,3,0,'roof'],
  ['04.03','BIM dakbedekking en zinkwerken',154,'m²',29,51,5,0,'roof'],
  ['05.01','BIM buitenschrijnwerk aluminium',14,'st',315,1520,0,0,'facade'],
  ['05.02','BIM gevelisolatie en gevelsteen',246,'m²',44,86,8,0,'facade'],
  ['05.03','BIM inkomdeur en sectionaalpoort',2,'st',420,2750,0,0,'facade'],
  ['06.01','BIM elektriciteit en domotica',1,'st',2800,6600,0,8200,'mep'],
  ['06.02','BIM sanitair en warmtepomp',1,'st',2100,7900,0,16800,'mep'],
  ['06.03','BIM ventilatie D en leidingtracés',1,'st',1450,4700,0,7600,'mep'],
  ['07.01','BIM pleisterwerken en chape',462,'m²',24,22,4,0,'finish'],
  ['07.02','BIM vloer- en wandafwerking',286,'m²',31,48,2,0,'finish'],
  ['07.03','BIM binnenschrijnwerk en maatwerk',1,'st',4200,6800,0,9500,'finish'],
  ['08.01','BIM terrassen, oprit en paden',186,'m²',22,46,14,0,'external'],
  ['08.02','BIM groenaanleg en infiltratie',1,'st',1800,7200,1200,4800,'external'],
] .map((raw, index) => {
  const [code, description, quantity, unit, labor, material, equipment, subcontracting, phaseId] = raw as [string,string,number,string,number,number,number,number,string]
  const phase = familyHomeBimPhases.find(item => item.id === phaseId)!
  return { id:`home-boq-${String(index + 1).padStart(2,'0')}`, chapterId:`home-chapter-${phase.workPackageCode}`, code, description, quantity, unit, labor, material, equipment, subcontracting, postType:'Samengestelde post' as const, quantityType:'Vermoedelijk' as const, notes:`5D BIM-bron: ${FAMILY_HOME_MODEL_NAME} · ${FAMILY_HOME_MODEL_VERSION} · 4D-fase ${phase.label}`, sortOrder:index }
})

export function buildFamilyHomeBimCalculation(): Calculation {
  return {
    id:'calc-family-home-bim', number:FAMILY_HOME_CALCULATION_NUMBER, opportunityId:'opp-family-home-bim', status:'Offerte',
    overheadPct:9.5, riskPct:3, marginPct:17.5, siteOverheadPct:4.5, escalationPct:1.2, discountPct:0, roundingStep:100,
    chapters:familyHomeBimPhases.map(phase=>({ id:`home-chapter-${phase.workPackageCode}`, code:phase.workPackageCode, name:phase.label, sortOrder:phase.sequence - 1 })),
    items:familyHomeCalculationItems,
    updatedAt:'2026-12-18T16:00:00.000Z',
  }
}

export const familyHomeWorkPackages = familyHomeBimPhases.map(phase => ({
  id:`home-wp-${phase.workPackageCode}`, code:phase.workPackageCode, name:phase.label, budget:phase.budget,
  plannedHours:Math.round(phase.budget / 72), status:'Klaar voor planning' as const,
}))

export function buildFamilyHomeBimProject(): Project {
  const activities = familyHomeBimPhases.map((phase, index) => ({
    id:`home-activity-${phase.id}`, workPackageId:`home-wp-${phase.workPackageCode}`, name:phase.label,
    startDate:phase.startDate, endDate:phase.endDate, progress:phase.progressPct,
    predecessorIds:index ? [`home-activity-${familyHomeBimPhases[index - 1].id}`] : [],
    dependencies:index ? [{ predecessorId:`home-activity-${familyHomeBimPhases[index - 1].id}`, type:index === 3 || index === 4 ? 'SS' as const : 'FS' as const, lagDays:index === 3 ? -10 : index === 4 ? -12 : 1 }] : [],
    milestone:false, responsible:index < 5 ? 'Lena Vermeulen' : 'Wouter Peeters', crewSize:index < 3 ? 5 : 3,
    weatherSensitive:['site','foundation','shell','roof','external'].includes(phase.id),
    resourceAssignments:[{ id:`home-resource-${phase.id}`, resourceType:'Ploeg' as const, resourceName:index < 3 ? 'Ploeg ruwbouw woning' : index < 6 ? 'Ploeg technieken en schil' : 'Ploeg afwerking', allocationPct:100 }],
    baselineStartDate:phase.startDate, baselineEndDate:phase.endDate,
  }))
  return {
    id:'project-family-home-bim', number:FAMILY_HOME_PROJECT_NUMBER, name:'Gezinswoning Bosveld · BIM 3D/4D/5D', organizationId:'org-family-home-client',
    legalEntityId:'entity-bouwflow', branchId:'branch-hasselt', sourceCalculationId:'calc-family-home-bim', contractValue:535_000, costBudget:410_000, marginPct:17.5, progress:45.8, status:'Op schema',
    handover:{ status:'Aanvaard', projectManager:'Lena Vermeulen', plannedStart:'2026-09-01', plannedEnd:'2027-05-28', notes:'Volledig BIM-demoproject: objectgebaseerde calculatie, 4D-uitvoeringsplanning en 5D-kosten- en vorderingsopvolging.', risks:['Beslissingen keuken en maatwerk tijdig vastleggen','Luchtdichtheidsdetails vóór sluiting technieken controleren'], checklist:{scopeReviewed:true,budgetReviewed:true,contractReviewed:true,documentsTransferred:true,risksReviewed:true,kickoffPlanned:true}, acceptedAt:'2026-08-28T09:00:00.000Z' },
    workPackages:familyHomeWorkPackages,
    planning:{ status:'Baseline', baselineVersion:1, activities, updatedAt:'2026-12-18T16:00:00.000Z', baselineHistory:[], scenarios:[] },
  }
}

const contractValueByWorkPackage = (budget:number) => Number((535_000 * budget / 410_000).toFixed(2))
const homeEvidence = (workPackageCode:string, completionPct:number) => {
  const elements = familyHomeBimElements.filter(item => item.workPackageCode === workPackageCode)
  const unit = elements[0]?.unit ?? 'st'
  const measuredQuantity = elements.reduce((sum,item)=>sum + item.quantity,0)
  return {
    modelId:FAMILY_HOME_MODEL_ID, modelName:FAMILY_HOME_MODEL_NAME, modelVersion:FAMILY_HOME_MODEL_VERSION, discipline:'Multidisciplinair' as const,
    elementIds:elements.map(item=>item.id), elementCount:elements.length, measuredQuantity:Number(measuredQuantity.toFixed(3)), verifiedQuantity:Number((measuredQuantity * completionPct / 100).toFixed(3)), unit,
    completionPct, measuredAt:'2027-01-31T08:30:00.000Z', measuredBy:'Lena Vermeulen', status:'Gecontroleerd' as const, clashFree:true,
    notes:'3D-selectie gecontroleerd tegen modelversie UIT-07; 4D-fase en 5D-waardering sluiten aan op de goedgekeurde baseline.',
  }
}

export function buildFamilyHomeBimProgressStatement(): ProgressStatement {
  const progressByCode = new Map([['01',100],['02',100],['03',72],['04',58],['05',25],['06',12]])
  const lines = familyHomeWorkPackages.map(workPackage => {
    const cumulativeProgressPct = progressByCode.get(workPackage.code) ?? 0
    const contractValue = contractValueByWorkPackage(workPackage.budget)
    const currentPeriod = Number((contractValue * cumulativeProgressPct / 100).toFixed(2))
    const evidence = cumulativeProgressPct ? homeEvidence(workPackage.code,cumulativeProgressPct) : undefined
    return { workPackageId:workPackage.id, workPackageCode:workPackage.code, workPackageName:workPackage.name, contractValue, previousCumulative:0, currentPeriod, cumulativeProgressPct, cumulativeValue:currentPeriod, measurementMethod:evidence ? 'BIM' as const : 'Handmatig' as const, measuredQuantity:evidence?.verifiedQuantity, unit:evidence?.unit, comment:evidence ? `${evidence.elementCount} woningelementen · 3D/4D/5D gecontroleerd` : 'Nog niet gestart', evidenceDocumentIds:[], bimEvidence:evidence }
  })
  const workAmount = Number(lines.reduce((sum,line)=>sum + line.currentPeriod,0).toFixed(2))
  const retentionAmount = Number((workAmount * .05).toFixed(2))
  return {
    id:'progress-family-home-2027-01', number:'VS-WONING-2027-01', projectId:'project-family-home-bim', periodStart:'2027-01-01', periodEnd:'2027-01-31', lines, changeOrderIds:[], workAmount,
    changeOrderAmount:0, priceRevisionAmount:0, grossAmount:workAmount, retentionPct:5, retentionAmount, netAmount:Number((workAmount-retentionAmount).toFixed(2)), status:'Goedgekeurd', notes:'BIM-vorderingsstaat gezinswoning met objectselectie in 3D, toetsing aan de 4D-baseline en 5D-waardering per werkpakket.',
    valuationDate:'2027-01-31', dueDate:'2027-03-02', certificateReference:'CERT-WONING-2027-01', preparedBy:'Lena Vermeulen', revisionFormula:'Vaste prijs · geen prijsherziening', advancePaymentAmount:0, advanceRecoveryAmount:0, otherDeductionsAmount:0, evidenceDocumentIds:[], qualityChecklist:{measurementsVerified:true,evidenceComplete:true,changesApproved:true,bimModelValidated:true},
    createdAt:'2027-01-31T09:00:00.000Z', submittedAt:'2027-01-31T10:00:00.000Z', approvedBy:'Tom en Sarah Vermeiren', approvedAt:'2027-02-03T14:00:00.000Z',
  }
}
