import type { Calculation, ProgressStatement, Project } from './domain.js'
import type { FamilyHomeBimElement, FamilyHomeBimPhase } from './family-home-bim.js'
import {
  BOSMANS_TAVERNIERS_SOURCE_TOTAL_EXCL_VAT,
  BOSMANS_TAVERNIERS_SOURCE_TOTAL_INCL_VAT,
  BOSMANS_TAVERNIERS_SOURCE_VAT,
  bosmansTaverniersDwgColumns,
  bosmansTaverniersDwgWalls,
  bosmansTaverniersMeetstaatChapters,
  bosmansTaverniersMeetstaatRows,
} from './bosmans-taverniers-bim.generated.js'

export const BOSMANS_TAVERNIERS_MODEL_ID = 'bosmans-taverniers-dwg-bim'
export const BOSMANS_TAVERNIERS_MODEL_NAME = 'BosmansTaverniers-DWG-reconstructie.ifc'
export const BOSMANS_TAVERNIERS_MODEL_VERSION = 'DWG AC1032 · meetstaat BA · bronuitgave 2026-08-03'
export const BOSMANS_TAVERNIERS_CALCULATION_NUMBER = 'CAL-BT-BA-001'
export const BOSMANS_TAVERNIERS_PROJECT_NUMBER = 'PRJ-BT-BOLDERBERG-001'

export const bosmansTaverniersBimPhases: FamilyHomeBimPhase[] = [
  { id:'bt-site', sequence:1, label:'Werfinrichting en grondwerken', workPackageCode:'01', startDate:'2026-09-07', endDate:'2026-10-02', budget:9_571.86, progressPct:0, color:'#8b765d' },
  { id:'bt-foundation', sequence:2, label:'Funderingen, kelder en vloerplaat', workPackageCode:'02', startDate:'2026-10-05', endDate:'2026-11-13', budget:21_714.72, progressPct:0, color:'#647f85' },
  { id:'bt-shell', sequence:3, label:'Ruwbouw en draagstructuur', workPackageCode:'03', startDate:'2026-11-16', endDate:'2027-01-29', budget:72_246.65, progressPct:0, color:'#b26f44' },
  { id:'bt-roof', sequence:4, label:'Plat dak en thermische schil', workPackageCode:'04', startDate:'2027-01-18', endDate:'2027-02-19', budget:42_808.97, progressPct:0, color:'#455f66' },
  { id:'bt-facade', sequence:5, label:'Gevel en buitenschrijnwerk', workPackageCode:'05', startDate:'2027-02-01', endDate:'2027-03-12', budget:39_270.16, progressPct:0, color:'#4c9ab0' },
  { id:'bt-mep', sequence:6, label:'Riolering en technieken', workPackageCode:'06', startDate:'2027-02-22', endDate:'2027-04-23', budget:61_708.02, progressPct:0, color:'#d28245' },
  { id:'bt-finish', sequence:7, label:'Binnenafwerking', workPackageCode:'07', startDate:'2027-04-05', endDate:'2027-06-25', budget:66_570.25, progressPct:0, color:'#aa8b69' },
  { id:'bt-handover', sequence:8, label:'Controle, as-built en oplevering', workPackageCode:'08', startDate:'2027-06-28', endDate:'2027-07-09', budget:0, progressPct:0, color:'#729267' },
]

const phaseByChapter = (chapterCode:string) => {
  const chapter = Number(chapterCode)
  if(chapter <= 2)return bosmansTaverniersBimPhases[0]
  if(chapter <= 3)return bosmansTaverniersBimPhases[1]
  if(chapter <= 7)return bosmansTaverniersBimPhases[2]
  if(chapter === 9 || chapter === 10)return bosmansTaverniersBimPhases[3]
  if([11,12,14].includes(chapter))return bosmansTaverniersBimPhases[4]
  if(chapter === 8 || chapter === 40)return bosmansTaverniersBimPhases[5]
  return bosmansTaverniersBimPhases[6]
}

const normalizedMeetstaatChapters = [
  {code:'00',name:'WERFINSTALLATIE'},
  ...bosmansTaverniersMeetstaatChapters.map(chapter=>({code:chapter.code.replace(/\D/g,'').padStart(2,'0'),name:chapter.name})),
]

const rawElements: FamilyHomeBimElement[] = [
  ...bosmansTaverniersDwgWalls.map((wall,index) => {
    const phase=bosmansTaverniersBimPhases[2]
    const length=Math.max(wall.size[0],wall.size[2])
    return {
      id:wall.id, code:`BT-W-${String(index+1).padStart(3,'0')}`, ifcType:'IfcWall', label:`DWG-wand ${wall.sourceBlock}`,
      category:'Wanden' as const, storey:wall.storey, quantity:Number((length*wall.size[1]).toFixed(3)), unit:'m²' as const, unitCost:210,
      x:0, y:0, width:0, height:0, shape:'wall' as const, geometry:{position:[...wall.position] as [number,number,number],size:[...wall.size] as [number,number,number]},
      phaseId:phase.id, workPackageCode:phase.workPackageCode, plannedStart:phase.startDate, plannedEnd:phase.endDate, completedProgressPct:0, verified:true,
    }
  }),
  ...bosmansTaverniersDwgColumns.map((column,index) => {
    const phase=bosmansTaverniersBimPhases[2]
    return {
      id:column.id, code:`BT-C-${String(index+1).padStart(2,'0')}`, ifcType:'IfcColumn', label:`DWG-kolom ${column.sourceBlock}`,
      category:'Kolommen' as const, storey:column.storey, quantity:Number((column.size[0]*column.size[1]*column.size[2]).toFixed(3)), unit:'m³' as const, unitCost:1_250,
      x:0, y:0, width:0, height:0, shape:'column' as const, geometry:{position:[...column.position] as [number,number,number],size:[...column.size] as [number,number,number]},
      phaseId:phase.id, workPackageCode:phase.workPackageCode, plannedStart:phase.startDate, plannedEnd:phase.endDate, completedProgressPct:0, verified:true,
    }
  }),
  ...[
    {id:'bt-floor-gv-1',label:'Vloerplaat gelijkvloers · hoofdvolume',storey:'Gelijkvloers',quantity:82.4,position:[-.7,.02,0] as [number,number,number],size:[9.9,.24,14.6] as [number,number,number]},
    {id:'bt-floor-gv-2',label:'Vloerplaat gelijkvloers · nevenvolume',storey:'Gelijkvloers',quantity:34.1376,position:[4.85,.02,1.8] as [number,number,number],size:[1.3,.24,8.6] as [number,number,number]},
    {id:'bt-floor-v1-1',label:'Verdiepingsvloer · hoofdvolume',storey:'Verdieping 1',quantity:70.2,position:[-.45,2.92,.15] as [number,number,number],size:[9.7,.24,13.1] as [number,number,number]},
    {id:'bt-floor-v1-2',label:'Verdiepingsvloer · nevenvolume',storey:'Verdieping 1',quantity:21.6585,position:[4.7,2.92,1.55] as [number,number,number],size:[1.45,.24,7.9] as [number,number,number]},
  ].map((floor,index) => {
    const phase=index<2?bosmansTaverniersBimPhases[1]:bosmansTaverniersBimPhases[2]
    return {id:floor.id,code:`BT-F-${index+1}`,ifcType:'IfcSlab',label:floor.label,category:'Vloeren' as const,storey:floor.storey,quantity:floor.quantity,unit:'m²' as const,unitCost:165,x:0,y:0,width:0,height:0,shape:'plate' as const,geometry:{position:floor.position,size:floor.size},phaseId:phase.id,workPackageCode:phase.workPackageCode,plannedStart:phase.startDate,plannedEnd:phase.endDate,completedProgressPct:0,verified:index!==0}
  }),
  ...[
    {id:'bt-roof-1',label:'Warm plat dak · hoofdvolume',quantity:142.8411,position:[-.25,5.88,.1] as [number,number,number],size:[10.3,.28,14.7] as [number,number,number]},
    {id:'bt-roof-2',label:'Plat dak · lager nevenvolume',quantity:40.4926,position:[4.95,3.17,1.9] as [number,number,number],size:[1.55,.28,8.8] as [number,number,number]},
  ].map((roof,index) => {const phase=bosmansTaverniersBimPhases[3];return {id:roof.id,code:`BT-R-${index+1}`,ifcType:'IfcRoof',label:roof.label,category:'Daken' as const,storey:'Dak',quantity:roof.quantity,unit:'m²' as const,unitCost:96,x:0,y:0,width:0,height:0,shape:'roof' as const,geometry:{position:roof.position,size:roof.size},phaseId:phase.id,workPackageCode:phase.workPackageCode,plannedStart:phase.startDate,plannedEnd:phase.endDate,completedProgressPct:0,verified:true}}),
  ...Array.from({length:14},(_,index) => {const phase=bosmansTaverniersBimPhases[4],upper=index>=7,slot=index%7,x=-4.4+slot*1.45,z=index%2?-7.42:7.42;return {id:`bt-window-${String(index+1).padStart(2,'0')}`,code:`BT-RA-${String(index+1).padStart(2,'0')}`,ifcType:'IfcWindow',label:`Buitenschrijnwerk raamgeheel ${index+1}`,category:'Ramen' as const,storey:upper?'Verdieping 1':'Gelijkvloers',quantity:Number((78.5809/14).toFixed(4)),unit:'m²' as const,unitCost:400,x:0,y:0,width:0,height:0,shape:'window' as const,geometry:{position:[x,upper?4.35:1.45,z] as [number,number,number],size:[1.05,1.45,.1] as [number,number,number]},phaseId:phase.id,workPackageCode:phase.workPackageCode,plannedStart:phase.startDate,plannedEnd:phase.endDate,completedProgressPct:0,verified:false}}),
]

const rawModelTotal=rawElements.reduce((sum,item)=>sum+item.quantity*item.unitCost,0)
const modelCostScale=BOSMANS_TAVERNIERS_SOURCE_TOTAL_EXCL_VAT/rawModelTotal
export const bosmansTaverniersBimElements: FamilyHomeBimElement[] = rawElements.map(item=>({...item,unitCost:Number((item.unitCost*modelCostScale).toFixed(6))}))

export function buildBosmansTaverniersCalculation():Calculation {
  return {
    id:'calc-bosmans-taverniers', number:BOSMANS_TAVERNIERS_CALCULATION_NUMBER, opportunityId:'opp-bosmans-taverniers', status:'Offerte',
    overheadPct:0,riskPct:0,marginPct:0,siteOverheadPct:0,escalationPct:0,discountPct:0,roundingStep:0.01,
    chapters:normalizedMeetstaatChapters.map((chapter,index)=>({id:`bt-chapter-${chapter.code}`,code:chapter.code,name:chapter.name,sortOrder:index})),
    items:bosmansTaverniersMeetstaatRows.map((row,index)=>{
      const phase=phaseByChapter(row.chapterCode)
      const sourceIsNegative=row.quantity<0
      return {id:row.id,chapterId:`bt-chapter-${row.chapterCode}`,code:row.code,description:row.description,quantity:Math.abs(row.quantity),unit:row.unit,labor:0,material:0,equipment:0,subcontracting:Math.abs(row.effectiveUnitPrice),postType:'Meetstaatpost' as const,quantityType:row.postType==='V.H.'?'Vermoedelijk' as const:'Forfaitair' as const,notes:`Bron: Bosmans-Taverniers MS BA.xlsx · blad samenvatting2 · rij ${row.sourceRow} · bronhoeveelheid ${row.quantity} ${row.unit} · bron-EH ${row.sourceUnitPrice.toFixed(4)} EUR · bronregel ${row.sourceTotal.toFixed(4)} EUR · 4D-fase ${phase.label}${sourceIsNegative?' · BRONAFWIJKING: negatieve hoeveelheid via 200% markdown behouden':''}`,priceAdjustments:sourceIsNegative?[{id:`bt-negative-source-${row.id}`,label:'Negatieve bronhoeveelheid behouden',type:'Markdown' as const,basis:'Directe kost' as const,percentage:200,active:true}]:[],sortOrder:index}
    }),
    updatedAt:'2026-08-03T18:41:51.000Z',
  }
}

export const bosmansTaverniersWorkPackages = bosmansTaverniersBimPhases.map(phase=>({id:`bt-wp-${phase.workPackageCode}`,code:phase.workPackageCode,name:phase.label,budget:phase.budget,plannedHours:Math.round(phase.budget/68),status:'Klaar voor planning' as const}))

export function buildBosmansTaverniersProject():Project {
  const activities=bosmansTaverniersBimPhases.map((phase,index)=>({id:`bt-activity-${phase.id}`,workPackageId:`bt-wp-${phase.workPackageCode}`,name:phase.label,startDate:phase.startDate,endDate:phase.endDate,progress:0,predecessorIds:index?[`bt-activity-${bosmansTaverniersBimPhases[index-1].id}`]:[],dependencies:index?[{predecessorId:`bt-activity-${bosmansTaverniersBimPhases[index-1].id}`,type:index===3||index===4?'SS' as const:'FS' as const,lagDays:index===3?-10:index===4?-8:1}]:[],milestone:index===bosmansTaverniersBimPhases.length-1,responsible:'Jurgen Bosmans',crewSize:index===bosmansTaverniersBimPhases.length-1?0:3,weatherSensitive:index<5,resourceAssignments:[],baselineStartDate:phase.startDate,baselineEndDate:phase.endDate}))
  return {id:'project-bosmans-taverniers',number:BOSMANS_TAVERNIERS_PROJECT_NUMBER,name:'Woning Bosmans-Taverniers · BIM 3D/4D/5D',organizationId:'org-bosmans-taverniers',legalEntityId:'entity-bouwflow',branchId:'branch-hasselt',sourceCalculationId:'calc-bosmans-taverniers',contractValue:BOSMANS_TAVERNIERS_SOURCE_TOTAL_EXCL_VAT,costBudget:BOSMANS_TAVERNIERS_SOURCE_TOTAL_EXCL_VAT,marginPct:0,progress:0,status:'Opstart',handover:{status:'Concept',projectManager:'Jurgen Bosmans',plannedStart:'2026-09-07',plannedEnd:'2027-07-09',notes:`BIM-reconstructie op basis van BosmansTaverniers.DWG (AutoCAD 2018) en Bosmans-Taverniers MS BA.xlsx. Meetstaat: ${BOSMANS_TAVERNIERS_SOURCE_TOTAL_EXCL_VAT.toFixed(2)} EUR excl. btw; ${BOSMANS_TAVERNIERS_SOURCE_VAT.toFixed(2)} EUR btw; ${BOSMANS_TAVERNIERS_SOURCE_TOTAL_INCL_VAT.toFixed(2)} EUR incl. btw. 4D-data is een voorstelplanning en moet voor baselining worden bevestigd.`,risks:['Broncontrole: meetstaatregel vloerplaat bevat een negatieve hoeveelheid van -0,23586 m³','Raamgeometrie is verdeeld volgens de meetstaat en moet tegen de geveltekeningen worden gevalideerd','Voorstelplanning nog niet als contractuele baseline goedgekeurd'],checklist:{scopeReviewed:true,budgetReviewed:true,contractReviewed:false,documentsTransferred:true,risksReviewed:true,kickoffPlanned:false}},workPackages:bosmansTaverniersWorkPackages,planning:{status:'Concept',baselineVersion:0,activities,updatedAt:'2026-08-03T20:00:00.000Z',baselineHistory:[],scenarios:[]}}
}

export function buildBosmansTaverniersProgressStatement():ProgressStatement {
  const lines=bosmansTaverniersWorkPackages.map(workPackage=>({workPackageId:workPackage.id,workPackageCode:workPackage.code,workPackageName:workPackage.name,contractValue:workPackage.budget,previousCumulative:0,currentPeriod:0,cumulativeProgressPct:0,cumulativeValue:0,measurementMethod:'BIM' as const,measuredQuantity:0,unit:'st' as const,comment:'Klaar voor eerste BIM-meting; nog geen werk gecertificeerd.',evidenceDocumentIds:[]}))
  return {id:'progress-bosmans-taverniers-concept',number:'VS-BT-CONCEPT-001',projectId:'project-bosmans-taverniers',periodStart:'2026-09-01',periodEnd:'2026-09-30',lines,changeOrderIds:[],workAmount:0,changeOrderAmount:0,priceRevisionAmount:0,grossAmount:0,retentionPct:5,retentionAmount:0,netAmount:0,status:'Concept',notes:'Conceptvorderingsstaat gekoppeld aan de DWG-geometrie en Excel-meetstaat. Pas hoeveelheden pas toe na verificatie op de werf.',valuationDate:'2026-09-30',dueDate:'2026-10-30',certificateReference:'',preparedBy:'Jurgen Bosmans',revisionFormula:'Volgens contract te bevestigen',advancePaymentAmount:0,advanceRecoveryAmount:0,otherDeductionsAmount:0,evidenceDocumentIds:[],qualityChecklist:{measurementsVerified:false,evidenceComplete:false,changesApproved:false,bimModelValidated:false},createdAt:'2026-08-03T20:00:00.000Z'}
}
