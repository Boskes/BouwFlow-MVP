import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, CheckCircle2, ExternalLink, Mail, Paperclip, RefreshCw, Reply, Search, Send } from 'lucide-react'
import type { MailboxComposeInput, MailboxMessage, MailboxOverview, MailboxReplyInput } from './domain'
import { messageBelongsToDossier } from './mailbox-context'

export interface DossierEmailContext {
  type: 'organization' | 'opportunity' | 'project'
  id: string
  label: string
  reference: string
  organizationId: string
  defaultRecipient?: string
}

interface DossierEmailActions {
  mailbox(): Promise<MailboxOverview>
  synchronizeMailbox(): Promise<MailboxOverview>
  sendMailboxMessage(input: MailboxComposeInput): Promise<MailboxMessage | undefined>
  replyMailboxMessage(id: string, input: MailboxReplyInput): Promise<{ sent: true } | undefined>
}

const emptyOverview: MailboxOverview = { configured: false, mailbox: '', messages: [] }
const splitAddresses = (value: string) => value.split(/[;,\n]/).map(item => item.trim()).filter(Boolean)

export default function DossierEmailTab({ context, actions }: { context: DossierEmailContext; actions: DossierEmailActions }) {
  const [overview, setOverview] = useState<MailboxOverview>(emptyOverview)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string>()
  const [composeOpen, setComposeOpen] = useState(false)
  const [replyingTo, setReplyingTo] = useState<MailboxMessage>()
  const [compose, setCompose] = useState({ to: context.defaultRecipient ?? '', cc: '', subject: `[${context.reference}] `, body: '' })
  const [replyBody, setReplyBody] = useState('')

  const dossierMessages = useMemo(() => overview.messages.filter(message => messageBelongsToDossier(message, { type: context.type, id: context.id })), [overview.messages, context.id, context.type])
  const messages = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase()
    if (!normalized) return dossierMessages
    return dossierMessages.filter(item => `${item.subject} ${item.fromName} ${item.fromAddress} ${item.bodyPreview}`.toLocaleLowerCase().includes(normalized))
  }, [dossierMessages, query])
  const selected = messages.find(item => item.id === selectedId) ?? messages[0]

  useEffect(() => {
    let active = true
    setLoading(true); setError(''); setNotice(''); setSelectedId(undefined)
    setCompose({ to: context.defaultRecipient ?? '', cc: '', subject: `[${context.reference}] `, body: '' })
    void actions.mailbox().then(result => {
      if (!active) return
      setOverview(result)
      setLoading(false)
    }).catch(value => {
      if (!active) return
      setError(value instanceof Error ? value.message : 'De dossiermail kon niet worden geladen.')
      setLoading(false)
    })
    return () => { active = false }
  }, [actions, context.defaultRecipient, context.id, context.reference, context.type])

  const synchronize = async () => {
    setSyncing(true); setError(''); setNotice('')
    try { setOverview(await actions.synchronizeMailbox()) }
    catch (value) { setError(value instanceof Error ? value.message : 'Synchronisatie mislukt.') }
    finally { setSyncing(false) }
  }

  const links = (): Pick<MailboxComposeInput, 'organizationId' | 'opportunityId' | 'projectId'> => ({
    organizationId: context.organizationId,
    opportunityId: context.type === 'opportunity' ? context.id : undefined,
    projectId: context.type === 'project' ? context.id : undefined,
  })

  const send = async (event: FormEvent) => {
    event.preventDefault(); setSending(true); setError(''); setNotice('')
    try {
      const message = await actions.sendMailboxMessage({ to: splitAddresses(compose.to), cc: splitAddresses(compose.cc), subject: compose.subject, body: compose.body, ...links() })
      if (message) setOverview(current => ({ ...current, messages: [message, ...current.messages] }))
      setComposeOpen(false)
      setCompose({ to: context.defaultRecipient ?? '', cc: '', subject: `[${context.reference}] `, body: '' })
      setNotice('De e-mail is verzonden en aan dit dossier gekoppeld.')
    } catch (value) { setError(value instanceof Error ? value.message : 'De e-mail kon niet worden verzonden.') }
    finally { setSending(false) }
  }

  const reply = async (event: FormEvent) => {
    event.preventDefault()
    if (!replyingTo) return
    setSending(true); setError(''); setNotice('')
    try {
      await actions.replyMailboxMessage(replyingTo.id, { body: replyBody })
      setReplyingTo(undefined); setReplyBody('')
      setNotice(`Je antwoord aan ${replyingTo.fromName || replyingTo.fromAddress} is via Microsoft 365 verzonden.`)
      void actions.synchronizeMailbox().then(setOverview).catch(() => undefined)
    } catch (value) { setError(value instanceof Error ? value.message : 'Het antwoord kon niet worden verzonden.') }
    finally { setSending(false) }
  }

  return <div className="dossier-email-tab">
    <section className="panel dossier-email-header">
      <div><p className="eyebrow">Dossiercommunicatie</p><h3>E-mail voor {context.reference}</h3><span>Alle berichten die aan <strong>{context.label}</strong> gekoppeld zijn.</span></div>
      <div className={`mailbox-connection ${overview.configured ? 'ready' : ''}`}>{overview.configured ? <CheckCircle2 size={19}/> : <AlertTriangle size={19}/>}<span><strong>{overview.configured ? overview.mailbox : 'Mailbox niet verbonden'}</strong><small>{overview.lastSynchronizedAt ? `Bijgewerkt ${new Date(overview.lastSynchronizedAt).toLocaleString('nl-BE')}` : 'Nog niet gesynchroniseerd'}</small></span></div>
    </section>
    {error && <div className="mailbox-alert"><AlertTriangle size={17}/><span>{error}</span></div>}
    {notice && <div className="mailbox-notice"><CheckCircle2 size={17}/><span>{notice}</span></div>}
    <section className="panel mailbox-toolbar">
      <label className="mailbox-search"><Search size={16}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Zoek binnen dit dossier…"/></label>
      <button className="secondary" disabled={!overview.configured || syncing} onClick={() => void synchronize()}><RefreshCw size={15} className={syncing ? 'spin' : ''}/>{syncing ? 'Synchroniseren…' : 'Synchroniseren'}</button>
      <button className="primary" disabled={!overview.configured} onClick={() => setComposeOpen(true)}><Send size={15}/>Nieuwe e-mail</button>
    </section>
    <div className="mailbox-layout dossier-mailbox-layout">
      <section className="panel mailbox-list">{loading ? <div className="mailbox-empty">Dossiermail laden…</div> : messages.map(message => <button key={message.id} className={selected?.id === message.id ? 'active' : ''} onClick={() => setSelectedId(message.id)}><span className={`mailbox-direction ${message.direction === 'Inkomend' ? 'incoming' : 'outgoing'}`}>{message.direction === 'Inkomend' ? <ArrowDownLeft size={15}/> : <ArrowUpRight size={15}/>}</span><span className="mailbox-list-copy"><strong>{message.direction === 'Inkomend' ? message.fromName || message.fromAddress : message.toRecipients.map(item => item.name || item.address).join(', ')}</strong><b>{message.subject}</b><small>{message.bodyPreview}</small></span><span className="mailbox-list-meta"><time>{new Date(message.receivedAt ?? message.sentAt ?? message.synchronizedAt).toLocaleDateString('nl-BE', { day: '2-digit', month: 'short' })}</time>{message.hasAttachments && <Paperclip size={13}/>}</span></button>)}{!loading && !messages.length && <div className="mailbox-empty"><Mail size={28}/><strong>Nog geen gekoppelde e-mails</strong><span>Stuur een nieuw bericht vanuit dit dossier of koppel bestaande mail via de centrale mailbox.</span></div>}</section>
      <section className="panel mailbox-detail">{selected ? <><header><div><p className="eyebrow">{selected.direction}</p><h2>{selected.subject}</h2></div><div className="dossier-mail-actions">{selected.direction === 'Inkomend' && <button className="primary" onClick={() => { setReplyingTo(selected); setReplyBody('') }}><Reply size={14}/>Beantwoorden</button>}{selected.webLink && <a className="secondary" href={selected.webLink} target="_blank" rel="noreferrer">Outlook <ExternalLink size={14}/></a>}</div></header><dl><div><dt>Van</dt><dd>{selected.fromName || selected.fromAddress} {selected.fromName && <small>{selected.fromAddress}</small>}</dd></div><div><dt>Aan</dt><dd>{selected.toRecipients.map(item => item.name || item.address).join(', ')}</dd></div><div><dt>Datum</dt><dd>{new Date(selected.receivedAt ?? selected.sentAt ?? selected.synchronizedAt).toLocaleString('nl-BE')}</dd></div></dl><article className="mailbox-preview">{selected.bodyPreview || 'Geen tekstvoorbeeld beschikbaar.'}</article></> : <div className="mailbox-empty">Selecteer een bericht om de inhoud te bekijken.</div>}</section>
    </div>
    {composeOpen && <div className="dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setComposeOpen(false) }}><form className="dialog mailbox-compose" onSubmit={send}><header><div><p className="eyebrow">Van {overview.mailbox}</p><h2>Nieuwe dossiermail</h2></div><button type="button" className="secondary" onClick={() => setComposeOpen(false)}>Sluiten</button></header><div className="dossier-email-context"><Mail size={16}/><span>Wordt automatisch gekoppeld aan <strong>{context.reference} · {context.label}</strong></span></div><label>Aan<input required value={compose.to} onChange={event => setCompose({ ...compose, to: event.target.value })} placeholder="naam@bedrijf.be; tweede@bedrijf.be"/></label><label>CC<input value={compose.cc} onChange={event => setCompose({ ...compose, cc: event.target.value })}/></label><label>Onderwerp<input required value={compose.subject} onChange={event => setCompose({ ...compose, subject: event.target.value })}/></label><label>Bericht<textarea required rows={10} value={compose.body} onChange={event => setCompose({ ...compose, body: event.target.value })}/></label><footer><button type="button" className="secondary" onClick={() => setComposeOpen(false)}>Annuleren</button><button className="primary" disabled={sending}><Send size={15}/>{sending ? 'Versturen…' : 'Versturen via Microsoft 365'}</button></footer></form></div>}
    {replyingTo && <div className="dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setReplyingTo(undefined) }}><form className="dialog mailbox-compose" onSubmit={reply}><header><div><p className="eyebrow">Antwoord via {overview.mailbox}</p><h2>{replyingTo.subject.startsWith('Re:') ? replyingTo.subject : `Re: ${replyingTo.subject}`}</h2></div><button type="button" className="secondary" onClick={() => setReplyingTo(undefined)}>Sluiten</button></header><div className="dossier-email-context"><Reply size={16}/><span>Aan <strong>{replyingTo.fromName || replyingTo.fromAddress}</strong>, binnen de bestaande Outlook-conversatie.</span></div><label>Antwoord<textarea required autoFocus rows={10} value={replyBody} onChange={event => setReplyBody(event.target.value)}/></label><footer><button type="button" className="secondary" onClick={() => setReplyingTo(undefined)}>Annuleren</button><button className="primary" disabled={sending}><Reply size={15}/>{sending ? 'Versturen…' : 'Antwoord versturen'}</button></footer></form></div>}
  </div>
}
