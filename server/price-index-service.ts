import ExcelJS from 'exceljs'
import { PDFParse } from 'pdf-parse'
import type { LaborPriceIndexValue, MaterialPriceIndexValue, PriceIndexCatalogue, PriceIndexSource } from '../src/domain.js'

export const I2021_SOURCE_URL='https://economie.fgov.be/sites/default/files/Files/Entreprises/prix-construction-Indice-I-2021.xlsx'
export const LABOR_CURRENT_SOURCE_URL='https://economie.fgov.be/sites/default/files/Files/Entreprises/prijzen-bouw-waarden-S-s.pdf'
export const LABOR_HISTORY_SOURCE_URL='https://economie.fgov.be/sites/default/files/Files/Entreprises/prijzen-bouw-waarden-S-s-Historiek.pdf'

type Fetcher=(input:string|URL|Request,init?:RequestInit)=>Promise<Response>

const isoDate=(value:Date)=>value.toISOString().slice(0,10)
const belgianDate=(value:string)=>{const [day,month,year]=value.split('/');return `${year}-${month}-${day}`}
const decimal=(value:string)=>Number(value.replace(/\./g,'').replace(',','.'))

function excelPeriod(value:unknown):string|undefined {
  if (value instanceof Date) return isoDate(value).slice(0,7)
  if (typeof value==='object'&&value&&'result' in value) return excelPeriod((value as {result?:unknown}).result)
  if (typeof value!=='string') return undefined
  const direct=value.match(/^(\d{4})-(\d{2})/)
  if (direct) return `${direct[1]}-${direct[2]}`
  const months:Record<string,string>={jan:'01',feb:'02',mrt:'03',apr:'04',mei:'05',jun:'06',jul:'07',aug:'08',sep:'09',okt:'10',nov:'11',dec:'12'}
  const localized=value.toLocaleLowerCase().match(/^([a-z]{3})-(\d{2})$/)
  return localized&&months[localized[1]]?`20${localized[2]}-${months[localized[1]]}`:undefined
}

export async function parseI2021Workbook(data:Uint8Array):Promise<MaterialPriceIndexValue[]> {
  const workbook=new ExcelJS.Workbook()
  await workbook.xlsx.load(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength) as ArrayBuffer)
  const sheet=workbook.getWorksheet('I_2021 (Nl)')??workbook.getWorksheet('I_2021 (Fr)')
  if (!sheet) throw new Error('Werkblad I-2021 ontbreekt in het officiële bestand')
  const header=sheet.getRow(2)
  const resultRow=sheet.getRow(33)
  const values:MaterialPriceIndexValue[]=[]
  for(let column=4;column<=sheet.columnCount;column+=1){
    const period=excelPeriod(header.getCell(column).value)
    const raw=resultRow.getCell(column).value
    const value=typeof raw==='number'?raw:typeof raw==='object'&&raw&&'result' in raw?Number((raw as {result?:unknown}).result):Number(raw)
    if(period&&Number.isFinite(value)&&value>0) values.push({series:'I-2021',period,value:Math.round(value*10_000)/10_000})
  }
  if(!values.length) throw new Error('Geen I-2021-indexwaarden gevonden in het officiële bestand')
  return values.sort((a,b)=>a.period.localeCompare(b.period))
}

export function parseLaborIndexText(text:string):LaborPriceIndexValue[] {
  const normalized=text.replace(/\r/g,'')
  const sectionPattern=/Waarden\s+kleine\s+"s"\s+op\s+(\d{2}\/\d{2}\/\d{4})\s+voor\s+de\s+offerten\s+neergelegd\s+vanaf\s+11\/06\/2007\s+en\s+grote\s+"S"\s+voor\s+de\s+aanbestedingen\s+vanaf\s+(\d{2}\/\d{2}\/\d{4})\./g
  const starts=[...normalized.matchAll(sectionPattern)]
  const employerSizes:LaborPriceIndexValue['employerSize'][]=['Minder dan 10','10 tot 20','Meer dan 20']
  const categories:LaborPriceIndexValue['category'][]=['A','B','C','D']
  const values:LaborPriceIndexValue[]=[]
  starts.forEach(match=>{
    const sectionStart=(match.index??0)+match[0].length
    const nextAnySection=normalized.slice(sectionStart).search(/Waarden\s+kleine\s+"s"\s+op\s+/)
    const section=normalized.slice(sectionStart,nextAnySection<0?undefined:sectionStart+nextAnySection)
    const smallEffectiveDate=belgianDate(match[1])
    const baseEffectiveDate=belgianDate(match[2])
    const employerBlocks=[
      section.match(/a\)\s+voor werkgevers die minder dan 10 werklieden tewerkstellen\.([\s\S]*?)(?=\nb\))/i)?.[1],
      section.match(/b\)\s+voor werkgevers die 10 tot 20 werklieden tewerkstellen\.([\s\S]*?)(?=\nc\))/i)?.[1],
      section.match(/c\)\s+voor werkgevers die meer dan 20 werklieden tewerkstellen\.([\s\S]*?)(?=\n--|\n\d+\/5|Waarden)/i)?.[1],
    ]
    employerBlocks.forEach((block,employerIndex)=>{
      const row=block?.match(/s\s+op\s+(\d+[,.]\d+)\s+(\d+[,.]\d+)\s+(\d+[,.]\d+)\s+(\d+[,.]\d+)/i)
      if(!row)return
      categories.forEach((category,categoryIndex)=>values.push({series:'S',smallEffectiveDate,baseEffectiveDate,employerSize:employerSizes[employerIndex],category,value:decimal(row[categoryIndex+1])}))
    })
  })
  const deduplicated=new Map(values.map(item=>[`${item.smallEffectiveDate}:${item.employerSize}:${item.category}`,item]))
  const result=[...deduplicated.values()].sort((a,b)=>a.smallEffectiveDate.localeCompare(b.smallEffectiveDate)||a.employerSize.localeCompare(b.employerSize)||a.category.localeCompare(b.category))
  if(!result.length) throw new Error('Geen S/s-indexwaarden gevonden in de officiële bestanden')
  return result
}

async function readResponse(response:Response,url:string,maxBytes:number) {
  if(!response.ok) throw new Error(`Officiële indexbron antwoordt met HTTP ${response.status}: ${url}`)
  const contentLength=Number(response.headers.get('content-length')??0)
  if(contentLength>maxBytes) throw new Error(`Officiële indexbron overschrijdt ${maxBytes} bytes: ${url}`)
  const bytes=new Uint8Array(await response.arrayBuffer())
  if(bytes.byteLength>maxBytes) throw new Error(`Officiële indexbron overschrijdt ${maxBytes} bytes: ${url}`)
  return bytes
}

async function pdfText(bytes:Uint8Array) {
  const parser=new PDFParse({data:bytes})
  try{return (await parser.getText()).text}finally{await parser.destroy()}
}

export interface PriceIndexProvider { catalogue(force?:boolean):Promise<PriceIndexCatalogue> }

export class OfficialBelgianPriceIndexService implements PriceIndexProvider {
  private cached?:{expiresAt:number;catalogue:PriceIndexCatalogue}
  private pending?:Promise<PriceIndexCatalogue>
  constructor(private readonly fetcher:Fetcher=fetch,private readonly cacheTtlMs=6*60*60*1000,private readonly now=()=>new Date()){}

  async catalogue(force=false):Promise<PriceIndexCatalogue>{
    if(!force&&this.cached&&this.cached.expiresAt>Date.now())return this.cached.catalogue
    if(this.pending)return this.pending
    this.pending=this.synchronize().finally(()=>{this.pending=undefined})
    const catalogue=await this.pending
    this.cached={catalogue,expiresAt:Date.now()+this.cacheTtlMs}
    return catalogue
  }

  private async synchronize():Promise<PriceIndexCatalogue>{
    const [materialResponse,currentLaborResponse,historyLaborResponse]=await Promise.all([
      this.fetcher(I2021_SOURCE_URL,{headers:{accept:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}}),
      this.fetcher(LABOR_CURRENT_SOURCE_URL,{headers:{accept:'application/pdf'}}),
      this.fetcher(LABOR_HISTORY_SOURCE_URL,{headers:{accept:'application/pdf'}}),
    ])
    const [materialBytes,currentLaborBytes,historyLaborBytes]=await Promise.all([
      readResponse(materialResponse,I2021_SOURCE_URL,10_000_000),readResponse(currentLaborResponse,LABOR_CURRENT_SOURCE_URL,5_000_000),readResponse(historyLaborResponse,LABOR_HISTORY_SOURCE_URL,20_000_000),
    ])
    const [material,currentLaborText,historyLaborText]=await Promise.all([parseI2021Workbook(materialBytes),pdfText(currentLaborBytes),pdfText(historyLaborBytes)])
    const labor=parseLaborIndexText(`${historyLaborText}\n${currentLaborText}`)
    const synchronizedAt=this.now().toISOString()
    const sources:PriceIndexSource[]=[
      {id:'fod-i2021',name:'FOD Economie · Index I-2021 en I+',url:I2021_SOURCE_URL,fetchedAt:synchronizedAt,publishedThrough:material.at(-1)!.period},
      {id:'fod-s',name:'FOD Economie · Waarden S en s',url:LABOR_CURRENT_SOURCE_URL,fetchedAt:synchronizedAt,publishedThrough:labor.at(-1)!.smallEffectiveDate},
    ]
    return {material,labor,sources,synchronizedAt}
  }
}

export class StaticPriceIndexProvider implements PriceIndexProvider {
  constructor(private readonly value:PriceIndexCatalogue){}
  async catalogue(){return this.value}
}
