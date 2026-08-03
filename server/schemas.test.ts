import { describe, expect, it } from 'vitest'
import { lidarAnalysisSchema, lidarRegistrationSchema, lidarScanSchema, organizationSchema, priceRevisionClauseSchema, progressStatementSchema } from './schemas'

const organization = {
  name: 'Bouwpartner NV',
  type: 'Privaat' as const,
  contactName: 'Lies Janssens',
  email: 'lies@example.be',
  vatNumber: 'BE0200000043',
  addressLine: 'Hoofdstraat 1',
  postalCode: '1000',
  city: 'Brussel',
  countryCode: 'BE',
  peppolEndpointId: '',
  peppolSchemeId: '0208',
  roles: ['Klant' as const],
  contacts: [],
}

describe('organizationSchema addresses', () => {
  it('keeps legacy organization payloads compatible', () => {
    expect(organizationSchema.parse(organization).addresses).toEqual([])
  })

  it('accepts one primary typed address', () => {
    const result = organizationSchema.safeParse({
      ...organization,
      addresses: [
        { id: '10000000-0000-4000-8000-000000000001', type: 'Bezoekadres', label: 'Kantoor', addressLine: 'Kantoorstraat 2', postalCode: '2000', city: 'Antwerpen', countryCode: 'BE', isPrimary: true, notes: '' },
        { id: '10000000-0000-4000-8000-000000000002', type: 'Facturatieadres', label: 'Boekhouding', addressLine: 'Factuurstraat 3', postalCode: '9000', city: 'Gent', countryCode: 'BE', isPrimary: false, notes: '' },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('rejects several primary addresses', () => {
    const result = organizationSchema.safeParse({
      ...organization,
      addresses: [
        { id: '10000000-0000-4000-8000-000000000001', type: 'Bezoekadres', label: 'Kantoor', addressLine: 'Kantoorstraat 2', postalCode: '2000', city: 'Antwerpen', countryCode: 'BE', isPrimary: true, notes: '' },
        { id: '10000000-0000-4000-8000-000000000002', type: 'Facturatieadres', label: 'Boekhouding', addressLine: 'Factuurstraat 3', postalCode: '9000', city: 'Gent', countryCode: 'BE', isPrimary: true, notes: '' },
      ],
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues.some(issue => issue.path[0] === 'addresses')).toBe(true)
  })
})

describe('progressStatementSchema BIM-certificatie',()=>{
  const workPackageId='10000000-0000-4000-8000-000000000001'
  it('aanvaardt een professioneel BIM-meetbewijs',()=>{
    const result=progressStatementSchema.parse({periodStart:'2026-08-01',periodEnd:'2026-08-31',valuationDate:'2026-08-31',dueDate:'2026-09-30',certificateReference:'CERT-08',preparedBy:'Lena Vermeulen',revisionFormula:'I-2021',advancePaymentAmount:0,advanceRecoveryAmount:12500,otherDeductionsAmount:500,changeOrderIds:[],priceRevisionAmount:8400,retentionPct:5,notes:'Gecontroleerde BIM-vordering.',qualityChecklist:{measurementsVerified:true,evidenceComplete:true,changesApproved:true,bimModelValidated:true},evidenceDocumentIds:[],lines:[{workPackageId,cumulativeProgressPct:47,measurementMethod:'BIM',measuredQuantity:5565.98,unit:'m³',evidenceDocumentIds:[],bimEvidence:{modelId:'tunnel-class8',modelName:'RingTunnel.ifc',modelVersion:'AFC-34',discipline:'Infrastructuur',elementIds:['SEG-001','SEG-002'],elementCount:2,measuredQuantity:11842.5,verifiedQuantity:5565.98,unit:'m³',completionPct:47,measuredAt:'2026-08-31T07:45:00.000Z',measuredBy:'Lena Vermeulen',status:'Gecontroleerd',clashFree:true,notes:'Landmeting gevalideerd.'}}]})
    expect(result.lines[0].bimEvidence?.status).toBe('Gecontroleerd')
  })

  it('weigert een betaaldatum vóór de waarderingsdatum',()=>{
    const result=progressStatementSchema.safeParse({periodStart:'2026-08-01',periodEnd:'2026-08-31',valuationDate:'2026-08-31',dueDate:'2026-08-15',changeOrderIds:[],priceRevisionAmount:0,retentionPct:5,notes:'',lines:[{workPackageId,cumulativeProgressPct:10}]})
    expect(result.success).toBe(false)
  })
})

describe('priceRevisionClauseSchema',()=>{
  const valid={enabled:true,formulaType:'I-2021 en S',laborWeightPct:40,materialWeightPct:40,fixedWeightPct:20,laborCategory:'A',employerSize:'Meer dan 20',baseDate:'2026-01-15',baseMaterialPeriod:'2026-01',valuationDateRule:'Waarderingsdatum',availabilityPolicy:'Voorlopig met correctie',applicationBase:'Werken en meerwerken',sourceClauseReference:'Bestek art. 12.4'}

  it('aanvaardt een volledige contractuele formule',()=>{
    expect(priceRevisionClauseSchema.safeParse(valid).success).toBe(true)
  })

  it('weigert gewichten die niet samen 100 procent vormen',()=>{
    expect(priceRevisionClauseSchema.safeParse({...valid,fixedWeightPct:15}).success).toBe(false)
  })
})

describe('LiDAR API-contract',()=>{
  const workPackageId='10000000-0000-4000-8000-000000000001'
  const point=(id:string)=>({id,label:`Punt ${id}`,bim:{x:10,y:5,z:0},scan:{x:0,y:0,z:0},verified:true})
  const observation={id:'wall-1',ifcGuid:'2A4x_GUID',label:'Dragende wand',category:'Wanden',workPackageId,plannedQuantity:42,observedQuantity:31.5,unit:'m\u00b2',measurementRule:'Oppervlakte',surfaceCoveragePct:75,visibilityPct:92,confidencePct:94,deviationMm:12,photoEvidenceCount:2,detected:true}

  it('aanvaardt een native iPhone scansessie en IFC-observaties',()=>{
    const scan=lidarScanSchema.parse({modelId:'ifc-woning',modelName:'Woning.ifc',modelVersion:'AFC-01',zone:'Gelijkvloers',storey:'00',deviceName:'iPhone Pro',deviceSupportsLidar:true,captureMode:'Gecombineerd',capturedBy:'Werfleider',capturedAt:'2026-08-03T08:00:00.000Z',notes:'Werfscan',controlPoints:[point('a'),point('b'),point('c')],observations:[observation]})
    expect(scan.observations[0].unit).toBe('m\u00b2')
    expect(lidarAnalysisSchema.safeParse({observations:[observation]}).success).toBe(true)
  })

  it('vereist minstens drie controlepunten voor registratie',()=>{
    expect(lidarRegistrationSchema.safeParse({registeredBy:'BIM-coÃ¶rdinator',controlPoints:[point('a'),point('b')]}).success).toBe(false)
  })
})
