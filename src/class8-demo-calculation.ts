import type { BoqItem, Calculation } from './domain.js'

// The project identity and high-level work packages follow the publicly
// described Oosterweel Rechteroever scope. Quantities and prices below are
// deterministic demo assumptions, not Lantis tender or contractor data.
export const OOSTERWEEL_DEMO_CHAPTER_COUNT = 180
export const OOSTERWEEL_DEMO_ITEM_COUNT = 2_000
export const OOSTERWEEL_DEMO_TARGET_DIRECT_COST = 650_000_000

type CostShares = {
  labor: number
  material: number
  equipment: number
  subcontracting: number
}

type WorkSection = {
  code: string
  name: string
  primaryUnit: string
  secondaryUnit: string
  quantityBase: number
  unitCostBase: number
  shares: CostShares
  chapters: string[]
}

const workSections: WorkSection[] = [
  {
    code: '01',
    name: 'Projectbeheersing en engineering',
    primaryUnit: 'uur',
    secondaryUnit: 'st',
    quantityBase: 1_200,
    unitCostBase: 108,
    shares: { labor: .62, material: .05, equipment: .03, subcontracting: .30 },
    chapters: ['Projectmanagement en rapportering', 'Ontwerpcoördinatie en raakvlakken', 'BIM-coördinatie en clashdetectie', 'Geotechnische engineering', 'Constructieve berekeningen', 'Verkeerskundige studies', 'Tunnelveiligheidsdossier', 'Vergunningen en voorwaardenbeheer', 'Omgevingsmanagement', 'Kabels- en leidingenmanagement', 'Risico- en kansenmanagement', 'Systems engineering en eisenbeheer', 'Planning en fasering', 'Kwaliteitsmanagement', 'Veiligheidscoördinatie ontwerp'],
  },
  {
    code: '02',
    name: 'Werfinrichting en bouwlogistiek',
    primaryUnit: 'dag',
    secondaryUnit: 'm²',
    quantityBase: 2_400,
    unitCostBase: 165,
    shares: { labor: .28, material: .24, equipment: .34, subcontracting: .14 },
    chapters: ['Centrale werfzone Rechteroever', 'Werfkantoren en personeelsvoorzieningen', 'Tijdelijke nutsvoorzieningen', 'Werfwegen en rijplaten', 'Bouwlogistiek via water', 'Tijdelijke loskades', 'Materiaalopslag en depots', 'Betoncentrale en menginstallaties', 'Wasplaatsen en wielwasinstallaties', 'Werfafsluiting en toegangscontrole', 'Werfverlichting en camerabewaking', 'Afval- en materialenbeheer', 'Wintermaatregelen', 'Stof-, geluid- en trillingsbeheersing', 'Demobilisatie en herstel werfzones'],
  },
  {
    code: '03',
    name: 'Bestaande toestand, nutsleidingen en archeologie',
    primaryUnit: 'm',
    secondaryUnit: 'st',
    quantityBase: 3_200,
    unitCostBase: 215,
    shares: { labor: .31, material: .27, equipment: .17, subcontracting: .25 },
    chapters: ['Topografische nulmeting', 'Bouwkundige plaatsbeschrijvingen', 'Proefsleuven en detectie', 'Verlegging middenspanningskabels', 'Verlegging hoogspanningsverbindingen', 'Verlegging drinkwaterleidingen', 'Verlegging aardgasleidingen', 'Verlegging telecom en glasvezel', 'Aanpassing rioleringsstelsels', 'Tijdelijke nutsdoorverbindingen', 'Archeologisch vooronderzoek', 'Archeologische begeleiding uitvoering', 'Explosievenonderzoek', 'Monitoring bestaande bebouwing', 'Coördinatie netbeheerders en opleverdossiers'],
  },
  {
    code: '04',
    name: 'Verkeersfasering en tijdelijke infrastructuur',
    primaryUnit: 'm',
    secondaryUnit: 'm²',
    quantityBase: 4_500,
    unitCostBase: 128,
    shares: { labor: .23, material: .39, equipment: .16, subcontracting: .22 },
    chapters: ['Fasering R1 Noord', 'Fasering R1 Oost', 'Tijdelijke rijbanen en doorsteken', 'Tijdelijke op- en afritten', 'Tijdelijke middenbermen', 'Tijdelijke geleideconstructies', 'Werfsignalisatie autosnelwegen', 'Dynamische verkeerssignalisatie', 'Omleidingen stedelijk wegennet', 'Tijdelijke fietsverbindingen', 'Tijdelijke voetgangersroutes', 'Openbaarvervoermaatregelen', 'Incidentmanagement en interventieroutes', 'Nacht- en weekendsluitingen', 'Verwijderen tijdelijke infrastructuur'],
  },
  {
    code: '05',
    name: 'Opbraak, sanering en grondvoorbereiding',
    primaryUnit: 'm³',
    secondaryUnit: 'm²',
    quantityBase: 6_500,
    unitCostBase: 72,
    shares: { labor: .18, material: .08, equipment: .43, subcontracting: .31 },
    chapters: ['Selectieve opbraak verhardingen', 'Opbraak lijnvormige elementen', 'Sloop bestaande kunstwerken', 'Sloop funderingen en massieven', 'Verwijderen weguitrusting', 'Rooien en ontstronken', 'Bodemsaneringswerken', 'PFAS-houdende grondstromen', 'Asbesthoudende materialen', 'Teerhoudend asfalt', 'Grondbank en traceerbaarheid', 'Tijdelijke gronddepots', 'Zeven en behandelen uitgegraven grond', 'Aanvullen en profileren werkplatformen', 'Vrijgave werkzones en keuringsrapporten'],
  },
  {
    code: '06',
    name: 'Grondwerken, bouwputten en waterbeheersing',
    primaryUnit: 'm³',
    secondaryUnit: 'm',
    quantityBase: 12_500,
    unitCostBase: 54,
    shares: { labor: .14, material: .12, equipment: .51, subcontracting: .23 },
    chapters: ['Massagrondverzet Oosterweelknoop', 'Uitgraving verdiepte Ring noord', 'Uitgraving verdiepte Ring oost', 'Bouwput Kanaaltunnels', 'Bouwput aansluitingscomplexen', 'Tijdelijke grondkeringen', 'Bemaling diepe bouwputten', 'Retourbemaling en infiltratie', 'Waterzuivering bemalingswater', 'Dijk- en polderwanden', 'Grondverbetering en stabilisatie', 'Lichtgewicht ophogingen', 'Aanvullingen rond constructies', 'Taluds en erosiebescherming', 'Geotechnische monitoring'],
  },
  {
    code: '07',
    name: 'Diepfunderingen en ondergrondse constructies',
    primaryUnit: 'm',
    secondaryUnit: 'st',
    quantityBase: 2_000,
    unitCostBase: 640,
    shares: { labor: .17, material: .37, equipment: .28, subcontracting: .18 },
    chapters: ['Diepwanden Oosterweelknoop', 'Diepwanden verdiepte Ring', 'Secanspalenwanden', 'Combiwanden en damplanken', 'Boordpalen grote diameter', 'Fundering op staal', 'Micropalen en trekankers', 'Grondankers tijdelijke fase', 'Grondankers definitieve fase', 'Onderwaterbetonvloeren', 'Trekpalen en verankeringssystemen', 'Jetgrouting en injecties', 'Stempelramen en tijdelijke ondersteuning', 'Paalproeven en integriteitsmetingen', 'Waterdichtheidsproeven bouwkuipen'],
  },
  {
    code: '08',
    name: 'Tunnel- en verdiepte-Ringconstructies',
    primaryUnit: 'm³',
    secondaryUnit: 'm²',
    quantityBase: 3_000,
    unitCostBase: 510,
    shares: { labor: .26, material: .43, equipment: .13, subcontracting: .18 },
    chapters: ['Vloerplaten Kanaaltunnels', 'Wanden Kanaaltunnels', 'Dakplaten Kanaaltunnels', 'Vloerplaten verdiepte Ring', 'Wanden verdiepte Ring', 'Dakplaten en overkappingen', 'Dienstgebouwen en technische kokers', 'Dwarsverbindingen en vluchtwegen', 'Pompkelders en waterbuffers', 'Voegconstructies en waterdichting', 'Brandwerende bekleding', 'Tunnelportalen en overgangsconstructies', 'Stootplaten en aansluitconstructies', 'Inspectiegangen en onderhoudsruimten', 'Afwerking ruwbouw tunnels'],
  },
  {
    code: '09',
    name: 'Kunstwerken en constructief beton',
    primaryUnit: 'm³',
    secondaryUnit: 'ton',
    quantityBase: 4_800,
    unitCostBase: 385,
    shares: { labor: .29, material: .46, equipment: .11, subcontracting: .14 },
    chapters: ['Brugdekken en viaducten', 'Landhoofden en pijlers', 'Keermuren Oosterweelknoop', 'Keermuren Ringzone', 'Fietsbruggen en passerelles', 'Onderdoorgangen lokaal verkeer', 'Prefabelementen en liggers', 'Ter plaatse gestort beton', 'Wapening en voorspanning', 'Bekistingen en ondersteuningen', 'Oplegtoestellen', 'Voegovergangen', 'Betonherstellingen en injecties', 'Oppervlaktebescherming beton', 'Belastingsproeven kunstwerken'],
  },
  {
    code: '10',
    name: 'Wegenis, riolering en afwatering',
    primaryUnit: 'm²',
    secondaryUnit: 'm',
    quantityBase: 9_000,
    unitCostBase: 118,
    shares: { labor: .19, material: .48, equipment: .20, subcontracting: .13 },
    chapters: ['Onderfunderingen en verbeterde grond', 'Steenslagfunderingen', 'Cementgebonden funderingen', 'Asfalt onderlagen', 'Asfalt tussenlagen', 'Geluidsarme toplagen', 'Betonverhardingen', 'Lijnvormige elementen', 'RWA-hoofdleidingen', 'DWA-riolering', 'Inspectieputten en kokers', 'Kolken en lijnafwatering', 'Pompstations en persleidingen', 'Waterbuffers en infiltratievoorzieningen', 'Wegmarkeringen en definitieve signalisatie'],
  },
  {
    code: '11',
    name: 'Tunneltechnieken en elektromechanica',
    primaryUnit: 'st',
    secondaryUnit: 'm',
    quantityBase: 1_500,
    unitCostBase: 1_850,
    shares: { labor: .18, material: .37, equipment: .07, subcontracting: .38 },
    chapters: ['Hoogspanningsinstallaties', 'Laagspanningsverdeling', 'Noodstroom en UPS', 'Tunnelverlichting', 'Ventilatie en rookbeheersing', 'Branddetectie en blusvoorzieningen', 'CCTV en incidentdetectie', 'Omroep en communicatiesystemen', 'Verkeerslichten en rijstrooksignalisatie', 'SCADA en tunnelbediening', 'Databekabeling en glasvezel', 'Pompen en waterbehandeling', 'Gebouwbeheersystemen', 'Cybersecurity en netwerksegmentatie', 'Integrale testen en indienststelling'],
  },
  {
    code: '12',
    name: 'Landschap, leefbaarheid en oplevering',
    primaryUnit: 'm²',
    secondaryUnit: 'st',
    quantityBase: 5_500,
    unitCostBase: 94,
    shares: { labor: .27, material: .39, equipment: .14, subcontracting: .20 },
    chapters: ['Grondmodellering en leefbaarheidsbermen', 'Teelaarde en bodemverbetering', 'Bomen en laanbeplanting', 'Bosgoed en struweel', 'Graslanden en bloemrijke zones', 'Wadi’s en ecologische oevers', 'Faunapassages en geleiding', 'Geluidsbermen en geluidsschermen', 'Fietswegen en recreatieve paden', 'Straatmeubilair en verlichting', 'Herstel tijdelijke werfzones', 'Onderhoud beplantingen', 'As-builtmetingen en revisiedossiers', 'Opleidings- en overdrachtsdossiers', 'Voorlopige oplevering en nazorg'],
  },
]

const itemVariants = [
  'opmeting, detailengineering en werkvoorbereiding',
  'uitvoeringsnota, keuringsplan en proefvak',
  'levering hoofdmaterialen inclusief kwaliteitsdocumenten',
  'aanvoer, interne logistiek en tijdelijke opslag',
  'uitvoering deelzone noord',
  'uitvoering deelzone zuid',
  'tijdelijke voorzieningen en beschermingsmaatregelen',
  'specialistische uitvoering door onderaannemer',
  'kwaliteitscontrole, proeven en vrijgave',
  'monitoring tijdens uitvoering en rapportering',
  'as-builtregistratie en opleverdossier',
  'stelpost raakvlakken en onvoorziene werkzaamheden',
]

const round = (value: number, digits = 2) => Number(value.toFixed(digits))

const variation = (sectionIndex: number, chapterIndex: number, itemIndex: number, salt = 0) => {
  const value = Math.sin((sectionIndex + 1) * 91.7 + (chapterIndex + 1) * 37.1 + (itemIndex + 1) * 17.3 + salt * 11.9) * 43_758.5453
  return value - Math.floor(value)
}

const quantityAndUnit = (section: WorkSection, sectionIndex: number, chapterIndex: number, itemIndex: number) => {
  const factor = .72 + variation(sectionIndex, chapterIndex, itemIndex, 1) * .66
  if (itemIndex === 0) return { quantity: round(section.quantityBase * .55 * factor, 1), unit: 'uur' }
  if (itemIndex === 1) return { quantity: round(section.quantityBase * .22 * factor, 1), unit: 'uur' }
  if (itemIndex === 2) return { quantity: Math.max(1, Math.round(section.quantityBase * .018 * factor)), unit: 'st' }
  if (itemIndex === 3) return { quantity: round(section.quantityBase * .35 * factor, 1), unit: section.secondaryUnit }
  if (itemIndex === 4 || itemIndex === 5) return { quantity: round(section.quantityBase * (itemIndex === 4 ? 1.3 : 1.05) * factor, 1), unit: section.primaryUnit }
  if (itemIndex === 6) return { quantity: round(section.quantityBase * .42 * factor, 1), unit: section.secondaryUnit }
  if (itemIndex === 7) return { quantity: 1, unit: 'GP' }
  if (itemIndex === 8) return { quantity: Math.max(1, Math.round(section.quantityBase * .012 * factor)), unit: 'st' }
  if (itemIndex === 9) return { quantity: Math.max(1, Math.round(section.quantityBase * .025 * factor)), unit: 'dag' }
  return { quantity: 1, unit: 'GP' }
}

const unitCost = (section: WorkSection, sectionIndex: number, chapterIndex: number, itemIndex: number) => {
  const factor = .78 + variation(sectionIndex, chapterIndex, itemIndex, 2) * .54
  if (itemIndex === 0) return 92 * factor
  if (itemIndex === 1) return 112 * factor
  if (itemIndex === 2) return section.unitCostBase * 14 * factor
  if (itemIndex === 3) return section.unitCostBase * .65 * factor
  if (itemIndex === 4 || itemIndex === 5) return section.unitCostBase * (itemIndex === 4 ? 1 : 1.12) * factor
  if (itemIndex === 6) return section.unitCostBase * .78 * factor
  if (itemIndex === 7) return section.unitCostBase * section.quantityBase * .34 * factor
  if (itemIndex === 8) return section.unitCostBase * 8.5 * factor
  if (itemIndex === 9) return 1_050 * factor
  return section.unitCostBase * section.quantityBase * (itemIndex === 10 ? .12 : .18) * factor
}

const sharesForItem = (section: WorkSection, itemIndex: number): CostShares => {
  if (itemIndex <= 1) return { labor: .72, material: .03, equipment: .05, subcontracting: .20 }
  if (itemIndex === 2) return { labor: .10, material: .70, equipment: .05, subcontracting: .15 }
  if (itemIndex === 3) return { labor: .16, material: .34, equipment: .42, subcontracting: .08 }
  if (itemIndex === 7) return { labor: .12, material: .18, equipment: .08, subcontracting: .62 }
  if (itemIndex >= 8) return { labor: .28, material: .12, equipment: .10, subcontracting: .50 }
  return section.shares
}

const itemDirectCost = (item: BoqItem) => {
  const materialWithWaste = item.material * (1 + (item.wastePct ?? 0) / 100)
  const base = item.labor + materialWithWaste + item.equipment + item.subcontracting
  return item.quantity * base * (1 + ((item.itemRiskPct ?? 0) + (item.markupPct ?? 0)) / 100)
}

const buildRawCalculation = (): Calculation => {
  const chapters: Calculation['chapters'] = []
  const items: BoqItem[] = []
  let chapterOrder = 0
  let itemOrder = 0

  workSections.forEach((section, sectionIndex) => {
    section.chapters.forEach((topic, chapterIndex) => {
      const chapterId = `chapter-oosterweel-${section.code}-${String(chapterIndex + 1).padStart(2, '0')}`
      const chapterCode = `${section.code}.${String(chapterIndex + 1).padStart(2, '0')}`
      chapters.push({ id: chapterId, code: chapterCode, name: `${section.name} · ${topic}`, sortOrder: chapterOrder })
      const itemCount = chapterOrder < 20 ? 12 : 11

      for (let itemIndex = 0; itemIndex < itemCount; itemIndex += 1) {
        const code = `${chapterCode}.${String(itemIndex + 1).padStart(3, '0')}`
        const totalUnitCost = unitCost(section, sectionIndex, chapterIndex, itemIndex)
        const shares = sharesForItem(section, itemIndex)
        const { quantity, unit } = quantityAndUnit(section, sectionIndex, chapterIndex, itemIndex)
        const quantityType: NonNullable<BoqItem['quantityType']> = unit === 'GP'
          ? 'Forfaitair'
          : itemIndex % 5 === 0 ? 'Verrekenbaar' : itemIndex % 7 === 0 ? 'Optioneel' : 'Vermoedelijk'

        items.push({
          id: `item-oosterweel-${String(itemOrder + 1).padStart(4, '0')}`,
          chapterId,
          sortOrder: itemOrder,
          code,
          description: `${topic} – ${itemVariants[itemIndex]}`,
          quantity,
          unit,
          labor: round(totalUnitCost * shares.labor),
          material: round(totalUnitCost * shares.material),
          equipment: round(totalUnitCost * shares.equipment),
          subcontracting: round(totalUnitCost * shares.subcontracting),
          postType: itemIndex === 11 ? 'Stelpost' : itemIndex === 7 ? 'Samengestelde post' : 'Meetstaatpost',
          quantityType,
          wastePct: itemIndex === 2 || itemIndex === 4 || itemIndex === 5 ? round(2 + variation(sectionIndex, chapterIndex, itemIndex, 3) * 4, 1) : 0,
          itemRiskPct: round(1 + variation(sectionIndex, chapterIndex, itemIndex, 4) * 3.5, 1),
          markupPct: 0,
          notes: itemIndex === 11 ? 'Demo-stelpost voor projectraakvlakken; geen officiële Oosterweel-meetstaat of aannemersprijs.' : '',
          variables: [],
          formulas: {},
          priceAdjustments: [],
          costApplications: {},
        })
        itemOrder += 1
      }
      chapterOrder += 1
    })
  })

  return {
    id: 'calc-oosterweel-rechteroever',
    number: 'CAL-DEMO-OWV-RO',
    opportunityId: 'opp-ring',
    status: 'Review',
    overheadPct: 7.5,
    riskPct: 6.5,
    marginPct: 8.5,
    siteOverheadPct: 4.5,
    escalationPct: 2.5,
    discountPct: 0,
    roundingStep: 100_000,
    chapters,
    items,
    updatedAt: '2026-07-28T12:00:00.000Z',
  }
}

export const buildOosterweelClass8DemoCalculation = (): Calculation => {
  const calculation = buildRawCalculation()
  const rawDirectCost = calculation.items.reduce((sum, item) => sum + itemDirectCost(item), 0)
  const scale = OOSTERWEEL_DEMO_TARGET_DIRECT_COST / rawDirectCost
  return {
    ...calculation,
    items: calculation.items.map(item => ({
      ...item,
      labor: round(item.labor * scale),
      material: round(item.material * scale),
      equipment: round(item.equipment * scale),
      subcontracting: round(item.subcontracting * scale),
    })),
  }
}
