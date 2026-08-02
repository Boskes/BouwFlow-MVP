import type { LaborPriceIndexValue, MaterialPriceIndexValue, PriceIndexCatalogue, PriceRevisionCalculation, PriceRevisionClause } from './domain.js'

const cents = (value:number) => Math.round((value + Number.EPSILON) * 100) / 100
const fourDecimals = (value:number) => Math.round((value + Number.EPSILON) * 10_000) / 10_000
const monthOf = (date:string) => date.slice(0,7)

export const defaultPriceRevisionClause = (baseDate:string):PriceRevisionClause => ({
  enabled:true,
  formulaType:'I-2021 en S',
  laborWeightPct:40,
  materialWeightPct:40,
  fixedWeightPct:20,
  laborCategory:'A',
  employerSize:'Meer dan 20',
  baseDate,
  baseMaterialPeriod:monthOf(baseDate),
  valuationDateRule:'Waarderingsdatum',
  availabilityPolicy:'Voorlopig met correctie',
  applicationBase:'Werken en meerwerken',
  sourceClauseReference:'Bijzonder bestek · prijsherzieningsclausule',
})

export function priceRevisionClauseSummary(clause:PriceRevisionClause) {
  if (!clause.enabled) return 'Vaste prijs · geen prijsherziening'
  return `p = P × [${clause.laborWeightPct/100} × (s/S) + ${clause.materialWeightPct/100} × (i-2021/I-2021) + ${clause.fixedWeightPct/100}]`
}

export function validatePriceRevisionClause(clause:PriceRevisionClause) {
  const weights=clause.laborWeightPct+clause.materialWeightPct+clause.fixedWeightPct
  if (Math.abs(weights-100)>.001) throw new Error('De gewichten van de prijsherzieningsformule moeten samen 100% zijn')
  if ([clause.laborWeightPct,clause.materialWeightPct,clause.fixedWeightPct].some(value=>value<0||value>100)) throw new Error('Ieder formulegewicht moet tussen 0% en 100% liggen')
  if (!/^\d{4}-\d{2}$/.test(clause.baseMaterialPeriod)) throw new Error('De basisperiode van I-2021 is ongeldig')
}

const findMaterial = (values:MaterialPriceIndexValue[], period:string) => values.find(item=>item.period===period)
const latestMaterial = (values:MaterialPriceIndexValue[], throughPeriod:string) => [...values].filter(item=>item.period<=throughPeriod).sort((a,b)=>b.period.localeCompare(a.period))[0]
const latestLabor = (values:LaborPriceIndexValue[], throughDate:string, clause:PriceRevisionClause, mode:'base'|'current') => [...values]
  .filter(item=>item.employerSize===clause.employerSize&&item.category===clause.laborCategory&&(mode==='base'?item.baseEffectiveDate:item.smallEffectiveDate)<=throughDate)
  .sort((a,b)=>(mode==='base'?b.baseEffectiveDate.localeCompare(a.baseEffectiveDate):b.smallEffectiveDate.localeCompare(a.smallEffectiveDate)))[0]

export function calculateContractPriceRevision(input:{clause:PriceRevisionClause;catalogue:PriceIndexCatalogue;workAmount:number;changeOrderAmount:number;valuationDate:string;calculatedAt?:string}):PriceRevisionCalculation {
  const {clause,catalogue}=input
  validatePriceRevisionClause(clause)
  const baseAmount=cents(input.workAmount+(clause.applicationBase==='Werken en meerwerken'?input.changeOrderAmount:0))
  if (!clause.enabled) return {
    status:'Niet van toepassing',formula:'Vaste prijs',sourceClauseReference:clause.sourceClauseReference,valuationDate:input.valuationDate,baseAmount,factor:1,revisedAmount:baseAmount,revisionAmount:0,
    labor:{weightPct:0,baseValue:1,currentValue:1,baseDate:clause.baseDate,currentDate:input.valuationDate,category:clause.laborCategory,employerSize:clause.employerSize},
    material:{weightPct:0,baseValue:1,currentValue:1,basePeriod:clause.baseMaterialPeriod,currentPeriod:monthOf(input.valuationDate)},fixedWeightPct:100,applicationBase:clause.applicationBase,
    calculatedAt:input.calculatedAt??new Date().toISOString(),synchronizedAt:catalogue.synchronizedAt,sources:catalogue.sources,warnings:[],
  }
  const baseMaterial=findMaterial(catalogue.material,clause.baseMaterialPeriod)
  if (!baseMaterial) throw new Error(`Officiële I-2021-index voor basisperiode ${clause.baseMaterialPeriod} ontbreekt`)
  const requestedPeriod=monthOf(input.valuationDate)
  const currentMaterial=clause.availabilityPolicy==='Exacte periode vereist'?findMaterial(catalogue.material,requestedPeriod):latestMaterial(catalogue.material,requestedPeriod)
  if (!currentMaterial) throw new Error(`Officiële I-2021-index voor waarderingsperiode ${requestedPeriod} ontbreekt`)
  const baseLabor=latestLabor(catalogue.labor,clause.baseDate,clause,'base')
  if (!baseLabor) throw new Error(`Officiële S-index voor basisdatum ${clause.baseDate} ontbreekt`)
  const currentLabor=latestLabor(catalogue.labor,input.valuationDate,clause,'current')
  if (!currentLabor) throw new Error(`Officiële s-index voor waarderingsdatum ${input.valuationDate} ontbreekt`)
  const warnings:string[]=[]
  const materialIsLagged=currentMaterial.period!==requestedPeriod
  if (materialIsLagged) warnings.push(`I-2021 ${requestedPeriod} is nog niet gepubliceerd; ${currentMaterial.period} werd toegepast.`)
  const status=materialIsLagged&&clause.availabilityPolicy==='Voorlopig met correctie'?'Voorlopig':'Definitief'
  const laborRatio=currentLabor.value/baseLabor.value
  const materialRatio=currentMaterial.value/baseMaterial.value
  const factor=fourDecimals((clause.laborWeightPct/100)*laborRatio+(clause.materialWeightPct/100)*materialRatio+clause.fixedWeightPct/100)
  const revisedAmount=cents(baseAmount*factor)
  return {
    status,
    formula:priceRevisionClauseSummary(clause),sourceClauseReference:clause.sourceClauseReference,valuationDate:input.valuationDate,baseAmount,factor,revisedAmount,revisionAmount:cents(revisedAmount-baseAmount),
    labor:{weightPct:clause.laborWeightPct,baseValue:baseLabor.value,currentValue:currentLabor.value,baseDate:baseLabor.baseEffectiveDate,currentDate:currentLabor.smallEffectiveDate,category:clause.laborCategory,employerSize:clause.employerSize},
    material:{weightPct:clause.materialWeightPct,baseValue:baseMaterial.value,currentValue:currentMaterial.value,basePeriod:baseMaterial.period,currentPeriod:currentMaterial.period},fixedWeightPct:clause.fixedWeightPct,applicationBase:clause.applicationBase,
    calculatedAt:input.calculatedAt??new Date().toISOString(),synchronizedAt:catalogue.synchronizedAt,sources:catalogue.sources,warnings,
  }
}

export const demoPriceIndexCatalogue:PriceIndexCatalogue={
  material:[
    ['2025-12',146.44],['2026-01',150.26],['2026-02',151.36],['2026-03',149.64],['2026-04',151.93],['2026-05',153.73],['2026-06',153.3],
  ].map(([period,value])=>({series:'I-2021' as const,period:String(period),value:Number(value)})),
  labor:['Minder dan 10','10 tot 20','Meer dan 20'].flatMap((employerSize,index)=>{
    const matrix=[[38.427,38.396,37.538,37.041],[39.545,39.514,38.656,38.159],[39.539,39.508,38.65,38.153]][index]
    return (['A','B','C','D'] as const).map((category,categoryIndex)=>({series:'S' as const,smallEffectiveDate:'2026-04-01',baseEffectiveDate:'2026-04-11',employerSize:employerSize as LaborPriceIndexValue['employerSize'],category,value:matrix[categoryIndex]}))
  }),
  sources:[
    {id:'fod-i2021',name:'FOD Economie · Index I-2021 en I+',url:'https://economie.fgov.be/sites/default/files/Files/Entreprises/prix-construction-Indice-I-2021.xlsx',fetchedAt:'2026-07-31T12:00:00.000Z',publishedThrough:'2026-06'},
    {id:'fod-s',name:'FOD Economie · Waarden S en s',url:'https://economie.fgov.be/sites/default/files/Files/Entreprises/prijzen-bouw-waarden-S-s.pdf',fetchedAt:'2026-07-31T12:00:00.000Z',publishedThrough:'2026-04-01'},
  ],
  synchronizedAt:'2026-07-31T12:00:00.000Z',
}
