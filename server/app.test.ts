import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { newDb } from 'pg-mem'
import type { Pool } from 'pg'
import type { FastifyInstance } from 'fastify'
import { buildApp } from './app.js'
import { DEVELOPMENT_TENANT_ID, DEVELOPMENT_USER_ID } from './context.js'
import { migrate } from './db/migration.js'
import { BouwFlowRepository } from './db/repository.js'
import { DEVELOPMENT_LEGAL_ENTITY_ID, DEVELOPMENT_PROJECT_MANAGER_ID, DEVELOPMENT_SERVICE_ENTITY_ID, seedDevelopmentData } from './db/seed.js'
import { MemoryObjectStorage } from './storage.js'

const organizationId = '10000000-0000-4000-8000-000000000001'
const favorableGoNoGo = { decision: 'Go', scores: { capacity: 4, financialRisk: 4, recognition: 5, technicalFeasibility: 4, expectedMargin: 4, competition: 3, strategicValue: 5, resources: 4, subcontractors: 4, contractRisk: 4 }, notes: 'Positieve beoordeling voor calculatie', assessedBy: 'Test tender manager' }

async function approveOpportunity(app: FastifyInstance, id: string) {
  const qualified = await app.inject({ method: 'POST', url: `/api/opportunities/${id}/qualify` })
  expect(qualified.statusCode, qualified.body).toBe(200)
  const assessed = await app.inject({ method: 'POST', url: `/api/opportunities/${id}/go-no-go`, payload: favorableGoNoGo })
  expect(assessed.statusCode, assessed.body).toBe(200)
  expect(assessed.json()).toMatchObject({ stage: 'Go/No-Go', goNoGo: { decision: 'Go', averageScore: 4.1 } })
}

function multipartCsv(csv: string) {
  const boundary = '----bouwflow-meetstaat-test'
  return {
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
    payload: Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="meetstaat.csv"\r\nContent-Type: text/csv\r\n\r\n`),
      Buffer.from(csv, 'utf8'),
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]),
  }
}

function multipartPhoto(fields: Record<string, string>, photo: Buffer) {
  const boundary = '----bouwflow-werffoto-test'
  const parts: Buffer[] = []
  for (const [name, value] of Object.entries(fields)) parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`))
  parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="werf-zone-a.png"\r\nContent-Type: image/png\r\n\r\n`), photo, Buffer.from(`\r\n--${boundary}--\r\n`))
  return { headers: { 'content-type': `multipart/form-data; boundary=${boundary}` }, payload: Buffer.concat(parts) }
}

function multipartDocument(fields: Record<string, string>, data: Buffer, fileName = 'werfplan.pdf', mimeType = 'application/pdf') {
  const boundary = '----bouwflow-document-test'
  const parts: Buffer[] = []
  for (const [name, value] of Object.entries(fields)) parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`))
  parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: ${mimeType}\r\n\r\n`), data, Buffer.from(`\r\n--${boundary}--\r\n`))
  return { headers: { 'content-type': `multipart/form-data; boundary=${boundary}` }, payload: Buffer.concat(parts) }
}

async function createEnterpriseTestProject(app: FastifyInstance) {
  const organization = (await app.inject({
    method: 'POST', url: '/api/organizations',
    payload: { name: 'Enterprise Testklant NV', type: 'Privaat', contactName: 'Eva Janssens', email: 'eva@enterprise.example', vatNumber: 'BE0777123456' },
  })).json()
  const opportunity = (await app.inject({
    method: 'POST', url: '/api/opportunities',
    payload: { title: 'Enterprise Testwerf', organizationId: organization.id, location: 'Gent', deadline: '2027-05-01', estimatedValue: 250000, probability: 70, recognition: 'C5' },
  })).json()
  await approveOpportunity(app, opportunity.id)
  const calculation = (await app.inject({ method: 'POST', url: `/api/opportunities/${opportunity.id}/calculations` })).json()
  const chapter = (await app.inject({ method: 'POST', url: `/api/calculations/${calculation.id}/chapters`, payload: { code: '01', name: 'Ruwbouw' } })).json()
  await app.inject({ method: 'POST', url: `/api/calculations/${calculation.id}/items`, payload: { chapterId: chapter.id, code: '01.01', description: 'Fundering', quantity: 1, unit: 'forfait', labor: 10000, material: 20000, equipment: 5000, subcontracting: 0 } })
  await app.inject({ method: 'POST', url: `/api/calculations/${calculation.id}/quotes`, payload: { subject: 'Enterprise offerte', introduction: 'Prijsopgave voor de enterprise testwerf.', executionTerm: '180 werkdagen', paymentTerms: '30 dagen', validityDays: 45, priceRevision: 'Volgens contract', exclusions: [], notes: '' } })
  return (await app.inject({ method: 'POST', url: `/api/calculations/${calculation.id}/award` })).json()
}

describe('BouwFlow API', () => {
  let pool: Pool
  let app: FastifyInstance
  let peppolNotificationSender: { send: ReturnType<typeof vi.fn> }

  beforeEach(async () => {
    const database = newDb({ autoCreateForeignKeyIndices: true })
    const adapter = database.adapters.createPg()
    pool = new adapter.Pool() as unknown as Pool
    await migrate(pool)
    await seedDevelopmentData(pool)
    peppolNotificationSender = { send: vi.fn(async () => undefined) }
    app = await buildApp({
      pool,
      objectStorage: new MemoryObjectStorage(),
      peppolWebhookSecret: 'test-webhook-secret',
      peppolWebhookPublicUrl: 'https://bouwflow.example/api/integrations/peppol/webhook',
      peppolNotificationTargets: [{ channel: 'E-mail', destination: 'finance@example.be' }, { channel: 'Teams', destination: 'Financiën' }],
      peppolNotificationSender,
      peppolNotificationDispatchIntervalMs: 60_000,
      peppolAccessPoint: {
        send: async () => ({ status: 'Geaccepteerd', provider: 'Test Accesspoint', providerReference: 'AP-2027-0001', message: 'Document door accesspoint geaccepteerd' }),
        status: async providerReference => ({ status: 'Afgeleverd', provider: 'Test Accesspoint', providerReference, message: 'Positieve transportbevestiging ontvangen' }),
      },
      belgianAddressSearch: {
        search: vi.fn(async () => [{
          id: 'wetstraat-16-1000',
          label: 'Wetstraat 16, 1000 Brussel',
          addressLine: 'Wetstraat 16',
          street: 'Wetstraat',
          houseNumber: '16',
          postalCode: '1000',
          city: 'Brussel',
          municipality: 'Brussel',
          source: 'Testbron',
        }]),
      },
    })
  })

  afterEach(async () => {
    await app.close()
  })

  it('zoekt Belgische adressen voor het relatieformulier', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/addresses/be/suggestions?q=wetstraat&limit=5' })

    expect(response.statusCode, response.body).toBe(200)
    expect(response.json()).toEqual({
      suggestions: [expect.objectContaining({ addressLine: 'Wetstraat 16', postalCode: '1000', city: 'Brussel' })],
    })
  })

  it('doorloopt de MVP-keten vanaf een nieuwe klant tot nacalculatie met auditlog', async () => {
    const organizationResponse = await app.inject({
      method: 'POST', url: '/api/organizations',
      payload: { name: 'MVP Infrastructuur NV', type: 'Privaat', contactName: 'Lotte Vermeulen', email: 'lotte@mvp-infra.example', vatNumber: 'BE0200000439', addressLine: 'Havenlaan 42', postalCode: '2030', city: 'Antwerpen', countryCode: 'BE', peppolEndpointId: '0200000439', peppolSchemeId: '0208' },
    })
    expect(organizationResponse.statusCode).toBe(201)
    const createdOrganization = organizationResponse.json()
    expect(createdOrganization).toMatchObject({ name: 'MVP Infrastructuur NV', contactName: 'Lotte Vermeulen', peppolEndpointId: '0200000439' })

    const organizationUpdateResponse = await app.inject({
      method: 'PATCH', url: `/api/organizations/${createdOrganization.id}`,
      payload: { ...createdOrganization, contactName: 'Lotte De Smet', email: 'lotte.desmet@mvp-infra.example' },
    })
    expect(organizationUpdateResponse.statusCode).toBe(200)
    expect(organizationUpdateResponse.json()).toMatchObject({ id: createdOrganization.id, contactName: 'Lotte De Smet', email: 'lotte.desmet@mvp-infra.example' })
    const activityResponse = await app.inject({ method:'POST', url:`/api/organizations/${createdOrganization.id}/activities`, payload:{ type:'Afspraak', subject:'Startoverleg aanbesteding', startsAt:'2026-08-12T08:30:00.000Z', status:'Gepland', notes:'Selectiecriteria en planning bespreken.', createdBy:'Lotte De Smet' } })
    expect(activityResponse.statusCode,activityResponse.body).toBe(201)
    expect(activityResponse.json().activities).toEqual([expect.objectContaining({ subject:'Startoverleg aanbesteding', status:'Gepland' })])
    const relationResponse = await app.inject({ method:'POST', url:`/api/organizations/${createdOrganization.id}/relations`, payload:{ relatedOrganizationId:organizationId, type:'Opdrachtgever', notes:'Publieke opdrachtgever van het tenderdossier.' } })
    expect(relationResponse.statusCode,relationResponse.body).toBe(201)
    expect(relationResponse.json().relations).toEqual([expect.objectContaining({ relatedOrganizationId:organizationId, type:'Opdrachtgever' })])

    const opportunityResponse = await app.inject({
      method: 'POST', url: '/api/opportunities',
      payload: { title: 'Testwerf Antwerpen', organizationId: createdOrganization.id, location: 'Antwerpen', deadline: '2026-12-01', estimatedValue: 500000, probability: 45, recognition: 'C5' },
    })
    expect(opportunityResponse.statusCode).toBe(201)
    const opportunity = opportunityResponse.json()
    const tenderResponse = await app.inject({ method:'PUT', url:`/api/opportunities/${opportunity.id}/tender`, payload:{ procedureType:'Openbaar', publicationDate:'2026-07-01', submissionDeadline:'2026-12-01T10:00:00.000Z', executionPeriod:'180 werkdagen', recognitionClass:'Klasse 8', recognitionCategory:'C5', selectionConditions:['VCA**','Referentie wegenbouw'], awardCriteria:[{id:'71000000-0000-4000-8000-000000000001',criterion:'Prijs',weightPct:60},{id:'71000000-0000-4000-8000-000000000002',criterion:'Kwaliteit',weightPct:40}], requiredDocumentIds:[], questions:[{id:'71000000-0000-4000-8000-000000000003',question:'Is nachtwerk verplicht?',askedOn:'2026-07-15',status:'Open'}], siteVisits:[{id:'71000000-0000-4000-8000-000000000004',scheduledAt:'2026-08-20T07:00:00.000Z',location:'Projectzone Antwerpen',mandatory:true,attendees:['Lotte De Smet'],notes:'PBM verplicht'}], competitors:['Concurrent Infra NV'], deadlineWarningDays:[30,14,7,2], approvedBy:'Tenderdirecteur', approvedAt:'2026-07-20T15:00:00.000Z', updatedAt:'2026-07-20T15:00:00.000Z' } })
    expect(tenderResponse.statusCode,tenderResponse.body).toBe(200)
    expect(tenderResponse.json()).toMatchObject({ tender:{ procedureType:'Openbaar', questions:[expect.objectContaining({status:'Open'})], approvedBy:'Tenderdirecteur' } })

    await approveOpportunity(app, opportunity.id)

    const calculationResponse = await app.inject({ method: 'POST', url: `/api/opportunities/${opportunity.id}/calculations` })
    expect(calculationResponse.statusCode).toBe(201)
    const calculation = calculationResponse.json()

    const chapterResponse = await app.inject({ method: 'POST', url: `/api/calculations/${calculation.id}/chapters`, payload: { code: '01', name: 'Grondwerken' } })
    expect(chapterResponse.statusCode).toBe(201)
    const chapter = chapterResponse.json()

    const itemResponse = await app.inject({
      method: 'POST', url: `/api/calculations/${calculation.id}/items`,
      payload: { chapterId: chapter.id, code: '01.01', description: 'Grondwerken', quantity: 100, unit: 'm³', labor: 10, material: 20, equipment: 5, subcontracting: 0 },
    })
    expect(itemResponse.statusCode).toBe(201)
    const item = itemResponse.json()

    const itemUpdateResponse = await app.inject({
      method: 'PATCH', url: `/api/calculations/${calculation.id}/items/${item.id}`,
      payload: { labor: 12.5 },
    })
    expect(itemUpdateResponse.statusCode).toBe(200)
    expect(itemUpdateResponse.json().labor).toBe(12.5)

    const quoteResponse = await app.inject({
      method: 'POST', url: `/api/calculations/${calculation.id}/quotes`,
      payload: { subject: 'Offerte grondwerken', introduction: 'Geachte, hierbij onze prijsopgave.', executionTerm: '20 werkdagen', paymentTerms: '30 dagen', validityDays: 45, priceRevision: 'Niet van toepassing', exclusions: ['Bemaling'], notes: 'Planning in overleg.' },
    })
    expect(quoteResponse.statusCode).toBe(201)
    expect(quoteResponse.json().total).toBeGreaterThan(3500)
    expect(quoteResponse.json()).toMatchObject({
      content: { subject: 'Offerte grondwerken', validityDays: 45, exclusions: ['Bemaling'] },
      snapshot: { clientName: 'MVP Infrastructuur NV', projectTitle: 'Testwerf Antwerpen', lines: [expect.objectContaining({ code: '01.01', quantity: 100 })] },
      workflow: { status:'Concept', validUntil:expect.any(String) },
    })
    const approvedQuoteResponse = await app.inject({ method:'POST', url:`/api/quotes/${quoteResponse.json().id}/approve`, payload:{approvedBy:'Directie BouwFlow'} })
    expect(approvedQuoteResponse.json()).toMatchObject({workflow:{status:'Intern goedgekeurd',approvedBy:'Directie BouwFlow'}})
    const sentQuoteResponse = await app.inject({ method:'POST', url:`/api/quotes/${quoteResponse.json().id}/send`, payload:{sentTo:'lotte.desmet@mvp-infra.example',sentBy:'Tenderteam'} })
    expect(sentQuoteResponse.json()).toMatchObject({workflow:{status:'Verzonden',sentTo:'lotte.desmet@mvp-infra.example',mailProviderReference:expect.stringContaining('development:'),reminderAt:expect.any(String)}})
    const openedQuoteResponse = await app.inject({ method:'POST', url:`/api/quotes/${quoteResponse.json().id}/opened` })
    expect(openedQuoteResponse.json()).toMatchObject({workflow:{status:'Geopend',openedAt:expect.any(String),events:expect.arrayContaining([expect.objectContaining({type:'Geopend'})])}})
    const remindedQuoteResponse = await app.inject({ method:'POST', url:`/api/quotes/${quoteResponse.json().id}/remind`, payload:{sentBy:'Tenderteam'} })
    expect(remindedQuoteResponse.json()).toMatchObject({workflow:{status:'Geopend',events:expect.arrayContaining([expect.objectContaining({type:'Herinnerd'})])}})
    const signedQuoteResponse = await app.inject({ method:'POST', url:`/api/quotes/${quoteResponse.json().id}/sign`, payload:{signedBy:'Lotte De Smet'} })
    expect(signedQuoteResponse.json()).toMatchObject({workflow:{status:'Ondertekend',signedBy:'Lotte De Smet',events:expect.arrayContaining([expect.objectContaining({type:'Ondertekend'})])}})

    const pdfResponse = await app.inject({ method: 'GET', url: `/api/quotes/${quoteResponse.json().id}/pdf` })
    expect(pdfResponse.statusCode).toBe(200)
    expect(pdfResponse.headers['content-type']).toContain('application/pdf')
    expect(pdfResponse.headers['content-disposition']).toContain(`${quoteResponse.json().number}.pdf`)
    expect(pdfResponse.rawPayload.subarray(0, 5).toString()).toBe('%PDF-')
    expect(pdfResponse.rawPayload.length).toBeGreaterThan(2000)

    const awardResponse = await app.inject({ method: 'POST', url: `/api/calculations/${calculation.id}/award` })
    expect(awardResponse.statusCode).toBe(201)
    expect(awardResponse.json()).toMatchObject({ name: 'Testwerf Antwerpen', status: 'Opstart', marginPct: 10 })
    const awardedProject = awardResponse.json()
    expect(awardedProject.legalEntityId).toBeTruthy()
    expect(awardedProject.branchId).toBeTruthy()
    expect(awardedProject.handover).toMatchObject({ status: 'Concept', checklist: { scopeReviewed: false, kickoffPlanned: false } })
    expect(awardedProject.workPackages).toEqual([expect.objectContaining({ code: '01', name: 'Grondwerken', budget: awardedProject.costBudget, plannedHours: 0 })])

    const legalEntityResponse = await app.inject({ method: 'POST', url: '/api/legal-entities', payload: { name: 'BouwFlow Infra NV', vatNumber: 'BE0999888777', country: 'België', currency: 'EUR', active: true } })
    expect(legalEntityResponse.statusCode).toBe(201)
    const branchResponse = await app.inject({ method: 'POST', url: `/api/legal-entities/${legalEntityResponse.json().id}/branches`, payload: { name: 'Antwerpen', address: 'Havenlaan 10, 2030 Antwerpen', country: 'België' } })
    expect(branchResponse.statusCode).toBe(201)
    const companyAssignmentResponse = await app.inject({ method: 'PATCH', url: `/api/projects/${awardedProject.id}/company-assignment`, payload: { legalEntityId: legalEntityResponse.json().id, branchId: branchResponse.json().id } })
    expect(companyAssignmentResponse.statusCode).toBe(200)
    expect(companyAssignmentResponse.json()).toMatchObject({ legalEntityId: legalEntityResponse.json().id, branchId: branchResponse.json().id })

    const documentBytes = Buffer.from('%PDF-1.4\nBouwFlow revisie 1\n%%EOF', 'utf8')
    const documentResponse = await app.inject({ method: 'POST', url: `/api/projects/${awardedProject.id}/documents`, ...multipartDocument({ title: 'Uitvoeringsplan zone A', category: 'Plan', notes: 'Eerste uitgave ter controle.', uploadedBy: 'Sofie Janssens' }, documentBytes) })
    expect(documentResponse.statusCode).toBe(201)
    expect(documentResponse.json()).toMatchObject({ projectId: awardedProject.id, title: 'Uitvoeringsplan zone A', category: 'Plan', status: 'Concept', versions: [expect.objectContaining({ revision: 1, revisionLabel: 'R1', fileName: 'werfplan.pdf', sizeBytes: documentBytes.length, contentDigest: expect.stringMatching(/^[a-f0-9]{64}$/) })] })
    const document = documentResponse.json()
    const updatedDocumentResponse = await app.inject({ method: 'PATCH', url: `/api/documents/${document.id}`, payload: { title: 'Uitvoeringsplan wegenis zone A', category: 'Plan' } })
    expect(updatedDocumentResponse.statusCode).toBe(200)
    expect(updatedDocumentResponse.json()).toMatchObject({ id: document.id, title: 'Uitvoeringsplan wegenis zone A', category: 'Plan', status: 'Concept' })
    const documentLinkResponse = await app.inject({ method:'POST', url:`/api/documents/${document.id}/record-links`, payload:{ type:'Opportuniteit', recordId:opportunity.id, label:`${opportunity.projectNumber} · ${opportunity.title}`, createdBy:'Sofie Janssens' } })
    expect(documentLinkResponse.statusCode).toBe(201)
    expect(documentLinkResponse.json().links).toEqual([expect.objectContaining({ type:'Opportuniteit', recordId:opportunity.id, createdBy:'Lokale ontwikkelaar' })])
    const documentFileResponse = await app.inject({ method: 'GET', url: `/api/document-versions/${document.currentVersionId}/file` })
    expect(documentFileResponse.statusCode).toBe(200)
    expect(documentFileResponse.headers['content-disposition']).toContain('werfplan.pdf')
    expect(documentFileResponse.rawPayload).toEqual(documentBytes)
    expect((await app.inject({ method: 'POST', url: `/api/documents/${document.id}/distribute`, payload: { recipients: [{ name: 'Peter Vrancken', email: 'peter@example.com' }] } })).statusCode).toBe(409)
    const submittedDocumentResponse = await app.inject({ method: 'POST', url: `/api/documents/${document.id}/submit` })
    expect(submittedDocumentResponse.json().status).toBe('Ter goedkeuring')
    const approvedDocumentResponse = await app.inject({ method: 'POST', url: `/api/documents/${document.id}/approve`, payload: { approvedBy: 'Peter Vrancken' } })
    expect(approvedDocumentResponse.json()).toMatchObject({ status: 'Goedgekeurd', approvedBy: 'Peter Vrancken' })
    const distributedDocumentResponse = await app.inject({ method: 'POST', url: `/api/documents/${document.id}/distribute`, payload: { recipients: [{ name: 'Peter Vrancken', email: 'peter@example.com' }, { name: 'Studiebureau Delta', email: 'plannen@delta.example' }] } })
    expect(distributedDocumentResponse.statusCode).toBe(200)
    expect(distributedDocumentResponse.json().recipients).toHaveLength(2)
    const readRecipient = distributedDocumentResponse.json().recipients[0]
    const readDocumentResponse = await app.inject({ method: 'POST', url: `/api/document-recipients/${readRecipient.id}/read` })
    expect(readDocumentResponse.json()).toMatchObject({ id: readRecipient.id, readAt: expect.any(String) })
    const revisedDocumentBytes = Buffer.from('%PDF-1.4\nBouwFlow revisie 2\n%%EOF', 'utf8')
    const revisedDocumentResponse = await app.inject({ method: 'POST', url: `/api/documents/${document.id}/revisions`, ...multipartDocument({ notes: 'Aangepast na controle opdrachtgever.', uploadedBy: 'Sofie Janssens' }, revisedDocumentBytes, 'werfplan-r2.pdf') })
    expect(revisedDocumentResponse.statusCode).toBe(201)
    expect(revisedDocumentResponse.json().status).toBe('Concept')
    expect(revisedDocumentResponse.json().approvedBy).toBeUndefined()
    expect(revisedDocumentResponse.json().versions).toEqual([expect.objectContaining({ revision: 2, revisionLabel: 'R2', contentDigest: expect.stringMatching(/^[a-f0-9]{64}$/) }), expect.objectContaining({ revision: 1, revisionLabel: 'R1', contentDigest: expect.stringMatching(/^[a-f0-9]{64}$/), supersededAt: expect.any(String) })])

    const certificateResponse = await app.inject({ method: 'POST', url: `/api/projects/${awardedProject.id}/qhse-certificates`, payload: { holderType: 'Medewerker', holderName: 'Jan Peeters', certificateType: 'VCA Basis', certificateNumber: 'VCA-2027-0042', issuedOn: '2026-08-01', expiresOn: '2027-08-01' } })
    expect(certificateResponse.statusCode).toBe(201)
    expect(certificateResponse.json()).toMatchObject({ projectId: awardedProject.id, holderType: 'Medewerker', holderName: 'Jan Peeters', certificateType: 'VCA Basis', expiresOn: '2027-08-01' })
    const findingId = '40000000-0000-4000-8000-000000000001'
    const inspectionResponse = await app.inject({ method: 'POST', url: `/api/projects/${awardedProject.id}/qhse-inspections`, payload: { inspectionDate: '2027-01-16', type: 'Veiligheidsinspectie', inspector: 'Els Vermeulen', location: 'Zone A', notes: 'Rondgang voor aanvang grondwerken.', findings: [{ id: findingId, description: 'Afscherming sleuf aanvullen', severity: 'Hoog', responsible: 'Jan Peeters', dueDate: '2027-01-17' }] } })
    expect(inspectionResponse.statusCode).toBe(201)
    expect(inspectionResponse.json()).toMatchObject({ projectId: awardedProject.id, status: 'Open', findings: [expect.objectContaining({ id: findingId, severity: 'Hoog' })] })
    expect((await app.inject({ method: 'POST', url: `/api/qhse-inspections/${inspectionResponse.json().id}/close` })).statusCode).toBe(409)
    const resolvedInspectionResponse = await app.inject({ method: 'POST', url: `/api/qhse-inspections/${inspectionResponse.json().id}/findings/${findingId}/resolve` })
    expect(resolvedInspectionResponse.json().findings[0].resolvedAt).toBeTruthy()
    const closedInspectionResponse = await app.inject({ method: 'POST', url: `/api/qhse-inspections/${inspectionResponse.json().id}/close` })
    expect(closedInspectionResponse.json()).toMatchObject({ status: 'Gesloten', closedAt: expect.any(String) })
    const prematurePlanningResponse = await app.inject({ method: 'POST', url: `/api/projects/${awardedProject.id}/planning/generate` })
    expect(prematurePlanningResponse.statusCode).toBe(409)

    const readyHandover = {
      status: 'Klaar voor overdracht', projectManager: 'Sofie Janssens', plannedStart: '2027-01-15', plannedEnd: '2027-05-30', notes: 'Interne kick-off na contractcontrole.', risks: ['Kabels en leidingen verifiëren.'],
      checklist: { scopeReviewed: true, budgetReviewed: true, contractReviewed: true, documentsTransferred: false, risksReviewed: true, kickoffPlanned: false },
    }
    const skippedStatusResponse = await app.inject({ method: 'PATCH', url: `/api/projects/${awardedProject.id}/startup`, payload: { handover: { ...readyHandover, status: 'Aanvaard', checklist: { scopeReviewed: true, budgetReviewed: true, contractReviewed: true, documentsTransferred: true, risksReviewed: true, kickoffPlanned: true } }, workPackages: awardedProject.workPackages } })
    expect(skippedStatusResponse.statusCode).toBe(409)

    const readyResponse = await app.inject({ method: 'PATCH', url: `/api/projects/${awardedProject.id}/startup`, payload: { handover: readyHandover, workPackages: [{ ...awardedProject.workPackages[0], budget: awardedProject.costBudget + 1000, plannedHours: 320, status: 'Klaar voor planning' }] } })
    expect(readyResponse.statusCode).toBe(200)
    expect(readyResponse.json().handover.status).toBe('Klaar voor overdracht')
    expect(readyResponse.json().workPackages[0]).toMatchObject({ budget: awardedProject.costBudget, plannedHours: 320, status: 'Klaar voor planning' })

    const acceptedResponse = await app.inject({ method: 'PATCH', url: `/api/projects/${awardedProject.id}/startup`, payload: { handover: { ...readyHandover, status: 'Aanvaard', checklist: { scopeReviewed: true, budgetReviewed: true, contractReviewed: true, documentsTransferred: true, risksReviewed: true, kickoffPlanned: true } }, workPackages: readyResponse.json().workPackages } })
    expect(acceptedResponse.statusCode).toBe(200)
    expect(acceptedResponse.json().handover).toMatchObject({ status: 'Aanvaard', projectManager: 'Sofie Janssens' })
    expect(acceptedResponse.json().handover.acceptedAt).toBeTruthy()

    const planningResponse = await app.inject({ method: 'POST', url: `/api/projects/${awardedProject.id}/planning/generate` })
    expect(planningResponse.statusCode).toBe(201)
    expect(planningResponse.json().planning).toMatchObject({ status: 'Concept', baselineVersion: 0 })
    expect(planningResponse.json().planning.activities).toHaveLength(2)
    expect(planningResponse.json().planning.activities[0]).toMatchObject({ workPackageId: awardedProject.workPackages[0].id, startDate: '2027-01-15', endDate: '2027-05-30', milestone: false, responsible: 'Sofie Janssens', crewSize: 0, weatherSensitive: false, resourceAssignments: [] })
    expect(planningResponse.json().planning.activities[1]).toMatchObject({ name: 'Mijlpaal · einde werken', startDate: '2027-05-30', endDate: '2027-05-30', milestone: true, predecessorIds: [planningResponse.json().planning.activities[0].id] })

    const baselineResponse = await app.inject({ method: 'POST', url: `/api/projects/${awardedProject.id}/planning/baseline` })
    expect(baselineResponse.statusCode).toBe(201)
    expect(baselineResponse.json().planning).toMatchObject({ status: 'Baseline', baselineVersion: 1 })
    expect(baselineResponse.json().planning.activities[0]).toMatchObject({ baselineStartDate: '2027-01-15', baselineEndDate: '2027-05-30' })

    const changedActivities = baselineResponse.json().planning.activities.map((activity: { milestone: boolean; predecessorIds: string[] }) => ({ ...(activity.milestone ? activity : { ...activity, startDate: '2027-01-16', responsible: 'Werfleider Tom', crewSize: 6, weatherSensitive: true, resourceAssignments: [{ id: '41000000-0000-4000-8000-000000000001', resourceType: 'Materieel', resourceName: 'Rupskraan 25t', allocationPct: 100, certificateExpiresOn: '2027-12-31' }] }), dependencies: activity.predecessorIds.map(predecessorId => ({ predecessorId, type: 'FS', lagDays: 0 })) }))
    const changedPlanningResponse = await app.inject({ method: 'PATCH', url: `/api/projects/${awardedProject.id}/planning`, payload: { activities: changedActivities } })
    expect(changedPlanningResponse.statusCode).toBe(200)
    expect(changedPlanningResponse.json().planning).toMatchObject({ status: 'Gewijzigd', baselineVersion: 1 })
    expect(changedPlanningResponse.json().planning.activities[0]).toMatchObject({ responsible: 'Werfleider Tom', crewSize: 6, weatherSensitive: true, resourceAssignments: [expect.objectContaining({ resourceName: 'Rupskraan 25t', allocationPct: 100 })] })
    expect(changedPlanningResponse.json().planning.activities[1]).toMatchObject({ dependencies: [{ predecessorId: planningResponse.json().planning.activities[0].id, type: 'FS', lagDays: 0 }] })

    const dailyReportPayload = {
      date: '2027-01-16', workPackageId: awardedProject.workPackages[0].id, weather: 'Regen', temperature: 8, activities: 'Uitgraving van de wegkoffer in zone A.',
      laborEntries: [{ id: '30000000-0000-4000-8000-000000000001', employeeName: 'Jan Peeters', role: 'Grondwerker', hours: 8, overtimeHours: 1 }],
      subcontractors: ['Signalisatie Janssens'], materials: [{ id: '30000000-0000-4000-8000-000000000002', description: 'Steenslag', quantity: 24, unit: 'ton' }],
      machines: [{ id: '30000000-0000-4000-8000-000000000003', description: 'Rupskraan 25 ton', quantity: 8, unit: 'uur' }], deliveries: 'Twee vrachten steenslag ontvangen.', delays: '', problems: '', visitors: 'Opdrachtgever om 10:00', notes: '',
    }
    const dailyReportResponse = await app.inject({ method: 'POST', url: `/api/projects/${awardedProject.id}/daily-reports`, payload: dailyReportPayload })
    expect(dailyReportResponse.statusCode).toBe(201)
    expect(dailyReportResponse.json()).toMatchObject({ projectId: awardedProject.id, status: 'Concept', weather: 'Regen', laborEntries: [expect.objectContaining({ employeeName: 'Jan Peeters', overtimeHours: 1 })] })
    const duplicateReportResponse = await app.inject({ method: 'POST', url: `/api/projects/${awardedProject.id}/daily-reports`, payload: dailyReportPayload })
    expect(duplicateReportResponse.statusCode).toBe(409)

    const updatedDailyReportResponse = await app.inject({ method: 'PATCH', url: `/api/daily-reports/${dailyReportResponse.json().id}`, payload: { ...dailyReportPayload, notes: 'Werkzone proper achtergelaten.' } })
    expect(updatedDailyReportResponse.statusCode).toBe(200)
    expect(updatedDailyReportResponse.json().notes).toBe('Werkzone proper achtergelaten.')

    const photoBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')
    const photoResponse = await app.inject({ method: 'POST', url: `/api/daily-reports/${dailyReportResponse.json().id}/photos`, ...multipartPhoto({ workPackageId: awardedProject.workPackages[0].id, caption: 'Uitgraving zone A', location: 'Zone A', takenAt: '2027-01-16T09:30:00.000Z' }, photoBytes) })
    expect(photoResponse.statusCode).toBe(201)
    expect(photoResponse.json()).toMatchObject({ projectId: awardedProject.id, dailyReportId: dailyReportResponse.json().id, caption: 'Uitgraving zone A', location: 'Zone A', mimeType: 'image/png', sizeBytes: photoBytes.length })
    const photoFileResponse = await app.inject({ method: 'GET', url: `/api/site-photos/${photoResponse.json().id}/file` })
    expect(photoFileResponse.statusCode).toBe(200)
    expect(photoFileResponse.headers['content-type']).toContain('image/png')
    expect(photoFileResponse.rawPayload).toEqual(photoBytes)
    const temporaryPhotoResponse = await app.inject({ method: 'POST', url: `/api/daily-reports/${dailyReportResponse.json().id}/photos`, ...multipartPhoto({ caption: 'Tijdelijk bewijs', location: 'Zone B', takenAt: '2027-01-16T10:00:00.000Z' }, photoBytes) })
    expect(temporaryPhotoResponse.statusCode).toBe(201)
    const photoDeleteResponse = await app.inject({ method: 'DELETE', url: `/api/site-photos/${temporaryPhotoResponse.json().id}` })
    expect(photoDeleteResponse.statusCode).toBe(204)
    expect((await app.inject({ method: 'GET', url: `/api/site-photos/${temporaryPhotoResponse.json().id}/file` })).statusCode).toBe(404)

    const submittedDailyReportResponse = await app.inject({ method: 'POST', url: `/api/daily-reports/${dailyReportResponse.json().id}/submit` })
    expect(submittedDailyReportResponse.statusCode).toBe(200)
    expect(submittedDailyReportResponse.json().status).toBe('Ingediend')
    const lockedReportResponse = await app.inject({ method: 'PATCH', url: `/api/daily-reports/${dailyReportResponse.json().id}`, payload: dailyReportPayload })
    expect(lockedReportResponse.statusCode).toBe(409)
    const signedDailyReportResponse = await app.inject({ method: 'POST', url: `/api/daily-reports/${dailyReportResponse.json().id}/sign`, payload: { signedBy: 'Peter Vrancken' } })
    expect(signedDailyReportResponse.statusCode).toBe(200)
    expect(signedDailyReportResponse.json()).toMatchObject({ status: 'Ondertekend', signedBy: 'Peter Vrancken' })
    expect(signedDailyReportResponse.json().signedAt).toBeTruthy()
    const lockedPhotoDeleteResponse = await app.inject({ method: 'DELETE', url: `/api/site-photos/${photoResponse.json().id}` })
    expect(lockedPhotoDeleteResponse.statusCode).toBe(409)

    const changeOrderPayload = {
      dailyReportId: dailyReportResponse.json().id, workPackageId: awardedProject.workPackages[0].id, date: '2027-01-16', cause: 'Onvoorziene kabelbundel',
      description: 'Manueel vrijgraven en tijdelijk ondersteunen van de aangetroffen kabelbundel.', initiator: 'Werfleiding', responsibleParty: 'Opdrachtgever', scheduleImpactDays: 2,
      costs: { labor: 8000, material: 3500, equipment: 1200, transport: 600, subcontracting: 2500, other: 200 }, photoIds: [photoResponse.json().id],
    }
    const changeOrderResponse = await app.inject({ method: 'POST', url: `/api/projects/${awardedProject.id}/change-orders`, payload: changeOrderPayload })
    expect(changeOrderResponse.statusCode).toBe(201)
    expect(changeOrderResponse.json()).toMatchObject({ projectId: awardedProject.id, status: 'Vastgesteld', total: 0, photoIds: [photoResponse.json().id] })
    const updatedChangeOrderResponse = await app.inject({ method: 'PATCH', url: `/api/change-orders/${changeOrderResponse.json().id}`, payload: { ...changeOrderPayload, costs: { ...changeOrderPayload.costs, labor: 8500 } } })
    expect(updatedChangeOrderResponse.statusCode).toBe(200)
    const calculatedChangeOrderResponse = await app.inject({ method: 'POST', url: `/api/change-orders/${changeOrderResponse.json().id}/calculate` })
    expect(calculatedChangeOrderResponse.statusCode).toBe(200)
    expect(calculatedChangeOrderResponse.json()).toMatchObject({ status: 'Berekend', total: 16500 })
    const submittedChangeOrderResponse = await app.inject({ method: 'POST', url: `/api/change-orders/${changeOrderResponse.json().id}/submit` })
    expect(submittedChangeOrderResponse.statusCode).toBe(200)
    expect(submittedChangeOrderResponse.json().status).toBe('Ter goedkeuring')
    const lockedChangeOrderResponse = await app.inject({ method: 'PATCH', url: `/api/change-orders/${changeOrderResponse.json().id}`, payload: changeOrderPayload })
    expect(lockedChangeOrderResponse.statusCode).toBe(409)
    const approvedChangeOrderResponse = await app.inject({ method: 'POST', url: `/api/change-orders/${changeOrderResponse.json().id}/approve`, payload: { approvedBy: 'Peter Vrancken' } })
    expect(approvedChangeOrderResponse.statusCode).toBe(200)
    expect(approvedChangeOrderResponse.json()).toMatchObject({ status: 'Goedgekeurd', approvedBy: 'Peter Vrancken' })
    const executedChangeOrderResponse = await app.inject({ method: 'POST', url: `/api/change-orders/${changeOrderResponse.json().id}/execute` })
    expect(executedChangeOrderResponse.statusCode).toBe(200)
    expect(executedChangeOrderResponse.json().status).toBe('Uitgevoerd')
    const invoiceReadyChangeOrderResponse = await app.inject({ method: 'POST', url: `/api/change-orders/${changeOrderResponse.json().id}/ready-for-invoice` })
    expect(invoiceReadyChangeOrderResponse.statusCode).toBe(200)
    expect(invoiceReadyChangeOrderResponse.json()).toMatchObject({ status: 'Klaar voor facturatie', total: 16500 })

    const progressStatementPayload = {
      periodStart: '2027-01-01', periodEnd: '2027-01-31', lines: [{ workPackageId: awardedProject.workPackages[0].id, cumulativeProgressPct: 25 }],
      changeOrderIds: [changeOrderResponse.json().id], priceRevisionAmount: 1000, retentionPct: 5, notes: 'Eerste maandelijkse vordering.',
    }
    const progressStatementResponse = await app.inject({ method: 'POST', url: `/api/projects/${awardedProject.id}/progress-statements`, payload: progressStatementPayload })
    expect(progressStatementResponse.statusCode).toBe(201)
    expect(progressStatementResponse.json()).toMatchObject({ projectId: awardedProject.id, status: 'Concept', changeOrderAmount: 16500, retentionPct: 5 })
    expect(progressStatementResponse.json().lines[0]).toMatchObject({ workPackageId: awardedProject.workPackages[0].id, cumulativeProgressPct: 25, previousCumulative: 0 })
    const updatedProgressStatementResponse = await app.inject({ method: 'PATCH', url: `/api/progress-statements/${progressStatementResponse.json().id}`, payload: { ...progressStatementPayload, lines: [{ workPackageId: awardedProject.workPackages[0].id, cumulativeProgressPct: 30 }], priceRevisionAmount: 1200 } })
    expect(updatedProgressStatementResponse.statusCode).toBe(200)
    expect(updatedProgressStatementResponse.json().workAmount).toBeGreaterThan(0)
    expect(updatedProgressStatementResponse.json().netAmount).toBeCloseTo(updatedProgressStatementResponse.json().grossAmount * .95, 2)
    const submittedProgressStatementResponse = await app.inject({ method: 'POST', url: `/api/progress-statements/${progressStatementResponse.json().id}/submit` })
    expect(submittedProgressStatementResponse.statusCode).toBe(200)
    expect(submittedProgressStatementResponse.json().status).toBe('Ingediend')
    const lockedProgressStatementResponse = await app.inject({ method: 'PATCH', url: `/api/progress-statements/${progressStatementResponse.json().id}`, payload: progressStatementPayload })
    expect(lockedProgressStatementResponse.statusCode).toBe(409)
    const approvedProgressStatementResponse = await app.inject({ method: 'POST', url: `/api/progress-statements/${progressStatementResponse.json().id}/approve`, payload: { approvedBy: 'Peter Vrancken' } })
    expect(approvedProgressStatementResponse.statusCode).toBe(200)
    expect(approvedProgressStatementResponse.json()).toMatchObject({ status: 'Goedgekeurd', approvedBy: 'Peter Vrancken' })
    const salesInvoiceResponse = await app.inject({ method: 'POST', url: `/api/progress-statements/${progressStatementResponse.json().id}/invoice`, payload: { invoiceDate: '2027-02-01' } })
    expect(salesInvoiceResponse.statusCode).toBe(201)
    expect(salesInvoiceResponse.json().statement).toMatchObject({ status: 'Factuurconcept', invoiceId: salesInvoiceResponse.json().invoice.id })
    expect(salesInvoiceResponse.json().invoice).toMatchObject({ number: 'VF-2027-00001', legalEntityId: legalEntityResponse.json().id, projectId: awardedProject.id, progressStatementId: progressStatementResponse.json().id, status: 'Concept', vatPct: 21, dueDate: '2027-03-03' })
    expect(salesInvoiceResponse.json().invoice.total).toBeCloseTo(salesInvoiceResponse.json().invoice.subtotal * 1.21, 2)
    const duplicateInvoiceResponse = await app.inject({ method: 'POST', url: `/api/progress-statements/${progressStatementResponse.json().id}/invoice`, payload: { invoiceDate: '2027-02-01', dueDate: '2027-03-03', vatPct: 21 } })
    expect(duplicateInvoiceResponse.statusCode).toBe(409)
    const conceptPeppolResponse = await app.inject({ method: 'POST', url: `/api/sales-invoices/${salesInvoiceResponse.json().invoice.id}/peppol-delivery` })
    expect(conceptPeppolResponse.statusCode).toBe(409)
    expect(conceptPeppolResponse.json().message).toContain('eerst uit')
    const issuedSalesInvoiceResponse = await app.inject({ method: 'POST', url: `/api/sales-invoices/${salesInvoiceResponse.json().invoice.id}/issue`, payload: { issuedBy: 'An De Smet' } })
    expect(issuedSalesInvoiceResponse.statusCode).toBe(200)
    expect(issuedSalesInvoiceResponse.json()).toMatchObject({ status: 'Openstaand', issuedBy: 'An De Smet' })
    const partialSalesPaymentResponse = await app.inject({ method: 'POST', url: `/api/sales-invoices/${salesInvoiceResponse.json().invoice.id}/payment`, payload: { paymentDate: '2027-03-01', amount: 100, reference: 'CODA-100' } })
    expect(partialSalesPaymentResponse.statusCode).toBe(409)
    const salesPaymentResponse = await app.inject({ method: 'POST', url: `/api/sales-invoices/${salesInvoiceResponse.json().invoice.id}/payment`, payload: { paymentDate: '2027-03-01', amount: salesInvoiceResponse.json().invoice.total, reference: 'CODA-2027-0031' } })
    expect(salesPaymentResponse.statusCode).toBe(200)
    expect(salesPaymentResponse.json()).toMatchObject({ status: 'Betaald', paidAt: '2027-03-01', paymentReference: 'CODA-2027-0031' })
    const decreasingProgressResponse = await app.inject({ method: 'POST', url: `/api/projects/${awardedProject.id}/progress-statements`, payload: { ...progressStatementPayload, periodStart: '2027-02-01', periodEnd: '2027-02-28', lines: [{ workPackageId: awardedProject.workPackages[0].id, cumulativeProgressPct: 20 }], changeOrderIds: [] } })
    expect(decreasingProgressResponse.statusCode).toBe(409)

    const commitmentResponse = await app.inject({ method: 'POST', url: `/api/projects/${awardedProject.id}/costs`, payload: { workPackageId: awardedProject.workPackages[0].id, date: '2027-01-20', type: 'Verplichting', category: 'material', description: 'Bestelling funderingsmateriaal', supplier: 'Steenslag NV', amount: 5000, reference: 'BB-2027-014' } })
    expect(commitmentResponse.statusCode).toBe(201)
    expect(commitmentResponse.json()).toMatchObject({ type: 'Verplichting', status: 'Open', amount: 5000 })
    const directCostResponse = await app.inject({ method: 'POST', url: `/api/projects/${awardedProject.id}/costs`, payload: { workPackageId: awardedProject.workPackages[0].id, date: '2027-01-21', type: 'Werkelijke kost', category: 'labor', description: 'Interne ploeguren januari', supplier: '', amount: 2500, reference: 'UREN-01' } })
    expect(directCostResponse.statusCode).toBe(201)
    expect(directCostResponse.json().status).toBe('Geboekt')
    const lowForecastResponse = await app.inject({ method: 'POST', url: `/api/projects/${awardedProject.id}/forecasts`, payload: { lines: [{ workPackageId: awardedProject.workPackages[0].id, remainingCost: 4000 }], notes: 'Te lage prognose' } })
    expect(lowForecastResponse.statusCode).toBe(409)
    const firstForecastResponse = await app.inject({ method: 'POST', url: `/api/projects/${awardedProject.id}/forecasts`, payload: { lines: [{ workPackageId: awardedProject.workPackages[0].id, remainingCost: 10000 }], notes: 'Eerste cost-to-complete-inschatting.' } })
    expect(firstForecastResponse.statusCode).toBe(201)
    expect(firstForecastResponse.json()).toMatchObject({ version: 1, actualCosts: 2500, openCommitments: 5000, remainingCost: 10000, estimateAtCompletion: 12500,status:'Ter goedkeuring' })
    const approvedForecast=await app.inject({method:'POST',url:`/api/project-forecasts/${firstForecastResponse.json().id}/approve`})
    expect(approvedForecast.statusCode,approvedForecast.body).toBe(200)
    expect(approvedForecast.json()).toMatchObject({status:'Goedgekeurd',approvedBy:expect.any(String),approvedAt:expect.any(String)})
    const settlementResponse = await app.inject({ method: 'POST', url: `/api/project-costs/${commitmentResponse.json().id}/settle`, payload: { date: '2027-01-31', amount: 5200, description: 'Factuur funderingsmateriaal', reference: 'LEV-2027-882' } })
    expect(settlementResponse.statusCode).toBe(201)
    expect(settlementResponse.json().commitment).toMatchObject({ status: 'Omgezet', settledByEntryId: settlementResponse.json().actualCost.id })
    expect(settlementResponse.json().actualCost).toMatchObject({ type: 'Werkelijke kost', status: 'Geboekt', amount: 5200, sourceCommitmentId: commitmentResponse.json().id })
    const secondForecastResponse = await app.inject({ method: 'POST', url: `/api/projects/${awardedProject.id}/forecasts`, payload: { lines: [{ workPackageId: awardedProject.workPackages[0].id, remainingCost: 8000 }], notes: 'Bijgesteld na leveranciersfactuur.' } })
    expect(secondForecastResponse.statusCode).toBe(201)
    expect(secondForecastResponse.json()).toMatchObject({ version: 2, actualCosts: 7700, openCommitments: 0, remainingCost: 8000, estimateAtCompletion: 15700,status:'Ter goedkeuring' })
    expect(secondForecastResponse.json().expectedRevenue).toBeCloseTo(awardedProject.contractValue + 16500, 2)

    const supplierOneResponse = await app.inject({ method: 'POST', url: '/api/suppliers', payload: { name: 'Beton & Co', vatNumber: 'BE0123456789', contactName: 'Lies Peeters', email: 'lies@example.be', paymentTerms: '30 dagen' } })
    const supplierTwoResponse = await app.inject({ method: 'POST', url: '/api/suppliers', payload: { name: 'Infra Supply', vatNumber: 'BE0987654321', contactName: 'Tom Claes', email: 'tom@example.be', paymentTerms: '45 dagen' } })
    expect(supplierOneResponse.statusCode).toBe(201)
    expect(supplierTwoResponse.statusCode).toBe(201)
    const procurementResponse = await app.inject({ method: 'POST', url: `/api/projects/${awardedProject.id}/procurement-requests`, payload: { workPackageId: awardedProject.workPackages[0].id, invitedSupplierIds: [supplierOneResponse.json().id, supplierTwoResponse.json().id], category: 'material', requestedBy: 'Sofie Janssens', neededBy: '2027-02-15', description: 'Aanvullend funderingsmateriaal', items: [{ id: '40000000-0000-4000-8000-000000000001', description: 'Steenslag type II', quantity: 100, unit: 'ton', targetUnitPrice: 60 }] } })
    expect(procurementResponse.statusCode).toBe(201)
    expect(procurementResponse.json()).toMatchObject({ status: 'Behoefte', category: 'material', quotes: [],approval:{status:'Te beoordelen',requiredRole:'Projectmanager',amount:6000} })
    const procurementApproval=await app.inject({method:'POST',url:`/api/procurement-requests/${procurementResponse.json().id}/approve`})
    expect(procurementApproval.statusCode,procurementApproval.body).toBe(200)
    expect(procurementApproval.json().approval).toMatchObject({status:'Goedgekeurd',approvedBy:expect.any(String)})
    const issuedProcurementResponse = await app.inject({ method: 'POST', url: `/api/procurement-requests/${procurementResponse.json().id}/issue` })
    expect(issuedProcurementResponse.statusCode).toBe(200)
    expect(issuedProcurementResponse.json().status).toBe('Prijsaanvraag')
    const firstSupplierQuoteResponse = await app.inject({ method: 'POST', url: `/api/procurement-requests/${procurementResponse.json().id}/quotes`, payload: { supplierId: supplierOneResponse.json().id, amount: 5900, leadTimeDays: 7, validityDate: '2027-02-10', notes: 'Levering inbegrepen.' } })
    const secondSupplierQuoteResponse = await app.inject({ method: 'POST', url: `/api/procurement-requests/${procurementResponse.json().id}/quotes`, payload: { supplierId: supplierTwoResponse.json().id, amount: 5600, leadTimeDays: 10, validityDate: '2027-02-12', notes: 'Prijs inclusief transport.' } })
    expect(firstSupplierQuoteResponse.statusCode).toBe(200)
    expect(secondSupplierQuoteResponse.statusCode).toBe(200)
    expect(secondSupplierQuoteResponse.json()).toMatchObject({ status: 'Vergelijken', quotes: [expect.objectContaining({ amount: 5900 }), expect.objectContaining({ amount: 5600 })] })
    const frameworkResponse = await app.inject({ method: 'POST', url: `/api/suppliers/${supplierTwoResponse.json().id}/framework-agreements`, payload: { number: 'RAAM-MAT-2026', title: 'Raamcontract funderingsmaterialen', category: 'material', startsOn: '2026-01-01', endsOn: '2028-12-31', ceilingAmount: 10000, documentIds: [] } })
    expect(frameworkResponse.statusCode, frameworkResponse.body).toBe(201)
    expect(frameworkResponse.json().frameworkAgreements[0]).toMatchObject({ status: 'Actief', committedAmount: 0, ceilingAmount: 10000 })
    const selectedQuote = secondSupplierQuoteResponse.json().quotes.find((quote: { supplierId: string }) => quote.supplierId === supplierTwoResponse.json().id)
    const selectedProcurementResponse = await app.inject({ method: 'POST', url: `/api/procurement-requests/${procurementResponse.json().id}/quotes/${selectedQuote.id}/select` })
    expect(selectedProcurementResponse.statusCode).toBe(201)
    expect(selectedProcurementResponse.json().request).toMatchObject({ status: 'Besteld', selectedQuoteId: selectedQuote.id })
    expect(selectedProcurementResponse.json().order).toMatchObject({ supplierId: supplierTwoResponse.json().id, frameworkAgreementId: frameworkResponse.json().frameworkAgreements[0].id, status: 'Besteld', amount: 5600 })
    expect(selectedProcurementResponse.json().commitment).toMatchObject({ type: 'Verplichting', status: 'Open', amount: 5600, category: 'material' })
    const purchaseOrderPdfResponse = await app.inject({ method: 'GET', url: `/api/purchase-orders/${selectedProcurementResponse.json().order.id}/pdf` })
    expect(purchaseOrderPdfResponse.statusCode).toBe(200)
    expect(purchaseOrderPdfResponse.headers['content-type']).toContain('application/pdf')
    expect(purchaseOrderPdfResponse.rawPayload.subarray(0, 4).toString()).toBe('%PDF')
    const forbiddenSupplierPdfResponse = await app.inject({ method: 'GET', url: `/api/purchase-orders/${selectedProcurementResponse.json().order.id}/pdf`, headers: { 'x-user-id': '70000000-0000-4000-8000-000000000091', 'x-user-roles': 'Leverancier', 'x-user-email': 'lies@example.be' } })
    expect(forbiddenSupplierPdfResponse.statusCode).toBe(403)
    const ownSupplierPdfResponse = await app.inject({ method: 'GET', url: `/api/purchase-orders/${selectedProcurementResponse.json().order.id}/pdf`, headers: { 'x-user-id': '70000000-0000-4000-8000-000000000092', 'x-user-roles': 'Leverancier', 'x-user-email': 'tom@example.be' } })
    expect(ownSupplierPdfResponse.statusCode).toBe(200)
    const firstDeliveryResponse = await app.inject({ method: 'POST', url: `/api/purchase-orders/${selectedProcurementResponse.json().order.id}/receive`, payload: { receivedAt: '2027-02-12', deliveryReference: 'LB-7701', receivedBy: 'Jan Peeters', notes: 'Eerste deellevering.', lines: [{ procurementItemId: '40000000-0000-4000-8000-000000000001', quantity: 40 }] } })
    expect(firstDeliveryResponse.json()).toMatchObject({ status: 'Gedeeltelijk ontvangen', lines: [expect.objectContaining({ receivedQuantity: 40 })], receipts: [expect.objectContaining({ deliveryReference: 'LB-7701' })] })
    const receivedOrderResponse = await app.inject({ method: 'POST', url: `/api/purchase-orders/${selectedProcurementResponse.json().order.id}/receive`, payload: { receivedAt: '2027-02-14', deliveryReference: 'LB-7788', receivedBy: 'Jan Peeters', notes: 'Hoeveelheid en kwaliteit gecontroleerd.', lines: [{ procurementItemId: '40000000-0000-4000-8000-000000000001', quantity: 60 }] } })
    expect(receivedOrderResponse.statusCode).toBe(200)
    expect(receivedOrderResponse.json()).toMatchObject({ status: 'Ontvangen', deliveryReference: 'LB-7788', receivedBy: 'Jan Peeters' })
    const matchedInvoiceResponse = await app.inject({ method: 'POST', url: `/api/purchase-orders/${selectedProcurementResponse.json().order.id}/match-invoice`, payload: { invoiceNumber: 'IS-2027-991', invoiceDate: '2027-02-16', dueDate: '2027-03-18', amount: 5700, lines: [{ procurementItemId: '40000000-0000-4000-8000-000000000001', quantity: 100, unitPrice: 57 }] } })
    expect(matchedInvoiceResponse.statusCode).toBe(200)
    expect(matchedInvoiceResponse.json().order).toMatchObject({ status: 'Afwijking', invoiceNumber: 'IS-2027-991', invoiceDueDate: '2027-03-18', invoiceAmount: 5700, matchResult: { matched: false, amountDifference: 100 } })
    expect(matchedInvoiceResponse.json().actualCost).toBeUndefined()
    const approvedDeviationResponse = await app.inject({ method: 'POST', url: `/api/purchase-orders/${selectedProcurementResponse.json().order.id}/approve-deviation`, payload: { reason: 'Transporttoeslag contractueel aanvaard.' } })
    expect(approvedDeviationResponse.statusCode).toBe(200)
    expect(approvedDeviationResponse.json().order).toMatchObject({ status: 'Factuur gecontroleerd', matchResult: { approvedBy: expect.any(String), approvalReason: 'Transporttoeslag contractueel aanvaard.' } })
    expect(approvedDeviationResponse.json().request.status).toBe('Afgesloten')
    expect(approvedDeviationResponse.json().commitment).toMatchObject({ status: 'Omgezet', settledByEntryId: approvedDeviationResponse.json().actualCost.id })
    expect(approvedDeviationResponse.json().actualCost).toMatchObject({ type: 'Werkelijke kost', amount: 5700, sourceCommitmentId: selectedProcurementResponse.json().commitment.id })
    const purchasePaymentResponse = await app.inject({ method: 'POST', url: `/api/purchase-orders/${selectedProcurementResponse.json().order.id}/payment`, payload: { paymentDate: '2027-03-17', amount: 5700, reference: 'BANK-2027-442' } })
    expect(purchasePaymentResponse.statusCode).toBe(200)
    expect(purchasePaymentResponse.json()).toMatchObject({ status: 'Betaald', paidAt: '2027-03-17', paidAmount: 5700, paymentReference: 'BANK-2027-442' })

    const feedbackResponse = await app.inject({ method: 'POST', url: `/api/projects/${awardedProject.id}/post-calculation/library`, payload: { boqItemId: item.id, category: 'labor' } })
    expect(feedbackResponse.statusCode).toBe(201)
    expect(feedbackResponse.json()).toMatchObject({ category: 'labor', unit: 'm³', source: expect.stringContaining(`Nacalculatie ${awardedProject.number}`) })
    expect(feedbackResponse.json().unitCost).toBeGreaterThan(0)
    const duplicateFeedbackResponse = await app.inject({ method: 'POST', url: `/api/projects/${awardedProject.id}/post-calculation/library`, payload: { boqItemId: item.id, category: 'labor' } })
    expect(duplicateFeedbackResponse.statusCode).toBe(409)

    const bootstrapResponse = await app.inject({ method: 'GET', url: '/api/bootstrap' })
    const state = bootstrapResponse.json()
    expect(state.opportunities[0].stage).toBe('Gewonnen')
    expect(state.calculations[0].items).toHaveLength(1)
    expect(state.quotes).toHaveLength(1)
    expect(state.projects).toHaveLength(1)
    expect(state.projects[0]).toMatchObject({ legalEntityId: legalEntityResponse.json().id, branchId: branchResponse.json().id })
    expect(state.legalEntities).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'BouwFlow Construct NV' }), expect.objectContaining({ id: legalEntityResponse.json().id, currency: 'EUR' })]))
    expect(state.companyBranches).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'Hasselt' }), expect.objectContaining({ id: branchResponse.json().id, legalEntityId: legalEntityResponse.json().id })]))
    expect(state.projects[0].planning).toMatchObject({ status: 'Gewijzigd', baselineVersion: 1 })
    expect(state.dailyReports).toEqual([expect.objectContaining({ status: 'Ondertekend', projectId: awardedProject.id, date: '2027-01-16' })])
    expect(state.sitePhotos).toEqual([expect.objectContaining({ dailyReportId: dailyReportResponse.json().id, caption: 'Uitgraving zone A' })])
    expect(state.changeOrders).toEqual([expect.objectContaining({ status: 'Opgenomen in vorderingsstaat', projectId: awardedProject.id, total: 16500, progressStatementId: progressStatementResponse.json().id })])
    expect(state.progressStatements).toEqual([expect.objectContaining({ status: 'Factuurconcept', netAmount: updatedProgressStatementResponse.json().netAmount })])
    expect(state.salesInvoices).toEqual([expect.objectContaining({ id: salesInvoiceResponse.json().invoice.id, vatPct: 21, status: 'Betaald', paidAt: '2027-03-01' })])
    expect(state.projectCosts).toHaveLength(5)
    expect(state.projectCosts).toEqual(expect.arrayContaining([expect.objectContaining({ id: commitmentResponse.json().id, status: 'Omgezet' }), expect.objectContaining({ sourceCommitmentId: commitmentResponse.json().id, amount: 5200 })]))
    expect(state.projectForecasts).toEqual([expect.objectContaining({ version: 2, estimateAtCompletion: 15700 }), expect.objectContaining({ version: 1, estimateAtCompletion: 12500 })])
    expect(state.costLibrary).toEqual(expect.arrayContaining([expect.objectContaining({ id: feedbackResponse.json().id, category: 'labor', unitCost: feedbackResponse.json().unitCost })]))
    expect(state.suppliers).toHaveLength(2)
    expect(state.suppliers.find((supplier: { id: string }) => supplier.id === supplierTwoResponse.json().id).frameworkAgreements[0]).toMatchObject({ committedAmount: 5600 })
    expect(state.procurementRequests).toEqual([expect.objectContaining({ id: procurementResponse.json().id, status: 'Afgesloten', purchaseOrderId: selectedProcurementResponse.json().order.id })])
    expect(state.purchaseOrders).toEqual([expect.objectContaining({ status: 'Betaald', actualCostId: approvedDeviationResponse.json().actualCost.id, invoiceDueDate: '2027-03-18' })])
    expect(state.documents).toHaveLength(1)
    expect(state.documents[0]).toMatchObject({ id: document.id, projectId: awardedProject.id, status: 'Concept', currentVersionId: revisedDocumentResponse.json().currentVersionId })
    expect(state.documents[0].versions).toEqual(expect.arrayContaining([expect.objectContaining({ revision: 2 }), expect.objectContaining({ revision: 1 })]))
    expect(state.documents[0].recipients).toEqual(expect.arrayContaining([expect.objectContaining({ email: 'peter@example.com', readAt: expect.any(String) }), expect.objectContaining({ email: 'plannen@delta.example' })]))
    expect(state.qhseCertificates).toEqual([expect.objectContaining({ id: certificateResponse.json().id, projectId: awardedProject.id, certificateNumber: 'VCA-2027-0042' })])
    expect(state.qhseInspections).toEqual([expect.objectContaining({ id: inspectionResponse.json().id, projectId: awardedProject.id, status: 'Gesloten', findings: [expect.objectContaining({ id: findingId, resolvedAt: expect.any(String) })] })])

    const auditResponse = await app.inject({ method: 'GET', url: '/api/audit' })
    expect(auditResponse.statusCode).toBe(200)
    expect(auditResponse.json().length).toBeGreaterThanOrEqual(77)
    expect(auditResponse.json()).toEqual(expect.arrayContaining([
      expect.objectContaining({ entityType: 'organization', entityId: createdOrganization.id, action: 'created' }),
      expect.objectContaining({ entityType: 'organization', entityId: createdOrganization.id, action: 'updated' }),
      expect.objectContaining({ entityType: 'opportunity', entityId: opportunity.id, action: 'qualified' }),
      expect.objectContaining({ entityType: 'opportunity', entityId: opportunity.id, action: 'go_decision' }),
    ]))
    const opportunityAuditResponse = await app.inject({ method: 'GET', url: `/api/audit/opportunity/${opportunity.id}` })
    expect(opportunityAuditResponse.statusCode).toBe(200)
    expect(opportunityAuditResponse.json()).toEqual(expect.arrayContaining([
      expect.objectContaining({ entityType: 'opportunity', entityId: opportunity.id, action: 'qualified', userName: expect.any(String) }),
    ]))
    expect(opportunityAuditResponse.json()[0]).not.toHaveProperty('oldValue')
    expect(opportunityAuditResponse.json()[0]).not.toHaveProperty('newValue')
    const preferenceKey = 'table-v1:opportunities:0:project.status'
    const savedPreference = await app.inject({ method: 'PATCH', url: `/api/user-preferences/${encodeURIComponent(preferenceKey)}`, payload: { value: { order: ['project', 'status'], widths: { project: 240 }, filters: { status: 'Go' } } } })
    expect(savedPreference.statusCode, savedPreference.body).toBe(200)
    const loadedPreference = await app.inject({ method: 'GET', url: `/api/user-preferences/${encodeURIComponent(preferenceKey)}` })
    expect(loadedPreference.statusCode).toBe(200)
    expect(loadedPreference.json()).toMatchObject({ key: preferenceKey, value: { order: ['project', 'status'], widths: { project: 240 }, filters: { status: 'Go' } } })
    const otherUsersPreference = await app.inject({ method: 'GET', url: `/api/user-preferences/${encodeURIComponent(preferenceKey)}`, headers: { 'x-user-id': DEVELOPMENT_PROJECT_MANAGER_ID, 'x-user-roles': 'Projectmanager' } })
    expect(otherUsersPreference.statusCode).toBe(200)
    expect(otherUsersPreference.json()).toEqual({ key: preferenceKey, value: null })

    const restrictUserResponse = await app.inject({ method: 'PATCH', url: `/api/users/${DEVELOPMENT_PROJECT_MANAGER_ID}/company-access`, payload: { allLegalEntities: false, legalEntityIds: [DEVELOPMENT_LEGAL_ENTITY_ID] } })
    expect(restrictUserResponse.statusCode).toBe(200)
    expect(restrictUserResponse.json()).toMatchObject({ allLegalEntities: false, legalEntityIds: [DEVELOPMENT_LEGAL_ENTITY_ID] })
    const scopedHeaders = { 'x-user-id': DEVELOPMENT_PROJECT_MANAGER_ID, 'x-user-roles': 'Projectmanager' }
    const deniedNotificationSettings = await app.inject({ method: 'PATCH', url: '/api/settings/peppol-notifications', headers: scopedHeaders, payload: { emailRecipients: ['project@example.be'], teamsTargets: [], criticalSlaMinutes: 10 } })
    expect(deniedNotificationSettings.statusCode).toBe(403)
    const deniedNotificationTest = await app.inject({ method: 'POST', url: '/api/settings/peppol-notifications/test', headers: scopedHeaders, payload: { channel: 'E-mail', destination: 'finance@example.be' } })
    expect(deniedNotificationTest.statusCode).toBe(403)
    const restrictedBootstrap = await app.inject({ method: 'GET', url: '/api/bootstrap', headers: scopedHeaders })
    expect(restrictedBootstrap.statusCode).toBe(200)
    expect(restrictedBootstrap.json().projects).toEqual([])
    expect(restrictedBootstrap.json().legalEntities).toEqual([expect.objectContaining({ id: DEVELOPMENT_LEGAL_ENTITY_ID })])
    expect(restrictedBootstrap.json().companyUsers).toEqual([expect.objectContaining({ id: DEVELOPMENT_PROJECT_MANAGER_ID })])
    expect(restrictedBootstrap.json().peppolNotificationSettings).toMatchObject({ emailRecipients: [], teamsTargets: [] })
    const deniedProjectMutation = await app.inject({ method: 'POST', url: `/api/projects/${awardedProject.id}/planning/generate`, headers: scopedHeaders })
    expect(deniedProjectMutation.statusCode).toBe(403)
    const grantProjectEntityResponse = await app.inject({ method: 'PATCH', url: `/api/users/${DEVELOPMENT_PROJECT_MANAGER_ID}/company-access`, payload: { allLegalEntities: false, legalEntityIds: [legalEntityResponse.json().id] } })
    expect(grantProjectEntityResponse.statusCode).toBe(200)
    const grantedBootstrap = await app.inject({ method: 'GET', url: '/api/bootstrap', headers: scopedHeaders })
    expect(grantedBootstrap.json().projects).toEqual([expect.objectContaining({ id: awardedProject.id })])

    const financialSettingsResponse = await app.inject({ method: 'PATCH', url: `/api/legal-entities/${legalEntityResponse.json().id}/financial-settings`, payload: { vatNumber: legalEntityResponse.json().vatNumber, invoicePrefix: 'BFI', nextInvoiceNumber: 770, defaultVatPct: 6, iban: 'BE12 3456 7890 1234', bic: 'GEBABEBB', paymentTermsDays: 45, addressLine: 'Testlaan 10', postalCode: '3500', city: 'Hasselt', countryCode: 'BE', peppolEndpointId: '0200000340', peppolSchemeId: '0208' } })
    expect(financialSettingsResponse.statusCode).toBe(200)
    expect(financialSettingsResponse.json()).toMatchObject({ invoicePrefix: 'BFI', nextInvoiceNumber: 770, defaultVatPct: 6, paymentTermsDays: 45 })
    const organizationBillingResponse = await app.inject({ method: 'PATCH', url: `/api/organizations/${createdOrganization.id}/billing-profile`, payload: { vatNumber: 'BE0200000439', addressLine: 'Koning Albert II-laan 20', postalCode: '1000', city: 'Brussel', countryCode: 'BE', peppolEndpointId: '0200000439', peppolSchemeId: '0208' } })
    expect(organizationBillingResponse.statusCode).toBe(200)
    expect(organizationBillingResponse.json()).toMatchObject({ vatNumber: 'BE0200000439', city: 'Brussel', peppolEndpointId: '0200000439' })
    const notificationSettingsResponse = await app.inject({ method: 'PATCH', url: '/api/settings/peppol-notifications', payload: { emailRecipients: ['peppol-alerts@example.be'], teamsTargets: ['Directie'], criticalSlaMinutes: 1 } })
    expect(notificationSettingsResponse.statusCode).toBe(200)
    expect(notificationSettingsResponse.json()).toMatchObject({ emailRecipients: ['peppol-alerts@example.be'], teamsTargets: ['Directie'], criticalSlaMinutes: 1, connectorConfigured: true, connectorProvider: 'Aangepaste adapter', connectorChannels: ['E-mail', 'Teams'], productionGate: { released: false }, updatedAt: expect.any(String) })
    expect(notificationSettingsResponse.json().integrationChecks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'access-point', ready: true }),
      expect.objectContaining({ id: 'webhook', ready: true }),
      expect.objectContaining({ id: 'notification-connector', ready: true }),
      expect.objectContaining({ id: 'notification-dispatcher', ready: true }),
    ]))
    expect(JSON.stringify(notificationSettingsResponse.json())).not.toContain('test-webhook-secret')
    const notificationTestResponse = await app.inject({ method: 'POST', url: '/api/settings/peppol-notifications/test', payload: { channel: 'E-mail', destination: 'peppol-alerts@example.be' } })
    expect(notificationTestResponse.statusCode).toBe(200)
    expect(notificationTestResponse.json()).toMatchObject({ id: expect.any(String), channel: 'E-mail', destination: 'peppol-alerts@example.be', status: 'Verzonden', sentAt: expect.any(String) })
    expect(peppolNotificationSender.send).toHaveBeenCalledWith(expect.objectContaining({ kind: 'Testmelding', destination: 'peppol-alerts@example.be', subject: 'BouwFlow Peppol-testmelding' }))
    const unknownNotificationTarget = await app.inject({ method: 'POST', url: '/api/settings/peppol-notifications/test', payload: { channel: 'E-mail', destination: 'niet-opgeslagen@example.be' } })
    expect(unknownNotificationTarget.statusCode).toBe(400)
    peppolNotificationSender.send.mockRejectedValueOnce(new Error('Testconnector offline'))
    const failedNotificationTest = await app.inject({ method: 'POST', url: '/api/settings/peppol-notifications/test', payload: { channel: 'Teams', destination: 'Directie' } })
    expect(failedNotificationTest.statusCode).toBe(502)
    expect(failedNotificationTest.json().message).toContain('Testconnector offline')
    const peppolValidationResponse = await app.inject({ method: 'POST', url: `/api/sales-invoices/${salesInvoiceResponse.json().invoice.id}/peppol-validation` })
    expect(peppolValidationResponse.statusCode).toBe(201)
    expect(peppolValidationResponse.json()).toMatchObject({ invoiceId: salesInvoiceResponse.json().invoice.id, documentDigest: expect.stringMatching(/^[a-f0-9]{64}$/), status: 'Geslaagd', source: 'Preflight', networkReady: false, issues: [] })
    const externalValidationId = '90000000-0000-4000-8000-000000000001'
    await pool.query("INSERT INTO peppol_validation_reports (tenant_id,id,invoice_id,document_digest,status,source,engine,profile,network_ready,issues) SELECT tenant_id,$1,id,$3,'Geslaagd','Extern','Test Schematron','Peppol BIS Billing 3.0 / UBL 2.1',true,'[]'::jsonb FROM sales_invoices WHERE id=$2", [externalValidationId, salesInvoiceResponse.json().invoice.id, peppolValidationResponse.json().documentDigest])
    const productionReleaseId = '90000000-0000-4000-8000-000000000002'
    await pool.query("INSERT INTO peppol_acceptance_runs (tenant_id,id,invoice_id,status,document_digest,steps,started_by,started_at,completed_at,released_by,released_at,release_notes) SELECT tenant_id,$1,id,'Geslaagd',$3,$4::jsonb,$5,now(),now(),'Testdirectie',now(),'Gecontroleerde productievrijgave voor de integratietest.' FROM sales_invoices WHERE id=$2", [productionReleaseId, salesInvoiceResponse.json().invoice.id, peppolValidationResponse.json().documentDigest, JSON.stringify([{ id: 'delivery', label: 'Aflevering', status: 'Geslaagd', message: 'Aflevering bewezen', at: new Date().toISOString() }]), DEVELOPMENT_USER_ID])
    const releasedSettings = (await app.inject({ method: 'GET', url: '/api/bootstrap' })).json().peppolNotificationSettings
    expect(releasedSettings.productionGate).toMatchObject({ released: true, runId: productionReleaseId, releasedBy: 'Testdirectie', releasedAt: expect.any(String) })
    await app.close()
    app = await buildApp({
      pool,
      objectStorage: new MemoryObjectStorage(),
      peppolValidator: { networkReady: true, validate: async () => ({ status: 'Geslaagd', source: 'Extern', engine: 'Test Schematron', profile: 'Peppol BIS Billing 3.0 / UBL 2.1', networkReady: true, issues: [] }) },
      peppolWebhookSecret: 'test-webhook-secret',
      peppolWebhookPublicUrl: 'https://bouwflow.example/api/integrations/peppol/webhook',
      peppolStatusPollIntervalMs: 60_000,
      peppolNotificationTargets: [{ channel: 'E-mail', destination: 'finance@example.be' }, { channel: 'Teams', destination: 'Financiën' }],
      peppolNotificationSender,
      peppolNotificationDispatchIntervalMs: 60_000,
      peppolAccessPoint: {
        send: async () => ({ status: 'Geaccepteerd', provider: 'Test Accesspoint', providerReference: 'AP-2027-0001', message: 'Document door accesspoint geaccepteerd' }),
        status: async providerReference => ({ status: 'Afgeleverd', provider: 'Test Accesspoint', providerReference, message: 'Positieve transportbevestiging ontvangen' }),
      },
    })
    const changedBillingResponse = await app.inject({ method: 'PATCH', url: `/api/organizations/${createdOrganization.id}/billing-profile`, payload: { vatNumber: 'BE0200000439', addressLine: 'Tijdelijk gewijzigd adres 1', postalCode: '1000', city: 'Brussel', countryCode: 'BE', peppolEndpointId: '0200000439', peppolSchemeId: '0208' } })
    expect(changedBillingResponse.statusCode).toBe(200)
    const changedDocumentDeliveryResponse = await app.inject({ method: 'POST', url: `/api/sales-invoices/${salesInvoiceResponse.json().invoice.id}/peppol-delivery` })
    expect(changedDocumentDeliveryResponse.statusCode).toBe(409)
    expect(changedDocumentDeliveryResponse.json().message).toContain('huidige factuurversie')
    const restoredBillingResponse = await app.inject({ method: 'PATCH', url: `/api/organizations/${createdOrganization.id}/billing-profile`, payload: { vatNumber: 'BE0200000439', addressLine: 'Koning Albert II-laan 20', postalCode: '1000', city: 'Brussel', countryCode: 'BE', peppolEndpointId: '0200000439', peppolSchemeId: '0208' } })
    expect(restoredBillingResponse.statusCode).toBe(200)
    const deliveryResponse = await app.inject({ method: 'POST', url: `/api/sales-invoices/${salesInvoiceResponse.json().invoice.id}/peppol-delivery` })
    expect(deliveryResponse.statusCode).toBe(201)
    expect(deliveryResponse.json()).toMatchObject({ invoiceId: salesInvoiceResponse.json().invoice.id, validationReportId: externalValidationId, status: 'Geaccepteerd', provider: 'Test Accesspoint', providerReference: 'AP-2027-0001', attempts: 1 })
    const duplicateDeliveryResponse = await app.inject({ method: 'POST', url: `/api/sales-invoices/${salesInvoiceResponse.json().invoice.id}/peppol-delivery` })
    expect(duplicateDeliveryResponse.statusCode).toBe(200)
    expect(duplicateDeliveryResponse.json()).toMatchObject({ id: deliveryResponse.json().id, attempts: 1 })
    const unauthorizedWebhookResponse = await app.inject({ method: 'POST', url: `/api/integrations/peppol/webhook/${deliveryResponse.json().id}`, payload: { eventId: 'evt-delivered-1', trackingId: 'AP-2027-0001', status: 'delivered' } })
    expect(unauthorizedWebhookResponse.statusCode).toBe(401)
    const failedWebhookResponse = await app.inject({ method: 'POST', url: `/api/integrations/peppol/webhook/${deliveryResponse.json().id}`, headers: { authorization: 'Bearer test-webhook-secret' }, payload: { eventId: 'evt-failed-1', trackingId: 'AP-2027-0001', status: 'failed', provider: 'Test Accesspoint', message: 'Tijdelijke AS4-transportfout' } })
    expect(failedWebhookResponse.statusCode).toBe(200)
    expect(failedWebhookResponse.json().status).toBe('Fout')
    const alertBootstrapResponse = await app.inject({ method: 'GET', url: '/api/bootstrap' })
    const peppolAlert = alertBootstrapResponse.json().peppolAlerts[0]
    expect(peppolAlert).toMatchObject({ deliveryId: deliveryResponse.json().id, invoiceId: salesInvoiceResponse.json().invoice.id, type: 'Verzending mislukt', severity: 'Hoog', status: 'Open', message: 'Tijdelijke AS4-transportfout' })
    expect(alertBootstrapResponse.json().peppolNotifications).toEqual(expect.arrayContaining([
      expect.objectContaining({ alertId: peppolAlert.id, channel: 'E-mail', destination: 'peppol-alerts@example.be', kind: 'Nieuwe waarschuwing', status: 'In wachtrij', attempts: 0 }),
      expect.objectContaining({ alertId: peppolAlert.id, channel: 'Teams', destination: 'Directie', kind: 'Nieuwe waarschuwing', status: 'In wachtrij', attempts: 0 }),
    ]))
    const notificationRepository = new BouwFlowRepository(pool, new MemoryObjectStorage(), [{ channel: 'E-mail', destination: 'finance@example.be' }, { channel: 'Teams', destination: 'Financiën' }])
    const initialNotifications = alertBootstrapResponse.json().peppolNotifications
    await notificationRepository.markPeppolNotificationSent(initialNotifications.find((notification: { channel: string }) => notification.channel === 'E-mail').id)
    await notificationRepository.markPeppolNotificationFailed(initialNotifications.find((notification: { channel: string }) => notification.channel === 'Teams').id, 'Teams-connector tijdelijk niet beschikbaar')
    await pool.query("UPDATE peppol_alerts SET severity='Kritiek' WHERE id=$1", [peppolAlert.id])
    expect(await notificationRepository.enqueueCriticalPeppolEscalations(new Date(Date.now() + 120_000).toISOString())).toBe(2)
    expect(await notificationRepository.enqueueCriticalPeppolEscalations(new Date(Date.now() + 120_000).toISOString())).toBe(0)
    const acknowledgeAlertResponse = await app.inject({ method: 'POST', url: `/api/peppol-alerts/${peppolAlert.id}/acknowledge` })
    expect(acknowledgeAlertResponse.statusCode).toBe(200)
    expect(acknowledgeAlertResponse.json()).toMatchObject({ id: peppolAlert.id, status: 'In behandeling', acknowledgedAt: expect.any(String), acknowledgedBy: expect.any(String) })
    const duplicateAcknowledgeResponse = await app.inject({ method: 'POST', url: `/api/peppol-alerts/${peppolAlert.id}/acknowledge` })
    expect(duplicateAcknowledgeResponse.json().status).toBe('In behandeling')
    const mismatchedWebhookResponse = await app.inject({ method: 'POST', url: `/api/integrations/peppol/webhook/${deliveryResponse.json().id}`, headers: { authorization: 'Bearer test-webhook-secret' }, payload: { eventId: 'evt-wrong-reference', trackingId: 'AP-OTHER', status: 'delivered' } })
    expect(mismatchedWebhookResponse.statusCode).toBe(409)
    const webhookPayload = { eventId: 'evt-delivered-1', trackingId: 'AP-2027-0001', status: 'delivered', provider: 'Test Accesspoint', message: 'Aflevering via webhook bevestigd' }
    const webhookResponse = await app.inject({ method: 'POST', url: `/api/integrations/peppol/webhook/${deliveryResponse.json().id}`, headers: { authorization: 'Bearer test-webhook-secret' }, payload: webhookPayload })
    expect(webhookResponse.statusCode).toBe(200)
    expect(webhookResponse.json()).toEqual({ accepted: true, deliveryId: deliveryResponse.json().id, status: 'Afgeleverd' })
    const duplicateWebhookResponse = await app.inject({ method: 'POST', url: `/api/integrations/peppol/webhook/${deliveryResponse.json().id}`, headers: { authorization: 'Bearer test-webhook-secret' }, payload: webhookPayload })
    expect(duplicateWebhookResponse.statusCode).toBe(200)
    const lateWebhookResponse = await app.inject({ method: 'POST', url: `/api/integrations/peppol/webhook/${deliveryResponse.json().id}`, headers: { authorization: 'Bearer test-webhook-secret' }, payload: { ...webhookPayload, eventId: 'evt-late-accepted', status: 'accepted' } })
    expect(lateWebhookResponse.json().status).toBe('Afgeleverd')
    const deliveryStatusResponse = await app.inject({ method: 'POST', url: `/api/sales-invoices/${salesInvoiceResponse.json().invoice.id}/peppol-status` })
    expect(deliveryStatusResponse.statusCode).toBe(200)
    expect(deliveryStatusResponse.json()).toMatchObject({ id: deliveryResponse.json().id, status: 'Afgeleverd', attempts: 1, deliveredAt: expect.any(String) })
    const invalidEndpointResponse = await app.inject({ method: 'PATCH', url: `/api/organizations/${createdOrganization.id}/billing-profile`, payload: { vatNumber: 'BE0200000439', addressLine: 'Koning Albert II-laan 20', postalCode: '1000', city: 'Brussel', countryCode: 'BE', peppolEndpointId: '0200000438', peppolSchemeId: '0208' } })
    expect(invalidEndpointResponse.statusCode).toBe(400)
    const intercompanyResponse = await app.inject({ method: 'POST', url: '/api/intercompany-charges', payload: { fromLegalEntityId: DEVELOPMENT_SERVICE_ENTITY_ID, toLegalEntityId: legalEntityResponse.json().id, projectId: awardedProject.id, description: 'Machine-uren mobiele kraan', baseAmount: 4000, markupPct: 5 } })
    expect(intercompanyResponse.statusCode).toBe(201)
    expect(intercompanyResponse.json()).toMatchObject({ number: 'IC-2026-0001', totalAmount: 4200, status: 'Concept' })
    const approvedIntercompany = await app.inject({ method: 'POST', url: `/api/intercompany-charges/${intercompanyResponse.json().id}/approve` })
    expect(approvedIntercompany.json()).toMatchObject({ status: 'Goedgekeurd', approvedAt: expect.any(String) })
    const postedIntercompany = await app.inject({ method: 'POST', url: `/api/intercompany-charges/${intercompanyResponse.json().id}/post` })
    expect(postedIntercompany.json()).toMatchObject({ status: 'Geboekt', postedAt: expect.any(String) })
    const financialBootstrap = await app.inject({ method: 'GET', url: '/api/bootstrap' })
    expect(financialBootstrap.json().intercompanyCharges).toEqual([expect.objectContaining({ id: intercompanyResponse.json().id, status: 'Geboekt' })])
    expect(financialBootstrap.json().peppolValidationReports).toEqual(expect.arrayContaining([expect.objectContaining({ invoiceId: salesInvoiceResponse.json().invoice.id, status: 'Geslaagd', source: 'Preflight' }), expect.objectContaining({ id: externalValidationId, source: 'Extern', networkReady: true })]))
    expect(financialBootstrap.json().peppolDeliveries).toEqual([expect.objectContaining({ id: deliveryResponse.json().id, status: 'Afgeleverd', providerReference: 'AP-2027-0001', events: expect.arrayContaining([expect.objectContaining({ providerEventId: 'evt-delivered-1' })]) })])
    expect(financialBootstrap.json().peppolDeliveries[0].events.filter((event: { providerEventId?: string }) => event.providerEventId === 'evt-delivered-1')).toHaveLength(1)
    expect(financialBootstrap.json().peppolAlerts).toEqual([expect.objectContaining({ id: peppolAlert.id, status: 'Opgelost', resolvedAt: expect.any(String) })])
    expect(financialBootstrap.json().peppolNotificationSettings).toMatchObject({ emailRecipients: ['peppol-alerts@example.be'], teamsTargets: ['Directie'], criticalSlaMinutes: 1 })
    expect(financialBootstrap.json().peppolNotifications).toEqual(expect.arrayContaining([
      expect.objectContaining({ channel: 'E-mail', kind: 'Nieuwe waarschuwing', status: 'Verzonden', attempts: 1 }),
      expect.objectContaining({ channel: 'Teams', kind: 'Nieuwe waarschuwing', status: 'Geannuleerd', attempts: 1 }),
      expect.objectContaining({ channel: 'E-mail', kind: 'SLA-escalatie', status: 'Geannuleerd', attempts: 0 }),
      expect.objectContaining({ channel: 'Teams', kind: 'SLA-escalatie', status: 'Geannuleerd', attempts: 0 }),
    ]))
  }, 20_000)

  it('verwijdert een meetstaatpost binnen de juiste calculatie', async () => {
    const opportunity = (await app.inject({ method: 'POST', url: '/api/opportunities', payload: { title: 'Tijdelijke calculatie', organizationId, location: 'Leuven', deadline: '2027-01-01', estimatedValue: 10000, probability: 20, recognition: '' } })).json()
    await approveOpportunity(app, opportunity.id)
    const calculation = (await app.inject({ method: 'POST', url: `/api/opportunities/${opportunity.id}/calculations` })).json()
    const item = (await app.inject({ method: 'POST', url: `/api/calculations/${calculation.id}/items`, payload: { code: 'T.01', description: 'Tijdelijke post', quantity: 1, unit: 'st', labor: 1, material: 0, equipment: 0, subcontracting: 0 } })).json()

    const response = await app.inject({ method: 'DELETE', url: `/api/calculations/${calculation.id}/items/${item.id}` })

    expect(response.statusCode).toBe(204)
    const state = (await app.inject({ method: 'GET', url: '/api/bootstrap' })).json()
    expect(state.calculations[0].items).toEqual([])
  })

  it('controleert en importeert een meetstaat en legt daarna een calculatieversie vast', async () => {
    const opportunity = (await app.inject({ method: 'POST', url: '/api/opportunities', payload: { title: 'Importwerf', organizationId, location: 'Mechelen', deadline: '2027-02-01', estimatedValue: 250000, probability: 35, recognition: 'C4' } })).json()
    await approveOpportunity(app, opportunity.id)
    const calculation = (await app.inject({ method: 'POST', url: `/api/opportunities/${opportunity.id}/calculations` })).json()
    const csv = [
      'Hoofdstuk;Hoofdstuknaam;Code;Omschrijving;Hoeveelheid;Eenheid;Arbeid;Materiaal;Materieel;Onderaanneming',
      '01;Grondwerken;01.01;Uitgraving;1.234,5;m3;2,5;4;1,25;0',
      '02;Riolering;02.01;PVC leiding;80;m;3;12,75;2;4',
    ].join('\n')

    const previewResponse = await app.inject({ method: 'POST', url: `/api/calculations/${calculation.id}/import/preview`, ...multipartCsv(csv) })
    expect(previewResponse.statusCode).toBe(200)
    expect(previewResponse.json()).toMatchObject({ chapterCount: 2, validRowCount: 2, errors: [] })

    const importResponse = await app.inject({ method: 'POST', url: `/api/calculations/${calculation.id}/import`, ...multipartCsv(csv) })
    expect(importResponse.statusCode).toBe(201)
    expect(importResponse.json().chapters).toHaveLength(2)
    expect(importResponse.json().items[0]).toMatchObject({ code: '01.01', quantity: 1234.5 })

    const versionResponse = await app.inject({
      method: 'POST', url: `/api/calculations/${calculation.id}/versions`,
      payload: { label: 'Inschrijvingsversie', reason: 'Na controle van de geïmporteerde meetstaat' },
    })
    expect(versionResponse.statusCode).toBe(201)
    expect(versionResponse.json()).toMatchObject({ version: 1, label: 'Inschrijvingsversie' })
    expect(versionResponse.json().snapshot.items).toHaveLength(2)

    const state = (await app.inject({ method: 'GET', url: '/api/bootstrap' })).json()
    expect(state.calculationVersions).toHaveLength(1)
    expect(state.calculations[0].chapters).toHaveLength(2)
  })

  it('beheert een kostprijs en past die met een traceerbare verbruiksfactor toe', async () => {
    const libraryResponse = await app.inject({
      method: 'POST', url: '/api/cost-library', headers: { 'x-user-roles': 'Aankoper' },
      payload: { code: 'MAT-TST', name: 'Proefmateriaal', category: 'material', unit: 'kg', unitCost: 12.5, source: 'Testleverancier' },
    })
    expect(libraryResponse.statusCode).toBe(201)
    const libraryItem = libraryResponse.json()

    const updateResponse = await app.inject({ method: 'PATCH', url: `/api/cost-library/${libraryItem.id}`, payload: { unitCost: 13 } })
    expect(updateResponse.statusCode).toBe(200)
    expect(updateResponse.json().unitCost).toBe(13)

    const opportunity = (await app.inject({ method: 'POST', url: '/api/opportunities', payload: { title: 'Normcalculatie', organizationId, location: 'Hasselt', deadline: '2027-03-01', estimatedValue: 50000, probability: 25, recognition: '' } })).json()
    await approveOpportunity(app, opportunity.id)
    const calculation = (await app.inject({ method: 'POST', url: `/api/opportunities/${opportunity.id}/calculations` })).json()
    const item = (await app.inject({ method: 'POST', url: `/api/calculations/${calculation.id}/items`, payload: { code: 'N.01', description: 'Post met materiaalnorm', quantity: 10, unit: 'm²', labor: 0, material: 0, equipment: 0, subcontracting: 0 } })).json()

    const applyResponse = await app.inject({ method: 'POST', url: `/api/calculations/${calculation.id}/items/${item.id}/cost-library/${libraryItem.id}`, payload: { factor: 1.2 } })
    expect(applyResponse.statusCode).toBe(200)
    expect(applyResponse.json()).toMatchObject({ material: 15.6, costApplications: { material: { libraryItemId: libraryItem.id, factor: 1.2, appliedUnitCost: 15.6 } } })

    const manualResponse = await app.inject({ method: 'PATCH', url: `/api/calculations/${calculation.id}/items/${item.id}`, payload: { material: 16 } })
    expect(manualResponse.statusCode).toBe(200)
    expect(manualResponse.json().material).toBe(16)
    expect(manualResponse.json().costApplications.material).toBeUndefined()

    const state = (await app.inject({ method: 'GET', url: '/api/bootstrap' })).json()
    expect(state.costLibrary).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'MAT-TST', unitCost: 13 })]))
  })

  it('beheert meerdere kostenbibliotheken met kloonbare en publiceerbare versies', async () => {
    const libraryResponse = await app.inject({ method: 'POST', url: '/api/cost-libraries', payload: { name: 'Regio Antwerpen', description: 'Raamcontracten en regionale prijzen' } })
    expect(libraryResponse.statusCode).toBe(201)
    const { library, version } = libraryResponse.json()
    expect(version).toMatchObject({ libraryId: library.id, version: 1, status: 'Concept' })

    const itemResponse = await app.inject({ method: 'POST', url: '/api/cost-library', payload: { libraryVersionId: version.id, code: 'ANT-MAT-01', name: 'Gestabiliseerd zand', category: 'material', unit: 'ton', unitCost: 31.5, source: 'Raamcontract Antwerpen' } })
    expect(itemResponse.statusCode).toBe(201)
    const published = await app.inject({ method: 'POST', url: `/api/cost-library-versions/${version.id}/publish` })
    expect(published.json().status).toBe('Gepubliceerd')

    const cloned = await app.inject({ method: 'POST', url: `/api/cost-libraries/${library.id}/versions`, payload: { label: 'Prijsniveau 2028', effectiveFrom: '2028-01-01', cloneFromVersionId: version.id } })
    expect(cloned.statusCode, cloned.body).toBe(201)
    expect(cloned.json().version).toMatchObject({ version: 2, status: 'Concept', label: 'Prijsniveau 2028' })
    expect(cloned.json().items).toEqual([expect.objectContaining({ libraryVersionId: cloned.json().version.id, code: 'ANT-MAT-01', unitCost: 31.5 })])

    const bootstrap = (await app.inject({ method: 'GET', url: '/api/bootstrap' })).json()
    expect(bootstrap.costLibraries).toEqual(expect.arrayContaining([expect.objectContaining({ id: library.id, name: 'Regio Antwerpen' })]))
    expect(bootstrap.costLibraryVersions.filter((entry: { libraryId: string }) => entry.libraryId === library.id)).toHaveLength(2)
  })

  it('beheert eenheden, conversies en actieve kostenbibliotheken', async () => {
    const meter = await app.inject({ method: 'POST', url: '/api/units', payload: { code: 'lm-test', name: 'Lopende meter test', category: 'Lengte', active: true } })
    const centimeter = await app.inject({ method: 'POST', url: '/api/units', payload: { code: 'cm-test', name: 'Centimeter test', category: 'Lengte', active: true } })
    expect(meter.statusCode, meter.body).toBe(201)
    expect(centimeter.statusCode, centimeter.body).toBe(201)

    const conversion = await app.inject({ method: 'POST', url: '/api/unit-conversions', payload: { fromUnitId: meter.json().id, toUnitId: centimeter.json().id, factor: 100 } })
    expect(conversion.statusCode, conversion.body).toBe(201)
    expect(conversion.json()).toMatchObject({ fromUnitId: meter.json().id, toUnitId: centimeter.json().id, factor: 100 })

    const scopeState = (await app.inject({ method: 'GET', url: '/api/bootstrap' })).json()
    const entity = scopeState.legalEntities[0]
    const branch = scopeState.companyBranches.find((item: { legalEntityId: string }) => item.legalEntityId === entity.id)
    const scopedLibrary = await app.inject({ method: 'POST', url: '/api/cost-libraries', payload: { name: 'Vestigingsprijzen test', description: 'Lokale raamcontracten', legalEntityId: entity.id, branchId: branch.id } })
    expect(scopedLibrary.statusCode, scopedLibrary.body).toBe(201)
    expect(scopedLibrary.json().library).toMatchObject({ legalEntityId: entity.id, branchId: branch.id, active: true })

    const centralLibrary = (await app.inject({ method: 'POST', url: '/api/cost-libraries', payload: { name: 'Testbibliotheek actiefbeheer', description: 'Test' } })).json().library
    const deactivated = await app.inject({ method: 'PATCH', url: `/api/cost-libraries/${centralLibrary.id}`, payload: { active: false } })
    expect(deactivated.statusCode, deactivated.body).toBe(200)
    expect(deactivated.json().active).toBe(false)
    const bootstrap = (await app.inject({ method: 'GET', url: '/api/bootstrap' })).json()
    expect(bootstrap.unitConversions).toEqual(expect.arrayContaining([expect.objectContaining({ factor: 100 })]))
  })

  it('past een klasse-8-structuur toe en herschikt hoofdstukken en posten atomair', async () => {
    const opportunity = (await app.inject({ method: 'POST', url: '/api/opportunities', payload: { title: 'Klasse-8-calculatie', organizationId, location: 'Antwerpen', deadline: '2028-02-01', estimatedValue: 25_000_000, probability: 60, recognition: 'D8' } })).json()
    await approveOpportunity(app, opportunity.id)
    const calculation = (await app.inject({ method: 'POST', url: `/api/opportunities/${opportunity.id}/calculations` })).json()
    const template = { id: 'klasse8-test-v1', name: 'Klasse 8 test', description: 'Teststructuur', discipline: 'Infrastructuur', recognitionClass: 'Klasse 8', version: 1, chapters: [
      { code: '01', name: 'Voorbereiding', items: [{ code: '01.01', description: 'Werfinrichting', quantity: 1, unit: 'GP', labor: 10, material: 0, equipment: 5, subcontracting: 0, quantityType: 'Forfaitair' }] },
      { code: '02', name: 'Uitvoering', items: [{ code: '02.01', description: 'Uitvoeringspost', quantity: 100, unit: 'm', labor: 2, material: 3, equipment: 1, subcontracting: 0, quantityType: 'Verrekenbaar' }] },
    ] }
    const templated = await app.inject({ method: 'POST', url: `/api/calculations/${calculation.id}/templates`, payload: template })
    expect(templated.statusCode).toBe(200)
    expect(templated.json().chapters).toHaveLength(2)
    expect(templated.json().items).toHaveLength(2)

    const [firstChapter, secondChapter] = templated.json().chapters
    const [firstItem, secondItem] = templated.json().items
    const structure = await app.inject({ method: 'PUT', url: `/api/calculations/${calculation.id}/structure`, payload: { chapters: [{ id: secondChapter.id, sortOrder: 0 }, { id: firstChapter.id, sortOrder: 1 }], items: [{ id: secondItem.id, chapterId: firstChapter.id, sortOrder: 0 }, { id: firstItem.id, chapterId: firstChapter.id, sortOrder: 1 }] } })
    expect(structure.statusCode).toBe(200)
    expect(structure.json().chapters[0].id).toBe(secondChapter.id)
    expect(structure.json().items).toEqual([expect.objectContaining({ id: secondItem.id, chapterId: firstChapter.id, sortOrder: 0 }), expect.objectContaining({ id: firstItem.id, sortOrder: 1 })])

    const advanced = await app.inject({ method: 'PATCH', url: `/api/calculations/${calculation.id}/items/${firstItem.id}`, payload: { wastePct: 7.5, itemRiskPct: 4, markupPct: 3, notes: 'Risicopost' } })
    expect(advanced.json()).toMatchObject({ wastePct: 7.5, itemRiskPct: 4, markupPct: 3, notes: 'Risicopost' })
  })

  it('vergelijkt scenario’s en gebruikt het gekozen scenario voor offerte en gunning', async () => {
    const opportunity = (await app.inject({ method: 'POST', url: '/api/opportunities', payload: { title: 'Scenariowerf', organizationId, location: 'Genk', deadline: '2027-04-01', estimatedValue: 75000, probability: 40, recognition: '' } })).json()
    await approveOpportunity(app, opportunity.id)
    const calculation = (await app.inject({ method: 'POST', url: `/api/opportunities/${opportunity.id}/calculations` })).json()
    await app.inject({ method: 'POST', url: `/api/calculations/${calculation.id}/items`, payload: { code: 'S.01', description: 'Scenario meetstaatpost', quantity: 100, unit: 'm²', labor: 10, material: 20, equipment: 5, subcontracting: 0 } })

    const presetsResponse = await app.inject({ method: 'POST', url: `/api/calculations/${calculation.id}/scenarios/presets` })
    expect(presetsResponse.statusCode).toBe(201)
    expect(presetsResponse.json()).toHaveLength(3)
    expect(presetsResponse.json().filter((scenario: { isSelected: boolean }) => scenario.isSelected)).toHaveLength(1)
    const conservative = presetsResponse.json().find((scenario: { name: string }) => scenario.name === 'Conservatief')

    const updateResponse = await app.inject({ method: 'PATCH', url: `/api/calculations/${calculation.id}/scenarios/${conservative.id}`, payload: { materialAdjustmentPct: 20, riskPct: 8 } })
    expect(updateResponse.statusCode).toBe(200)
    expect(updateResponse.json()).toMatchObject({ materialAdjustmentPct: 20, riskPct: 8 })

    const selectResponse = await app.inject({ method: 'POST', url: `/api/calculations/${calculation.id}/scenarios/${conservative.id}/select` })
    expect(selectResponse.statusCode).toBe(200)
    expect(selectResponse.json().isSelected).toBe(true)

    const quoteResponse = await app.inject({ method: 'POST', url: `/api/calculations/${calculation.id}/quotes` })
    expect(quoteResponse.statusCode).toBe(201)
    expect(quoteResponse.json().scenarioId).toBe(conservative.id)
    expect(quoteResponse.json().total).toBeCloseTo(5194.22, 1)
    expect(quoteResponse.json().snapshot).toMatchObject({ scenarioName: 'Conservatief', riskPct: 8, total: 5194.22 })

    const awardResponse = await app.inject({ method: 'POST', url: `/api/calculations/${calculation.id}/award` })
    expect(awardResponse.statusCode).toBe(201)
    expect(awardResponse.json()).toMatchObject({ contractValue: 5194.22, marginPct: 10 })

    const state = (await app.inject({ method: 'GET', url: '/api/bootstrap' })).json()
    expect(state.calculationScenarios.filter((scenario: { calculationId: string; isSelected: boolean }) => scenario.calculationId === calculation.id && scenario.isSelected)).toEqual([expect.objectContaining({ id: conservative.id })])
    expect(state.quotes[0].scenarioId).toBe(conservative.id)
  })

  it('isoleert gegevens per tenant', async () => {
    const secondTenant = '20000000-0000-4000-8000-000000000001'
    const secondUser = '20000000-0000-4000-8000-000000000002'
    await pool.query('INSERT INTO tenants (id,name) VALUES ($1,$2)', [secondTenant, 'Tweede aannemer'])
    await pool.query(`INSERT INTO users (tenant_id,id,display_name,email,role) VALUES ($1,$2,$3,$4,$5)`, [secondTenant, secondUser, 'Andere gebruiker', 'ander@example.be', 'Administrator'])
    await pool.query(`INSERT INTO organizations (tenant_id,id,name,type,contact_name,email) VALUES ($1,$2,$3,$4,$5,$6)`, [secondTenant, '20000000-0000-4000-8000-000000000003', 'Andere klant', 'Privaat', 'Contact', 'contact@example.be'])

    const defaultState = await app.inject({ method: 'GET', url: '/api/bootstrap' })
    expect(defaultState.json().organizations).toHaveLength(3)

    const secondState = await app.inject({ method: 'GET', url: '/api/bootstrap', headers: { 'x-tenant-id': secondTenant, 'x-user-id': secondUser } })
    expect(secondState.json().organizations).toEqual([expect.objectContaining({ name: 'Andere klant' })])
    expect(secondState.json().legalEntities).toEqual([])
    expect(secondState.json().companyBranches).toEqual([])
    expect(secondState.json().opportunities).toEqual([])
    expect(secondState.json().costLibrary).toEqual([])
    expect(secondState.json().calculationScenarios).toEqual([])
    expect(secondState.json().dailyReports).toEqual([])
    expect(secondState.json().sitePhotos).toEqual([])
    expect(secondState.json().changeOrders).toEqual([])
    expect(secondState.json().progressStatements).toEqual([])
    expect(secondState.json().salesInvoices).toEqual([])
    expect(secondState.json().projectCosts).toEqual([])
    expect(secondState.json().projectForecasts).toEqual([])
    expect(secondState.json().suppliers).toEqual([])
    expect(secondState.json().procurementRequests).toEqual([])
    expect(secondState.json().purchaseOrders).toEqual([])
    expect(secondState.json().documents).toEqual([])
    expect(secondState.json().qhseCertificates).toEqual([])
    expect(secondState.json().qhseInspections).toEqual([])
  })

  it('beperkt Peppol-tests tot de kanalen van een gedeeltelijk geconfigureerde connector', async () => {
    await app.close()
    const emailOnlySender = {
      configuredChannels: ['E-mail'] as const,
      send: vi.fn(async () => undefined),
    }
    app = await buildApp({
      pool,
      objectStorage: new MemoryObjectStorage(),
      peppolNotificationTargets: [{ channel: 'E-mail', destination: 'finance@example.be' }, { channel: 'Teams', destination: 'Financiën' }],
      peppolNotificationSender: emailOnlySender,
      peppolNotificationDispatchIntervalMs: 0,
    })

    const settingsResponse = await app.inject({ method: 'GET', url: '/api/bootstrap' })
    expect(settingsResponse.json().peppolNotificationSettings).toMatchObject({ connectorConfigured: true, connectorChannels: ['E-mail'] })
    expect(settingsResponse.json().peppolNotificationSettings.integrationChecks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'validator', ready: false }),
      expect.objectContaining({ id: 'access-point', ready: false }),
      expect.objectContaining({ id: 'notification-connector', ready: true, detail: expect.stringContaining('E-mail') }),
      expect.objectContaining({ id: 'notification-dispatcher', ready: false }),
    ]))

    const teamsResponse = await app.inject({ method: 'POST', url: '/api/settings/peppol-notifications/test', payload: { channel: 'Teams', destination: 'Financiën' } })
    expect(teamsResponse.statusCode).toBe(409)
    expect(teamsResponse.json().message).toContain('Teams is niet geconfigureerd')
    expect(emailOnlySender.send).not.toHaveBeenCalled()

    const emailResponse = await app.inject({ method: 'POST', url: '/api/settings/peppol-notifications/test', payload: { channel: 'E-mail', destination: 'finance@example.be' } })
    expect(emailResponse.statusCode).toBe(200)
    expect(emailOnlySender.send).toHaveBeenCalledOnce()
  })

  it('legt een volledige Peppol-acceptatierun vast en voltooit die via de providerwebhook', async () => {
    await app.close()
    const acceptanceAccessPoint = {
      configured: true,
      send: vi.fn(async () => ({ status: 'Geaccepteerd' as const, provider: 'Acceptatie AP', providerReference: 'ACC-7788', message: 'Testfactuur door het accesspoint geaccepteerd' })),
      status: vi.fn(async () => ({ status: 'Afgeleverd' as const, provider: 'Acceptatie AP', providerReference: 'ACC-7788', message: 'Testfactuur afgeleverd' })),
    }
    const acceptanceStorage = new MemoryObjectStorage()
    app = await buildApp({
      pool,
      objectStorage: acceptanceStorage,
      peppolValidator: {
        networkReady: true,
        validate: async () => ({ status: 'Geslaagd', source: 'Extern', engine: 'Acceptatie Schematron', profile: 'Peppol BIS Billing 3.0 / UBL 2.1', networkReady: true, issues: [] }),
      },
      peppolAccessPoint: acceptanceAccessPoint,
      peppolWebhookSecret: 'acceptance-webhook-secret',
      peppolWebhookPublicUrl: 'https://bouwflow.example/api/integrations/peppol/webhook',
      peppolStatusPollIntervalMs: 60_000,
      peppolNotificationSender: { configuredChannels: ['E-mail', 'Teams'], send: async () => undefined },
      peppolNotificationTargets: [{ channel: 'E-mail', destination: 'finance@example.be' }],
      peppolNotificationDispatchIntervalMs: 60_000,
    })

    const initialState = (await app.inject({ method: 'GET', url: '/api/bootstrap' })).json()
    expect(initialState.peppolNotificationSettings.productionGate).toEqual({ released: false })
    const entity = initialState.legalEntities.find((item: { id: string }) => item.id === DEVELOPMENT_LEGAL_ENTITY_ID)
    await app.inject({ method: 'PATCH', url: `/api/legal-entities/${entity.id}/financial-settings`, payload: { vatNumber: entity.vatNumber, invoicePrefix: 'ACC', nextInvoiceNumber: 1, defaultVatPct: 21, iban: 'BE68539007547034', bic: 'GEBABEBB', paymentTermsDays: 30, addressLine: 'Testlaan 1', postalCode: '3500', city: 'Hasselt', countryCode: 'BE', peppolEndpointId: '0123456749', peppolSchemeId: '0208' } })
    await app.inject({ method: 'PATCH', url: `/api/organizations/${organizationId}/billing-profile`, payload: { vatNumber: 'BE0200000043', addressLine: 'Wetstraat 1', postalCode: '1000', city: 'Brussel', countryCode: 'BE', peppolEndpointId: '0200000043', peppolSchemeId: '0208' } })
    const opportunity = (await app.inject({ method: 'POST', url: '/api/opportunities', payload: { title: 'Peppol acceptatiewerf', organizationId, location: 'Brussel', deadline: '2027-06-01', estimatedValue: 50000, probability: 80, recognition: '' } })).json()
    await approveOpportunity(app, opportunity.id)
    const calculation = (await app.inject({ method: 'POST', url: `/api/opportunities/${opportunity.id}/calculations` })).json()
    const chapter = (await app.inject({ method: 'POST', url: `/api/calculations/${calculation.id}/chapters`, payload: { code: 'A', name: 'Acceptatiewerken' } })).json()
    await app.inject({ method: 'POST', url: `/api/calculations/${calculation.id}/items`, payload: { chapterId: chapter.id, code: 'A.01', description: 'Acceptatiepost', quantity: 10, unit: 'st', labor: 100, material: 50, equipment: 0, subcontracting: 0 } })
    await app.inject({ method: 'POST', url: `/api/calculations/${calculation.id}/quotes`, payload: { subject: 'Peppol-acceptatie', introduction: 'Gecontroleerde testofferte.', executionTerm: '1 werkdag', paymentTerms: '30 dagen', validityDays: 30, priceRevision: 'Niet van toepassing', exclusions: [], notes: '' } })
    const project = (await app.inject({ method: 'POST', url: `/api/calculations/${calculation.id}/award` })).json()
    const statement = (await app.inject({ method: 'POST', url: `/api/projects/${project.id}/progress-statements`, payload: { periodStart: '2027-05-01', periodEnd: '2027-05-31', lines: [{ workPackageId: project.workPackages[0].id, cumulativeProgressPct: 100 }], changeOrderIds: [], priceRevisionAmount: 0, retentionPct: 0, notes: 'Gecontroleerde Peppol-acceptatie.' } })).json()
    await app.inject({ method: 'POST', url: `/api/progress-statements/${statement.id}/submit` })
    await app.inject({ method: 'POST', url: `/api/progress-statements/${statement.id}/approve`, payload: { approvedBy: 'Acceptatiebeheerder' } })
    const invoice = (await app.inject({ method: 'POST', url: `/api/progress-statements/${statement.id}/invoice`, payload: { invoiceDate: '2027-06-01' } })).json().invoice
    await app.inject({ method: 'POST', url: `/api/sales-invoices/${invoice.id}/issue`, payload: { issuedBy: 'Acceptatiebeheerder' } })

    const missingConfirmation = await app.inject({ method: 'POST', url: `/api/sales-invoices/${invoice.id}/peppol-acceptance`, payload: { confirmNetworkSend: false } })
    expect(missingConfirmation.statusCode).toBe(400)
    const acceptanceResponse = await app.inject({ method: 'POST', url: `/api/sales-invoices/${invoice.id}/peppol-acceptance`, payload: { confirmNetworkSend: true } })
    expect(acceptanceResponse.statusCode).toBe(201)
    expect(acceptanceResponse.json().run).toMatchObject({ invoiceId: invoice.id, status: 'In opvolging', validationReportId: expect.any(String), deliveryId: expect.any(String), steps: [expect.objectContaining({ id: 'configuration', status: 'Geslaagd' }), expect.objectContaining({ id: 'validation', status: 'Geslaagd' }), expect.objectContaining({ id: 'submission', status: 'Geslaagd' }), expect.objectContaining({ id: 'delivery', status: 'In afwachting' })] })
    expect(acceptanceAccessPoint.send).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: expect.any(String), callbackUrl: expect.stringContaining(acceptanceResponse.json().run.deliveryId) }))
    const blockedProductionSend = await app.inject({ method: 'POST', url: `/api/sales-invoices/${invoice.id}/peppol-delivery` })
    expect(blockedProductionSend.statusCode).toBe(409)
    expect(blockedProductionSend.json().message).toContain('geslaagde acceptatierun vrij')
    const prematureRelease = await app.inject({ method: 'POST', url: `/api/peppol-acceptance-runs/${acceptanceResponse.json().run.id}/release`, payload: { releasedBy: 'Directie', notes: 'Nog niet afgeleverd.' } })
    expect(prematureRelease.statusCode).toBe(409)

    const webhookResponse = await app.inject({ method: 'POST', url: `/api/integrations/peppol/webhook/${acceptanceResponse.json().run.deliveryId}`, headers: { authorization: 'Bearer acceptance-webhook-secret' }, payload: { eventId: 'acceptance-delivered-1', trackingId: 'ACC-7788', status: 'delivered', provider: 'Acceptatie AP', message: 'Acceptatiefactuur afgeleverd' } })
    expect(webhookResponse.statusCode).toBe(200)
    const completedState = (await app.inject({ method: 'GET', url: '/api/bootstrap' })).json()
    expect(completedState.peppolAcceptanceRuns).toEqual([expect.objectContaining({ id: acceptanceResponse.json().run.id, status: 'Geslaagd', completedAt: expect.any(String), steps: expect.arrayContaining([expect.objectContaining({ id: 'delivery', status: 'Geslaagd', reference: 'ACC-7788' })]) })])
    expect(completedState.peppolNotificationSettings.productionGate).toEqual({ released: false })
    const deniedRelease = await app.inject({ method: 'POST', url: `/api/peppol-acceptance-runs/${acceptanceResponse.json().run.id}/release`, headers: { 'x-user-roles': 'Financiële administratie' }, payload: { releasedBy: 'Financiële administratie', notes: 'Technisch gecontroleerd.' } })
    expect(deniedRelease.statusCode).toBe(403)
    const releaseResponse = await app.inject({ method: 'POST', url: `/api/peppol-acceptance-runs/${acceptanceResponse.json().run.id}/release`, payload: { releasedBy: 'Karel Directie', notes: 'Readiness en netwerkbewijs gecontroleerd voor productievrijgave.' } })
    expect(releaseResponse.statusCode).toBe(200)
    expect(releaseResponse.json()).toMatchObject({ releasedBy: 'Karel Directie', releasedAt: expect.any(String), releaseNotes: expect.stringContaining('netwerkbewijs') })
    const pdfResponse = await app.inject({ method: 'GET', url: `/api/peppol-acceptance-runs/${acceptanceResponse.json().run.id}/pdf` })
    expect(pdfResponse.statusCode).toBe(200)
    expect(pdfResponse.headers['content-type']).toContain('application/pdf')
    expect(pdfResponse.headers['content-disposition']).toContain(`Peppol-acceptatie-${invoice.number}.pdf`)
    expect(pdfResponse.rawPayload.subarray(0, 5).toString()).toBe('%PDF-')
    expect(pdfResponse.rawPayload.length).toBeGreaterThan(2_000)
    const releasedState = (await app.inject({ method: 'GET', url: '/api/bootstrap' })).json()
    expect(releasedState.peppolAcceptanceRuns[0]).toMatchObject({ releasedBy: 'Karel Directie', releasedAt: expect.any(String) })
    expect(releasedState.peppolNotificationSettings.productionGate).toMatchObject({ released: true, runId: acceptanceResponse.json().run.id, releasedBy: 'Karel Directie', releasedAt: expect.any(String) })
    const archivedDocuments = releasedState.documents.filter((document: { peppolAcceptanceRunId?: string }) => document.peppolAcceptanceRunId === acceptanceResponse.json().run.id)
    expect(archivedDocuments).toHaveLength(1)
    expect(archivedDocuments[0]).toMatchObject({ projectId: project.id, legalEntityId: entity.id, salesInvoiceId: invoice.id, title: `Peppol-productievrijgave ${invoice.number}`, category: 'Verslag', status: 'Goedgekeurd', immutable: true, approvedBy: 'Karel Directie', approvedAt: expect.any(String), versions: [expect.objectContaining({ revision: 1, revisionLabel: 'R1', fileName: `Peppol-acceptatie-${invoice.number}.pdf`, mimeType: 'application/pdf', sizeBytes: expect.any(Number), contentDigest: expect.stringMatching(/^[a-f0-9]{64}$/) })] })
    const archivedVersion = archivedDocuments[0].versions[0]
    const archivedPdfResponse = await app.inject({ method: 'GET', url: `/api/document-versions/${archivedVersion.id}/file` })
    expect(archivedPdfResponse.statusCode).toBe(200)
    expect(archivedPdfResponse.headers['content-type']).toContain('application/pdf')
    expect(archivedPdfResponse.rawPayload.subarray(0, 5).toString()).toBe('%PDF-')
    const validIntegrityResponse = await app.inject({ method: 'POST', url: `/api/document-versions/${archivedVersion.id}/verify-integrity` })
    expect(validIntegrityResponse.statusCode).toBe(200)
    expect(validIntegrityResponse.json()).toMatchObject({ versionId: archivedVersion.id, algorithm: 'SHA-256', expectedDigest: archivedVersion.contentDigest, actualDigest: archivedVersion.contentDigest, status: 'Geldig', verifiedAt: expect.any(String) })
    const storageKeyResult = await pool.query<{ storage_key: string }>('SELECT storage_key FROM document_versions WHERE id=$1', [archivedVersion.id])
    await acceptanceStorage.put(storageKeyResult.rows[0].storage_key, Buffer.from('%PDF-gewijzigd-na-archivering'))
    const changedIntegrityResponse = await app.inject({ method: 'POST', url: `/api/document-versions/${archivedVersion.id}/verify-integrity` })
    expect(changedIntegrityResponse.statusCode).toBe(200)
    expect(changedIntegrityResponse.json()).toMatchObject({ versionId: archivedVersion.id, expectedDigest: archivedVersion.contentDigest, actualDigest: expect.stringMatching(/^[a-f0-9]{64}$/), status: 'Gewijzigd' })
    expect(changedIntegrityResponse.json().actualDigest).not.toBe(archivedVersion.contentDigest)
    const immutableRevisionResponse = await app.inject({ method: 'POST', url: `/api/documents/${archivedDocuments[0].id}/revisions`, ...multipartDocument({ notes: 'Mag niet worden aangepast.', uploadedBy: 'Testgebruiker' }, Buffer.from('%PDF-ongewenste-revisie'), 'gewijzigd-bewijs.pdf') })
    expect(immutableRevisionResponse.statusCode).toBe(409)
    expect(immutableRevisionResponse.json().message).toContain('onveranderlijk')
    const duplicateReleaseResponse = await app.inject({ method: 'POST', url: `/api/peppol-acceptance-runs/${acceptanceResponse.json().run.id}/release`, payload: { releasedBy: 'Andere vrijgever', notes: 'Deze retry mag geen tweede document opleveren.' } })
    expect(duplicateReleaseResponse.statusCode).toBe(200)
    const stateAfterDuplicateRelease = (await app.inject({ method: 'GET', url: '/api/bootstrap' })).json()
    expect(stateAfterDuplicateRelease.documents.filter((document: { peppolAcceptanceRunId?: string }) => document.peppolAcceptanceRunId === acceptanceResponse.json().run.id)).toHaveLength(1)
    const allowedProductionSend = await app.inject({ method: 'POST', url: `/api/sales-invoices/${invoice.id}/peppol-delivery` })
    expect(allowedProductionSend.statusCode).toBe(200)
    expect(allowedProductionSend.json()).toMatchObject({ id: acceptanceResponse.json().run.deliveryId, status: 'Afgeleverd' })
    const duplicateResponse = await app.inject({ method: 'POST', url: `/api/sales-invoices/${invoice.id}/peppol-acceptance`, payload: { confirmNetworkSend: true } })
    expect(duplicateResponse.statusCode).toBe(200)
    expect(duplicateResponse.json().run.id).toBe(acceptanceResponse.json().run.id)
    expect(acceptanceAccessPoint.send).toHaveBeenCalledOnce()
  })

  it('beheert materieel, magazijnen en gecontroleerde voorraadbewegingen', async () => {
    const warehouseResponse = await app.inject({ method: 'POST', url: '/api/warehouses', payload: { name: 'Magazijn Noord', location: 'Antwerpen' } })
    expect(warehouseResponse.statusCode).toBe(201)
    const itemResponse = await app.inject({ method: 'POST', url: '/api/inventory-items', payload: { sku: 'PBM-001', name: 'Veiligheidshelm', unit: 'stuk', minimumStock: 10, maximumStock: 100, defaultPurchasePrice: 24.5 } })
    expect(itemResponse.statusCode).toBe(201)
    const assetResponse = await app.inject({ method: 'POST', url: '/api/assets', payload: { code: 'MCH-900', name: 'Mobiele kraan', category: 'Machine', status: 'Beschikbaar', location: 'Antwerpen', hourlyRate: 145, inspectionExpiresOn: '2027-12-31', maintenanceDueOn: '2027-08-01', insurer:'BouwProtect',insurancePolicyNumber:'MCH-2027-900',insuranceExpiresOn:'2028-01-31',mileage: 0, operatingHours: 1200 } })
    expect(assetResponse.statusCode).toBe(201)
    const receiptResponse = await app.inject({ method: 'POST', url: '/api/stock-movements', payload: { inventoryItemId: itemResponse.json().id, warehouseId: warehouseResponse.json().id, type: 'Ontvangst', quantity: 40, reference: 'LV-2027-001', performedBy: 'Magazijnier Els' } })
    expect(receiptResponse.statusCode).toBe(201)
    expect(receiptResponse.json().item.stocks[0]).toMatchObject({ quantity: 40, reserved: 0 })
    const reservationResponse = await app.inject({ method: 'POST', url: '/api/stock-movements', payload: { inventoryItemId: itemResponse.json().id, warehouseId: warehouseResponse.json().id, type: 'Reservatie', quantity: 12, reference: 'PRJ-reservatie', performedBy: 'Magazijnier Els' } })
    expect(reservationResponse.statusCode).toBe(201)
    expect(reservationResponse.json().item.stocks[0]).toMatchObject({ quantity: 40, reserved: 12 })
    const insufficientResponse = await app.inject({ method: 'POST', url: '/api/stock-movements', payload: { inventoryItemId: itemResponse.json().id, warehouseId: warehouseResponse.json().id, type: 'Uitgifte', quantity: 50, reference: 'Te grote uitgifte', performedBy: 'Magazijnier Els' } })
    expect(insufficientResponse.statusCode).toBe(409)
    const countResponse = await app.inject({ method: 'POST', url: `/api/inventory-items/${itemResponse.json().id}/count`, payload: { warehouseId: warehouseResponse.json().id, countedQuantity: 38, countedBy: 'Magazijnier Els', notes: 'Cyclische telling zone A' } })
    expect(countResponse.statusCode, countResponse.body).toBe(200)
    expect(countResponse.json()).toMatchObject({ item: { counts: [expect.objectContaining({ bookQuantity: 40, countedQuantity: 38, difference: -2 })] }, movement: { type: 'Correctie' } })
    const lotItemResponse = await app.inject({ method: 'POST', url: '/api/inventory-items', payload: { sku: 'CHEM-001', name: 'Injectiehars', unit: 'bus', minimumStock: 2, maximumStock: 20, defaultPurchasePrice: 85, lotTracking: true } })
    expect((await app.inject({ method: 'POST', url: '/api/stock-movements', payload: { inventoryItemId: lotItemResponse.json().id, warehouseId: warehouseResponse.json().id, type: 'Ontvangst', quantity: 5, reference: 'Zonder lot', performedBy: 'Magazijnier Els' } })).statusCode).toBe(409)
    const lotReceiptResponse = await app.inject({ method: 'POST', url: '/api/stock-movements', payload: { inventoryItemId: lotItemResponse.json().id, warehouseId: warehouseResponse.json().id, type: 'Ontvangst', quantity: 5, reference: 'LOT-LEVERING', performedBy: 'Magazijnier Els', lotNumber: 'LOT-2027-A' } })
    expect(lotReceiptResponse.json().item.lots).toEqual([expect.objectContaining({ lotNumber: 'LOT-2027-A', quantity: 5 })])
    const maintenanceResponse = await app.inject({ method: 'POST', url: `/api/assets/${assetResponse.json().id}/operations`, payload: { kind: 'maintenance', value: { title: 'Jaarlijks onderhoud', scheduledOn: '2027-08-01', supplier: 'Kraan Service NV', cost: 1850, status: 'Gepland', notes: 'Volgens onderhoudsplan' } } })
    expect(maintenanceResponse.json().maintenanceOrders).toEqual([expect.objectContaining({ title: 'Jaarlijks onderhoud', cost: 1850 })])
    const bootstrap = (await app.inject({ method: 'GET', url: '/api/bootstrap' })).json()
    expect(bootstrap.assets).toEqual([expect.objectContaining({ code: 'MCH-900', hourlyRate: 145, insurer:'BouwProtect',insurancePolicyNumber:'MCH-2027-900',insuranceExpiresOn:'2028-01-31' })])
    expect(bootstrap.inventoryItems).toEqual(expect.arrayContaining([expect.objectContaining({ sku: 'PBM-001', defaultPurchasePrice: 24.5, stocks: [expect.objectContaining({ quantity: 38, reserved: 12 })] }), expect.objectContaining({ sku: 'CHEM-001', lotTracking: true })]))
    expect(bootstrap.stockMovements).toHaveLength(4)
  })

  it('doorloopt de volledige enterprise-laag met traceerbare statussen', async () => {
    const project = await createEnterpriseTestProject(app)

    const subcontractorResponse = await app.inject({ method: 'POST', url: '/api/subcontractors', payload: { name: 'Fundering Partners BV', vatNumber: 'BE0888123456', contactName: 'Omar Peeters', email: 'omar@fundering.example', hourlyRate: 68, insuranceExpiresOn: '2028-12-31', vcaExpiresOn: '2028-06-30', projectIds: [project.id] } })
    expect(subcontractorResponse.statusCode).toBe(201)
    const invitedSubcontractorResponse = await app.inject({ method: 'POST', url: `/api/subcontractors/${subcontractorResponse.json().id}/invite` })
    expect(invitedSubcontractorResponse.json()).toMatchObject({ status: 'Goedgekeurd', documentsComplete: true, portalInvitedAt: expect.any(String) })
    const subcontractorId=subcontractorResponse.json().id
    const agreementResponse=await app.inject({method:'POST',url:`/api/subcontractors/${subcontractorId}/operations`,payload:{kind:'agreement',value:{number:'OA-2027-001',projectId:project.id,title:'Funderingswerken',contractValue:85000,retentionPct:5,penaltyPerDay:500,startDate:'2027-02-01',endDate:'2027-08-31',status:'Actief',documentIds:[]}}})
    expect(agreementResponse.statusCode,agreementResponse.body).toBe(200)
    const foreignSubcontractorMutation=await app.inject({method:'POST',url:`/api/subcontractors/${subcontractorId}/operations`,headers:{'x-user-id':'70000000-0000-4000-8000-000000000093','x-user-name':'Vreemde onderaannemer','x-user-email':'ander@onderaannemer.example','x-user-roles':'Onderaannemer'},payload:{kind:'progress',value:{projectId:project.id,periodEnd:'2027-02-28',grossAmount:1000,penaltyAmount:0,notes:'Niet toegestaan'}}})
    expect(foreignSubcontractorMutation.statusCode).toBe(403)
    const progressResponse=await app.inject({method:'POST',url:`/api/subcontractors/${subcontractorId}/operations`,payload:{kind:'progress',value:{projectId:project.id,periodEnd:'2027-02-28',grossAmount:20000,penaltyAmount:250,notes:'Eerste vorderingsperiode'}}})
    expect(progressResponse.statusCode,progressResponse.body).toBe(200)
    expect(progressResponse.json().progressClaims[0]).toMatchObject({grossAmount:20000,retentionAmount:1000,penaltyAmount:250,netAmount:18750,status:'Ingediend'})
    const progressId=progressResponse.json().progressClaims[0].id
    expect((await app.inject({method:'POST',url:`/api/subcontractors/${subcontractorId}/progress/${progressId}/decision`,payload:{status:'Goedgekeurd'}})).json().progressClaims[0]).toMatchObject({status:'Goedgekeurd',approvedBy:expect.any(String)})

    const qhseResponse = await app.inject({ method: 'POST', url: '/api/qhse-events', payload: { projectId: project.id, eventDate: '2027-02-10', type: 'Bijna-ongeval', title: 'Losliggend materiaal', description: 'Materiaal lag in de looproute.', severity: 'Hoog', reporter: 'Werfleider Jan', responsible: 'Ploegbaas Els', dueDate: '2027-02-11', correctiveAction: 'Looproute vrijmaken en dagelijkse controle invoeren.', participants: ['Jan Peeters', 'Els Jacobs'] } })
    expect(qhseResponse.statusCode).toBe(201)
    expect((await app.inject({ method: 'POST', url: `/api/qhse-events/${qhseResponse.json().id}/close` })).json()).toMatchObject({ status: 'Gesloten', closedAt: expect.any(String) })

    const jointVentureResponse = await app.inject({ method: 'POST', url: '/api/joint-ventures', payload: { name: 'THV BouwFlow Enterprise', type: 'THV', projectId: project.id, country: 'België', currency: 'eur', vatRule: 'Belgische btw-regels volgens aandeel', members: [{ legalEntityId: DEVELOPMENT_LEGAL_ENTITY_ID, sharePct: 60, lead: true }, { legalEntityId: DEVELOPMENT_SERVICE_ENTITY_ID, sharePct: 40, lead: false }] } })
    expect(jointVentureResponse.json()).toMatchObject({ status: 'Actief', currency: 'EUR', members: expect.arrayContaining([expect.objectContaining({ sharePct: 60, lead: true })]) })

    const connectionResponse = await app.inject({ method: 'POST', url: '/api/integration-connections', payload: { name: 'Exact productie', provider: 'Exact Online', legalEntityId: DEVELOPMENT_LEGAL_ENTITY_ID, endpoint: 'https://start.exactonline.be/api' } })
    expect(connectionResponse.statusCode).toBe(423)
    expect(connectionResponse.json().message).toContain('on hold')

    const aiResponse = await app.inject({ method: 'POST', url: `/api/projects/${project.id}/ai-analyses`, payload: { type: 'Contractrisico', question: 'Welke contractrisico’s moeten we opvolgen?', createdBy: 'Projectmanager Els' } })
    expect(aiResponse.statusCode, aiResponse.body).toBe(201)
    expect(aiResponse.json()).toMatchObject({ status: 'Concept', sources: [expect.objectContaining({ title: expect.stringContaining(project.number), excerpt: expect.any(String) })] })
    expect((await app.inject({ method: 'POST', url: `/api/ai-analyses/${aiResponse.json().id}/approve`, payload: { approvedBy: 'Directeur Karel' } })).json()).toMatchObject({ status: 'Goedgekeurd', approvedBy: 'Directeur Karel', approvedAt: expect.any(String) })

    const obligationId = '51000000-0000-4000-8000-000000000001'
    const riskId = '51000000-0000-4000-8000-000000000002'
    const contractResponse = await app.inject({ method: 'POST', url: `/api/projects/${project.id}/contracts`, payload: { title: `Contract ${project.number}`, signedOn: '2027-01-15', executionStart: '2027-02-01', executionEnd: '2027-12-20', paymentTerms: '30 dagen', retentionPct: 5, penaltyPerDay: 1000, priceRevision: 'Volgens contractformule', obligations: [{ id: obligationId, title: 'Startbevel bevestigen', dueDate: '2027-02-01', owner: 'Projectmanager Els', status: 'Open' }], risks: [{ id: riskId, description: 'Boete bij termijnoverschrijding', impact: 'Hoog', mitigation: 'Wekelijkse termijncontrole', owner: 'Projectmanager Els', status: 'Open' }] } })
    expect(contractResponse.statusCode).toBe(201)
    const securityId = '51000000-0000-4000-8000-000000000003'
    const claimId = '51000000-0000-4000-8000-000000000004'
    const updatedContractResponse = await app.inject({ method:'PATCH', url:`/api/contracts/${contractResponse.json().id}`, payload:{ contractNumber:'CTR-2027-001', contractType:'Openbare opdracht', contractValue:1_250_000, currency:'EUR', securities:[{ id:securityId, type:'Bankgarantie', reference:'BG-2027-44', issuer:'BouwBank', amount:62_500, expiresOn:'2028-06-30', status:'Actief' }], claims:[{ id:claimId, number:'CLM-001', title:'Termijnverlenging nutsleidingen', amount:45_000, scheduleImpactDays:12, status:'Concept' }] } })
    expect(updatedContractResponse.statusCode, updatedContractResponse.body).toBe(200)
    expect(updatedContractResponse.json()).toMatchObject({ contractNumber:'CTR-2027-001', securities:[expect.objectContaining({ reference:'BG-2027-44' })], claims:[expect.objectContaining({ number:'CLM-001' })] })
    const signedContractDocument = await app.inject({ method:'POST',url:`/api/projects/${project.id}/documents`,...multipartDocument({title:'Getekende aannemingsovereenkomst',category:'Contract',notes:'Ondertekend exemplaar.',uploadedBy:'Projectdirectie'},Buffer.from('%PDF-getekend-contract'),'getekend-contract.pdf') })
    expect(signedContractDocument.statusCode,signedContractDocument.body).toBe(201)
    const contractWithDocument = await app.inject({ method:'PATCH',url:`/api/contracts/${contractResponse.json().id}`,payload:{documentIds:[signedContractDocument.json().id]} })
    expect(contractWithDocument.json()).toMatchObject({approvalStatus:'Concept',documentIds:[signedContractDocument.json().id]})
    const submittedContract = await app.inject({method:'POST',url:`/api/contracts/${contractResponse.json().id}/submit`})
    expect(submittedContract.statusCode,submittedContract.body).toBe(200)
    expect(submittedContract.json()).toMatchObject({approvalStatus:'Ter goedkeuring',submittedBy:expect.any(String),submittedAt:expect.any(String)})
    const approvedContract = await app.inject({method:'POST',url:`/api/contracts/${contractResponse.json().id}/approve`})
    expect(approvedContract.statusCode,approvedContract.body).toBe(200)
    expect(approvedContract.json()).toMatchObject({approvalStatus:'Goedgekeurd',approvedBy:expect.any(String),approvedAt:expect.any(String)})
    expect((await app.inject({ method: 'POST', url: `/api/contracts/${contractResponse.json().id}/obligations/${obligationId}/complete` })).json()).toMatchObject({ obligations: [expect.objectContaining({ id: obligationId, status: 'Voltooid', completedAt: expect.any(String) })] })

    const closeoutResponse = await app.inject({ method: 'POST', url: `/api/projects/${project.id}/closeouts`, payload: { status: 'Voorbereiding', bondReleaseStatus: 'Niet aangevraagd', asBuiltComplete: false, maintenanceFileComplete: false } })
    expect(closeoutResponse.statusCode).toBe(201)
    const closeoutItemResponse = await app.inject({ method: 'POST', url: `/api/closeouts/${closeoutResponse.json().id}/items`, payload: { description: 'Beschadigde boordsteen vervangen', responsible: 'Ploegbaas Els', dueDate: '2027-12-22' } })
    expect(closeoutItemResponse.json().items).toEqual([expect.objectContaining({ status: 'Open' })])
    const closeoutItemId = closeoutItemResponse.json().items[0].id
    expect((await app.inject({ method: 'POST', url: `/api/closeouts/${closeoutResponse.json().id}/items/${closeoutItemId}/resolve` })).json()).toMatchObject({ items: [expect.objectContaining({ status: 'Opgelost', resolvedAt: expect.any(String) })] })
    const updatedCloseout = await app.inject({ method: 'PATCH', url: `/api/closeouts/${closeoutResponse.json().id}`, payload: { status: 'Definitief opgeleverd', provisionalAcceptanceOn: '2027-12-20', definitiveAcceptanceOn: '2028-01-20', guaranteeUntil: '2030-01-20', bondReleaseStatus: 'Aangevraagd', asBuiltComplete: true, maintenanceFileComplete: true, bondAmount:62_500, bondReleasedAmount:31_250, acceptanceDocumentIds:[], asBuiltDocumentIds:[], maintenanceDocumentIds:[], guaranteeDocumentIds:[] } })
    expect(updatedCloseout.statusCode, updatedCloseout.body).toBe(200)
    expect(updatedCloseout.json()).toMatchObject({ status: 'Definitief opgeleverd', asBuiltComplete: true, guaranteeUntil: '2030-01-20', bondAmount:62_500 })
    const customerSignature = await app.inject({ method:'POST', url:`/api/closeouts/${closeoutResponse.json().id}/customer-sign`, headers:{ 'x-user-id':DEVELOPMENT_USER_ID, 'x-user-name':'Eva Janssens', 'x-user-email':'eva@enterprise.example', 'x-user-roles':'Klant' } })
    expect(customerSignature.statusCode, customerSignature.body).toBe(200)
    expect(customerSignature.json()).toMatchObject({ customerSignedBy:'Eva Janssens', customerSignedAt:expect.any(String) })
    const duplicateCustomerSignature = await app.inject({ method:'POST', url:`/api/closeouts/${closeoutResponse.json().id}/customer-sign`, headers:{ 'x-user-id':DEVELOPMENT_USER_ID, 'x-user-name':'Eva Janssens', 'x-user-email':'eva@enterprise.example', 'x-user-roles':'Klant' } })
    expect(duplicateCustomerSignature.statusCode).toBe(409)
    const serviceResponse = await app.inject({ method: 'POST', url: `/api/closeouts/${closeoutResponse.json().id}/service-requests`, payload: { title: 'Verzakking na oplevering', description: 'Lokale verzakking aan de toegang controleren.', reportedAt: '2028-02-03' } })
    expect(serviceResponse.statusCode, serviceResponse.body).toBe(201)
    expect(serviceResponse.json()).toMatchObject({ status: 'Nazorg', serviceRequests: [expect.objectContaining({ status: 'Nieuw' })] })
    const serviceRequestId = serviceResponse.json().serviceRequests[0].id
    expect((await app.inject({ method: 'POST', url: `/api/closeouts/${closeoutResponse.json().id}/service-requests/${serviceRequestId}/resolve` })).json()).toMatchObject({ serviceRequests: [expect.objectContaining({ status: 'Opgelost', resolvedAt: expect.any(String) })] })

    const employeeResponse = await app.inject({ method:'POST', url:'/api/employees', payload:{ employeeNumber:'MW-900', firstName:'Nora', lastName:'Vermeulen', email:'nora.vermeulen@example.be', role:'Werfleider', legalEntityId:DEVELOPMENT_LEGAL_ENTITY_ID, employmentPct:80, weeklyHours:32, annualLeaveHours:128, hireDate:'2025-01-01', skills:['VCA VOL','Werfcoördinatie'], active:true } })
    expect(employeeResponse.statusCode, employeeResponse.body).toBe(201)
    const crewResponse = await app.inject({ method:'POST', url:'/api/employee-crews', payload:{ name:'Ploeg Noord', legalEntityId:DEVELOPMENT_LEGAL_ENTITY_ID, leaderEmployeeId:employeeResponse.json().id, memberEmployeeIds:[employeeResponse.json().id], active:true } })
    expect(crewResponse.statusCode, crewResponse.body).toBe(201)
    expect(crewResponse.json()).toMatchObject({ name:'Ploeg Noord', leaderEmployeeId:employeeResponse.json().id, memberEmployeeIds:[employeeResponse.json().id] })
    const absenceResponse = await app.inject({ method:'POST', url:'/api/employee-absences', payload:{ employeeId:employeeResponse.json().id, type:'Verlof', startDate:'2027-04-12', endDate:'2027-04-16', hours:32, reason:'Jaarlijks verlof', requestedBy:'Nora Vermeulen' } })
    expect(absenceResponse.json()).toMatchObject({ status:'Aangevraagd', hours:32, requestedAt:expect.any(String) })
    const approvedAbsenceResponse = await app.inject({ method:'POST', url:`/api/employee-absences/${absenceResponse.json().id}/decision`, payload:{ status:'Goedgekeurd', decidedBy:'HR Els' } })
    expect(approvedAbsenceResponse.json()).toMatchObject({ status:'Goedgekeurd', decidedBy:'HR Els', decidedAt:expect.any(String) })

    const bootstrap = (await app.inject({ method: 'GET', url: '/api/bootstrap' })).json()
    expect(bootstrap).toMatchObject({
      subcontractors: [expect.objectContaining({ portalInvitedAt: expect.any(String) })],
      qhseEvents: [expect.objectContaining({ status: 'Gesloten' })],
      jointVentures: [expect.objectContaining({ status: 'Actief' })],
      integrationConnections: [],
      integrationJobs: [],
      aiAnalyses: [expect.objectContaining({ status: 'Goedgekeurd' })],
      projectContracts: [expect.objectContaining({ status: 'Actief' })],
      projectCloseouts: [expect.objectContaining({ items: [expect.objectContaining({ status: 'Opgelost' })] })],
      employees: [expect.objectContaining({ employeeNumber:'MW-900', employmentPct:80 })],
      employeeAbsences: [expect.objectContaining({ type:'Verlof', status:'Goedgekeurd' })],
      employeeCrews: [expect.objectContaining({ name:'Ploeg Noord', active:true })],
    })
  })

  it('weigert ongeldige invoer voordat de database wordt aangeroepen', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/opportunities', payload: { title: 'x' } })
    expect(response.statusCode).toBe(400)
    expect(response.json().error).toBe('validation_error')
  })

  it('vereist een expliciete Go-beslissing voordat de calculatie start', async () => {
    const opportunity = (await app.inject({ method: 'POST', url: '/api/opportunities', payload: { title: 'Go No-Go testwerf', organizationId, location: 'Hasselt', deadline: '2027-10-01', estimatedValue: 125000, probability: 30, recognition: 'C3' } })).json()
    expect((await app.inject({ method: 'POST', url: `/api/opportunities/${opportunity.id}/calculations` })).statusCode).toBe(409)
    expect((await app.inject({ method: 'POST', url: `/api/opportunities/${opportunity.id}/qualify` })).json()).toMatchObject({ stage: 'Gekwalificeerd' })
    const noGo = await app.inject({ method: 'POST', url: `/api/opportunities/${opportunity.id}/go-no-go`, payload: { ...favorableGoNoGo, decision: 'No-Go', scores: Object.fromEntries(Object.keys(favorableGoNoGo.scores).map(key => [key, 1])), notes: 'Onvoldoende capaciteit en te hoog risico' } })
    expect(noGo.json()).toMatchObject({ stage: 'Verloren', probability: 0, goNoGo: { decision: 'No-Go', averageScore: 1 } })
    expect((await app.inject({ method: 'POST', url: `/api/opportunities/${opportunity.id}/calculations` })).statusCode).toBe(409)
    const reconsidered = await app.inject({ method: 'POST', url: `/api/opportunities/${opportunity.id}/go-no-go`, payload: favorableGoNoGo })
    expect(reconsidered.json()).toMatchObject({ stage: 'Go/No-Go', goNoGo: { decision: 'Go' } })
    expect((await app.inject({ method: 'POST', url: `/api/opportunities/${opportunity.id}/calculations` })).statusCode).toBe(201)
  })

  it('opent en wijzigt opportuniteit- en projectstamgegevens geaudit', async () => {
    const opportunity = (await app.inject({ method: 'POST', url: '/api/opportunities', payload: { title: 'Bewerkbare opportuniteit', organizationId, location: 'Genk', deadline: '2027-11-01', estimatedValue: 175000, probability: 35, recognition: 'C4' } })).json()
    const updatedOpportunity = await app.inject({ method: 'PATCH', url: `/api/opportunities/${opportunity.id}`, payload: { title: 'Bewerkte opportuniteit', organizationId, location: 'Hasselt', deadline: '2027-11-15', estimatedValue: 190000, probability: 45, recognition: 'C5' } })
    expect(updatedOpportunity.statusCode, updatedOpportunity.body).toBe(200)
    expect(updatedOpportunity.json()).toMatchObject({ id: opportunity.id, title: 'Bewerkte opportuniteit', location: 'Hasselt', estimatedValue: 190000, stage: 'Nieuw' })

    const project = await createEnterpriseTestProject(app)
    const updatedProject = await app.inject({ method: 'PATCH', url: `/api/projects/${project.id}`, payload: { name: 'Bewerkte enterprise werf', organizationId: project.organizationId, progress: 27, status: 'Op schema' } })
    expect(updatedProject.statusCode, updatedProject.body).toBe(200)
    expect(updatedProject.json()).toMatchObject({ id: project.id, name: 'Bewerkte enterprise werf', progress: 27, status: 'Op schema', contractValue: project.contractValue })

    const audit = (await app.inject({ method: 'GET', url: '/api/audit' })).json()
    expect(audit).toEqual(expect.arrayContaining([
      expect.objectContaining({ entityType: 'opportunity', entityId: opportunity.id, action: 'updated' }),
      expect.objectContaining({ entityType: 'project', entityId: project.id, action: 'details_updated' }),
    ]))
  })

  it('weigert mutaties voor een rol zonder calculatierechten', async () => {
    const response = await app.inject({
      method: 'POST', url: '/api/opportunities', headers: { 'x-user-roles': 'Arbeider' },
      payload: { title: 'Niet toegestaan project', organizationId, location: 'Gent', deadline: '2026-12-01', estimatedValue: 1000, probability: 10, recognition: '' },
    })
    expect(response.statusCode).toBe(403)
  })

  it('handhaaft de rollenmatrix over commercieel, HR, inkoop en financiën', async () => {
    const cases = [
      { role: 'Aankoper', method: 'POST', url: '/api/employees' },
      { role: 'HR', method: 'POST', url: '/api/opportunities' },
      { role: 'Calculator', method: 'POST', url: `/api/projects/${crypto.randomUUID()}/procurement-requests` },
      { role: 'Werfleider', method: 'PATCH', url: `/api/legal-entities/${DEVELOPMENT_LEGAL_ENTITY_ID}/financial-settings` },
      { role: 'Klant', method: 'POST', url: '/api/employees' },
      { role: 'Leverancier', method: 'POST', url: '/api/opportunities' },
      { role: 'Onderaannemer', method: 'PATCH', url: `/api/legal-entities/${DEVELOPMENT_LEGAL_ENTITY_ID}/financial-settings` },
    ] as const
    for (const item of cases) {
      const response = await app.inject({ method:item.method, url:item.url, headers:{ 'x-user-roles':item.role }, payload:{} })
      expect(response.statusCode, `${item.role} kreeg onverwacht toegang tot ${item.url}`).toBe(403)
    }
  })

  it('scopeert het klantportaal server-side tot de eigen dossiers en verbergt interne kostdata', async () => {
    const project = await createEnterpriseTestProject(app)
    const response = await app.inject({
      method: 'GET', url: '/api/bootstrap',
      headers: {
        'x-user-id': '70000000-0000-4000-8000-000000000071',
        'x-user-name': 'Eva Janssens',
        'x-user-email': 'eva@enterprise.example',
        'x-user-roles': 'Klant',
      },
    })
    expect(response.statusCode, response.body).toBe(200)
    const state = response.json()
    expect(state.organizations).toEqual([expect.objectContaining({ name: 'Enterprise Testklant NV' })])
    expect(state.projects).toEqual([expect.objectContaining({ id: project.id, costBudget: 0, marginPct: 0 })])
    expect(state.calculations).toEqual([expect.objectContaining({ items: [], chapters: [], marginPct: 0, overheadPct: 0, riskPct: 0 })])
    expect(state.costLibrary).toEqual([])
    expect(state.projectCosts).toEqual([])
    expect(state.employees).toEqual([])
    expect(state.suppliers).toEqual([])
  })

  it('scopeert het onderaannemersportaal en scheidt werfbonnen en eigen documenten van klantdata', async () => {
    const project = await createEnterpriseTestProject(app)
    const subcontractorResponse = await app.inject({
      method: 'POST', url: '/api/subcontractors',
      payload: { name: 'Portaal Funderingen BV', vatNumber: 'BE0888999000', contactName: 'Omar Peeters', email: 'omar@portaal.example', hourlyRate: 67, insuranceExpiresOn: '2028-12-31', vcaExpiresOn: '2028-06-30', projectIds: [project.id] },
    })
    expect(subcontractorResponse.statusCode, subcontractorResponse.body).toBe(201)
    const subcontractor = subcontractorResponse.json()
    const subcontractorHeaders = {
      'x-user-id': '70000000-0000-4000-8000-000000000094',
      'x-user-name': 'Omar Peeters',
      'x-user-email': 'omar@portaal.example',
      'x-user-roles': 'Onderaannemer',
    }
    const customerHeaders = {
      'x-user-id': '70000000-0000-4000-8000-000000000071',
      'x-user-name': 'Eva Janssens',
      'x-user-email': 'eva@enterprise.example',
      'x-user-roles': 'Klant',
    }
    const targetedTicket = (await app.inject({
      method: 'POST', url: '/api/work-tickets',
      payload: { projectId: project.id, subcontractorId: subcontractor.id, type: 'Regiewerk', date: '2027-06-02', description: 'Bijkomende funderingswerken', lines: [{ id: '73000000-0000-4000-8000-000000000011', category: 'Arbeid', description: 'Funderingsploeg', quantity: 8, unit: 'u', unitPrice: 67 }], createdBy: 'Jana Werf' },
    })).json()
    const clientTicket = (await app.inject({
      method: 'POST', url: '/api/work-tickets',
      payload: { projectId: project.id, type: 'Meerwerk', date: '2027-06-02', description: 'Bijkomende sleufwerken opdrachtgever', lines: [{ id: '73000000-0000-4000-8000-000000000012', category: 'Materieel', description: 'Graafmachine', quantity: 4, unit: 'u', unitPrice: 125 }], createdBy: 'Jana Werf' },
    })).json()
    await app.inject({ method: 'POST', url: `/api/work-tickets/${targetedTicket.id}/submit` })
    await app.inject({ method: 'POST', url: `/api/work-tickets/${clientTicket.id}/submit` })

    const employeeResponse = await app.inject({ method: 'POST', url: `/api/subcontractors/${subcontractor.id}/operations`, headers: subcontractorHeaders, payload: { kind: 'employee', value: { name: 'Yassin El Amrani', role: 'Bekister', certificate: 'VCA Basis', certificateExpiresOn: '2028-05-31' } } })
    expect(employeeResponse.statusCode, employeeResponse.body).toBe(200)
    expect(employeeResponse.json().employees).toEqual([expect.objectContaining({ name: 'Yassin El Amrani', certificate: 'VCA Basis' })])

    const multipart = multipartDocument({ title: 'VCA attest ploeg', category: 'Veiligheid', notes: 'Aangeleverd via onderaannemersportaal.', uploadedBy: 'Mag niet worden vertrouwd' }, Buffer.from('%PDF-portaal-attest'), 'vca-attest.pdf')
    const documentResponse = await app.inject({ method: 'POST', url: `/api/projects/${project.id}/documents`, headers: { ...multipart.headers, ...subcontractorHeaders }, payload: multipart.payload })
    expect(documentResponse.statusCode, documentResponse.body).toBe(201)
    expect(documentResponse.json()).toMatchObject({ status: 'Concept', category: 'Veiligheid', versions: [expect.objectContaining({ uploadedBy: 'Omar Peeters' })], links: [expect.objectContaining({ type: 'Onderaannemer', recordId: subcontractor.id })] })

    const subcontractorBootstrap = await app.inject({ method: 'GET', url: '/api/bootstrap', headers: subcontractorHeaders })
    expect(subcontractorBootstrap.statusCode, subcontractorBootstrap.body).toBe(200)
    expect(subcontractorBootstrap.json()).toMatchObject({ currentUserId: subcontractorHeaders['x-user-id'], companyUsers: [expect.objectContaining({ role: 'Onderaannemer', email: 'omar@portaal.example' })] })
    expect(subcontractorBootstrap.json().workTickets.map((item: { id: string }) => item.id)).toEqual([targetedTicket.id])
    expect(subcontractorBootstrap.json().documents).toEqual([expect.objectContaining({ id: documentResponse.json().id, status: 'Concept' })])
    expect((await app.inject({ method: 'GET', url: `/api/document-versions/${documentResponse.json().currentVersionId}/file`, headers: subcontractorHeaders })).statusCode).toBe(200)

    const forbiddenCustomerSignature = await app.inject({ method: 'POST', url: `/api/work-tickets/${targetedTicket.id}/sign`, headers: customerHeaders, payload: { signedBy: 'Onjuiste ondertekenaar' } })
    expect(forbiddenCustomerSignature.statusCode).toBe(403)
    const ownSignature = await app.inject({ method: 'POST', url: `/api/work-tickets/${targetedTicket.id}/sign`, headers: subcontractorHeaders, payload: { signedBy: 'Te negeren naam' } })
    expect(ownSignature.statusCode, ownSignature.body).toBe(200)
    expect(ownSignature.json()).toMatchObject({ status: 'Ondertekend', signedBy: 'Omar Peeters' })

    const customerBootstrap = await app.inject({ method: 'GET', url: '/api/bootstrap', headers: customerHeaders })
    expect(customerBootstrap.json().workTickets.map((item: { id: string }) => item.id)).toEqual([clientTicket.id])
  })

  it('biedt een publieke healthcheck', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ status: 'ok', service: 'bouwflow-api' })
    expect(response.headers).toMatchObject({ 'x-content-type-options': 'nosniff', 'x-frame-options': 'DENY' })
  })

  it('levert een opgeschaalde dossierlijst binnen het performancebudget', async () => {
    const records = Array.from({ length: 250 }, (_, index) => ({
      id:`80000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      name:`Schaaltest relatie ${String(index + 1).padStart(3, '0')}`,
      email:`schaal-${index + 1}@example.be`,
    }))
    await Promise.all(records.map(item => pool.query(`INSERT INTO organizations (tenant_id,id,name,type,contact_name,email,vat_number) VALUES ($1,$2,$3,'Privaat','Schaaltest',$4,'')`, [DEVELOPMENT_TENANT_ID,item.id,item.name,item.email])))
    const startedAt = performance.now()
    const response = await app.inject({ method:'GET', url:'/api/bootstrap' })
    const elapsedMs = performance.now() - startedAt
    expect(response.statusCode, response.body).toBe(200)
    expect(response.json().organizations.length).toBeGreaterThanOrEqual(253)
    expect(elapsedMs).toBeLessThan(5_000)
  })

  it('laat de browser de verplichte idempotency-header via CORS versturen', async () => {
    const response = await app.inject({ method: 'OPTIONS', url: '/api/organizations', headers: { origin: 'http://localhost:5173', 'access-control-request-method': 'POST', 'access-control-request-headers': 'authorization,content-type,idempotency-key' } })
    expect(response.statusCode).toBe(204)
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173')
    expect(response.headers['access-control-allow-headers']?.toLocaleLowerCase()).toContain('idempotency-key')
  })

  it('controleert database en object storage in de readinesscheck', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/health/ready' })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({ status: 'ready', service: 'bouwflow-api', checks: { database: 'ok', objectStorage: 'ok' } })
    expect(response.headers).toMatchObject({ 'cache-control': 'no-store', 'x-request-id': expect.any(String) })
  })

  it('biedt lokaal scrape-bare metrics zonder record- of tenantlabels', async () => {
    await app.inject({ method: 'GET', url: '/health' })
    const response = await app.inject({ method: 'GET', url: '/internal/metrics' })
    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toContain('text/plain')
    expect(response.body).toContain('bouwflow_http_requests_total')
    expect(response.body).not.toContain('tenant_id')
  })

  it('voert dezelfde mutatie met een idempotency-key maximaal eenmaal uit', async () => {
    const key = '70000000-0000-4000-8000-000000000001'
    const request = { method: 'POST' as const, url: '/api/organizations', headers: { 'idempotency-key': key }, payload: { name: 'Idempotente Klant NV', type: 'Privaat', contactName: 'Els Test', email: 'els@example.be', vatNumber: 'BE0999999991' } }
    const first = await app.inject(request)
    const repeated = await app.inject(request)
    expect(first.statusCode).toBe(201)
    expect(repeated.statusCode).toBe(201)
    expect(repeated.json()).toEqual(first.json())
    expect((await pool.query("SELECT count(*)::int AS count FROM organizations WHERE name='Idempotente Klant NV'")).rows[0].count).toBe(1)
  })

  it('weigert hergebruik van een idempotency-key voor een andere mutatie', async () => {
    const key = '70000000-0000-4000-8000-000000000002'
    await app.inject({ method: 'POST', url: '/api/organizations', headers: { 'idempotency-key': key }, payload: { name: 'Eerste Klant NV', type: 'Privaat', contactName: 'Els Test', email: 'els@example.be', vatNumber: 'BE0999999992' } })
    const response = await app.inject({ method: 'POST', url: '/api/opportunities', headers: { 'idempotency-key': key }, payload: { title: 'Onjuiste replay', organizationId, location: 'Gent', deadline: '2027-12-01', estimatedValue: 1000, probability: 10, recognition: '' } })
    expect(response.statusCode).toBe(409)
  })

  it('detecteert gelijktijdige wijzigingen met een gegevensversie zonder de eerste wijziging te verliezen', async () => {
    const bootstrap = await app.inject({ method: 'GET', url: '/api/bootstrap' })
    const revision = bootstrap.headers.etag
    expect(revision).toMatch(/^"\d+"$/)
    const first = await app.inject({
      method: 'POST', url: '/api/organizations',
      headers: { 'if-match': revision!, 'idempotency-key': '70000000-0000-4000-8000-000000000081' },
      payload: { name: 'Gelijktijdige Klant A', type: 'Privaat', contactName: 'Els Test', email: 'els.a@example.be', vatNumber: 'BE0999999981' },
    })
    expect(first.statusCode, first.body).toBe(201)
    expect(first.headers.etag).not.toBe(revision)
    const stale = await app.inject({
      method: 'POST', url: '/api/organizations',
      headers: { 'if-match': revision!, 'idempotency-key': '70000000-0000-4000-8000-000000000082' },
      payload: { name: 'Gelijktijdige Klant B', type: 'Privaat', contactName: 'Els Test', email: 'els.b@example.be', vatNumber: 'BE0999999982' },
    })
    expect(stale.statusCode).toBe(409)
    expect(stale.json().message).toContain('andere gebruiker gewijzigd')
    expect((await pool.query("SELECT count(*)::int AS count FROM organizations WHERE name LIKE 'Gelijktijdige Klant %'")).rows[0].count).toBe(1)
  })

  it('doorloopt werfbonnen, HR-uren en contractuele claims met gecontroleerde statussen', async () => {
    const project = await createEnterpriseTestProject(app)
    const employeeResponse = await app.inject({ method:'POST', url:'/api/employees', payload:{ employeeNumber:'T-900',firstName:'Jana',lastName:'Werf',email:'jana.werf@example.be',role:'Ploegbaas',legalEntityId:DEVELOPMENT_LEGAL_ENTITY_ID,branchId:undefined,employmentPct:100,weeklyHours:40,annualLeaveHours:160,hireDate:'2025-01-01',skills:['VCA Basis'],active:true } })
    expect(employeeResponse.statusCode,employeeResponse.body).toBe(201)
    const employee=employeeResponse.json()

    const ticketResponse=await app.inject({method:'POST',url:'/api/work-tickets',payload:{projectId:project.id,type:'Regiewerk',date:'2027-06-01',description:'Onvoorziene vrijmaking van nutsleidingen',lines:[{id:'73000000-0000-4000-8000-000000000001',category:'Arbeid',description:'Ploeg grondwerken',quantity:8,unit:'u',unitPrice:55}],createdBy:'Jana Werf'}})
    expect(ticketResponse.statusCode,ticketResponse.body).toBe(201)
    expect(ticketResponse.json()).toMatchObject({status:'Concept',total:440})
    const ticketId=ticketResponse.json().id
    expect((await app.inject({method:'POST',url:`/api/work-tickets/${ticketId}/submit`})).json()).toMatchObject({status:'Ter ondertekening'})
    expect((await app.inject({method:'POST',url:`/api/work-tickets/${ticketId}/sign`,payload:{signedBy:'Opdrachtgever Test'}})).json()).toMatchObject({status:'Ondertekend',signedBy:'Opdrachtgever Test'})

    const timeResponse=await app.inject({method:'POST',url:'/api/time-entries',payload:{employeeId:employee.id,projectId:project.id,date:'2027-06-01',startTime:'07:00',endTime:'16:00',breakMinutes:60,regularHours:8,overtimeHours:0,travelHours:0.5,nightHours:0,weekendHours:0,source:'Mobiel'}})
    expect(timeResponse.statusCode,timeResponse.body).toBe(201)
    const timeId=timeResponse.json().id
    expect((await app.inject({method:'POST',url:`/api/time-entries/${timeId}/submit`})).json()).toMatchObject({status:'Ingediend'})
    expect((await app.inject({method:'POST',url:`/api/time-entries/${timeId}/decision`,payload:{decision:'Goedgekeurd'}})).json()).toMatchObject({status:'Goedgekeurd'})

    const claimResponse=await app.inject({method:'POST',url:'/api/project-claims',payload:{projectId:project.id,type:'Termijnverlenging',cause:'Onvoorziene nutsleidingen',description:'Acht kalenderdagen termijnverlenging met onderbouwde dagrapporten.',amount:0,extensionDays:8,responsibleParty:'Opdrachtgever',documentIds:[],createdBy:'Projectmanager'}})
    expect(claimResponse.statusCode,claimResponse.body).toBe(201)
    const claimId=claimResponse.json().id
    expect((await app.inject({method:'POST',url:`/api/project-claims/${claimId}/transition`,payload:{action:'approve'}})).json()).toMatchObject({status:'Intern goedgekeurd'})
    expect((await app.inject({method:'POST',url:`/api/project-claims/${claimId}/transition`,payload:{action:'submit'}})).json()).toMatchObject({status:'Ingediend'})
    expect((await app.inject({method:'POST',url:`/api/project-claims/${claimId}/transition`,payload:{action:'accept',notes:'Contractueel aanvaard'}})).json()).toMatchObject({status:'Aanvaard',decisionNotes:'Contractueel aanvaard'})
    const ticketAudit = await app.inject({method:'GET',url:`/api/audit/work_ticket/${ticketId}`})
    const timeAudit = await app.inject({method:'GET',url:`/api/audit/time_entry/${timeId}`})
    const claimAudit = await app.inject({method:'GET',url:`/api/audit/project_claim/${claimId}`})
    expect(ticketAudit.statusCode,ticketAudit.body).toBe(200)
    expect(timeAudit.statusCode,timeAudit.body).toBe(200)
    expect(claimAudit.statusCode,claimAudit.body).toBe(200)
    expect(ticketAudit.json().map((item:{action:string})=>item.action)).toEqual(expect.arrayContaining(['created','digitally_signed']))
    expect(timeAudit.json().map((item:{action:string})=>item.action)).toEqual(expect.arrayContaining(['created','approved']))
    expect(claimAudit.json().map((item:{action:string})=>item.action)).toEqual(expect.arrayContaining(['created','accept']))
  })

  it('corrigeert een opportuniteitsworkflow zonder dossiergegevens te verwijderen en registreert de reden',async()=>{
    const opportunityResponse=await app.inject({
      method:'POST',
      url:'/api/opportunities',
      payload:{title:'Workflowcorrectie klasse 8',organizationId,location:'Antwerpen',deadline:'2027-12-01',estimatedValue:12_500_000,probability:55,recognition:'Klasse 8 C5'},
    })
    expect(opportunityResponse.statusCode,opportunityResponse.body).toBe(201)
    const opportunity=opportunityResponse.json()
    await approveOpportunity(app,opportunity.id)
    const originalCalculation=(await app.inject({method:'POST',url:`/api/opportunities/${opportunity.id}/calculations`})).json()

    const correctionResponse=await app.inject({
      method:'POST',
      url:'/api/workflows/correct',
      payload:{dossierType:'opportunity',recordId:opportunity.id,targetStatus:'Gekwalificeerd',reason:'De erkenningscategorie moet opnieuw inhoudelijk worden gecontroleerd.'},
    })

    expect(correctionResponse.statusCode,correctionResponse.body).toBe(200)
    expect(correctionResponse.json()).toMatchObject({
      correction:{recordId:opportunity.id,previousStatus:'Calculatie',targetStatus:'Gekwalificeerd',reason:'De erkenningscategorie moet opnieuw inhoudelijk worden gecontroleerd.',correctedBy:expect.any(String),correctedAt:expect.any(String)},
      record:{id:opportunity.id,stage:'Gekwalificeerd',goNoGo:{decision:'Go'},title:'Workflowcorrectie klasse 8'},
    })
    const forwardCorrection=await app.inject({
      method:'POST',
      url:'/api/workflows/correct',
      payload:{dossierType:'opportunity',recordId:opportunity.id,targetStatus:'Calculatie',reason:'Deze poging mag geen workflowstappen overslaan.'},
    })
    expect(forwardCorrection.statusCode).toBe(409)
    await app.inject({method:'POST',url:`/api/opportunities/${opportunity.id}/go-no-go`,payload:favorableGoNoGo})
    const resumedCalculation=await app.inject({method:'POST',url:`/api/opportunities/${opportunity.id}/calculations`})
    expect(resumedCalculation.statusCode,resumedCalculation.body).toBe(201)
    expect(resumedCalculation.json().id).toBe(originalCalculation.id)
    const bootstrap=await app.inject({method:'GET',url:'/api/bootstrap'})
    expect(bootstrap.json().opportunities).toEqual(expect.arrayContaining([expect.objectContaining({id:opportunity.id,stage:'Calculatie'})]))
    expect(bootstrap.json().calculations.filter((item:{opportunityId:string})=>item.opportunityId===opportunity.id)).toHaveLength(1)
    const audit=await app.inject({method:'GET',url:`/api/audit/opportunity/${opportunity.id}`})
    expect(audit.json()).toEqual(expect.arrayContaining([expect.objectContaining({action:'workflow_corrected',reason:'De erkenningscategorie moet opnieuw inhoudelijk worden gecontroleerd.'})]))
  })
})
