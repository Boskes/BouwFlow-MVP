import type { BimProgressEvidence, ProjectWorkPackage } from './domain.js'

export type LidarScanStatus = 'Concept' | 'Opgenomen' | 'Uitgelijnd' | 'Geanalyseerd' | 'Ter goedkeuring' | 'Goedgekeurd' | 'As-built gepubliceerd'
export type LidarArtifactKind = 'RoomPlan JSON' | 'USDZ' | 'Mesh' | 'Puntenwolk' | 'Foto' | 'Dieptekaart'
export type LidarMeasurementRule = 'Oppervlakte' | 'Volume' | 'Lengte' | 'Aanwezigheid' | 'Foto en controle'

export interface LidarVector3 { x: number; y: number; z: number }

export interface LidarControlPoint {
  id: string
  label: string
  bim: LidarVector3
  scan: LidarVector3
  verified: boolean
}

export interface LidarRegistration {
  controlPointCount: number
  translation: LidarVector3
  rotationDegrees: number
  rmsErrorMm: number
  maxErrorMm: number
  quality: 'Hoog' | 'Aanvaardbaar' | 'Te controleren'
  registeredAt: string
  registeredBy: string
}

export interface LidarArtifact {
  id: string
  kind: LidarArtifactKind
  fileName: string
  mimeType: string
  sizeBytes: number
  digest?: string
  storageKey?: string
  capturedAt: string
}

export interface LidarElementObservation {
  id: string
  ifcGuid: string
  label: string
  category: string
  workPackageId: string
  plannedQuantity: number
  observedQuantity: number
  unit: 'm²' | 'm³' | 'm' | 'st'
  measurementRule: LidarMeasurementRule
  surfaceCoveragePct: number
  visibilityPct: number
  confidencePct: number
  deviationMm: number
  photoEvidenceCount: number
  detected: boolean
}

export interface LidarElementMatch extends LidarElementObservation {
  suggestedProgressPct: number
  acceptedQuantity: number
  autoApprovable: boolean
  reviewReasons: string[]
}

export interface LidarProgressProposal {
  id: string
  scanSessionId: string
  workPackageId: string
  workPackageCode: string
  workPackageName: string
  elementIds: string[]
  ifcGuids: string[]
  measuredQuantity: number
  verifiedQuantity: number
  unit: 'm²' | 'm³' | 'm' | 'st' | 'gemengd'
  suggestedProgressPct: number
  confidencePct: number
  autoApprovable: boolean
  status: 'Voorstel' | 'Te controleren' | 'Goedgekeurd' | 'Afgekeurd'
  reviewReasons: string[]
  approvedBy?: string
  approvedAt?: string
}

export interface LidarBcfTopic {
  id: string
  scanSessionId: string
  title: string
  description: string
  status: 'Open' | 'In behandeling' | 'Opgelost'
  priority: 'Laag' | 'Normaal' | 'Hoog' | 'Kritiek'
  ifcGuids: string[]
  viewpoint: { camera: LidarVector3; direction: LidarVector3; snapshotArtifactId?: string }
  assignedTo?: string
  dueDate?: string
  createdBy: string
  createdAt: string
}

export interface LidarAsBuiltRevision {
  id: string
  scanSessionId: string
  modelId: string
  sourceModelVersion: string
  revision: string
  approvedElementCount: number
  deviationCount: number
  bcfTopicIds: string[]
  status: 'Concept' | 'Gepubliceerd'
  createdBy: string
  createdAt: string
  publishedAt?: string
}

export interface LidarScanSession {
  id: string
  projectId: string
  modelId: string
  modelName: string
  modelVersion: string
  zone: string
  storey: string
  deviceName: string
  deviceSupportsLidar: boolean
  captureMode: 'RoomPlan' | 'ARKit mesh' | 'Gecombineerd'
  status: LidarScanStatus
  capturedBy: string
  capturedAt: string
  notes: string
  controlPoints: LidarControlPoint[]
  registration?: LidarRegistration
  artifacts: LidarArtifact[]
  observations: LidarElementObservation[]
  matches: LidarElementMatch[]
  progressProposals: LidarProgressProposal[]
  bcfTopics: LidarBcfTopic[]
  asBuiltRevisions: LidarAsBuiltRevision[]
}

export interface LidarScanInput extends Pick<LidarScanSession, 'modelId' | 'modelName' | 'modelVersion' | 'zone' | 'storey' | 'deviceName' | 'deviceSupportsLidar' | 'captureMode' | 'capturedBy' | 'capturedAt' | 'notes'> {
  controlPoints?: LidarControlPoint[]
}

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value))
const round = (value: number, decimals = 2) => Number(value.toFixed(decimals))
const distance = (left: LidarVector3, right: LidarVector3) => Math.sqrt((left.x-right.x)**2+(left.y-right.y)**2+(left.z-right.z)**2)

export function registerLidarScan(controlPoints: LidarControlPoint[], registeredBy: string, registeredAt = new Date().toISOString()): LidarRegistration {
  const verified = controlPoints.filter(point => point.verified)
  if (verified.length < 3) throw new Error('Minstens drie geverifieerde controlepunten zijn vereist voor BIM-uitlijning.')
  const scanCenter=verified.reduce((sum,point)=>({x:sum.x+point.scan.x,y:sum.y+point.scan.y,z:sum.z+point.scan.z}),{x:0,y:0,z:0})
  const bimCenter=verified.reduce((sum,point)=>({x:sum.x+point.bim.x,y:sum.y+point.bim.y,z:sum.z+point.bim.z}),{x:0,y:0,z:0})
  for(const center of [scanCenter,bimCenter]){center.x/=verified.length;center.y/=verified.length;center.z/=verified.length}
  const planar=verified.reduce((sum,point)=>{const sx=point.scan.x-scanCenter.x,sy=point.scan.y-scanCenter.y,bx=point.bim.x-bimCenter.x,by=point.bim.y-bimCenter.y;return{cross:sum.cross+sx*by-sy*bx,dot:sum.dot+sx*bx+sy*by}},{cross:0,dot:0})
  const rotationRadians=Math.atan2(planar.cross,planar.dot),cos=Math.cos(rotationRadians),sin=Math.sin(rotationRadians)
  const rotatedCenter={x:cos*scanCenter.x-sin*scanCenter.y,y:sin*scanCenter.x+cos*scanCenter.y,z:scanCenter.z}
  const translation={x:bimCenter.x-rotatedCenter.x,y:bimCenter.y-rotatedCenter.y,z:bimCenter.z-rotatedCenter.z}
  const transform=(point:LidarVector3)=>({x:cos*point.x-sin*point.y+translation.x,y:sin*point.x+cos*point.y+translation.y,z:point.z+translation.z})
  const errors = verified.map(point => distance(point.bim,transform(point.scan))*1_000)
  const rmsErrorMm = Math.sqrt(errors.reduce((sum,error)=>sum+error**2,0)/errors.length)
  const maxErrorMm = Math.max(...errors)
  return {
    controlPointCount:verified.length,
    translation:{x:round(translation.x,6),y:round(translation.y,6),z:round(translation.z,6)},rotationDegrees:round(rotationRadians*180/Math.PI,4),
    rmsErrorMm:round(rmsErrorMm,1),maxErrorMm:round(maxErrorMm,1),
    quality:rmsErrorMm<=20?'Hoog':rmsErrorMm<=50?'Aanvaardbaar':'Te controleren',
    registeredAt,registeredBy,
  }
}

export function analyzeLidarObservations(observations: LidarElementObservation[]): LidarElementMatch[] {
  return observations.map(observation=>{
    const quantityRatio = observation.plannedQuantity > 0 ? clamp(observation.observedQuantity / observation.plannedQuantity * 100) : 0
    const progress = observation.measurementRule === 'Aanwezigheid'
      ? (observation.detected ? 100 : 0)
      : observation.measurementRule === 'Foto en controle'
        ? Math.min(quantityRatio, observation.photoEvidenceCount ? 100 : 0)
        : Math.min(quantityRatio, observation.surfaceCoveragePct)
    const reviewReasons:string[]=[]
    if(!observation.detected)reviewReasons.push('Element niet overtuigend aangetroffen')
    if(observation.visibilityPct<60)reviewReasons.push('Minder dan 60% zichtbaar in de opname')
    if(observation.confidencePct<85)reviewReasons.push('Herkenningszekerheid lager dan 85%')
    if(Math.abs(observation.deviationMm)>30)reviewReasons.push('Geometrische afwijking groter dan 30 mm')
    if(observation.measurementRule==='Foto en controle'&&!observation.photoEvidenceCount)reviewReasons.push('Foto en manuele kwaliteitscontrole vereist')
    const acceptedQuantity=observation.plannedQuantity*progress/100
    return {...observation,suggestedProgressPct:round(progress,1),acceptedQuantity:round(acceptedQuantity,3),autoApprovable:reviewReasons.length===0,reviewReasons}
  })
}

export function buildLidarProgressProposals(scanSessionId:string,matches:LidarElementMatch[],workPackages:ProjectWorkPackage[]):LidarProgressProposal[]{
  return workPackages.flatMap(workPackage=>{
    const grouped=matches.filter(match=>match.workPackageId===workPackage.id)
    if(!grouped.length)return[]
    const units=[...new Set(grouped.map(match=>match.unit))]
    const weight=grouped.reduce((sum,match)=>sum+Math.max(match.plannedQuantity,1),0)
    const progress=grouped.reduce((sum,match)=>sum+match.suggestedProgressPct*Math.max(match.plannedQuantity,1),0)/weight
    const confidence=grouped.reduce((sum,match)=>sum+match.confidencePct*Math.max(match.plannedQuantity,1),0)/weight
    const reasons=[...new Set(grouped.flatMap(match=>match.reviewReasons))]
    return [{
      id:`proposal-${scanSessionId}-${workPackage.id}`,scanSessionId,workPackageId:workPackage.id,workPackageCode:workPackage.code,workPackageName:workPackage.name,
      elementIds:grouped.map(match=>match.id),ifcGuids:grouped.map(match=>match.ifcGuid),measuredQuantity:round(grouped.reduce((sum,match)=>sum+match.observedQuantity,0),3),
      verifiedQuantity:round(grouped.filter(match=>match.autoApprovable).reduce((sum,match)=>sum+match.acceptedQuantity,0),3),unit:units.length===1?units[0]:'gemengd',
      suggestedProgressPct:round(progress,1),confidencePct:round(confidence,1),autoApprovable:grouped.every(match=>match.autoApprovable),status:reasons.length?'Te controleren':'Voorstel',reviewReasons:reasons,
    }]
  })
}

export function approveLidarProposal(proposal:LidarProgressProposal,approvedBy:string,approvedAt=new Date().toISOString()):LidarProgressProposal{
  if(proposal.unit==='gemengd')throw new Error('Een LiDAR-vorderingsvoorstel met gemengde eenheden kan niet worden goedgekeurd.')
  if(!approvedBy.trim())throw new Error('Een goedkeurder is verplicht.')
  return {...proposal,status:'Goedgekeurd',verifiedQuantity:proposal.measuredQuantity,approvedBy:approvedBy.trim(),approvedAt}
}

export function lidarProposalToBimEvidence(session:LidarScanSession,proposal:LidarProgressProposal):BimProgressEvidence{
  if(proposal.status!=='Goedgekeurd'||proposal.unit==='gemengd')throw new Error('Alleen een goedgekeurd LiDAR-voorstel met één meeteenheid kan als BIM-meetbewijs worden toegepast.')
  return {
    modelId:session.modelId,modelName:session.modelName,modelVersion:session.modelVersion,discipline:'Multidisciplinair',elementIds:proposal.ifcGuids,elementCount:proposal.ifcGuids.length,
    measuredQuantity:proposal.measuredQuantity,verifiedQuantity:proposal.verifiedQuantity,unit:proposal.unit,completionPct:proposal.suggestedProgressPct,measuredAt:session.capturedAt,
    measuredBy:proposal.approvedBy??session.capturedBy,status:'Gecontroleerd',clashFree:session.matches.every(match=>Math.abs(match.deviationMm)<=30),
    notes:`LiDAR-scan ${session.id} · ${session.zone} · registratie ${session.registration?.rmsErrorMm??'—'} mm RMS · zekerheid ${proposal.confidencePct}%`,
    lidarEvidence:{scanSessionId:session.id,captureMode:session.captureMode,deviceName:session.deviceName,registrationRmsMm:session.registration?.rmsErrorMm??0,confidencePct:proposal.confidencePct,artifactIds:session.artifacts.map(item=>item.id),bcfTopicIds:session.bcfTopics.map(item=>item.id)},
  }
}

export function createLidarBcfTopic(input:Omit<LidarBcfTopic,'id'|'status'|'createdAt'>,createdAt=new Date().toISOString()):LidarBcfTopic{
  if(!input.ifcGuids.length)throw new Error('Een BCF-punt moet aan minstens één IFC-GUID gekoppeld zijn.')
  return {...input,id:`bcf-${input.scanSessionId}-${Math.abs(input.title.split('').reduce((sum,char)=>sum+char.charCodeAt(0),0))}`,status:'Open',createdAt}
}

export function buildAsBuiltRevision(session:LidarScanSession,createdBy:string,createdAt=new Date().toISOString()):LidarAsBuiltRevision{
  const approved=session.progressProposals.filter(proposal=>proposal.status==='Goedgekeurd')
  if(!approved.length)throw new Error('Publiceer pas een as-builtversie nadat minstens één LiDAR-vorderingsvoorstel is goedgekeurd.')
  const sequence=session.asBuiltRevisions.length+1
  return {id:`asbuilt-${session.id}-${sequence}`,scanSessionId:session.id,modelId:session.modelId,sourceModelVersion:session.modelVersion,revision:`ASB-${String(sequence).padStart(2,'0')}`,approvedElementCount:new Set(approved.flatMap(item=>item.ifcGuids)).size,deviationCount:session.matches.filter(match=>Math.abs(match.deviationMm)>30).length,bcfTopicIds:session.bcfTopics.map(item=>item.id),status:'Gepubliceerd',createdBy,createdAt,publishedAt:createdAt}
}

export function lidarScanReadiness(session:LidarScanSession){
  return {
    captureComplete:session.artifacts.some(item=>item.kind==='USDZ'||item.kind==='Mesh'||item.kind==='Puntenwolk'),
    registered:Boolean(session.registration&&session.registration.quality!=='Te controleren'),
    analyzed:Boolean(session.matches.length&&session.progressProposals.length),
    evidenceComplete:Boolean(session.progressProposals.length)&&session.artifacts.some(item=>item.kind==='Foto')&&session.progressProposals.every(item=>item.status==='Goedgekeurd'||item.status==='Afgekeurd'),
    asBuiltPublished:session.asBuiltRevisions.some(item=>item.status==='Gepubliceerd'),
  }
}
