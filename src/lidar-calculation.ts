import type { BoqItem } from './domain.js'

export type LidarSurveyPurpose = 'Calculatie-opname' | 'Nulmeting' | 'Vorderingsopname' | 'As-built'
export type LidarElementKind = 'Ruimte' | 'Wand' | 'Vloer' | 'Plafond' | 'Deur' | 'Raam' | 'Kolom' | 'Trap' | 'Dak' | 'Stopcontact' | 'Schakelaar' | 'Lichtpunt' | 'Elektrisch bord' | 'Datapunt' | 'Detector' | 'Leiding' | 'Afvoer' | 'Ventilatiekanaal' | 'Sanitair toestel' | 'Verwarmingstoestel' | 'Technische installatie' | 'Buitenobject' | 'Vrij element'
export type LidarWorkDiscipline = 'Voorbereiding' | 'Afbraak' | 'Ruwbouw' | 'Dak' | 'Buitenschil' | 'Binnenafwerking' | 'Schilderwerken' | 'Vloeren' | 'Elektriciteit' | 'Data & beveiliging' | 'Sanitair' | 'HVAC' | 'Brandveiligheid' | 'Buitenaanleg' | 'Controle & keuring'
export type LidarQuantityBasis = 'Oppervlakte' | 'Lengte' | 'Volume' | 'Aantal' | 'Punt' | 'Forfait'
export type LidarEvidenceKind = 'LiDAR-meting' | 'Foto' | 'Dagrapport' | 'Manuele bevestiging' | 'Keuringsdocument'

export interface LidarSurveyElement {
  id: string
  roomId: string
  roomName: string
  kind: LidarElementKind
  label: string
  sourceElementId?: string
  areaM2?: number
  netAreaM2?: number
  lengthM?: number
  volumeM3?: number
  count?: number
  confidencePct: number
  photoArtifactIds: string[]
}

export interface LidarWorkCatalogItem {
  code: string
  name: string
  discipline: LidarWorkDiscipline
  elementKinds: LidarElementKind[]
  unit: 'm²' | 'm³' | 'm' | 'st' | 'punt' | 'forfait'
  quantityBasis: LidarQuantityBasis
  labor: number
  material: number
  equipment: number
  subcontracting: number
  wastePct: number
  evidence: LidarEvidenceKind[]
  description: string
}

export interface LidarWorkAssignment {
  id: string
  catalogCode: string
  elementIds: string[]
  description?: string
  quantityOverride?: number
  wastePct?: number
  notes?: string
  photoArtifactIds: string[]
  dailyReportIds: string[]
  inspectionDocumentIds: string[]
  manuallyConfirmed: boolean
}

export interface LidarCalculationProposalItem {
  id: string
  assignmentId: string
  catalogCode: string
  discipline: LidarWorkDiscipline
  roomNames: string[]
  sourceElementIds: string[]
  quantity: number
  unit: string
  confidencePct: number
  evidenceComplete: boolean
  reviewReasons: string[]
  boqItem: Omit<BoqItem, 'id' | 'chapterId' | 'sortOrder' | 'costApplications'>
}

export interface LidarCalculationProposal {
  id: string
  scanSessionId: string
  calculationId: string
  status: 'Concept' | 'Ter controle' | 'Goedgekeurd' | 'Toegepast'
  items: LidarCalculationProposalItem[]
  reviewReasons: string[]
  directCost: number
  createdAt: string
  approvedBy?: string
  approvedAt?: string
  appliedAt?: string
  createdItemIds?: string[]
}

type WorkSeed = Omit<LidarWorkCatalogItem, 'description'> & { description?: string }
const work = (seed: WorkSeed): LidarWorkCatalogItem => ({ ...seed, description: seed.description ?? `${seed.name}; hoeveelheid uit scan meten en voor uitvoering controleren.` })
const ev = (...items: LidarEvidenceKind[]) => items

export const LIDAR_WORK_CATALOG: LidarWorkCatalogItem[] = [
  work({code:'VBR-010',name:'Werfzone afschermen en beschermen',discipline:'Voorbereiding',elementKinds:['Ruimte','Vloer','Vrij element'],unit:'m²',quantityBasis:'Oppervlakte',labor:5.4,material:2.8,equipment:.7,subcontracting:0,wastePct:5,evidence:ev('LiDAR-meting','Foto','Manuele bevestiging')}),
  work({code:'VBR-020',name:'Meubilair en inrichting verplaatsen',discipline:'Voorbereiding',elementKinds:['Ruimte','Vrij element'],unit:'forfait',quantityBasis:'Forfait',labor:165,material:15,equipment:20,subcontracting:0,wastePct:0,evidence:ev('Foto','Dagrapport','Manuele bevestiging')}),
  work({code:'AFB-010',name:'Niet-dragende wand uitbreken',discipline:'Afbraak',elementKinds:['Wand'],unit:'m²',quantityBasis:'Oppervlakte',labor:22,material:0,equipment:7.5,subcontracting:0,wastePct:12,evidence:ev('LiDAR-meting','Foto','Dagrapport','Manuele bevestiging')}),
  work({code:'AFB-020',name:'Vloerafwerking uitbreken',discipline:'Afbraak',elementKinds:['Vloer'],unit:'m²',quantityBasis:'Oppervlakte',labor:15,material:0,equipment:5,subcontracting:0,wastePct:10,evidence:ev('LiDAR-meting','Foto','Dagrapport')}),
  work({code:'AFB-030',name:'Plafondbekleding verwijderen',discipline:'Afbraak',elementKinds:['Plafond'],unit:'m²',quantityBasis:'Oppervlakte',labor:13.5,material:0,equipment:3,subcontracting:0,wastePct:10,evidence:ev('LiDAR-meting','Foto','Dagrapport')}),
  work({code:'AFB-040',name:'Deur en omlijsting verwijderen',discipline:'Afbraak',elementKinds:['Deur'],unit:'st',quantityBasis:'Aantal',labor:68,material:0,equipment:8,subcontracting:0,wastePct:0,evidence:ev('LiDAR-meting','Foto','Dagrapport')}),
  work({code:'AFB-050',name:'Raam verwijderen',discipline:'Afbraak',elementKinds:['Raam'],unit:'st',quantityBasis:'Aantal',labor:125,material:0,equipment:18,subcontracting:0,wastePct:0,evidence:ev('LiDAR-meting','Foto','Dagrapport')}),
  work({code:'AFB-060',name:'Technische leidingen demonteren',discipline:'Afbraak',elementKinds:['Leiding','Afvoer','Ventilatiekanaal'],unit:'m',quantityBasis:'Lengte',labor:11,material:0,equipment:2,subcontracting:0,wastePct:5,evidence:ev('LiDAR-meting','Foto','Dagrapport')}),
  work({code:'RUW-010',name:'Nieuwe snelbouw- of kalkzandsteenwand',discipline:'Ruwbouw',elementKinds:['Wand'],unit:'m²',quantityBasis:'Oppervlakte',labor:42,material:39,equipment:4,subcontracting:0,wastePct:7,evidence:ev('LiDAR-meting','Foto','Dagrapport','Manuele bevestiging')}),
  work({code:'RUW-020',name:'Opening dichtmetselen',discipline:'Ruwbouw',elementKinds:['Deur','Raam','Wand'],unit:'m²',quantityBasis:'Oppervlakte',labor:49,material:44,equipment:5,subcontracting:0,wastePct:8,evidence:ev('LiDAR-meting','Foto','Dagrapport')}),
  work({code:'RUW-030',name:'Nieuwe opening met latei maken',discipline:'Ruwbouw',elementKinds:['Wand','Deur','Raam'],unit:'st',quantityBasis:'Aantal',labor:275,material:180,equipment:95,subcontracting:0,wastePct:5,evidence:ev('LiDAR-meting','Foto','Dagrapport','Keuringsdocument','Manuele bevestiging')}),
  work({code:'RUW-040',name:'Betonherstelling',discipline:'Ruwbouw',elementKinds:['Wand','Vloer','Kolom','Trap'],unit:'m²',quantityBasis:'Oppervlakte',labor:58,material:47,equipment:8,subcontracting:0,wastePct:8,evidence:ev('LiDAR-meting','Foto','Dagrapport','Manuele bevestiging')}),
  work({code:'DAK-010',name:'Dakbedekking vernieuwen',discipline:'Dak',elementKinds:['Dak'],unit:'m²',quantityBasis:'Oppervlakte',labor:32,material:54,equipment:8,subcontracting:0,wastePct:10,evidence:ev('LiDAR-meting','Foto','Dagrapport')}),
  work({code:'DAK-020',name:'Dakisolatie plaatsen',discipline:'Dak',elementKinds:['Dak'],unit:'m²',quantityBasis:'Oppervlakte',labor:15,material:31,equipment:2,subcontracting:0,wastePct:6,evidence:ev('LiDAR-meting','Foto','Dagrapport','Manuele bevestiging')}),
  work({code:'GEV-010',name:'Gevelisolatie met afwerking',discipline:'Buitenschil',elementKinds:['Wand'],unit:'m²',quantityBasis:'Oppervlakte',labor:48,material:73,equipment:12,subcontracting:0,wastePct:8,evidence:ev('LiDAR-meting','Foto','Dagrapport')}),
  work({code:'GEV-020',name:'Buitenschrijnwerk vervangen',discipline:'Buitenschil',elementKinds:['Raam','Deur'],unit:'st',quantityBasis:'Aantal',labor:185,material:740,equipment:25,subcontracting:0,wastePct:0,evidence:ev('LiDAR-meting','Foto','Dagrapport','Keuringsdocument')}),
  work({code:'BIN-010',name:'Voorzetwand in gipskarton',discipline:'Binnenafwerking',elementKinds:['Wand'],unit:'m²',quantityBasis:'Oppervlakte',labor:31,material:28,equipment:2,subcontracting:0,wastePct:8,evidence:ev('LiDAR-meting','Foto','Dagrapport')}),
  work({code:'BIN-020',name:'Scheidingswand in gipskarton',discipline:'Binnenafwerking',elementKinds:['Wand'],unit:'m²',quantityBasis:'Oppervlakte',labor:39,material:43,equipment:3,subcontracting:0,wastePct:8,evidence:ev('LiDAR-meting','Foto','Dagrapport')}),
  work({code:'BIN-030',name:'Pleisterwerk herstellen',discipline:'Binnenafwerking',elementKinds:['Wand','Plafond'],unit:'m²',quantityBasis:'Oppervlakte',labor:23,material:9,equipment:1,subcontracting:0,wastePct:7,evidence:ev('LiDAR-meting','Foto','Manuele bevestiging')}),
  work({code:'BIN-040',name:'Volledig nieuw binnenpleisterwerk',discipline:'Binnenafwerking',elementKinds:['Wand','Plafond'],unit:'m²',quantityBasis:'Oppervlakte',labor:29,material:12,equipment:2,subcontracting:0,wastePct:7,evidence:ev('LiDAR-meting','Foto','Dagrapport')}),
  work({code:'BIN-050',name:'Verlaagd plafond plaatsen',discipline:'Binnenafwerking',elementKinds:['Plafond'],unit:'m²',quantityBasis:'Oppervlakte',labor:36,material:39,equipment:4,subcontracting:0,wastePct:8,evidence:ev('LiDAR-meting','Foto','Dagrapport')}),
  work({code:'BIN-060',name:'Binnendeur met omlijsting plaatsen',discipline:'Binnenafwerking',elementKinds:['Deur'],unit:'st',quantityBasis:'Aantal',labor:165,material:460,equipment:10,subcontracting:0,wastePct:0,evidence:ev('LiDAR-meting','Foto','Manuele bevestiging')}),
  work({code:'SCH-010',name:'Wanden schilderen: primer en twee lagen',discipline:'Schilderwerken',elementKinds:['Wand'],unit:'m²',quantityBasis:'Oppervlakte',labor:16.5,material:6.2,equipment:.8,subcontracting:0,wastePct:5,evidence:ev('LiDAR-meting','Foto','Dagrapport','Manuele bevestiging')}),
  work({code:'SCH-020',name:'Plafonds schilderen: primer en twee lagen',discipline:'Schilderwerken',elementKinds:['Plafond'],unit:'m²',quantityBasis:'Oppervlakte',labor:18.5,material:6.7,equipment:1.2,subcontracting:0,wastePct:5,evidence:ev('LiDAR-meting','Foto','Dagrapport','Manuele bevestiging')}),
  work({code:'SCH-030',name:'Binnenschrijnwerk schilderen',discipline:'Schilderwerken',elementKinds:['Deur','Raam','Trap'],unit:'st',quantityBasis:'Aantal',labor:92,material:24,equipment:2,subcontracting:0,wastePct:5,evidence:ev('Foto','Dagrapport','Manuele bevestiging')}),
  work({code:'VLO-010',name:'Chape plaatsen',discipline:'Vloeren',elementKinds:['Vloer'],unit:'m²',quantityBasis:'Oppervlakte',labor:15,material:17,equipment:2.5,subcontracting:0,wastePct:6,evidence:ev('LiDAR-meting','Foto','Dagrapport')}),
  work({code:'VLO-020',name:'Vloertegels plaatsen',discipline:'Vloeren',elementKinds:['Vloer'],unit:'m²',quantityBasis:'Oppervlakte',labor:37,material:42,equipment:2,subcontracting:0,wastePct:10,evidence:ev('LiDAR-meting','Foto','Dagrapport')}),
  work({code:'VLO-030',name:'Wandtegels plaatsen',discipline:'Vloeren',elementKinds:['Wand'],unit:'m²',quantityBasis:'Oppervlakte',labor:41,material:39,equipment:2,subcontracting:0,wastePct:10,evidence:ev('LiDAR-meting','Foto','Dagrapport')}),
  work({code:'VLO-040',name:'Parket of laminaat plaatsen',discipline:'Vloeren',elementKinds:['Vloer'],unit:'m²',quantityBasis:'Oppervlakte',labor:24,material:46,equipment:1.5,subcontracting:0,wastePct:8,evidence:ev('LiDAR-meting','Foto','Dagrapport')}),
  work({code:'VLO-050',name:'Plinten plaatsen',discipline:'Vloeren',elementKinds:['Ruimte','Wand'],unit:'m',quantityBasis:'Lengte',labor:9.5,material:8,equipment:.5,subcontracting:0,wastePct:8,evidence:ev('LiDAR-meting','Foto')}),
  work({code:'ELE-010',name:'Stopcontact inbouw plaatsen',discipline:'Elektriciteit',elementKinds:['Stopcontact','Wand'],unit:'punt',quantityBasis:'Punt',labor:48,material:29,equipment:2,subcontracting:0,wastePct:3,evidence:ev('LiDAR-meting','Foto','Dagrapport','Keuringsdocument')}),
  work({code:'ELE-011',name:'Stopcontact opbouw plaatsen',discipline:'Elektriciteit',elementKinds:['Stopcontact','Wand'],unit:'punt',quantityBasis:'Punt',labor:34,material:24,equipment:1,subcontracting:0,wastePct:3,evidence:ev('LiDAR-meting','Foto','Dagrapport','Keuringsdocument')}),
  work({code:'ELE-020',name:'Schakelaar plaatsen',discipline:'Elektriciteit',elementKinds:['Schakelaar','Wand'],unit:'punt',quantityBasis:'Punt',labor:42,material:25,equipment:1,subcontracting:0,wastePct:3,evidence:ev('LiDAR-meting','Foto','Dagrapport','Keuringsdocument')}),
  work({code:'ELE-030',name:'Lichtpunt en bedrading voorzien',discipline:'Elektriciteit',elementKinds:['Lichtpunt','Plafond','Wand'],unit:'punt',quantityBasis:'Punt',labor:58,material:31,equipment:2,subcontracting:0,wastePct:5,evidence:ev('LiDAR-meting','Foto','Dagrapport','Keuringsdocument')}),
  work({code:'ELE-040',name:'LED-armatuur plaatsen',discipline:'Elektriciteit',elementKinds:['Lichtpunt','Plafond','Wand'],unit:'st',quantityBasis:'Aantal',labor:36,material:95,equipment:2,subcontracting:0,wastePct:0,evidence:ev('LiDAR-meting','Foto','Dagrapport','Keuringsdocument')}),
  work({code:'ELE-050',name:'Voedingskabel in buis of goot',discipline:'Elektriciteit',elementKinds:['Leiding','Wand','Plafond','Vloer'],unit:'m',quantityBasis:'Lengte',labor:8.5,material:6.5,equipment:.5,subcontracting:0,wastePct:8,evidence:ev('LiDAR-meting','Foto','Dagrapport','Keuringsdocument')}),
  work({code:'ELE-060',name:'Kabelgoot plaatsen',discipline:'Elektriciteit',elementKinds:['Leiding','Wand','Plafond'],unit:'m',quantityBasis:'Lengte',labor:14,material:18,equipment:1,subcontracting:0,wastePct:6,evidence:ev('LiDAR-meting','Foto','Dagrapport')}),
  work({code:'ELE-070',name:'Elektrisch verdeelbord plaatsen of vervangen',discipline:'Elektriciteit',elementKinds:['Elektrisch bord','Wand'],unit:'st',quantityBasis:'Aantal',labor:420,material:760,equipment:15,subcontracting:0,wastePct:0,evidence:ev('LiDAR-meting','Foto','Dagrapport','Keuringsdocument','Manuele bevestiging')}),
  work({code:'ELE-080',name:'Aarding en equipotentiale verbinding',discipline:'Elektriciteit',elementKinds:['Leiding','Technische installatie'],unit:'forfait',quantityBasis:'Forfait',labor:285,material:190,equipment:12,subcontracting:0,wastePct:3,evidence:ev('Foto','Dagrapport','Keuringsdocument','Manuele bevestiging')}),
  work({code:'DAT-010',name:'RJ45-datapunt plaatsen en testen',discipline:'Data & beveiliging',elementKinds:['Datapunt','Wand'],unit:'punt',quantityBasis:'Punt',labor:62,material:38,equipment:2,subcontracting:0,wastePct:5,evidence:ev('LiDAR-meting','Foto','Dagrapport','Keuringsdocument')}),
  work({code:'DAT-020',name:'Wifi-accesspoint plaatsen',discipline:'Data & beveiliging',elementKinds:['Technische installatie','Plafond','Wand'],unit:'st',quantityBasis:'Aantal',labor:85,material:210,equipment:3,subcontracting:0,wastePct:0,evidence:ev('LiDAR-meting','Foto','Dagrapport','Manuele bevestiging')}),
  work({code:'DAT-030',name:'Camera of toegangscontrolepunt plaatsen',discipline:'Data & beveiliging',elementKinds:['Technische installatie','Wand','Plafond'],unit:'punt',quantityBasis:'Punt',labor:120,material:265,equipment:4,subcontracting:0,wastePct:0,evidence:ev('LiDAR-meting','Foto','Dagrapport','Keuringsdocument')}),
  work({code:'SAN-010',name:'Koud- of warmwaterleiding plaatsen',discipline:'Sanitair',elementKinds:['Leiding','Wand','Vloer','Plafond'],unit:'m',quantityBasis:'Lengte',labor:17,material:13,equipment:1,subcontracting:0,wastePct:8,evidence:ev('LiDAR-meting','Foto','Dagrapport','Manuele bevestiging')}),
  work({code:'SAN-020',name:'Afvoerleiding plaatsen',discipline:'Sanitair',elementKinds:['Afvoer','Leiding','Vloer','Wand'],unit:'m',quantityBasis:'Lengte',labor:22,material:18,equipment:2,subcontracting:0,wastePct:8,evidence:ev('LiDAR-meting','Foto','Dagrapport','Manuele bevestiging')}),
  work({code:'SAN-030',name:'Toilet plaatsen en aansluiten',discipline:'Sanitair',elementKinds:['Sanitair toestel'],unit:'st',quantityBasis:'Aantal',labor:185,material:390,equipment:4,subcontracting:0,wastePct:0,evidence:ev('LiDAR-meting','Foto','Dagrapport','Manuele bevestiging')}),
  work({code:'SAN-040',name:'Wastafel plaatsen en aansluiten',discipline:'Sanitair',elementKinds:['Sanitair toestel'],unit:'st',quantityBasis:'Aantal',labor:145,material:320,equipment:3,subcontracting:0,wastePct:0,evidence:ev('LiDAR-meting','Foto','Dagrapport','Manuele bevestiging')}),
  work({code:'SAN-050',name:'Douche of bad plaatsen en aansluiten',discipline:'Sanitair',elementKinds:['Sanitair toestel','Vloer','Wand'],unit:'st',quantityBasis:'Aantal',labor:390,material:780,equipment:12,subcontracting:0,wastePct:3,evidence:ev('LiDAR-meting','Foto','Dagrapport','Manuele bevestiging')}),
  work({code:'SAN-060',name:'Sanitaire kraan plaatsen',discipline:'Sanitair',elementKinds:['Sanitair toestel'],unit:'st',quantityBasis:'Aantal',labor:72,material:145,equipment:1,subcontracting:0,wastePct:0,evidence:ev('Foto','Dagrapport','Manuele bevestiging')}),
  work({code:'HVA-010',name:'Radiator plaatsen en aansluiten',discipline:'HVAC',elementKinds:['Verwarmingstoestel','Wand'],unit:'st',quantityBasis:'Aantal',labor:195,material:430,equipment:5,subcontracting:0,wastePct:0,evidence:ev('LiDAR-meting','Foto','Dagrapport','Manuele bevestiging')}),
  work({code:'HVA-020',name:'Vloerverwarmingscircuit plaatsen',discipline:'HVAC',elementKinds:['Vloer','Leiding'],unit:'m²',quantityBasis:'Oppervlakte',labor:19,material:31,equipment:2,subcontracting:0,wastePct:7,evidence:ev('LiDAR-meting','Foto','Dagrapport','Keuringsdocument')}),
  work({code:'HVA-030',name:'Verwarmingsleiding plaatsen',discipline:'HVAC',elementKinds:['Leiding','Wand','Vloer','Plafond'],unit:'m',quantityBasis:'Lengte',labor:18,material:15,equipment:1,subcontracting:0,wastePct:8,evidence:ev('LiDAR-meting','Foto','Dagrapport','Manuele bevestiging')}),
  work({code:'HVA-040',name:'Ventilatiekanaal plaatsen',discipline:'HVAC',elementKinds:['Ventilatiekanaal','Plafond','Wand'],unit:'m',quantityBasis:'Lengte',labor:24,material:27,equipment:2,subcontracting:0,wastePct:8,evidence:ev('LiDAR-meting','Foto','Dagrapport')}),
  work({code:'HVA-050',name:'Ventiel of rooster plaatsen',discipline:'HVAC',elementKinds:['Ventilatiekanaal','Plafond','Wand'],unit:'st',quantityBasis:'Aantal',labor:48,material:52,equipment:1,subcontracting:0,wastePct:0,evidence:ev('LiDAR-meting','Foto','Dagrapport')}),
  work({code:'HVA-060',name:'Warmtepomp of ketel plaatsen',discipline:'HVAC',elementKinds:['Verwarmingstoestel','Technische installatie'],unit:'st',quantityBasis:'Aantal',labor:980,material:4250,equipment:180,subcontracting:0,wastePct:0,evidence:ev('LiDAR-meting','Foto','Dagrapport','Keuringsdocument','Manuele bevestiging')}),
  work({code:'BRD-010',name:'Rook- of branddetector plaatsen',discipline:'Brandveiligheid',elementKinds:['Detector','Plafond','Wand'],unit:'st',quantityBasis:'Aantal',labor:62,material:85,equipment:1,subcontracting:0,wastePct:0,evidence:ev('LiDAR-meting','Foto','Dagrapport','Keuringsdocument')}),
  work({code:'BRD-020',name:'Brandwerende doorvoering afdichten',discipline:'Brandveiligheid',elementKinds:['Wand','Vloer','Leiding','Ventilatiekanaal'],unit:'st',quantityBasis:'Aantal',labor:75,material:48,equipment:2,subcontracting:0,wastePct:5,evidence:ev('Foto','Dagrapport','Keuringsdocument','Manuele bevestiging')}),
  work({code:'BRD-030',name:'Branddeur plaatsen',discipline:'Brandveiligheid',elementKinds:['Deur'],unit:'st',quantityBasis:'Aantal',labor:240,material:1050,equipment:15,subcontracting:0,wastePct:0,evidence:ev('LiDAR-meting','Foto','Dagrapport','Keuringsdocument')}),
  work({code:'BUI-010',name:'Buitenverharding plaatsen',discipline:'Buitenaanleg',elementKinds:['Buitenobject','Vloer'],unit:'m²',quantityBasis:'Oppervlakte',labor:28,material:39,equipment:8,subcontracting:0,wastePct:8,evidence:ev('LiDAR-meting','Foto','Dagrapport')}),
  work({code:'BUI-020',name:'Riolering of drainage plaatsen',discipline:'Buitenaanleg',elementKinds:['Afvoer','Leiding','Buitenobject'],unit:'m',quantityBasis:'Lengte',labor:31,material:28,equipment:12,subcontracting:0,wastePct:8,evidence:ev('LiDAR-meting','Foto','Dagrapport','Manuele bevestiging')}),
  work({code:'BUI-030',name:'Omheining plaatsen',discipline:'Buitenaanleg',elementKinds:['Buitenobject'],unit:'m',quantityBasis:'Lengte',labor:24,material:52,equipment:4,subcontracting:0,wastePct:6,evidence:ev('LiDAR-meting','Foto','Dagrapport')}),
  work({code:'KEU-010',name:'Elektrische keuring',discipline:'Controle & keuring',elementKinds:['Elektrisch bord','Technische installatie'],unit:'forfait',quantityBasis:'Forfait',labor:0,material:0,equipment:0,subcontracting:245,wastePct:0,evidence:ev('Keuringsdocument','Manuele bevestiging')}),
  work({code:'KEU-020',name:'Drukproef sanitaire of verwarmingsleidingen',discipline:'Controle & keuring',elementKinds:['Leiding','Afvoer'],unit:'forfait',quantityBasis:'Forfait',labor:135,material:15,equipment:40,subcontracting:0,wastePct:0,evidence:ev('Dagrapport','Keuringsdocument','Manuele bevestiging')}),
  work({code:'KEU-030',name:'Ventilatiedebieten meten en inregelen',discipline:'Controle & keuring',elementKinds:['Ventilatiekanaal','Technische installatie'],unit:'forfait',quantityBasis:'Forfait',labor:165,material:0,equipment:55,subcontracting:0,wastePct:0,evidence:ev('Keuringsdocument','Manuele bevestiging')}),
]

const round = (value: number, decimals = 3) => Number(value.toFixed(decimals))
const quantityFor = (basis: LidarQuantityBasis, elements: LidarSurveyElement[]) => {
  if (basis === 'Oppervlakte') return elements.reduce((sum, item) => sum + (item.netAreaM2 ?? item.areaM2 ?? 0), 0)
  if (basis === 'Lengte') return elements.reduce((sum, item) => sum + (item.lengthM ?? 0), 0)
  if (basis === 'Volume') return elements.reduce((sum, item) => sum + (item.volumeM3 ?? 0), 0)
  if (basis === 'Aantal' || basis === 'Punt') return elements.reduce((sum, item) => sum + (item.count ?? 1), 0)
  return 1
}

export function measurementForAssignment(assignment: LidarWorkAssignment, elements: LidarSurveyElement[], catalog = LIDAR_WORK_CATALOG) {
  const definition = catalog.find(item => item.code === assignment.catalogCode)
  if (!definition) throw new Error(`Werkcode ${assignment.catalogCode} bestaat niet in de LiDAR-werkencatalogus.`)
  const selected = elements.filter(item => assignment.elementIds.includes(item.id))
  if (!selected.length) throw new Error(`Selecteer minstens één scanobject voor ${definition.name}.`)
  const incompatible = selected.filter(item => !definition.elementKinds.includes(item.kind))
  const measured = assignment.quantityOverride ?? quantityFor(definition.quantityBasis, selected)
  const quantity = round(measured * (1 + (assignment.wastePct ?? definition.wastePct) / 100))
  const evidencePresent = new Set<LidarEvidenceKind>([
    'LiDAR-meting',
    ...(assignment.photoArtifactIds.length ? ['Foto' as const] : []),
    ...(assignment.dailyReportIds.length ? ['Dagrapport' as const] : []),
    ...(assignment.inspectionDocumentIds.length ? ['Keuringsdocument' as const] : []),
    ...(assignment.manuallyConfirmed ? ['Manuele bevestiging' as const] : []),
  ])
  const missingEvidence = definition.evidence.filter(item => !evidencePresent.has(item))
  const confidencePct = selected.reduce((sum, item) => sum + item.confidencePct, 0) / selected.length
  const reviewReasons = [
    ...(quantity <= 0 ? ['De gemeten hoeveelheid is nul; voer een manuele hoeveelheid in.'] : []),
    ...(confidencePct < 85 ? [`Gemiddelde scanzekerheid ${round(confidencePct, 1)}% is lager dan 85%.`] : []),
    ...(incompatible.length ? [`${incompatible.length} element(en) passen niet bij de meetregel van dit werk.`] : []),
    ...missingEvidence.map(item => `${item} ontbreekt als verplicht bewijs.`),
  ]
  return { definition, selected, quantity, confidencePct: round(confidencePct, 1), missingEvidence, reviewReasons }
}

export function buildLidarCalculationProposal(scanSessionId: string, calculationId: string, elements: LidarSurveyElement[], assignments: LidarWorkAssignment[], createdAt = new Date().toISOString(), catalog = LIDAR_WORK_CATALOG): LidarCalculationProposal {
  if (!assignments.length) throw new Error('Benoem minstens één uit te voeren werk op de scan.')
  const items = assignments.map((assignment, index): LidarCalculationProposalItem => {
    const measured = measurementForAssignment(assignment, elements, catalog)
    const definition = measured.definition
    return {
      id: `lidar-calc-${scanSessionId}-${index + 1}`,
      assignmentId: assignment.id,
      catalogCode: definition.code,
      discipline: definition.discipline,
      roomNames: [...new Set(measured.selected.map(item => item.roomName))],
      sourceElementIds: measured.selected.map(item => item.id),
      quantity: measured.quantity,
      unit: definition.unit,
      confidencePct: measured.confidencePct,
      evidenceComplete: measured.missingEvidence.length === 0,
      reviewReasons: measured.reviewReasons,
      boqItem: {
        code: definition.code,
        description: assignment.description?.trim() || definition.name,
        quantity: measured.quantity,
        unit: definition.unit,
        labor: definition.labor,
        material: definition.material,
        equipment: definition.equipment,
        subcontracting: definition.subcontracting,
        postType: 'Samengestelde post',
        quantityType: 'Vermoedelijk',
        wastePct: assignment.wastePct ?? definition.wastePct,
        itemRiskPct: measured.confidencePct < 85 ? 5 : 1,
        markupPct: 0,
        notes: `LiDAR-calculatie · ${measured.selected.map(item => `${item.roomName}/${item.label}`).join(', ')} · zekerheid ${measured.confidencePct}% · scan ${scanSessionId}${assignment.notes ? ` · ${assignment.notes}` : ''}`,
      },
    }
  })
  const reviewReasons = [...new Set(items.flatMap(item => item.reviewReasons))]
  const directCost = round(items.reduce((sum, item) => sum + item.quantity * (item.boqItem.labor + item.boqItem.material + item.boqItem.equipment + item.boqItem.subcontracting), 0), 2)
  return { id: `proposal-${scanSessionId}`, scanSessionId, calculationId, status: reviewReasons.length ? 'Ter controle' : 'Concept', items, reviewReasons, directCost, createdAt }
}

export function approveLidarCalculationProposal(proposal: LidarCalculationProposal, approvedBy: string, approvedAt = new Date().toISOString()) {
  if (!approvedBy.trim()) throw new Error('Een calculator of goedkeurder is verplicht.')
  const blocking = proposal.items.flatMap(item => item.reviewReasons.filter(reason => reason.includes('hoeveelheid is nul') || reason.includes('passen niet')))
  if (blocking.length) throw new Error(`Los eerst ${blocking.length} blokkerende meetcontrole(s) op.`)
  return { ...proposal, status: 'Goedgekeurd' as const, approvedBy: approvedBy.trim(), approvedAt }
}

export function lidarCalculationReadiness(elements: LidarSurveyElement[], assignments: LidarWorkAssignment[], proposal?: LidarCalculationProposal) {
  return {
    geometryAvailable: elements.length > 0,
    worksAssigned: assignments.length > 0,
    evidenceComplete: Boolean(proposal?.items.length) && proposal!.items.every(item => item.evidenceComplete),
    reviewed: proposal?.status === 'Goedgekeurd' || proposal?.status === 'Toegepast',
    applied: proposal?.status === 'Toegepast',
  }
}
