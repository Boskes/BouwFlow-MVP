import { Suspense, lazy, useMemo, useRef, useState } from 'react'
import { Boxes, CalendarDays, CheckCircle2, Euro, FileCheck2, Filter, Layers3, ScanLine, Upload, X } from 'lucide-react'
import type { BimProgressEvidence, ProjectWorkPackage } from './domain'
import { bimProgressExamples, bimProgressExampleById, type BimProgressElement } from './bim-progress-examples'
import type { IfcViewerElement } from './BimIfcViewer'

const BimIfcViewer = lazy(()=>import('./BimIfcViewer'))
const FamilyHomeBimViewer = lazy(()=>import('./FamilyHomeBimViewer'))

type Props = {
  workPackages:ProjectWorkPackage[]; initialWorkPackageId:string; previousPct:number; preparedBy:string;
  initialEvidence?:BimProgressEvidence;
  onApply:(workPackageId:string, progressPct:number, evidence:BimProgressEvidence)=>void; onClose:()=>void
}

const number = (value:number) => new Intl.NumberFormat('nl-BE',{maximumFractionDigits:2}).format(value)

export default function BimProgressDialog({workPackages,initialWorkPackageId,previousPct,preparedBy,initialEvidence,onApply,onClose}:Props) {
  const fileRef=useRef<HTMLInputElement>(null)
  const initialExample=bimProgressExampleById(initialEvidence?.modelId??bimProgressExamples[0].id)
  const [exampleId,setExampleId]=useState(initialExample.id)
  const [dimension,setDimension]=useState<'3D'|'4D'|'5D'>('3D')
  const [timelineIndex,setTimelineIndex]=useState(0)
  const example=bimProgressExampleById(exampleId)
  const [elements,setElements]=useState<BimProgressElement[]>(initialExample.elements)
  const [selected,setSelected]=useState<Set<string>>(new Set(initialEvidence?.elementIds??initialExample.elements.filter((_,index)=>index<18).map(item=>item.id)))
  const [category,setCategory]=useState('Alle categorieën')
  const [storey,setStorey]=useState('Alle zones')
  const [workPackageId,setWorkPackageId]=useState(initialWorkPackageId)
  const [completionPct,setCompletionPct]=useState(Math.max(previousPct,initialEvidence?.completionPct??55))
  const [measuredBy,setMeasuredBy]=useState(initialEvidence?.measuredBy??preparedBy)
  const [modelVersion,setModelVersion]=useState(initialEvidence?.modelVersion??initialExample.modelVersion)
  const [notes,setNotes]=useState(initialEvidence?.notes??'Hoeveelheden en visuele voortgang gecontroleerd tegen de laatst gepubliceerde CDE-versie.')
  const [validated,setValidated]=useState(initialEvidence?.status==='Gecontroleerd'||!initialEvidence)
  const [ifcFile,setIfcFile]=useState<File>()
  const [ifcElements,setIfcElements]=useState<IfcViewerElement[]>([])
  const [ifcProgress,setIfcProgress]=useState(0)
  const categories=useMemo(()=>[...new Set(elements.map(item=>item.category))].sort(),[elements])
  const storeys=useMemo(()=>[...new Set(elements.map(item=>item.storey))].sort(),[elements])
  const phases=useMemo(()=>[...new Set(elements.map(item=>item.phase))],[elements])
  const activePhase=phases[Math.min(timelineIndex,Math.max(0,phases.length-1))]
  const visible=elements.filter(item=>(category==='Alle categorieën'||item.category===category)&&(storey==='Alle zones'||item.storey===storey))
  const selectedElements=elements.filter(item=>selected.has(item.id))
  const selectedUnits=new Set(selectedElements.map(item=>item.unit))
  const mixedUnits=selectedUnits.size>1
  const quantity=selectedElements.reduce((sum,item)=>sum+item.quantity,0)
  const unit=selectedElements[0]?.unit??'st'
  const verifiedQuantity=quantity*completionPct/100
  const verifiedCount=selectedElements.filter(item=>item.verified).length
  const selectedCost=selectedElements.reduce((sum,item)=>sum+item.costValue,0)
  const modelCost=elements.reduce((sum,item)=>sum+item.costValue,0)
  const timelineState=(item:BimProgressElement)=>{const index=phases.indexOf(item.phase);return index<timelineIndex?'timeline-complete':index===timelineIndex?'timeline-active':'timeline-future'}

  const loadExample=(id:string)=>{
    const next=bimProgressExampleById(id); setExampleId(id); setElements(next.elements); setSelected(new Set(next.elements.filter((_,index)=>index<18).map(item=>item.id)))
    setModelVersion(next.modelVersion); setIfcFile(undefined); setIfcElements([]); setCategory('Alle categorieën'); setStorey('Alle zones'); setTimelineIndex(0); setDimension(next.id==='family-home-bim-3d4d5d'?'3D':'5D')
  }
  const importIfc=(file?:File)=>{ if(!file)return; setIfcFile(file);setIfcProgress(1);setIfcElements([]);setSelected(new Set());setModelVersion(`IFC-import · ${new Date().toLocaleDateString('nl-BE')}`) }
  const apply=()=>{
    if(!selectedElements.length||mixedUnits||!workPackageId||!measuredBy.trim())return
    onApply(workPackageId,completionPct,{
      modelId:ifcFile?`ifc-${ifcFile.name}`:example.id, modelName:ifcFile?.name??example.modelName, modelVersion,
      discipline:example.discipline, elementIds:selectedElements.map(item=>item.id), elementCount:selectedElements.length,
      measuredQuantity:Number(quantity.toFixed(3)), verifiedQuantity:Number(verifiedQuantity.toFixed(3)), unit, completionPct,
      measuredAt:new Date().toISOString(), measuredBy:measuredBy.trim(), status:validated?'Gecontroleerd':'Concept', clashFree:validated, notes,
    })
  }
  return <div className="modal-backdrop bim-progress-backdrop">
    <section className="modal bim-progress-dialog" aria-label="BIM-vordering opmaken">
      <header className="modal-head"><div><p className="eyebrow">3D/4D/5D voortgangsmeting</p><h2>BIM-vordering samenstellen</h2><span>Selecteer in 3D, toets aan de 4D-planning en waardeer rechtstreeks vanuit het 5D-kostenmodel.</span></div><button className="icon-button" aria-label="Sluiten" onClick={onClose}><X size={20}/></button></header>
      <div className="bim-progress-layout">
        <aside className="bim-progress-examples"><div className="bim-progress-title"><Layers3 size={17}/><div><strong>Professionele voorbeelden</strong><small>Klasse 8 en publieke projecten</small></div></div>{bimProgressExamples.map(item=><button key={item.id} className={item.id===exampleId?'active':''} onClick={()=>loadExample(item.id)}><strong>{item.label}</strong><span>{item.projectType}</span><small>{item.elements.length} modelelementen · {item.discipline}</small></button>)}</aside>
        <main className="bim-progress-viewer">
          <div className="bim-progress-toolbar">
            <div className="bim-progress-dimensions">{(['3D','4D','5D'] as const).map(item=><button type="button" key={item} className={dimension===item?'active':''} onClick={()=>setDimension(item)}>{item==='3D'?<Boxes size={13}/>:item==='4D'?<CalendarDays size={13}/>:<Euro size={13}/>}<strong>{item}</strong></button>)}</div>
            <label><Filter size={14}/><select value={category} onChange={event=>setCategory(event.target.value)}><option>Alle categorieën</option>{categories.map(item=><option key={item}>{item}</option>)}</select></label>
            <label><select value={storey} onChange={event=>setStorey(event.target.value)}><option>Alle zones</option>{storeys.map(item=><option key={item}>{item}</option>)}</select></label>
            <button className="secondary" onClick={()=>setSelected(new Set(visible.map(item=>item.id)))}>Selecteer zichtbaar</button><button className="secondary" onClick={()=>setSelected(new Set())}>Wis selectie</button>
          </div>
          {dimension==='4D'&&<div className="bim-progress-timeline"><span>4D-fase <strong>{activePhase}</strong></span><input aria-label="4D-fase BIM-vordering" type="range" min="0" max={Math.max(0,phases.length-1)} step="1" value={timelineIndex} onChange={event=>setTimelineIndex(Number(event.target.value))}/><small>{visible.filter(item=>phases.indexOf(item.phase)<=timelineIndex).length}/{elements.length} elementen gepland · {visible.filter(item=>item.phase===activePhase).length} in actieve fase</small></div>}
          <div className="bim-progress-canvas">
            {ifcFile?<Suspense fallback={<div className="bim-progress-loading">IFC-engine laden…</div>}><BimIfcViewer file={ifcFile} selectedExpressIds={new Set([...selected].map(Number))} onSelectionChange={ids=>setSelected(new Set([...ids].map(String)))} onProgress={setIfcProgress} onError={()=>setIfcProgress(0)} onModelLoaded={report=>{setIfcElements(report.elements);const imported=report.elements.map((item):BimProgressElement=>({id:String(item.expressId),code:`IFC-${item.expressId}`,label:item.name,category:item.category,storey:item.storey,quantity:item.quantity,unit:item.unit,plannedProgressPct:100,completedProgressPct:0,verified:!item.warning,phase:'IFC-import',plannedStart:new Date().toISOString().slice(0,10),plannedEnd:new Date().toISOString().slice(0,10),costValue:item.quantity*125}));setElements(imported);setSelected(new Set(imported.slice(0,Math.min(24,imported.length)).map(item=>item.id)));setIfcProgress(100)}} /></Suspense>:
              visible.some(item=>item.geometry)?<div className={`bim-progress-house-scene mode-${dimension.toLocaleLowerCase()}`}>
                <Suspense fallback={<div className="bim-progress-loading">Woningmodel laden…</div>}><FamilyHomeBimViewer elements={visible} selectedIds={selected} dimension={dimension} elementState={item=>timelineState(item as BimProgressElement)} onToggle={id=>setSelected(current=>{const next=new Set(current);if(next.has(id))next.delete(id);else next.add(id);return next})}/></Suspense>
                {dimension==='5D'&&<div className="bim-progress-5d-overlay"><span>Geselecteerde 5D-waarde<strong>{new Intl.NumberFormat('nl-BE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(selectedCost)}</strong></span><span>Volledig BIM-model<strong>{new Intl.NumberFormat('nl-BE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(modelCost)}</strong></span></div>}
              </div>:
              <div className="bim-progress-grid">{visible.map((item,index)=><button key={item.id} className={`${selected.has(item.id)?'selected':''} ${item.verified?'verified':'review'} ${dimension==='4D'?timelineState(item):''}`} style={{'--bim-index':index} as React.CSSProperties} onClick={()=>setSelected(current=>{const next=new Set(current);if(next.has(item.id))next.delete(item.id);else next.add(item.id);return next})}><span>{item.storey}</span><Boxes size={18}/><strong>{item.code}</strong><small>{item.category}<br/>{number(item.quantity)} {item.unit}</small>{item.verified&&<CheckCircle2 size={13}/>}</button>)}</div>}
            <div className="bim-progress-model-state"><ScanLine size={15}/><strong>{ifcFile?`${ifcProgress}% · ${ifcElements.length||elements.length} IFC-objecten`:example.coordinationStatus}</strong></div>
          </div>
          <div className="bim-progress-description"><strong>{ifcFile?ifcFile.name:example.modelName}</strong><span>{example.description}</span><input ref={fileRef} hidden type="file" accept=".ifc" onChange={event=>importIfc(event.target.files?.[0])}/><button className="secondary" onClick={()=>fileRef.current?.click()}><Upload size={14}/>Eigen IFC-model importeren</button></div>
        </main>
        <aside className="bim-progress-inspector">
          <div className="bim-progress-title"><FileCheck2 size={17}/><div><strong>Meetbewijs</strong><small>Wordt onveranderlijk opgeslagen</small></div></div>
          <div className="bim-progress-kpis"><div><span>Geselecteerd</span><strong>{selectedElements.length}</strong></div><div><span>Gemeten</span><strong>{mixedUnits?'Filter op één eenheid':`${number(quantity)} ${unit}`}</strong></div><div><span>Geverifieerd</span><strong>{verifiedCount}/{selectedElements.length}</strong></div><div><span>Te vorderen</span><strong>{mixedUnits?'—':`${number(verifiedQuantity)} ${unit}`}</strong></div></div>
          <div className="bim-progress-dimensional-proof"><span><Boxes size={14}/><strong>3D</strong><small>{selectedElements.length} objecten geselecteerd</small></span><span><CalendarDays size={14}/><strong>4D</strong><small>{new Set(selectedElements.map(item=>item.phase)).size} uitvoeringsfasen</small></span><span><Euro size={14}/><strong>5D</strong><small>{new Intl.NumberFormat('nl-BE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(selectedCost)}</small></span></div>
          {mixedUnits&&<div className="bim-progress-unit-warning">Selecteer objecten met dezelfde eenheid (m², m³, m of st) voor een controleerbaar meetbewijs.</div>}
          <label>Werkpakket<select value={workPackageId} onChange={event=>setWorkPackageId(event.target.value)}>{workPackages.map(item=><option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label>
          <label>Cumulatieve uitvoering<div className="bim-progress-range"><input type="range" min={previousPct} max="100" step="0.1" value={completionPct} onChange={event=>setCompletionPct(Number(event.target.value))}/><strong>{number(completionPct)}%</strong></div><small>Vorige gecertificeerde stand: {number(previousPct)}%</small></label>
          <label>Modelversie<input required value={modelVersion} onChange={event=>setModelVersion(event.target.value)}/></label>
          <label>Gemeten door<input required value={measuredBy} onChange={event=>setMeasuredBy(event.target.value)} placeholder="Naam BIM-coördinator of landmeter"/></label>
          <label>Controle-opmerking<textarea rows={4} value={notes} onChange={event=>setNotes(event.target.value)}/></label>
          <label className="bim-progress-check"><input type="checkbox" checked={validated} onChange={event=>setValidated(event.target.checked)}/><span><strong>Model en clashes gecontroleerd</strong><small>Bevestigt CDE-versie, selectie en hoeveelheden</small></span></label>
          <button className="primary bim-progress-apply" disabled={!selectedElements.length||mixedUnits||!measuredBy.trim()} onClick={apply}><CheckCircle2 size={16}/>BIM-meting toepassen</button>
        </aside>
      </div>
    </section>
  </div>
}
