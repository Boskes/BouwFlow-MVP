import { describe,expect,it,vi } from 'vitest'
import { MicrosoftGraphTokenProvider } from './peppol/microsoft365-notification.js'
import { createMicrosoft365MailService, Microsoft365MailService } from './microsoft365-mail.js'

describe('centrale Microsoft 365-mailbox',()=>{
  it('verstuurt uitsluitend vanuit de geconfigureerde mailbox en bewaart het bericht in Verzonden',async()=>{
    const fetchMock=vi.fn(async(input:string|URL|Request)=>String(input).includes('/token')
      ?new Response(JSON.stringify({access_token:'token',expires_in:3600}),{status:200,headers:{'content-type':'application/json'}})
      :new Response('',{status:202}))
    const fetcher=fetchMock as unknown as typeof fetch
    const service=new Microsoft365MailService('Bouw.Flow@bosis.be',new MicrosoftGraphTokenProvider('tenant','client','secret',fetcher),fetcher)
    await service.send({to:['klant@example.be'],subject:'Project 24001',body:'Bericht',idempotencyKey:'mail-1'})
    expect(fetchMock.mock.calls[1][0]).toBe('https://graph.microsoft.com/v1.0/users/Bouw.Flow%40bosis.be/sendMail')
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toMatchObject({saveToSentItems:true,message:{toRecipients:[{emailAddress:{address:'klant@example.be'}}],internetMessageHeaders:[{name:'x-bouwflow-idempotency-key',value:'mail-1'}]}})
  })

  it('synchroniseert Postvak IN en Verzonden met de BouwFlow-correlatiesleutel',async()=>{
    const fetchMock=vi.fn(async(input:string|URL|Request)=>{
      const url=String(input)
      if(url.includes('/token'))return new Response(JSON.stringify({access_token:'token',expires_in:3600}),{status:200,headers:{'content-type':'application/json'}})
      const incoming=url.includes('/inbox/')
      return new Response(JSON.stringify({value:[{id:incoming?'in-1':'out-1',subject:incoming?'Vraag werf':'Antwoord werf',bodyPreview:'Project 24001',from:{emailAddress:{name:incoming?'Klant':'BouwFlow',address:incoming?'klant@example.be':'Bouw.Flow@bosis.be'}},toRecipients:[{emailAddress:{address:incoming?'Bouw.Flow@bosis.be':'klant@example.be'}}],receivedDateTime:incoming?'2026-08-01T08:00:00Z':undefined,sentDateTime:incoming?undefined:'2026-08-01T09:00:00Z',internetMessageHeaders:incoming?[]:[{name:'x-bouwflow-idempotency-key',value:'mail-1'}]}]}),{status:200,headers:{'content-type':'application/json'}})
    })
    const fetcher=fetchMock as unknown as typeof fetch
    const service=new Microsoft365MailService('Bouw.Flow@bosis.be',new MicrosoftGraphTokenProvider('tenant','client','secret',fetcher),fetcher)
    const messages=await service.synchronize()
    expect(messages).toEqual(expect.arrayContaining([expect.objectContaining({providerMessageId:'in-1',direction:'Inkomend'}),expect.objectContaining({providerMessageId:'out-1',direction:'Uitgaand',correlationKey:'mail-1'})]))
  })

  it('beantwoordt een inkomend bericht binnen de bestaande Microsoft 365-conversatie',async()=>{
    const fetchMock=vi.fn(async(input:string|URL|Request)=>String(input).includes('/token')
      ?new Response(JSON.stringify({access_token:'token',expires_in:3600}),{status:200,headers:{'content-type':'application/json'}})
      :new Response('',{status:202}))
    const fetcher=fetchMock as unknown as typeof fetch
    const service=new Microsoft365MailService('Bouw.Flow@bosis.be',new MicrosoftGraphTokenProvider('tenant','client','secret',fetcher),fetcher)
    await service.reply('graph/message+1','Bedankt, we nemen dit mee in de projectopvolging.')
    expect(fetchMock.mock.calls[1][0]).toBe('https://graph.microsoft.com/v1.0/users/Bouw.Flow%40bosis.be/messages/graph%2Fmessage%2B1/reply')
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({comment:'Bedankt, we nemen dit mee in de projectopvolging.'})
  })

  it('vereist een volledige configuratie en ondersteunt de centrale env-namen',()=>{
    expect(createMicrosoft365MailService({})).toBeUndefined()
    expect(()=>createMicrosoft365MailService({M365_MAIL_MAILBOX:'x'} as never)).not.toThrow()
    expect(()=>createMicrosoft365MailService({M365_MAIL_TENANT_ID:'tenant'})).toThrow('onvolledig')
    expect(createMicrosoft365MailService({M365_MAIL_TENANT_ID:'tenant',M365_MAIL_CLIENT_ID:'client',M365_MAIL_CLIENT_SECRET:'secret',M365_MAILBOX:'Bouw.Flow@bosis.be'})).toBeInstanceOf(Microsoft365MailService)
  })
})
