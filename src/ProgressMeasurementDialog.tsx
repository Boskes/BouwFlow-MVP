import { useMemo, useState } from 'react'
import { CheckCircle2, ClipboardList, FileCheck2, Search, X } from 'lucide-react'
import { buildDailyReportEvidence, buildMeetstaatEvidence, approvedDailyProduction, quantityProgress, workPackageBoqItems } from './progress-measurements'
import type { Calculation, DailyReport, ProgressMeasurementMethod, ProgressStatementLineInput, Project, ProjectWorkPackage, QuantityProgressMeasurement } from './domain'

const formatNumber = (value:number) => new Intl.NumberFormat('nl-BE',{maximumFractionDigits:2}).format(value)

export default function ProgressMeasurementDialog({ calculation, project, workPackage, method, dailyReports, periodEnd, actor, line, previousPct, onApply, onClose }:{
  calculation?:Calculation; project:Project; workPackage:ProjectWorkPackage; method:Extract<ProgressMeasurementMethod,'Meetstaat'|'Dagrapporten'>; dailyReports:DailyReport[]; periodEnd:string; actor:string; line:ProgressStatementLineInput;
  previousPct:number;
  onApply:(patch:Partial<ProgressStatementLineInput>)=>void; onClose:()=>void;
}) {
  const linkedItems=useMemo(()=>workPackageBoqItems(calculation,workPackage),[calculation,workPackage])
  const initial=new Map(line.meetstaatEvidence?.measurements.map(item=>[item.boqItemId,item.cumulativeQuantity])??[])
  const [measurements,setMeasurements]=useState<QuantityProgressMeasurement[]>(()=>linkedItems.map(item=>({boqItemId:item.id,cumulativeQuantity:initial.get(item.id)??0})))
  const [query,setQuery]=useState('')
  const [page,setPage]=useState(0)
  const progress=quantityProgress(calculation,workPackage,measurements)
  const approved=approvedDailyProduction(dailyReports,project.id,workPackage.id,periodEnd)
  const dailyEvidence=calculation?buildDailyReportEvidence(calculation,project,workPackage,dailyReports,periodEnd):undefined
  const dailyProgress=quantityProgress(calculation,workPackage,approved.entries.reduce<QuantityProgressMeasurement[]>((result,entry)=>{const current=result.find(item=>item.boqItemId===entry.boqItemId);if(current)current.cumulativeQuantity+=entry.quantity;else result.push({boqItemId:entry.boqItemId,cumulativeQuantity:entry.quantity});return result},[]))
  const filtered=progress.items.filter(({item})=>`${item.code} ${item.description}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
  const pageSize=100
  const visible=filtered.slice(page*pageSize,(page+1)*pageSize)
  const completion=method==='Meetstaat'?progress.completionPct:dailyProgress.completionPct
  const belowPrevious=completion+0.0001<previousPct
  const canApply=Boolean(calculation&&linkedItems.length&&(method==='Meetstaat'||approved.entries.length)&&!belowPrevious)
  return <div className="modal-backdrop measurement-dialog-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}>
    <div className="modal measurement-dialog">
      <div className="modal-head"><div><p className="eyebrow">Automatische voortgang · {workPackage.code}</p><h2>{method==='Meetstaat'?'Meetstaat koppelen':'Goedgekeurde dagrapporten ophalen'}</h2></div><button type="button" className="icon-button" aria-label="Sluiten" onClick={onClose}><X size={20}/></button></div>
      {!calculation?<div className="measurement-empty"><strong>Geen broncalculatie beschikbaar</strong><span>Koppel eerst een calculatie aan dit project.</span></div>:!linkedItems.length?<div className="measurement-empty"><strong>Geen gekoppelde calculatieposten</strong><span>De hoofdstukcode moet overeenkomen met werkpakket {workPackage.code}.</span></div>:<>
        <section className="measurement-summary"><div><span>Bron</span><strong>{calculation.number}</strong></div><div><span>Calculatieposten</span><strong>{linkedItems.length}</strong></div><div><span>{method==='Meetstaat'?'Gewogen voortgang':'Ondertekende rapporten'}</span><strong>{method==='Meetstaat'?`${formatNumber(completion)}%`:approved.reports.length}</strong></div><div><span>{method==='Meetstaat'?'Meetdatum':'Productieregels'}</span><strong>{method==='Meetstaat'?new Date().toLocaleDateString('nl-BE'):approved.entries.length}</strong></div></section>
        {belowPrevious&&<div className="measurement-callout measurement-callout-warning"><div><strong>De nieuwe stand is lager dan de vorige vordering ({formatNumber(previousPct)}%)</strong><span>Vul de volledige cumulatieve meetstaat aan. Een gecertificeerde voortgang kan niet worden verlaagd.</span></div></div>}
        {method==='Meetstaat'?<div className="measurement-content">
          <div className="measurement-toolbar"><label><Search size={15}/><input value={query} onChange={event=>{setQuery(event.target.value);setPage(0)}} placeholder="Zoek code of omschrijving"/></label><span>Hoeveelheden zijn cumulatief tot {new Date(periodEnd).toLocaleDateString('nl-BE')}.</span></div>
          <div className="table-wrap"><table><thead><tr><th>Post</th><th>Contracthoeveelheid</th><th>Cumulatief gemeten</th><th>Stand</th></tr></thead><tbody>{visible.map(({item,contractQuantity,measuredQuantity,ratio})=><tr key={item.id}><td><strong>{item.code}</strong><span>{item.description}</span></td><td>{formatNumber(contractQuantity)} {item.unit}</td><td><input aria-label={`Gemeten hoeveelheid ${item.code}`} type="number" min="0" step="0.01" value={measuredQuantity} onChange={event=>setMeasurements(current=>current.map(entry=>entry.boqItemId===item.id?{...entry,cumulativeQuantity:Number(event.target.value)}:entry))}/><span>{item.unit}</span></td><td><strong>{formatNumber(ratio*100)}%</strong></td></tr>)}</tbody></table></div>
          {filtered.length>pageSize&&<div className="measurement-pagination"><button type="button" disabled={!page} onClick={()=>setPage(value=>value-1)}>Vorige</button><span>{page+1} / {Math.ceil(filtered.length/pageSize)}</span><button type="button" disabled={(page+1)*pageSize>=filtered.length} onClick={()=>setPage(value=>value+1)}>Volgende</button></div>}
        </div>:<div className="measurement-content daily-evidence-content">
          <div className="measurement-callout"><CheckCircle2 size={18}/><div><strong>Alleen ondertekende rapporten tellen mee</strong><span>Concepten en ingediende rapporten worden automatisch uitgesloten. De stand is cumulatief tot {new Date(periodEnd).toLocaleDateString('nl-BE')}.</span></div></div>
          {approved.reports.length?<div className="daily-evidence-list">{approved.reports.map(report=><article key={report.id}><FileCheck2 size={17}/><div><strong>{new Date(report.date).toLocaleDateString('nl-BE')} · {report.activities||'Dagrapport'}</strong><span>Ondertekend door {report.signedBy} · {(report.productionEntries??[]).filter(entry=>entry.workPackageId===workPackage.id).length} productieregels</span></div><b>{(report.productionEntries??[]).filter(entry=>entry.workPackageId===workPackage.id).reduce((sum,entry)=>sum+entry.quantity,0).toLocaleString('nl-BE')} eenheden</b></article>)}</div>:<div className="measurement-empty"><strong>Geen goedgekeurde productie gevonden</strong><span>Voeg productiehoeveelheden toe aan een dagrapport en laat het rapport ondertekenen.</span></div>}
        </div>}
      </>}
      <div className="modal-actions"><span className="modal-note">BouwFlow herberekent deze koppeling opnieuw op de server.</span><button type="button" className="secondary" onClick={onClose}>Annuleren</button><button type="button" className="primary" disabled={!canApply} onClick={()=>{if(!calculation)return;if(method==='Meetstaat'){const evidence=buildMeetstaatEvidence(calculation,workPackage,measurements,actor||'Projectteam');onApply({measurementMethod:'Meetstaat',cumulativeProgressPct:evidence.completionPct,meetstaatEvidence:evidence,dailyReportEvidence:undefined,bimEvidence:undefined,comment:`${evidence.itemCount} calculatieposten automatisch gewogen`})}else if(dailyEvidence){onApply({measurementMethod:'Dagrapporten',cumulativeProgressPct:dailyEvidence.completionPct,dailyReportEvidence:dailyEvidence,meetstaatEvidence:undefined,bimEvidence:undefined,comment:`${dailyEvidence.reportCount} ondertekende dagrapporten · ${dailyEvidence.productionEntryCount} productieregels`})}}}><ClipboardList size={15}/>{method==='Meetstaat'?'Meetstaat toepassen':'Dagrapporten toepassen'}</button></div>
    </div>
  </div>
}
