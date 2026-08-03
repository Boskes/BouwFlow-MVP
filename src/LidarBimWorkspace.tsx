import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ArrowRight, Camera, CheckCircle2, CircleDot, CloudUpload, FileCheck2, GitCompareArrows, Layers3, MapPin, ScanLine, ShieldCheck, Smartphone, TriangleAlert, X } from 'lucide-react'
import type { BimProgressEvidence, ProjectWorkPackage } from './domain'
import { analyzeLidarObservations, approveLidarProposal, buildAsBuiltRevision, buildLidarProgressProposals, createLidarBcfTopic, lidarProposalToBimEvidence, lidarScanReadiness, registerLidarScan, type LidarArtifact, type LidarBcfTopic, type LidarControlPoint, type LidarElementObservation, type LidarScanInput, type LidarScanSession } from './lidar-bim'

type ScanElement = { id:string; code:string; label:string; category:string; quantity:number; unit:'m²'|'m³'|'m'|'st'; completedProgressPct?:number; verified?:boolean }
export type LidarPersistence={
  list:(projectId:string)=>Promise<LidarScanSession[]>;create:(projectId:string,input:LidarScanInput&{controlPoints?:LidarControlPoint[];observations?:LidarElementObservation[]})=>Promise<LidarScanSession|undefined>;
  upload:(scanId:string,file:File,input:{kind:LidarArtifact['kind'];capturedAt:string})=>Promise<LidarScanSession|undefined>;register:(scanId:string,points:LidarControlPoint[],by:string)=>Promise<LidarScanSession|undefined>;
  analyze:(scanId:string,observations:LidarElementObservation[])=>Promise<LidarScanSession|undefined>;approve:(scanId:string,proposalId:string,by:string)=>Promise<LidarScanSession|undefined>;
  createBcf:(scanId:string,input:Omit<LidarBcfTopic,'id'|'scanSessionId'|'status'|'createdAt'>)=>Promise<LidarScanSession|undefined>;publishAsBuilt:(scanId:string,by:string)=>Promise<LidarScanSession|undefined>;
}
type Props = {
  projectId:string
  modelId:string
  modelName:string
  modelVersion:string
  elements:ScanElement[]
  workPackages:ProjectWorkPackage[]
  initialWorkPackageId:string
  actor:string
  persistence?:LidarPersistence
  onApply:(workPackageId:string,progressPct:number,evidence:BimProgressEvidence)=>void
  onClose:()=>void
}

const phases=[
  {id:1,label:'Opname',description:'LiDAR, foto’s en controlepunten'},
  {id:2,label:'BIM-koppeling',description:'Uitlijning en IFC-herkenning'},
  {id:3,label:'Vordering',description:'Voorstel en goedkeuring'},
  {id:4,label:'As-built & BCF',description:'Afwijkingen en opleverdossier'},
] as const
const number=(value:number,maximumFractionDigits=1)=>new Intl.NumberFormat('nl-BE',{maximumFractionDigits}).format(value)
const now='2026-08-03T08:42:00.000Z'

function initialSession(props:Props):LidarScanSession{
  const firstUnit=props.elements[0]?.unit??'m²'
  const compatible=props.elements.filter(item=>item.unit===firstUnit).slice(0,18)
  const observations:LidarElementObservation[]=compatible.map((element,index)=>{
    const progress=(element.completedProgressPct??0)>0?element.completedProgressPct!:Math.min(92,62+index*3)
    return {id:element.id,ifcGuid:element.id,label:element.label,category:element.category,workPackageId:props.initialWorkPackageId,plannedQuantity:element.quantity,observedQuantity:Number((element.quantity*progress/100).toFixed(3)),unit:element.unit,measurementRule:element.unit==='st'?'Aanwezigheid':element.unit==='m³'?'Volume':element.unit==='m'?'Lengte':'Oppervlakte',surfaceCoveragePct:Math.min(100,progress+7),visibilityPct:index===2?52:88+index%8,confidencePct:index===2?81:91+index%6,deviationMm:index===2?46:8+index%18,photoEvidenceCount:2,detected:true}
  })
  const artifacts:LidarArtifact[]=[
    {id:'artifact-usdz-bt-01',kind:'USDZ',fileName:'BT-gelijkvloers-20260803.usdz',mimeType:'model/vnd.usdz+zip',sizeBytes:8_420_118,digest:'sha256:demo-usdz-bt-01',capturedAt:now},
    {id:'artifact-photo-bt-01',kind:'Foto',fileName:'BT-gelijkvloers-overzicht.heic',mimeType:'image/heic',sizeBytes:3_145_020,digest:'sha256:demo-photo-bt-01',capturedAt:now},
    {id:'artifact-json-bt-01',kind:'RoomPlan JSON',fileName:'BT-gelijkvloers-roomplan.json',mimeType:'application/json',sizeBytes:184_310,digest:'sha256:demo-json-bt-01',capturedAt:now},
  ]
  return {id:'lidar-bt-2026-08-03-01',projectId:props.projectId,modelId:props.modelId,modelName:props.modelName,modelVersion:props.modelVersion,zone:'Gelijkvloers · leefruimte en inkom',storey:'Gelijkvloers',deviceName:'iPhone Pro · LiDAR',deviceSupportsLidar:true,captureMode:'Gecombineerd',status:'Opgenomen',capturedBy:props.actor||'Werfleider',capturedAt:now,notes:'Pilotopname woning Bosmans-Taverniers. Geen personen in beeld.',controlPoints:[
    {id:'cp-01',label:'As A/1',bim:{x:10,y:5,z:0},scan:{x:0,y:0,z:0},verified:true},
    {id:'cp-02',label:'As D/1',bim:{x:17.2,y:5,z:0},scan:{x:7.199,y:.002,z:0},verified:true},
    {id:'cp-03',label:'As A/5',bim:{x:10,y:13.4,z:0},scan:{x:.001,y:8.4,z:.001},verified:true},
    {id:'cp-04',label:'Dorpel inkom',bim:{x:11.2,y:5,z:.02},scan:{x:1.2,y:.001,z:.019},verified:true},
  ],artifacts,observations,matches:[],progressProposals:[],bcfTopics:[],asBuiltRevisions:[]}
}

export default function LidarBimWorkspace(props:Props){
  const [phase,setPhase]=useState<(typeof phases)[number]['id']>(1)
  const [session,setSession]=useState<LidarScanSession>(()=>initialSession(props))
  const [notice,setNotice]=useState('De iPhone-opname is ontvangen en wacht op BIM-uitlijning.')
  const [reviewer,setReviewer]=useState(props.actor||'BIM-coördinator')
  const [selectedProposalId,setSelectedProposalId]=useState<string>()
  const uploadRef=useRef<HTMLInputElement>(null)
  const initialized=useRef(false)
  const remoteSeed=useRef({modelId:props.modelId,modelName:props.modelName,modelVersion:props.modelVersion,zone:session.zone,storey:session.storey,deviceName:session.deviceName,deviceSupportsLidar:true,captureMode:session.captureMode,capturedBy:props.actor||'Werfleider',capturedAt:session.capturedAt,notes:session.notes,controlPoints:session.controlPoints,observations:session.observations})
  const readiness=lidarScanReadiness(session)
  const selectedProposal=session.progressProposals.find(item=>item.id===selectedProposalId)??session.progressProposals[0]
  const criticalMatches=useMemo(()=>session.matches.filter(item=>item.reviewReasons.length),[session.matches])

  useEffect(()=>{if(!props.persistence||initialized.current)return;initialized.current=true;void (async()=>{const existing=await props.persistence!.list(props.projectId);if(existing[0]){setSession(existing[0]);setNotice('Laatste opgeslagen LiDAR-scansessie geladen.');return}const created=await props.persistence!.create(props.projectId,remoteSeed.current);if(created){setSession(created);setNotice('LiDAR-scansessie veilig in het projectdossier aangemaakt.')}})()},[props.persistence,props.projectId])

  const register=async()=>{
    try{const saved=await props.persistence?.register(session.id,session.controlPoints,reviewer||session.capturedBy);const registration=saved?.registration??registerLidarScan(session.controlPoints,reviewer||session.capturedBy);setSession(saved??(current=>({...current,registration,status:'Uitgelijnd'})));setNotice(`Scan uitgelijnd met ${registration.controlPointCount} controlepunten · ${registration.rmsErrorMm} mm RMS.`);setPhase(2)}catch(error){setNotice(error instanceof Error?error.message:'Uitlijning mislukt')}
  }
  const analyze=async()=>{
    const saved=await props.persistence?.analyze(session.id,session.observations);const matches=saved?.matches??analyzeLidarObservations(session.observations)
    const proposals=saved?.progressProposals??buildLidarProgressProposals(session.id,matches,props.workPackages)
    setSession(saved??(current=>({...current,matches,progressProposals:proposals,status:'Geanalyseerd'})));setSelectedProposalId(proposals[0]?.id);setNotice(`${matches.length} IFC-objecten gekoppeld; ${matches.filter(item=>!item.autoApprovable).length} vragen menselijke controle.`);setPhase(3)
  }
  const approve=async()=>{
    if(!selectedProposal)return
    try{const saved=await props.persistence?.approve(session.id,selectedProposal.id,reviewer);const approved=saved?.progressProposals.find(item=>item.id===selectedProposal.id)??approveLidarProposal(selectedProposal,reviewer);setSession(saved??(current=>({...current,status:'Goedgekeurd',progressProposals:current.progressProposals.map(item=>item.id===approved.id?approved:item)})));setNotice(`Vorderingsvoorstel ${approved.workPackageCode} goedgekeurd door ${reviewer}.`)}catch(error){setNotice(error instanceof Error?error.message:'Goedkeuring mislukt')}
  }
  const apply=()=>{
    const proposal=session.progressProposals.find(item=>item.id===selectedProposal?.id)
    if(!proposal)return
    try{props.onApply(proposal.workPackageId,proposal.suggestedProgressPct,lidarProposalToBimEvidence(session,proposal));setNotice('LiDAR-meetbewijs is toegepast op de vorderingsstaat.')}catch(error){setNotice(error instanceof Error?error.message:'Meetbewijs kon niet worden toegepast')}
  }
  const createIssue=async()=>{
    const match=criticalMatches[0]??session.matches[0]
    if(!match){setNotice('Analyseer de scan eerst om een BCF-punt te maken.');return}
    const input:Omit<LidarBcfTopic,'id'|'scanSessionId'|'status'|'createdAt'>={title:`LiDAR-afwijking · ${match.label}`,description:match.reviewReasons.join('. ')||`Controleer een afwijking van ${match.deviationMm} mm.`,priority:Math.abs(match.deviationMm)>50?'Kritiek':'Hoog',ifcGuids:[match.ifcGuid],viewpoint:{camera:{x:2.1,y:1.4,z:1.65},direction:{x:.2,y:.9,z:-.1},snapshotArtifactId:session.artifacts.find(item=>item.kind==='Foto')?.id},assignedTo:'Projectleider',createdBy:reviewer||session.capturedBy};const saved=await props.persistence?.createBcf(session.id,input);const topic=saved?.bcfTopics[0]??createLidarBcfTopic({...input,scanSessionId:session.id});setSession(saved??(current=>({...current,bcfTopics:[topic,...current.bcfTopics]})));setNotice(`BCF-punt “${topic.title}” aangemaakt en aan de IFC-GUID gekoppeld.`)
  }
  const publishAsBuilt=async()=>{
    try{const saved=await props.persistence?.publishAsBuilt(session.id,reviewer);const revision=saved?.asBuiltRevisions[0]??buildAsBuiltRevision(session,reviewer);setSession(saved??(current=>({...current,status:'As-built gepubliceerd',asBuiltRevisions:[revision,...current.asBuiltRevisions]})));setNotice(`As-built ${revision.revision} gepubliceerd met ${revision.approvedElementCount} gecontroleerde objecten.`)}catch(error){setNotice(error instanceof Error?error.message:'As-built kon niet worden gepubliceerd')}
  }
  const importArtifact=async(file?:File)=>{
    if(!file)return
    const extension=file.name.split('.').pop()?.toLowerCase();const kind:LidarArtifact['kind']=extension==='usdz'?'USDZ':extension==='json'?'RoomPlan JSON':extension==='ply'||extension==='obj'?'Puntenwolk':file.type.startsWith('image/')?'Foto':'Mesh'
    const capturedAt=new Date().toISOString();const saved=await props.persistence?.upload(session.id,file,{kind,capturedAt});if(saved){setSession(saved);setNotice(`${file.name} met hashcontrole in het scanbewijs opgeslagen.`);return}const artifact:LidarArtifact={id:`artifact-${Date.now()}`,kind,fileName:file.name,mimeType:file.type||'application/octet-stream',sizeBytes:file.size,capturedAt}
    setSession(current=>({...current,artifacts:[artifact,...current.artifacts],status:'Opgenomen'}));setNotice(`${file.name} toegevoegd aan het scanbewijs.`)
  }

  return <div className="modal-backdrop lidar-workspace-backdrop">
    <section className="modal lidar-workspace" aria-label="LiDAR BIM-voortgang">
      <header className="lidar-header"><div className="lidar-brand"><ScanLine size={23}/></div><div><p className="eyebrow">iPhone LiDAR · BIM · vorderingen</p><h2>Werfscan en digitaal meetbewijs</h2><span>{session.modelName} · {session.modelVersion}</span></div><div className="lidar-header-status"><i></i><span>{session.status}</span><strong>{session.zone}</strong></div><button className="icon-button" aria-label="LiDAR sluiten" onClick={props.onClose}><X size={20}/></button></header>
      <nav className="lidar-phase-nav" aria-label="LiDAR-fases">{phases.map(item=><button type="button" key={item.id} className={`${phase===item.id?'active':''} ${item.id<phase?'complete':''}`} onClick={()=>setPhase(item.id)}><em>{item.id}</em><span><strong>{item.label}</strong><small>{item.description}</small></span>{item.id<4&&<ArrowRight size={14}/>}</button>)}</nav>
      <div className="lidar-notice"><CircleDot size={14}/><span>{notice}</span></div>
      <div className="lidar-body">
        <aside className="lidar-side"><div className="lidar-device-card"><Smartphone size={22}/><span><strong>{session.deviceName}</strong><small>{session.captureMode} · LiDAR {session.deviceSupportsLidar?'actief':'niet beschikbaar'}</small></span><CheckCircle2 size={16}/></div><h3>Scanbewijs</h3>{session.artifacts.map(item=><div className="lidar-artifact" key={item.id}><span><strong>{item.kind}</strong><small>{item.fileName}</small></span><em>{number(item.sizeBytes/1_000_000,2)} MB</em></div>)}<input hidden ref={uploadRef} type="file" accept=".usdz,.json,.ply,.obj,.zip,image/*" onChange={event=>importArtifact(event.target.files?.[0])}/><button className="secondary" onClick={()=>uploadRef.current?.click()}><CloudUpload size={14}/>Scanbestand importeren</button><div className="lidar-native"><Smartphone size={17}/><span><strong>BouwFlow Scan voor iPhone</strong><small>RoomPlan/ARKit-opnames synchroniseren met dezelfde Entra-aanmelding.</small></span></div></aside>
        <main className="lidar-main">
          {phase===1&&<><section className="lidar-stage-head"><div><p className="eyebrow">Fase 1 · Bewijsopname</p><h3>LiDAR, foto’s en vaste referentiepunten</h3></div><button className="primary" onClick={register}><MapPin size={15}/>Controlepunten uitlijnen</button></section><div className="lidar-capture-preview"><div className="lidar-camera-grid"></div><div className="lidar-scan-cone"></div><div className="lidar-room-shape"><i></i><i></i><i></i><i></i></div><div className="lidar-capture-overlay"><Camera size={18}/><strong>Opname compleet</strong><span>{session.observations.length} objectkandidaten · {session.artifacts.length} bewijsbestanden</span></div></div><div className="lidar-control-grid">{session.controlPoints.map(point=><div key={point.id}><MapPin size={15}/><span><strong>{point.label}</strong><small>BIM {point.bim.x}, {point.bim.y}, {point.bim.z} m</small></span><em>{point.verified?'Geverifieerd':'Open'}</em></div>)}</div></>}
          {phase===2&&<><section className="lidar-stage-head"><div><p className="eyebrow">Fase 2 · Slimme BIM-koppeling</p><h3>Scan tegenover IFC-model analyseren</h3></div><button className="primary" disabled={!session.registration} onClick={analyze}><GitCompareArrows size={15}/>Automatisch koppelen</button></section><div className="lidar-registration"><div><span>Controlepunten</span><strong>{session.registration?.controlPointCount??0}</strong></div><div><span>RMS-afwijking</span><strong>{session.registration?`${session.registration.rmsErrorMm} mm`:'Nog uitlijnen'}</strong></div><div><span>Rotatie / kwaliteit</span><strong>{session.registration?`${number(session.registration.rotationDegrees,2)}Â° Â· ${session.registration.quality}`:'Open'}</strong></div><div><span>IFC-revisie</span><strong>{session.modelVersion}</strong></div></div><div className="lidar-compare"><div><p>BIM</p>{session.observations.slice(0,12).map(item=><i key={`bim-${item.id}`} title={item.label}></i>)}</div><div><p>LiDAR-reality</p>{session.observations.slice(0,12).map((item,index)=><i key={`scan-${item.id}`} className={index===2?'deviation':''} title={item.label}></i>)}</div><span><GitCompareArrows size={24}/><strong>IFC-GUID matching</strong><small>Geometrie, zone, categorie en hoeveelheden</small></span></div></>}
          {phase===3&&<><section className="lidar-stage-head"><div><p className="eyebrow">Fase 3 · Vorderingsvoorstel</p><h3>Objectbewijs naar meetstaat en werkpakket</h3></div><button className="primary" disabled={!selectedProposal||selectedProposal.status==='Goedgekeurd'} onClick={approve}><ShieldCheck size={15}/>Menselijk goedkeuren</button></section>{session.progressProposals.length?<div className="lidar-proposals">{session.progressProposals.map(item=><button key={item.id} className={selectedProposal?.id===item.id?'active':''} onClick={()=>setSelectedProposalId(item.id)}><span><strong>{item.workPackageCode} · {item.workPackageName}</strong><small>{item.elementIds.length} IFC-objecten · {number(item.confidencePct)}% zekerheid</small></span><em>{number(item.suggestedProgressPct)}%</em><b className={item.status==='Goedgekeurd'?'ok':item.reviewReasons.length?'warn':''}>{item.status}</b></button>)}</div>:<div className="lidar-empty"><GitCompareArrows size={28}/><strong>Voer eerst de BIM-analyse uit</strong><span>Daarna maakt BouwFlow voorstellen per werkpakket.</span></div>}{selectedProposal&&<div className="lidar-proposal-detail"><div><span>Gemeten</span><strong>{number(selectedProposal.measuredQuantity,3)} {selectedProposal.unit}</strong></div><div><span>Te vorderen</span><strong>{number(selectedProposal.suggestedProgressPct)}%</strong></div><div><span>Controle</span><strong>{selectedProposal.reviewReasons.length?`${selectedProposal.reviewReasons.length} punten`:'Automatisch conform'}</strong></div>{selectedProposal.reviewReasons.map(reason=><p key={reason}><TriangleAlert size={13}/>{reason}</p>)}<label>Goedgekeurd door<input value={reviewer} onChange={event=>setReviewer(event.target.value)}/></label><button className="primary" disabled={selectedProposal.status!=='Goedgekeurd'} onClick={apply}><FileCheck2 size={15}/>Toepassen op vorderingsstaat</button></div>}</>}
          {phase===4&&<><section className="lidar-stage-head"><div><p className="eyebrow">Fase 4 · OpenBIM en oplevering</p><h3>BCF-afwijkingen en as-builtmodel</h3></div><div className="lidar-stage-actions"><button className="secondary" onClick={createIssue}><AlertTriangle size={15}/>BCF-punt maken</button><button className="primary" onClick={publishAsBuilt}><Layers3 size={15}/>As-built publiceren</button></div></section><div className="lidar-closeout-kpis"><div><span>Afwijkingen</span><strong>{criticalMatches.length}</strong><small>tolerantie of zekerheid</small></div><div><span>BCF-punten</span><strong>{session.bcfTopics.length}</strong><small>met IFC-viewpoint</small></div><div><span>As-built</span><strong>{session.asBuiltRevisions[0]?.revision??'Concept'}</strong><small>{session.asBuiltRevisions[0]?.approvedElementCount??0} objecten</small></div></div><div className="lidar-issues">{session.bcfTopics.map(item=><article key={item.id}><AlertTriangle size={17}/><span><strong>{item.title}</strong><small>{item.description}</small><em>{item.ifcGuids.join(', ')}</em></span><b>{item.status}</b></article>)}{!session.bcfTopics.length&&<div className="lidar-empty"><AlertTriangle size={28}/><strong>Nog geen BCF-afwijkingen</strong><span>Maak vanuit een meetafwijking een openBIM-punt.</span></div>}</div></>}
        </main>
        <aside className="lidar-readiness"><h3>Flowgereedheid</h3>{[['Opname compleet',readiness.captureComplete],['BIM uitgelijnd',readiness.registered],['Objecten geanalyseerd',readiness.analyzed],['Bewijs goedgekeurd',readiness.evidenceComplete],['As-built gepubliceerd',readiness.asBuiltPublished]].map(([label,ready])=><div key={String(label)} className={ready?'ready':''}>{ready?<CheckCircle2 size={15}/>:<CircleDot size={15}/>}<span>{label}</span></div>)}<div className="lidar-safety"><ShieldCheck size={17}/><span><strong>Geen automatische betaling</strong><small>LiDAR maakt een voorstel. Een bevoegde gebruiker blijft verantwoordelijk voor certificatie.</small></span></div><div className="lidar-safety warning"><TriangleAlert size={17}/><span><strong>Niet landmeetkundig</strong><small>Gebruik controlepunten, kwaliteitsdrempels en professionele metingen waar het contract dit vereist.</small></span></div></aside>
      </div>
    </section>
  </div>
}
