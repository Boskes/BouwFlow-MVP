import { describe, expect, it } from 'vitest'
import { messageBelongsToDossier } from './mailbox-context'
import type { MailboxMessage } from './domain'

const message: MailboxMessage = {
  id: 'mail-1', providerMessageId: 'graph-1', direction: 'Inkomend', fromName: 'Klant', fromAddress: 'klant@example.be',
  toRecipients: [{ name: 'BouwFlow', address: 'bouw.flow@bosis.be' }], ccRecipients: [], subject: 'Vraag', bodyPreview: 'Detail',
  isRead: true, hasAttachments: false, organizationId: 'org-1', opportunityId: 'opp-1', projectId: 'project-1', synchronizedAt: '2026-08-02T10:00:00Z',
}

describe('contextuele dossiermail', () => {
  it('toont een bericht alleen in het gekoppelde relatie-, opportuniteit- of projectdossier', () => {
    expect(messageBelongsToDossier(message, { type: 'organization', id: 'org-1' })).toBe(true)
    expect(messageBelongsToDossier(message, { type: 'opportunity', id: 'opp-1' })).toBe(true)
    expect(messageBelongsToDossier(message, { type: 'project', id: 'project-1' })).toBe(true)
    expect(messageBelongsToDossier(message, { type: 'project', id: 'project-2' })).toBe(false)
  })
})
