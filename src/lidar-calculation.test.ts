import { describe, expect, it } from 'vitest'
import { approveLidarCalculationProposal, buildLidarCalculationProposal, LIDAR_WORK_CATALOG, measurementForAssignment, type LidarSurveyElement, type LidarWorkAssignment } from './lidar-calculation'

const elements: LidarSurveyElement[] = [
  { id:'wall-1',roomId:'room-1',roomName:'Leefruimte',kind:'Wand',label:'Wand noord',areaM2:21,netAreaM2:18.5,confidencePct:94,photoArtifactIds:['photo-1'] },
  { id:'socket-1',roomId:'room-1',roomName:'Leefruimte',kind:'Stopcontact',label:'Nieuw stopcontact tv-hoek',count:2,confidencePct:91,photoArtifactIds:['photo-1'] },
  { id:'pipe-1',roomId:'room-2',roomName:'Badkamer',kind:'Leiding',label:'Waterleiding wastafel',lengthM:7.4,confidencePct:79,photoArtifactIds:['photo-2'] },
]

const assignment = (patch: Partial<LidarWorkAssignment>): LidarWorkAssignment => ({ id:'assignment-1',catalogCode:'SCH-010',elementIds:['wall-1'],photoArtifactIds:['photo-1'],dailyReportIds:[],inspectionDocumentIds:[],manuallyConfirmed:true,...patch })

describe('LiDAR-calculatie', () => {
  it('bevat een brede catalogus met bouwkundige werken en technieken', () => {
    expect(LIDAR_WORK_CATALOG.length).toBeGreaterThanOrEqual(55)
    expect(LIDAR_WORK_CATALOG).toEqual(expect.arrayContaining([
      expect.objectContaining({code:'ELE-010',name:expect.stringContaining('Stopcontact')}),
      expect.objectContaining({code:'ELE-030',name:expect.stringContaining('Lichtpunt')}),
      expect.objectContaining({code:'SAN-010',name:expect.stringContaining('waterleiding')}),
      expect.objectContaining({code:'HVA-040',name:expect.stringContaining('Ventilatiekanaal')}),
      expect.objectContaining({code:'KEU-010',evidence:expect.arrayContaining(['Keuringsdocument'])}),
    ]))
  })

  it('meet netto wandoppervlakte en voegt het ingestelde verlies toe', () => {
    const result = measurementForAssignment(assignment({wastePct:10}), elements)
    expect(result.quantity).toBe(20.35)
    expect(result.confidencePct).toBe(94)
    expect(result.reviewReasons).toEqual(expect.arrayContaining([expect.stringContaining('Dagrapport')]))
  })

  it('maakt calculatieposten met herleidbaarheid naar ruimte, scanobject en bewijs', () => {
    const proposal = buildLidarCalculationProposal('scan-1','calc-1',elements,[
      assignment({dailyReportIds:['report-1']}),
      assignment({id:'assignment-2',catalogCode:'ELE-010',elementIds:['socket-1'],dailyReportIds:['report-1'],inspectionDocumentIds:['keur-1']}),
    ],'2026-08-04T08:00:00.000Z')
    expect(proposal.items).toHaveLength(2)
    expect(proposal.items[0]).toMatchObject({quantity:19.425,unit:'m²',roomNames:['Leefruimte'],sourceElementIds:['wall-1'],evidenceComplete:true})
    expect(proposal.items[1]).toMatchObject({quantity:2.06,unit:'punt',catalogCode:'ELE-010',evidenceComplete:true})
    expect(proposal.items[1].boqItem.notes).toContain('scan scan-1')
    expect(proposal.directCost).toBeGreaterThan(0)
  })

  it('vereist menselijke controle voor lage zekerheid en ontbrekend bewijs', () => {
    const proposal = buildLidarCalculationProposal('scan-2','calc-1',elements,[assignment({catalogCode:'SAN-010',elementIds:['pipe-1'],manuallyConfirmed:false})])
    expect(proposal.status).toBe('Ter controle')
    expect(proposal.reviewReasons).toEqual(expect.arrayContaining([expect.stringContaining('lager dan 85%'),expect.stringContaining('Dagrapport'),expect.stringContaining('Manuele bevestiging')]))
  })

  it('laat goedkeuring toe nadat niet-blokkerende controles menselijk zijn beoordeeld', () => {
    const proposal = buildLidarCalculationProposal('scan-3','calc-1',elements,[assignment({catalogCode:'SAN-010',elementIds:['pipe-1'],dailyReportIds:['report-1'],manuallyConfirmed:true})])
    expect(approveLidarCalculationProposal(proposal,'Calculator')).toMatchObject({status:'Goedgekeurd',approvedBy:'Calculator'})
  })
})
