import { describe, expect, it } from 'vitest'
import type { CheckinatworkParticipant, CheckinatworkParticipantInput, CheckinatworkSite } from '../src/domain'
import { CheckinatworkGatewayError, HttpCheckinatworkGateway, SimulationCheckinatworkGateway } from './checkinatwork-gateway'

const participantInput = { projectId: 'project-1', displayName: 'Jan Peeters', employerName: 'BouwFlow', employerCompanyNumber: '0502635588', participantType: 'Werknemer', identifierType: 'INSZ', identifier: '85071210989', active: true } satisfies CheckinatworkParticipantInput
const site = { id: 'site-1', projectId: 'project-1', workPlaceId: 'WP-001', environment: 'Simulatie', active: true } as CheckinatworkSite

describe('Checkinatwork-gateway', () => {
  it('provisioneert een identiteit als onomkeerbare referentie met alleen last4', async () => {
    const result = await new SimulationCheckinatworkGateway().provisionIdentity(participantInput)
    expect(result.identifierLast4).toBe('0989')
    expect(result.secureIdentityReference).not.toContain(participantInput.identifier)
  })

  it('weigert een ongeldig INSZ', async () => {
    await expect(new SimulationCheckinatworkGateway().provisionIdentity({ ...participantInput, identifier: '123' })).rejects.toMatchObject({ code: 'INVALID_INSS' })
  })

  it('levert voor dezelfde idempotente registratie hetzelfde ontvangstnummer', async () => {
    const gateway = new SimulationCheckinatworkGateway()
    const identity = await gateway.provisionIdentity(participantInput)
    const participant = { ...participantInput, id: 'participant-1', identifierLast4: identity.identifierLast4, secureIdentityReference: identity.secureIdentityReference, identityVerified: true, createdAt: '2026-08-03T05:00:00.000Z' } as CheckinatworkParticipant
    const input = { site, participant, registrationDate: '2026-08-03', clientReference: 'bouwflow:site-1:participant-1:2026-08-03' }
    const first = await gateway.register(input)
    const second = await gateway.register(input)
    expect(first.receiptNumber).toBe(second.receiptNumber)
  })

  it('accepteert nooit een onbeveiligde productie-adapter', () => {
    expect(() => new HttpCheckinatworkGateway('http://adapter.example.test', 'token', true)).toThrowError(CheckinatworkGatewayError)
  })
})
