import { describe,expect,it } from 'vitest'
import type { ProjectWorkPackage } from './domain'
import { analyzeLidarObservations, approveLidarProposal, buildAsBuiltRevision, buildLidarProgressProposals, createLidarBcfTopic, lidarProposalToBimEvidence, lidarScanReadiness, registerLidarScan, type LidarScanSession } from './lidar-bim'

const workPackage:ProjectWorkPackage={id:'wp-1',code:'03',name:'Ruwbouw',budget:100_000,plannedHours:640,status:'Klaar voor planning'}
const controls=[
  {id:'a',label:'A',bim:{x:10,y:5,z:0},scan:{x:0,y:0,z:0},verified:true},
  {id:'b',label:'B',bim:{x:15,y:5,z:0},scan:{x:5,y:.001,z:0},verified:true},
  {id:'c',label:'C',bim:{x:10,y:10,z:0},scan:{x:0,y:5,z:.001},verified:true},
]
const observations=[{id:'wall-1',ifcGuid:'2abc',label:'Wand gelijkvloers',category:'Wanden',workPackageId:'wp-1',plannedQuantity:100,observedQuantity:72,unit:'m²' as const,measurementRule:'Oppervlakte' as const,surfaceCoveragePct:75,visibilityPct:91,confidencePct:94,deviationMm:12,photoEvidenceCount:2,detected:true}]

describe('LiDAR BIM-vorderingsflow',()=>{
  it('markeert bewijs niet als goedgekeurd zolang er geen voorstellen zijn',()=>{
    const session={artifacts:[{kind:'Foto'}],progressProposals:[],registration:undefined,matches:[],asBuiltRevisions:[]} as unknown as LidarScanSession
    expect(lidarScanReadiness(session).evidenceComplete).toBe(false)
  })
  it('registreert een scan met minstens drie controlepunten',()=>{
    const registration=registerLidarScan(controls,'BIM-coördinator','2026-08-03T08:00:00.000Z')
    expect(registration.quality).toBe('Hoog')
    expect(registration.translation.x).toBeCloseTo(10,3)
  })

  it('stelt element- en werkpakketvoortgang voor',()=>{
    const matches=analyzeLidarObservations(observations)
    const proposals=buildLidarProgressProposals('scan-1',matches,[workPackage])
    expect(matches[0]).toMatchObject({suggestedProgressPct:72,autoApprovable:true})
    expect(proposals[0]).toMatchObject({suggestedProgressPct:72,confidencePct:94,unit:'m²'})
  })

  it('maakt goedgekeurd BIM-meetbewijs, BCF en as-built',()=>{
    const registration=registerLidarScan(controls,'BIM-coördinator')
    const matches=analyzeLidarObservations(observations)
    const approved=approveLidarProposal(buildLidarProgressProposals('scan-1',matches,[workPackage])[0],'Lena Vermeulen','2026-08-03T09:00:00.000Z')
    const topic=createLidarBcfTopic({scanSessionId:'scan-1',title:'Wand wijkt af',description:'Controleer positie',priority:'Hoog',ifcGuids:['2abc'],viewpoint:{camera:{x:1,y:2,z:1.6},direction:{x:0,y:1,z:0}},createdBy:'Lena'})
    const session:LidarScanSession={id:'scan-1',projectId:'project-1',modelId:'model-1',modelName:'Woning.ifc',modelVersion:'AFC-01',zone:'Gelijkvloers',storey:'00',deviceName:'iPhone Pro',deviceSupportsLidar:true,captureMode:'Gecombineerd',status:'Goedgekeurd',capturedBy:'Werfleider',capturedAt:'2026-08-03T08:00:00.000Z',notes:'',controlPoints:controls,registration,artifacts:[{id:'photo-1',kind:'Foto',fileName:'scan.jpg',mimeType:'image/jpeg',sizeBytes:1200,capturedAt:'2026-08-03T08:00:00.000Z'}],observations,matches,progressProposals:[approved],bcfTopics:[topic],asBuiltRevisions:[]}
    const evidence=lidarProposalToBimEvidence(session,approved)
    const asBuilt=buildAsBuiltRevision(session,'BIM-coördinator')
    expect(evidence.lidarEvidence).toMatchObject({scanSessionId:'scan-1',confidencePct:94})
    expect(asBuilt).toMatchObject({approvedElementCount:1,deviationCount:0,status:'Gepubliceerd'})
  })

  it('blokkeert automatische goedkeuring bij slechte zichtbaarheid of toleranties',()=>{
    const [match]=analyzeLidarObservations([{...observations[0],visibilityPct:40,deviationMm:55}])
    expect(match.autoApprovable).toBe(false)
    expect(match.reviewReasons).toEqual(expect.arrayContaining([
      'Minder dan 60% zichtbaar in de opname',
      'Geometrische afwijking groter dan 30 mm',
      'Goedgekeurd dagrapport ontbreekt voor een onzekere meting',
      'Manuele bevestiging ontbreekt voor een onzekere meting',
    ]))
  })
})
