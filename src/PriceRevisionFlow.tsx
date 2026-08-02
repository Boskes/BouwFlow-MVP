import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Calculator, CheckCircle2, ExternalLink, RefreshCw, Scale, X } from 'lucide-react'
import type { PriceIndexCatalogue, PriceRevisionCalculation, PriceRevisionClause, ProjectContract, ProjectContractUpdateInput } from './domain'
import { calculateContractPriceRevision, defaultPriceRevisionClause, priceRevisionClauseSummary, validatePriceRevisionClause } from './price-revision'

const money=(value:number)=>new Intl.NumberFormat('nl-BE',{style:'currency',currency:'EUR'}).format(value)
const number=(value:number)=>new Intl.NumberFormat('nl-BE',{maximumFractionDigits:4}).format(value)
const displayMonth=(period:string)=>new Date(`${period}-01T00:00:00`).toLocaleDateString('nl-BE',{month:'long',year:'numeric'})

type CatalogueLoader=(refresh?:boolean)=>Promise<PriceIndexCatalogue|undefined>

export function ContractPriceRevisionPanel({contract,onLoad,onSave}:{contract:ProjectContract;onLoad:CatalogueLoader;onSave:(input:ProjectContractUpdateInput)=>Promise<void>}){
  const [editing,setEditing]=useState(false)
  const clause=contract.priceRevisionClause
  return <>
    <section className="panel contract-price-revision-panel">
      <div className="price-revision-panel-head"><div><p className="eyebrow">Contractuele prijsherziening</p><h2>{clause?.enabled?'Automatisch op basis van I-2021 en S':'Nog niet contractueel geconfigureerd'}</h2></div><button type="button" className="primary" onClick={()=>setEditing(true)}><Scale size={15}/>{clause?'Clausule beheren':'Clausule instellen'}</button></div>
      {clause?<div className="price-revision-contract-grid"><span><small>Formule</small><strong>{priceRevisionClauseSummary(clause)}</strong></span><span><small>Gewichten</small><strong>{clause.laborWeightPct}% loon · {clause.materialWeightPct}% materiaal · {clause.fixedWeightPct}% vast</strong></span><span><small>Basis</small><strong>{clause.baseDate} · I-2021 {clause.baseMaterialPeriod}</strong></span><span><small>Publicatiebeleid</small><strong>{clause.availabilityPolicy}</strong></span><span><small>Toepassingsbasis</small><strong>{clause.applicationBase}</strong></span><span><small>Contractstatus</small><strong>{contract.approvalStatus}</strong></span></div>:<p className="panel-footnote">Leg formule, gewichten, categorie, werkgeversgrootte, basisperiode en de omgang met vertraagde indexpublicaties vast. Daarna moet de gewijzigde contractversie opnieuw worden goedgekeurd.</p>}
    </section>
    {editing&&<PriceRevisionClauseDialog contract={contract} onLoad={onLoad} onSave={async input=>{await onSave(input);setEditing(false)}} onClose={()=>setEditing(false)}/>}
  </>
}

function PriceRevisionClauseDialog({contract,onLoad,onSave,onClose}:{contract:ProjectContract;onLoad:CatalogueLoader;onSave:(input:ProjectContractUpdateInput)=>Promise<void>;onClose:()=>void}){
  const [clause,setClause]=useState<PriceRevisionClause>(()=>contract.priceRevisionClause??defaultPriceRevisionClause(contract.signedOn))
  const [catalogue,setCatalogue]=useState<PriceIndexCatalogue>()
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [saving,setSaving]=useState(false)
  const load=async(refresh=false)=>{setLoading(true);setError('');try{const result=await onLoad(refresh);if(!result)throw new Error('Geen indexcatalogus ontvangen');setCatalogue(result);if(!contract.priceRevisionClause){const base=[...result.material].filter(item=>item.period<=clause.baseDate.slice(0,7)).at(-1);if(base)setClause(current=>({...current,baseMaterialPeriod:base.period}))}}catch(reason){setError(reason instanceof Error?reason.message:'Indexen konden niet worden opgehaald')}finally{setLoading(false)}}
  // The initial catalogue load deliberately uses the clause snapshot from when the dialog opens.
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  useEffect(()=>{void load()},[])
  const weightTotal=clause.laborWeightPct+clause.materialWeightPct+clause.fixedWeightPct
  const baseMaterial=catalogue?.material.find(item=>item.period===clause.baseMaterialPeriod)
  const baseLabor=[...(catalogue?.labor??[])].filter(item=>item.category===clause.laborCategory&&item.employerSize===clause.employerSize&&item.baseEffectiveDate<=clause.baseDate).sort((a,b)=>b.baseEffectiveDate.localeCompare(a.baseEffectiveDate))[0]
  const valid=Math.abs(weightTotal-100)<.001&&Boolean(baseMaterial&&baseLabor&&clause.sourceClauseReference.trim().length>1)
  return <div className="modal-backdrop price-revision-dialog-backdrop"><form className="modal price-revision-dialog" onSubmit={async event=>{event.preventDefault();try{validatePriceRevisionClause(clause);setSaving(true);await onSave({priceRevisionClause:clause,priceRevision:priceRevisionClauseSummary(clause)})}catch(reason){setError(reason instanceof Error?reason.message:'Clausule kon niet worden opgeslagen')}finally{setSaving(false)}}}>
    <div className="modal-head"><div><p className="eyebrow">Contractclausule</p><h2>Prijsherzieningsformule configureren</h2></div><button type="button" className="icon-button" aria-label="Sluiten" onClick={onClose}><X size={20}/></button></div>
    <div className="price-revision-dialog-content">
      <div className="official-index-banner"><CheckCircle2 size={18}/><div><strong>Officiële Belgische bouwindexen</strong><span>I-2021 en S/s worden rechtstreeks opgehaald bij FOD Economie. Iedere vordering bewaart de gebruikte waarden en bronnen.</span></div><button type="button" className="secondary" disabled={loading} onClick={()=>void load(true)}><RefreshCw size={14}/>{loading?'Ophalen…':'Indexen vernieuwen'}</button></div>
      {error&&<div className="price-revision-error"><AlertTriangle size={16}/>{error}</div>}
      <section className="price-revision-form-grid">
        <label className="price-revision-toggle"><input type="checkbox" checked={clause.enabled} onChange={event=>setClause({...clause,enabled:event.target.checked})}/><span><strong>Prijsherziening actief</strong><small>Automatisch toepassen op nieuwe vorderingsstaten</small></span></label>
        <label>Formuletype<select value={clause.formulaType} disabled><option>I-2021 en S</option></select></label>
        <label>Loongewicht x1 (%)<input type="number" min="0" max="100" step="0.01" value={clause.laborWeightPct} onChange={event=>setClause({...clause,laborWeightPct:Number(event.target.value)})}/></label>
        <label>Materiaalgewicht x2 (%)<input type="number" min="0" max="100" step="0.01" value={clause.materialWeightPct} onChange={event=>setClause({...clause,materialWeightPct:Number(event.target.value)})}/></label>
        <label>Vast deel (%)<input type="number" min="0" max="100" step="0.01" value={clause.fixedWeightPct} onChange={event=>setClause({...clause,fixedWeightPct:Number(event.target.value)})}/><small className={Math.abs(weightTotal-100)<.001?'valid-weight':'invalid-weight'}>Totaal {number(weightTotal)}%</small></label>
        <label>Looncategorie<select value={clause.laborCategory} onChange={event=>setClause({...clause,laborCategory:event.target.value as PriceRevisionClause['laborCategory']})}><option value="A">A · maritiem, grond-, wegen- en betonwerken</option><option value="B">B · dakbedekking en voegwerken</option><option value="C">C · vloer-, plafond- en pleisterwerken</option><option value="D">D · andere werken</option></select></label>
        <label>Werkgeversgrootte<select value={clause.employerSize} onChange={event=>setClause({...clause,employerSize:event.target.value as PriceRevisionClause['employerSize']})}>{['Minder dan 10','10 tot 20','Meer dan 20'].map(value=><option key={value}>{value}</option>)}</select></label>
        <label>Contractuele basisdatum<input type="date" value={clause.baseDate} onChange={event=>setClause({...clause,baseDate:event.target.value})}/></label>
        <label>Basisperiode I-2021<select value={clause.baseMaterialPeriod} onChange={event=>setClause({...clause,baseMaterialPeriod:event.target.value})}>{(catalogue?.material??[]).filter(item=>item.period<=clause.baseDate.slice(0,7)).map(item=><option key={item.period} value={item.period}>{displayMonth(item.period)} · {number(item.value)}</option>)}</select></label>
        <label>Indexdatum vordering<select value={clause.valuationDateRule} onChange={event=>setClause({...clause,valuationDateRule:event.target.value as PriceRevisionClause['valuationDateRule']})}><option>Waarderingsdatum</option><option>Einde vorderingsperiode</option></select></label>
        <label>Als de maandindex nog ontbreekt<select value={clause.availabilityPolicy} onChange={event=>setClause({...clause,availabilityPolicy:event.target.value as PriceRevisionClause['availabilityPolicy']})}><option>Voorlopig met correctie</option><option>Laatste officiële index</option><option>Exacte periode vereist</option></select></label>
        <label>Herzienbare basis<select value={clause.applicationBase} onChange={event=>setClause({...clause,applicationBase:event.target.value as PriceRevisionClause['applicationBase']})}><option>Werken</option><option>Werken en meerwerken</option></select></label>
        <label className="wide">Referentie in bestek of contract<input required value={clause.sourceClauseReference} onChange={event=>setClause({...clause,sourceClauseReference:event.target.value})} placeholder="bv. Bijzonder bestek, art. 14.2"/></label>
      </section>
      <section className="price-revision-preview"><div><span>Contractformule</span><strong>{priceRevisionClauseSummary(clause)}</strong></div><div><span>Basis S</span><strong>{baseLabor?`${number(baseLabor.value)} · vanaf ${baseLabor.baseEffectiveDate}`:'Niet gevonden'}</strong></div><div><span>Basis I-2021</span><strong>{baseMaterial?number(baseMaterial.value):'Niet gevonden'}</strong></div></section>
      <div className="price-revision-guidance"><AlertTriangle size={17}/><span>Opslaan maakt een nieuwe contractversie in status Concept. Laat de clausule opnieuw goedkeuren voordat de volgende vorderingsstaat wordt opgesteld.</span></div>
    </div>
    <div className="modal-actions"><span className="modal-note">Bronnen: FOD Economie · Mercuriale I-2021 en waarden S/s.</span><button type="button" className="secondary" onClick={onClose}>Annuleren</button><button className="primary" disabled={!valid||saving}>{saving?'Opslaan…':'Clausule opslaan'}</button></div>
  </form></div>
}

export function ProgressPriceRevisionPanel({contract,workAmount,changeOrderAmount,valuationDate,periodEnd,current,onLoad,onCalculation,onBlocked}:{contract?:ProjectContract;workAmount:number;changeOrderAmount:number;valuationDate:string;periodEnd:string;current?:PriceRevisionCalculation;onLoad:CatalogueLoader;onCalculation:(calculation:PriceRevisionCalculation)=>void;onBlocked:(blocked:boolean)=>void}){
  const clause=contract?.priceRevisionClause
  const [catalogue,setCatalogue]=useState<PriceIndexCatalogue>()
  const [loading,setLoading]=useState(Boolean(clause?.enabled))
  const [error,setError]=useState('')
  const load=async(refresh=false)=>{if(!clause)return;setLoading(true);setError('');try{const result=await onLoad(refresh);if(!result)throw new Error('Geen indexcatalogus ontvangen');setCatalogue(result)}catch(reason){setError(reason instanceof Error?reason.message:'Officiële indexen konden niet worden opgehaald')}finally{setLoading(false)}}
  // Reload only when the active contract changes; field edits are calculated from the loaded snapshot.
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  useEffect(()=>{if(clause)void load()},[contract?.id])
  const effectiveValuationDate=clause?.valuationDateRule==='Einde vorderingsperiode'?periodEnd:valuationDate
  const result=useMemo(()=>{if(!clause||!catalogue)return undefined;try{return calculateContractPriceRevision({clause,catalogue,workAmount,changeOrderAmount,valuationDate:effectiveValuationDate,calculatedAt:catalogue.synchronizedAt})}catch(reason){return reason instanceof Error?reason:new Error('Prijsherziening kon niet worden berekend')}},[clause,catalogue,workAmount,changeOrderAmount,effectiveValuationDate])
  // Parent callbacks are intentionally excluded to avoid recalculating after the callback updates the form.
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  useEffect(()=>{const blocked=Boolean(clause&&(loading||error||result instanceof Error||contract?.approvalStatus!=='Goedgekeurd'));onBlocked(blocked);if(result&&!(result instanceof Error)&&JSON.stringify(result)!==JSON.stringify(current))onCalculation(result)},[result,loading,error,contract?.approvalStatus])
  if(!clause)return <section className="statement-price-revision manual"><div><Calculator size={18}/><span><strong>Handmatige prijsherziening</strong><small>Er is geen gestructureerde clausule in het actieve contract. Configureer deze in Contract &amp; Oplevering.</small></span></div></section>
  const calculation=result instanceof Error?undefined:result
  return <section className="statement-price-revision"><div className="statement-price-revision-head"><div><p className="eyebrow">Automatische contractberekening</p><h3>Prijsherziening</h3></div><button type="button" className="secondary" disabled={loading} onClick={()=>void load(true)}><RefreshCw size={14}/>{loading?'Indexen ophalen…':'Officiële indexen vernieuwen'}</button></div>
    {contract?.approvalStatus!=='Goedgekeurd'&&<div className="price-revision-error"><AlertTriangle size={16}/>De prijsherzieningsclausule moet opnieuw contractueel worden goedgekeurd.</div>}
    {(error||result instanceof Error)&&<div className="price-revision-error"><AlertTriangle size={16}/>{error||(result as Error).message}</div>}
    {calculation&&<><div className="statement-price-revision-grid"><span><small>Herzienbare basis P</small><strong>{money(calculation.baseAmount)}</strong></span><span><small>Loon s/S · {calculation.labor.weightPct}%</small><strong>{number(calculation.labor.currentValue)} / {number(calculation.labor.baseValue)}</strong></span><span><small>Materiaal i/I · {calculation.material.weightPct}%</small><strong>{number(calculation.material.currentValue)} / {number(calculation.material.baseValue)}</strong></span><span><small>Herzieningsfactor</small><strong>{number(calculation.factor)}</strong></span><span><small>Prijsherziening</small><strong>{money(calculation.revisionAmount)}</strong></span><span><small>Status</small><strong className={calculation.status==='Voorlopig'?'provisional':'final'}>{calculation.status}</strong></span></div>{calculation.warnings.map(warning=><div className="price-revision-warning" key={warning}><AlertTriangle size={15}/>{warning}</div>)}<div className="price-revision-source-links">{calculation.sources.map(source=><a key={source.id} href={source.url} target="_blank" rel="noreferrer"><ExternalLink size={13}/>{source.name} · t/m {source.publishedThrough}</a>)}</div></>}
  </section>
}
