import type { BimProgressEvidence } from './domain'
import { FAMILY_HOME_MODEL_ID, FAMILY_HOME_MODEL_NAME, FAMILY_HOME_MODEL_VERSION, familyHomeBimElements, familyHomeBimPhases, type FamilyHomeBimGeometry } from './family-home-bim'

export type BimProgressElement = {
  id:string; code:string; label:string; category:string; storey:string; quantity:number; unit:BimProgressEvidence['unit']; plannedProgressPct:number; completedProgressPct:number; verified:boolean;
  phase:string; phaseId?:string; plannedStart:string; plannedEnd:string; costValue:number; x?:number; y?:number; width?:number; height?:number; shape?:string; geometry?:FamilyHomeBimGeometry
}

export type BimProgressExample = {
  id:string; label:string; projectType:string; description:string; modelName:string; modelVersion:string; discipline:BimProgressEvidence['discipline']; coordinationStatus:string; elements:BimProgressElement[]
}

const series = (prefix:string, count:number, category:string, storeys:string[], unit:BimProgressEvidence['unit'], quantity:number, completion:number):BimProgressElement[] =>
  Array.from({length:count},(_,index)=>({
    id:`${prefix}-${String(index+1).padStart(3,'0')}`, code:`${prefix.toUpperCase()}-${String(index+1).padStart(3,'0')}`,
    label:`${category} ${String(index+1).padStart(2,'0')}`, category, storey:storeys[index%storeys.length], quantity:Number((quantity*(.82+(index%5)*.09)).toFixed(2)), unit,
    plannedProgressPct:Math.min(100,completion+8+(index%4)*3), completedProgressPct:Math.max(0,completion-(index%6)*4), verified:index%7!==0,
    phase:`Fase ${1 + (index % 5)}`, plannedStart:`2026-${String(3 + (index % 5) * 2).padStart(2,'0')}-01`, plannedEnd:`2026-${String(4 + (index % 5) * 2).padStart(2,'0')}-28`, costValue:Number((quantity*(120 + (index%6)*24)).toFixed(2)),
  }))

export const bimProgressExamples:BimProgressExample[] = [
  {
    id:FAMILY_HOME_MODEL_ID, label:'Gezinswoning · volledig BIM', projectType:'Private woningbouw · € 535.000',
    description:'Volledig LOD350-woningmodel voor een vrijstaande gezinswoning. Alle objecten zijn gekoppeld aan uitvoeringsfasen, werkpakketten, calculatiebedragen en gecertificeerde voortgang.',
    modelName:FAMILY_HOME_MODEL_NAME, modelVersion:FAMILY_HOME_MODEL_VERSION, discipline:'Multidisciplinair', coordinationStatus:'Uitvoeringsmodel · 3D/4D/5D gecontroleerd · CDE-uitgave 07',
    elements:familyHomeBimElements.map(element=>({ id:element.id, code:element.code, label:element.label, category:element.category, storey:element.storey, quantity:element.quantity, unit:element.unit, plannedProgressPct:familyHomeBimPhases.find(phase=>phase.id===element.phaseId)?.progressPct??0, completedProgressPct:element.completedProgressPct, verified:element.verified, phase:familyHomeBimPhases.find(phase=>phase.id===element.phaseId)?.label??element.phaseId, phaseId:element.phaseId, plannedStart:element.plannedStart, plannedEnd:element.plannedEnd, costValue:Number((element.quantity*element.unitCost).toFixed(2)), x:element.x, y:element.y, width:element.width, height:element.height, shape:element.shape, geometry:element.geometry })),
  },
  {
    id:'hospital-class8', label:'Klasse 8 · ziekenhuisvleugel', projectType:'Zorgbouw · € 128 miljoen',
    description:'Multidisciplinair federatiemodel met ruwbouw, gevel en technieken per bouwlaag. Geschikt voor maandelijkse waardering met controle door directievoering.',
    modelName:'AZ-Noord-Federatie.ifc', modelVersion:'CDE-P06 · 2026-07-28', discipline:'Multidisciplinair', coordinationStatus:'Clashronde 18 afgesloten · 4 geaccepteerde afwijkingen',
    elements:[...series('hslab',18,'Vloerplaten',['-1','Gelijkvloers','Niveau 1','Niveau 2'], 'm²',420,61),...series('hwall',24,'Binnenwanden',['Gelijkvloers','Niveau 1','Niveau 2'], 'm²',86,54),...series('hfac',16,'Gevelmodules',['Gelijkvloers','Niveau 1','Niveau 2'], 'st',1,43),...series('hmep',30,'Techniekzones',['-1','Gelijkvloers','Niveau 1','Niveau 2'], 'm',18,37)],
  },
  {
    id:'tunnel-class8', label:'Klasse 8 · stedelijke tunnel', projectType:'Infrastructuur · € 462 miljoen',
    description:'IFC4.3 tunnelmodel met moten, vluchtkokers, dienstgebouwen en technische installaties. Voorbeeld met hoeveelheden per zone en verificatie door landmeter.',
    modelName:'RingTunnel-Zuid-IFC43.ifc', modelVersion:'AFC-TUN-34 · 2026-07-31', discipline:'Infrastructuur', coordinationStatus:'AFC-model · landmeetkundige controle 98,7%',
    elements:[...series('tseg',36,'Tunnelmoten',['Zone West','Zone Midden','Zone Oost'], 'm³',315,47),...series('troad',18,'Wegverharding',['Koker Noord','Koker Zuid'], 'm²',680,42),...series('tesc',12,'Vluchtverbindingen',['Zone West','Zone Midden','Zone Oost'], 'st',1,33),...series('ttech',28,'Technische tracés',['Koker Noord','Koker Zuid'], 'm',42,29)],
  },
  {
    id:'tower-class8', label:'Klasse 8 · hoogbouw 38 lagen', projectType:'Hoogbouw · € 196 miljoen',
    description:'Ruwbouw- en gevelmodel met repetitieve verdiepingen, betoncycli, prefab gevelelementen en installatieschachten. Inclusief steekproefsgewijze kwaliteitscontrole.',
    modelName:'Antwerp-Tower-LOD400.ifc', modelVersion:'CON-REV12 · 2026-07-30', discipline:'Structuur', coordinationStatus:'Uitvoeringsmodel · 12 open BCF-issues buiten selectie',
    elements:[...series('tslab',38,'Verdiepingsvloeren',Array.from({length:38},(_,i)=>`Niveau ${i+1}`), 'm²',735,68),...series('tcore',38,'Betonkernen',Array.from({length:38},(_,i)=>`Niveau ${i+1}`), 'm³',94,66),...series('tcurt',76,'Gevelzones',Array.from({length:38},(_,i)=>`Niveau ${i+1}`), 'st',1,51)],
  },
  {
    id:'school-mep', label:'Onderwijscluster · BIM technieken', projectType:'Publieke gebouwen · € 74 miljoen',
    description:'MEP-productiemodel met luchtkanalen, leidingen, kabelgoten en technische lokalen. Geschikt voor voortgang op gemonteerde én geteste hoeveelheden.',
    modelName:'Campus-West-MEP.ifc', modelVersion:'MEP-SHOP-09 · 2026-07-29', discipline:'Technieken', coordinationStatus:'Installatiemodel · drukproeven zone A/B goedgekeurd',
    elements:[...series('duct',32,'Luchtkanalen',['Blok A','Blok B','Sporthal'], 'm',24,57),...series('pipe',40,'Leidingen',['Blok A','Blok B','Sporthal'], 'm',19,49),...series('cable',26,'Kabelgoten',['Blok A','Blok B','Sporthal'], 'm',21,45),...series('plant',18,'Technische toestellen',['Technisch lokaal','Dak'], 'st',1,38)],
  },
  {
    id:'road-junction', label:'Complex verkeersknooppunt', projectType:'Wegenis en kunstwerken · € 238 miljoen',
    description:'IFC4.3 wegenmodel met grondverzet, riolering, verharding en drie kunstwerken. Voorbeeld voor hoeveelheidsgerichte vordering per tracédeel.',
    modelName:'Knoop-E314-IFC43.ifc', modelVersion:'ROAD-AFC-21 · 2026-08-01', discipline:'Infrastructuur', coordinationStatus:'AFC · alignments en terreinsurvey gevalideerd',
    elements:[...series('earth',24,'Grondwerkzones',['Tak A','Tak B','Tak C','Ring'], 'm³',1240,72),...series('sewer',28,'Rioleringstracés',['Tak A','Tak B','Tak C','Ring'], 'm',36,63),...series('pave',20,'Verhardingsvakken',['Tak A','Tak B','Tak C','Ring'], 'm²',890,44),...series('bridge',16,'Kunstwerkonderdelen',['KW01','KW02','KW03'], 'm³',185,36)],
  },
]

export const bimProgressExampleById = (id:string) => bimProgressExamples.find(example=>example.id===id) ?? bimProgressExamples[0]
