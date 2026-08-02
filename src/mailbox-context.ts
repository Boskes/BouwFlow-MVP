import type { MailboxMessage } from './domain'

export type MailboxDossierReference = { type: 'organization' | 'opportunity' | 'project'; id: string }

export const messageBelongsToDossier = (message: MailboxMessage, context: MailboxDossierReference) => context.type === 'project'
  ? message.projectId === context.id
  : context.type === 'opportunity'
    ? message.opportunityId === context.id
    : message.organizationId === context.id
