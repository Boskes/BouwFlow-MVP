import { describe, expect, it } from 'vitest'
import type { PriceIndexCatalogue, PriceRevisionClause } from './domain.js'
import { calculateContractPriceRevision, validatePriceRevisionClause } from './price-revision.js'

const clause:PriceRevisionClause={
  enabled:true,
  formulaType:'I-2021 en S',
  laborWeightPct:40,
  materialWeightPct:40,
  fixedWeightPct:20,
  laborCategory:'A',
  employerSize:'Meer dan 20',
  baseDate:'2026-01-15',
  baseMaterialPeriod:'2026-01',
  valuationDateRule:'Waarderingsdatum',
  availabilityPolicy:'Voorlopig met correctie',
  applicationBase:'Werken en meerwerken',
  sourceClauseReference:'Bestek art. 12.4',
}

const catalogue:PriceIndexCatalogue={
  material:[
    {series:'I-2021',period:'2026-01',value:100},
    {series:'I-2021',period:'2026-02',value:110},
  ],
  labor:[
    {series:'S',smallEffectiveDate:'2026-01-01',baseEffectiveDate:'2026-01-11',employerSize:'Meer dan 20',category:'A',value:40},
    {series:'S',smallEffectiveDate:'2026-02-01',baseEffectiveDate:'2026-02-11',employerSize:'Meer dan 20',category:'A',value:44},
  ],
  sources:[{id:'fod-i2021',name:'FOD Economie',url:'https://economie.fgov.be',fetchedAt:'2026-03-01T08:00:00.000Z',publishedThrough:'2026-02'}],
  synchronizedAt:'2026-03-01T08:00:00.000Z',
}

describe('contractuele prijsherziening',()=>{
  it('berekent de gewogen S- en I-2021-formule op werken en meerwerken',()=>{
    const result=calculateContractPriceRevision({clause,catalogue,workAmount:800,changeOrderAmount:200,valuationDate:'2026-02-28',calculatedAt:'2026-03-01T09:00:00.000Z'})
    expect(result).toMatchObject({status:'Definitief',baseAmount:1000,factor:1.08,revisedAmount:1080,revisionAmount:80,fixedWeightPct:20,sourceClauseReference:'Bestek art. 12.4'})
    expect(result.labor).toMatchObject({baseValue:40,currentValue:44,category:'A'})
    expect(result.material).toMatchObject({baseValue:100,currentValue:110,basePeriod:'2026-01',currentPeriod:'2026-02'})
  })

  it('markeert de berekening voorlopig wanneer de waarderingsmaand nog niet is gepubliceerd',()=>{
    const result=calculateContractPriceRevision({clause,catalogue,workAmount:1000,changeOrderAmount:0,valuationDate:'2026-03-31'})
    expect(result.status).toBe('Voorlopig')
    expect(result.material.currentPeriod).toBe('2026-02')
    expect(result.warnings[0]).toContain('2026-03')
  })

  it('blokkeert wanneer het contract de exacte waarderingsmaand vereist',()=>{
    expect(()=>calculateContractPriceRevision({clause:{...clause,availabilityPolicy:'Exacte periode vereist'},catalogue,workAmount:1000,changeOrderAmount:0,valuationDate:'2026-03-31'})).toThrow('2026-03')
  })

  it('controleert dat alle contractuele gewichten samen exact 100 procent vormen',()=>{
    expect(()=>validatePriceRevisionClause({...clause,fixedWeightPct:15})).toThrow('100%')
  })
})
