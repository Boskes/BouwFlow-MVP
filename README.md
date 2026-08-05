# BouwFlow MVP

Een werkende geïntegreerde MVP-webapplicatie voor bouw- en
infrastructuurbedrijven. De huidige versie doorloopt de volledige eerste keten:
klant, opportuniteit, calculatie, offerte, project, werf, vorderingsstaat,
facturatie en nacalculatie. De formele dekking van alle 18 MVP-onderdelen staat in
[de MVP-acceptatiematrix](docs/MVP_ACCEPTANCE.md).
De technische en operationele poorten voor een gecontroleerde livegang staan in
[de productie-readinesschecklist](docs/PRODUCTION_READINESS.md).
Het volledige handmatige scenario van klant tot afgesloten multi-companyproject
staat in [de end-to-end acceptatietest](docs/END_TO_END_ACCEPTATIETEST.md).

## Inbegrepen

- Afgeleid directiedashboard
- CRM-relaties aanmaken en bewerken met primaire contact- en facturatiegegevens
- Opportuniteiten aanmaken en opvolgen
- Calculaties starten vanuit een opportuniteit
- Meetstaatposten per hoofdstuk structureren en kostensoorten bewerken
- Excel- en CSV-meetstaten eerst controleren en daarna atomair importeren
- Calculatieversies met label, reden en volledige momentopname vastleggen
- Centrale kostprijsbibliotheek voor arbeid, materiaal, materieel en onderaanneming
- Kostprijzen met verbruiksfactor en bronvermelding op meetstaatposten toepassen
- Verwachte, conservatieve, optimistische en eigen calculatiescenario's vergelijken
- Het gekozen scenario laten doorwerken naar offertewaarde en projectgunning
- Algemene kosten, risico en doelmarge berekenen
- Professionele offerteversies met commerciële voorwaarden vastleggen, vooraf bekijken en als PDF downloaden
- Gunning omzetten naar een project met uitvoeringsbudget en werkpakketten
- Formele overdracht van calculator naar projectmanager met risico- en controlelijst
- Projectplanning met automatische activiteiten, afhankelijkheden, mijlpaal en Gantt-weergave
- Baselineversies met zichtbare afwijkingen na planningswijzigingen
- Mobiele dagrapporten per project, datum en werkpakket
- Ploeguren, overuren, onderaannemers, materiaal en machines registreren
- Dagrapporten gecontroleerd indienen, vergrendelen en digitaal ondertekenen
- Werffoto’s via mobiele camera uploaden, koppelen en beveiligd bekijken
- Foto-evidence na indiening onverwijderbaar bewaren
- Digitale werfbonnen en meerwerken met kostenopbouw en planningimpact
- Gecontroleerde klantgoedkeuring, uitvoering en vrijgave voor facturatie
- Cumulatieve vorderingsstaten per werkpakket met prijsherziening en inhoudingen
- Automatische opname van vrijgegeven meerwerken en verkoopfactuurconcepten
- Projectkostenregister voor open verplichtingen en werkelijke kosten
- Versiebeheer voor cost-to-complete, eindkost en prognosemarge
- Leveranciersdatabase en inkoopbehoeften met prijsvergelijking
- Automatische bestelverplichtingen, ontvangst en leveranciersfactuurcontrole
- Verkoop- en leveranciersfacturen met vervaldag, verzending en betalingsregistratie
- Project- en portfoliocashflow met maandprognose en achterstallige posten
- Nacalculatie per werkpakket, kostensoort en oorspronkelijke meetstaatpost
- Gecontroleerde terugkoppeling van werkelijke eenheidskosten naar de kostprijsbibliotheek
- Lokale browserpersistentie met herstelbare demonstratiegegevens
- Responsieve mobiele weergave
- Installeerbare PWA met offline shell, laatst gesynchroniseerde momentopname en
  idempotente wachtrij voor JSON-wijzigingen
- Multi-tenant Node/TypeScript-API
- PostgreSQL-datamodel met tenantgebonden foreign keys
- Auditregistratie binnen dezelfde databasetransactie
- Microsoft Entra ID-tokenvalidatie en rolcontrole
- Interactieve Microsoft-login, stille tokenvernieuwing en afmelden

## Lokaal ontwikkelen

Gebruik Node.js 22 en installeer exact de vastgelegde dependencies:

```bash
npm ci
npm run dev
```

Vite toont in de terminal op welke lokale URL de app beschikbaar is.

De service worker wordt alleen in de productiebuild geregistreerd. API-antwoorden
worden bewust niet gecachet; de app bewaart een tenantgebonden werkkopie in
IndexedDB en synchroniseert wachtende JSON-wijzigingen opnieuw zodra de verbinding
herstelt. Bestandsuploads vereisen verbinding en melden een fout wanneer die wegvalt.

Wil je zonder Docker of PostgreSQL testen terwijl `.env` wel een API-URL bevat,
open dan de lokale URL met `?mode=demo`, bijvoorbeeld
`http://127.0.0.1:4173/?mode=demo`. De MVP gebruikt dan uitsluitend lokale
browseropslag. Met **Demo herstellen** zet je de voorbeeldgegevens terug.

### API en PostgreSQL

Start PostgreSQL, kopieer `.env.example` naar `.env` en start daarna de API:

```bash
docker compose up -d postgres
npm run api:dev
```

De API draait standaard op `http://127.0.0.1:3001`. In ontwikkelmodus wordt een
vaste lokale tenant en administrator gebruikt. Met `AUTH_MODE=entra` valideert
de API Microsoft Entra ID access tokens tegen de ingestelde tenant en client-id.
Wanneer ook de drie `VITE_ENTRA_*`-variabelen zijn ingesteld, beveiligt de
React-client de volledige interface met de zakelijke Microsoft-login.

### Peppol-validatie

Iedere verkoopfactuur kan vanuit de factuurpreview worden gecontroleerd. Zonder
extra configuratie voert BouwFlow een lokale, transparante preflight uit op het
Peppol-profiel, beide endpoint-ID's, betaalgegevens, factuurregels en totalen.
Het rapport wordt tenantgebonden bewaard en geaudit, maar krijgt bewust nooit de
status `networkReady`: daarvoor zijn de officiële EN16931- en Peppol
Schematron-regels nodig.

Stel `PEPPOL_VALIDATOR_URL` in om een beheerde externe validator te koppelen. De
API verstuurt de UBL als `application/xml` via `POST` en verwacht JSON in deze
vorm:

```json
{
  "valid": true,
  "engine": "Peppol Schematron 3.0.20",
  "profile": "Peppol BIS Billing 3.0 / UBL 2.1",
  "issues": [
    { "code": "PEPPOL-EN16931-R001", "severity": "warning", "message": "...", "path": "/Invoice/..." }
  ]
}
```

Alleen een geldige externe controle zonder fouten wordt als netwerk-klaar
gemarkeerd. De validator-URL moet daarom verwijzen naar een vertrouwde interne
of contractueel goedgekeurde dienst: de aanvraag bevat factuur- en klantdata.

### Peppol-accesspoint

Netwerkklare facturen kunnen via een gecertificeerde Peppol-provider worden
verzonden. Configureer daarvoor `PEPPOL_ACCESS_POINT_URL` en het server-side
`PEPPOL_ACCESS_POINT_TOKEN`. BouwFlow stuurt de UBL via `POST` met de volgende
headers: `Idempotency-Key`, `X-Peppol-Sender`, `X-Peppol-Recipient`,
`X-Peppol-Document-Type` en `X-Peppol-Process`. De providerantwoord-JSON gebruikt
dit compacte adaptercontract:

```json
{
  "accepted": true,
  "status": "accepted",
  "trackingId": "AP-2027-0001",
  "provider": "Gecertificeerd accesspoint",
  "message": "Document geaccepteerd"
}
```

Voor statusopvolging roept BouwFlow `GET {PEPPOL_ACCESS_POINT_URL}/{trackingId}`
aan. Ondersteunde providerstatussen zijn `queued`, `pending`, `accepted`,
`submitted`, `delivered`, `completed`, `rejected`, `failed` en `error`. Iedere
poging en statusovergang wordt met tijdstip geaudit. De idempotentiesleutel blijft
bij een retry gelijk, zodat een onzekere netwerkuitkomst geen dubbele factuur
veroorzaakt. BouwFlow bewaart bovendien de SHA-256-digest van de gevalideerde UBL
en blokkeert verzending zodra factuur-, klant- of entiteitsdata daarna wijzigen.
AS4-verkeer, Peppol-certificaten en SMP/SML-discovery blijven de
verantwoordelijkheid van de gecertificeerde provider.

Voor automatische opvolging configureer je daarnaast `PEPPOL_WEBHOOK_SECRET`,
`PEPPOL_WEBHOOK_PUBLIC_URL` en `PEPPOL_STATUS_POLL_INTERVAL_MS`. De callback-URL
wordt per verzending via `X-Peppol-Webhook` aan de adapter meegegeven. De provider
roept die URL aan met `Authorization: Bearer <secret>` en een JSON-body:

```json
{
  "eventId": "evt-7788-delivered",
  "trackingId": "AP-2027-0001",
  "status": "delivered",
  "provider": "Gecertificeerd accesspoint",
  "message": "Positieve transportbevestiging ontvangen"
}
```

Event-ID's worden idempotent verwerkt. Terminale statussen kunnen niet door een
laat of dubbel providerbericht worden teruggedraaid. Als een webhook uitblijft,
controleert de achtergrondtaak openstaande referenties via het statusendpoint.

Financiële gebruikers volgen de volledige stroom op het cashflowscherm onder
`Peppol-leveringen`. Het overzicht scheidt aandachtspunten, onderweg zijnde,
niet gestarte en afgeleverde facturen. Leveringen zonder providerupdate gedurende
meer dan dertig minuten worden gemarkeerd. Vanuit dezelfde tabel kan de gebruiker
de providerstatus opvragen of het factuurdossier openen voor validatie en retry.
Factuurconcepten worden niet aangeboden: een verkoopfactuur moet eerst formeel
zijn uitgegeven.

### Peppol-waarschuwingen

BouwFlow maakt automatisch een persistente financiële waarschuwing bij een
mislukte verzending, providerweigering of ontbrekende statusupdate. `Geweigerd`
is kritiek; transportfouten en stilgevallen leveringen zijn hoog. Een financiële
gebruiker kan de melding in behandeling nemen, waarna gebruiker en tijdstip
worden vastgelegd. Een positieve acceptatie of aflevering sluit bijbehorende
waarschuwingen automatisch. Aanmaken, behandelen, heropenen en oplossen worden
afzonderlijk in het auditlog opgenomen. Bedrijfs- en projectautorisaties gelden
ook voor deze waarschuwingen.

### Externe Peppol-notificaties

Waarschuwingen kunnen transactioneel naar e-mail en Microsoft Teams worden
doorgestuurd. Configureer `PEPPOL_NOTIFICATION_URL` als interne notificatieconnector
en vul `PEPPOL_ALERT_EMAIL_TO` en/of `PEPPOL_ALERT_TEAMS_TARGETS` in als
komma-gescheiden bestemmingen. BouwFlow bewaart ieder bericht eerst in een outbox,
levert het idempotent af en probeert een tijdelijke fout maximaal vijf keer opnieuw
met oplopende wachttijd. Kritieke meldingen die na
`PEPPOL_CRITICAL_SLA_MINUTES` nog openstaan krijgen één afzonderlijke
SLA-escalatie per kanaal. Zodra de Peppol-levering herstelt, worden nog niet
verstuurde berichten geannuleerd. De status per kanaal is zichtbaar bij de
waarschuwing in Cashflow en iedere overgang wordt geaudit.

De connector ontvangt via `POST` JSON met `id`, `channel`, `kind`, `destination`,
`subject` en `message`. De header `Idempotency-Key` bevat hetzelfde notificatie-ID;
`PEPPOL_NOTIFICATION_TOKEN` wordt optioneel als bearer-token meegestuurd.

De doelvariabelen en `PEPPOL_CRITICAL_SLA_MINUTES` zijn veilige initiële
standaarden voor nieuwe tenants. Beheerders, directie en financiële administratie
met toegang tot alle entiteiten kunnen deze waarden daarna tenantgebonden beheren
via `Peppol-meldingen`. Opgeslagen tenantinstellingen krijgen voorrang op de
omgevingsvariabelen. De interface toont wel of de serverconnector beschikbaar is,
maar geeft de geheime URL en het token nooit aan de browser door.

Vanuit hetzelfde scherm kan een bevoegde gebruiker een testmelding versturen.
De bestemming moet al in de tenantinstellingen staan; vrije adressen of Teams-doelen
worden door de server geweigerd. BouwFlow maakt voor een test geen operationele
waarschuwing aan, maar audit wel de aanvraag en de geslaagde of mislukte aflevering.

#### Directe Microsoft 365-adapter

Wanneer `PEPPOL_NOTIFICATION_URL` leeg blijft, kan BouwFlow de kanalen zelf
afhandelen. E-mail gebruikt Microsoft Graph `POST /users/{mailbox}/sendMail` met
een afzonderlijke daemon-appregistratie, client credentials en application
permission `Mail.Send`. Configureer daarvoor `M365_NOTIFICATION_TENANT_ID`,
`M365_NOTIFICATION_CLIENT_ID`, `M365_NOTIFICATION_CLIENT_SECRET` en
`M365_NOTIFICATION_SENDER`. De tokenprovider gebruikt
`https://graph.microsoft.com/.default`, bewaart het token alleen in het proces en
vernieuwt het eenmaal na een 401. Zie [Microsoft Graph sendMail](https://learn.microsoft.com/en-us/graph/api/user-sendmail?view=graph-rest-1.0)
en [client credentials](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-client-creds-grant-flow).

Teams gebruikt geen breed Graph-apprecht. Maak per doel een Teams Workflow met
de trigger `When a Teams webhook request is received` en bewaar de resulterende
HTTPS-URL uitsluitend server-side in `PEPPOL_TEAMS_WEBHOOKS_JSON`, bijvoorbeeld
`{"Financiën":"https://..."}`. De sleutel moet overeenkomen met de doelnaam in
het BouwFlow-scherm. BouwFlow verzendt een Adaptive Card met onderwerp, melding,
type en audit-ID. Zie [Teams Workflows-webhooks](https://learn.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook#create-webhooks-using-workflows).

De adapter kan ook gedeeltelijk worden geconfigureerd. BouwFlow toont in de
tenantinstellingen welke kanalen werkelijk actief zijn, blokkeert testmeldingen
voor een ontbrekend kanaal en maakt daarvoor geen nieuwe outboxberichten aan.
Hierdoor blijft een e-mail-only of Teams-only uitrol veilig bruikbaar.

Hetzelfde scherm bevat een server-side productiegereedheidscontrole voor de
externe validator, het Peppol-accesspoint, de providerwebhook, statuspolling, de
notificatieconnector en de outboxdispatcher. De API geeft alleen status en een
veilige toelichting terug; URL's, tokens en andere connectorgeheimen worden nooit
naar de browser gestuurd. Deze controle bevestigt de configuratie. Gebruik daarna
de testmelding en een gecontroleerde testfactuur voor de echte end-to-endproef.

Een uitgegeven factuur bevat daarnaast een expliciete `Acceptatietest starten`-
actie. Na bevestiging voert BouwFlow de echte externe validatie en
accesspointaanlevering uit en bewaart het vierstappenrapport in PostgreSQL:
productieconfiguratie, validatie, aanlevering en netwerkaflevering. De laatste stap
blijft `In afwachting` tot een providerwebhook of de statusmonitor de aflevering
bevestigt. Herhaalde klikken zijn idempotent en verzenden een reeds lopende of
geslaagde acceptatiefactuur niet opnieuw.

Na een aantoonbare aflevering kan directie of een beheerder de run formeel voor
productie vrijgeven. Daarvoor moeten alle zes readinesscontroles nog steeds groen
zijn. BouwFlow bewaart de vrijgever, het tijdstip en een verplichte notitie en maakt
een downloadbaar PDF-rapport met factuur- en projectgegevens, alle controlestappen,
providerreferenties, documentdigest en de productievrijgave.

De normale actie `Via Peppol verzenden` is tenantbreed door deze productiepoort
beveiligd. Zonder een vrijgegeven, geslaagde acceptatierun weigert de API iedere
productieverzending. Ook na vrijgave wordt bij elke verzendpoging opnieuw
gecontroleerd of alle zes readinesscontroles groen zijn; een uitgevallen webhook,
statusmonitor of notificatieketen sluit de poort dus automatisch opnieuw. Alleen de
expliciete acceptatieroute blijft buiten deze poort, zodat een nieuwe omgeving het
vereiste end-to-endbewijs kan opbouwen.

Het tenantscherm `Peppol-meldingen` bevat ook een centraal acceptatiedossier. Het
toont alle runs met factuur, project, status en vrijgever, biedt het PDF-rapport per
run aan en bepaalt de eerstvolgende beheeractie. Vanuit dit dossier opent BouwFlow
rechtstreeks de betrokken verkoopfactuur om een test opnieuw uit te voeren, een
lopende levering op te volgen of de formele vrijgave af te ronden.

Bij de formele vrijgave archiveert BouwFlow hetzelfde PDF-bewijs automatisch in het
centrale projectdossier. Het document wordt gekoppeld aan project, juridische
entiteit, verkoopfactuur en acceptatierun, krijgt onmiddellijk status `Goedgekeurd`
en is niet reviseerbaar. Een herhaalde vrijgave of technische retry maakt nooit een
tweede archiefdocument; downloaden en gecontroleerd verspreiden blijven mogelijk.

Iedere nieuwe documentversie bewaart daarnaast de SHA-256-hash van de oorspronkelijk
opgeslagen bytes. De actie `Integriteit` leest het bestand opnieuw uit object storage,
berekent de actuele hash op de server en vergelijkt beide waarden. Het resultaat
`Geldig`, `Gewijzigd` of `Niet beschikbaar` wordt met tijdstip en beide hashes in het
auditlog vastgelegd. Historische versies van vóór deze functie krijgen bewust geen
nieuwe referentiehash achteraf.

De generieke `PEPPOL_NOTIFICATION_URL` heeft voorrang wanneer beide adapters zijn
ingesteld. Zo kan een organisatie desgewenst een eigen centrale relay behouden.

## Controleren

Voer vóór iedere push dezelfde controles uit als GitHub Actions:

```bash
npm run lint
npm test
npm run build
npm run preview
```

## Productie

De productieomgeving gebruikt `https://aifestival.be` op de gedeelde Easyhost
VPS. Pushes en pull requests worden door GitHub Actions gecontroleerd. Alleen een
geslaagde build op `main` wordt automatisch door de VPS opgehaald en atomisch
geactiveerd.

De volledige eenmalige inrichting en rollbackprocedure staat in
[`docs/PRODUCTION_DEPLOYMENT.md`](docs/PRODUCTION_DEPLOYMENT.md).

## Huidige technische grens

De multi-tenant API, PostgreSQL-migratie, auditlog en authenticatiegrens zijn
aanwezig en worden geautomatiseerd getest. De React-interface gebruikt de API
zodra `VITE_API_URL` is ingesteld en toont laad-, fout- en synchronisatiestatus.
Zonder die instelling blijft de browserrepository beschikbaar als lokale demo.

De API ondersteunt de volledige huidige schermflow, inclusief het wijzigen en
verwijderen van meetstaatposten, hoofdstukken, meetstaatimport en
calculatieversies. De React-client verzorgt interactieve Entra
ID-login en levert access tokens aan de API. Gevalideerde gebruikers worden bij
de eerste login tenantgebonden geregistreerd, waarna applicatierollen en auditlog
dezelfde identiteit gebruiken.

De Easyhost-releaseflow kan frontend en API nu atomisch publiceren en samen
terugrollen. De eenmalige VPS-, PostgreSQL-, back-up- en Entra-configuratie moet
nog door een beheerder worden uitgevoerd voordat productiegegevens worden
toegelaten.

## Meetstaat importeren

De centrale API accepteert `.xlsx` en `.csv` tot 10 MB. Bij Excel wordt het
eerste werkblad gelezen; een import bevat maximaal 5.000 gegevensrijen. De
verplichte kolommen zijn `Code`, `Omschrijving`, `Hoeveelheid` en `Eenheid`.
Optioneel worden `Hoofdstuk`, `Hoofdstuknaam`, `Arbeid`, `Materiaal`, `Materieel`
en `Onderaanneming` herkend. Komma- en puntnotatie voor Belgische bedragen en
hoeveelheden worden ondersteund. De toepassing toont rijfouten vooraf en schrijft
pas naar PostgreSQL wanneer het volledige bestand geldig is.

## Kostprijsbibliotheek

De bibliotheek beheert herbruikbare arbeids-, materiaal-, materieel- en
onderaannemersprijzen met code, eenheid, actuele eenheidskost en bron. Vanuit een
meetstaatpost kiest de calculator een kostprijs en voert hij de verbruiksfactor
in. BouwFlow berekent vervolgens de kost per meetstaateenheid en bewaart de
gebruikte bron, factor en toegepaste prijs. Een manuele prijswijziging verbreekt
die bronkoppeling, zodat de audittrail geen verouderde herkomst suggereert.

## Calculatiescenario's

Per calculatie kunnen meerdere scenario's naast de basisberekening bestaan. Een
scenario bevat procentuele afwijkingen voor arbeid, materiaal, materieel en
onderaanneming, aangevuld met eigen percentages voor algemene kosten, risico en
marge. BouwFlow toont directe kost, verkoopwaarde en afwijking tegenover de
basis. Eén scenario wordt expliciet gekozen voor de volgende offerteversie; bij
gunning wordt de vastgelegde offertewaarde overgenomen in het projectbudget.

## Offertegenerator

Vanuit een calculatie legt BouwFlow het gekozen scenario, de meetstaatprijzen en
de commerciële toeslagen vast in een onveranderlijke offerte-momentopname. De
calculator vult onderwerp, inleiding, uitvoeringstermijn, betalingsvoorwaarden,
geldigheid, prijsherziening, uitsluitingen en opmerkingen aan. De schermpreview
en de PDF gebruiken vervolgens uitsluitend deze bevroren gegevens, zodat latere
wijzigingen aan de calculatie een bestaande offerteversie niet stilzwijgend
veranderen. PDF-download is tenantgebonden en beschikbaar via de centrale API.

## Projectopstart en overdracht

Bij gunning zet BouwFlow de laatste bevroren offerte om naar een projectdossier.
De hoofdstukken uit de calculatie worden automatisch werkpakketten; het
uitvoeringsbudget wordt proportioneel verdeeld en sluit na afronding exact aan op
het totale projectbudget. Per werkpakket worden geplande uren en planningsstatus
vastgelegd. De calculator en projectmanager doorlopen daarnaast een formele
overdracht met verantwoordelijke, geplande datums, risicoregister, notities en
zes verplichte controles. Alleen een volledig gecontroleerd dossier kan de
status `Aanvaard` krijgen; iedere wijziging komt in het tenantgebonden auditlog.

## Projectplanning

Na aanvaarding van de projectoverdracht genereert BouwFlow een eerste planning
uit de werkpakketten. De beschikbare projectperiode wordt gewogen verdeeld op
basis van geplande uren, of op budget wanneer nog geen uren beschikbaar zijn.
Activiteiten worden gekoppeld met voorgangers en de geplande einddatum wordt als
mijlpaal toegevoegd. De planner kan namen, datums, afhankelijkheden en voortgang
aanpassen in een tabel en dezelfde gegevens in een Gantt-tijdlijn bekijken.
Een baseline bevriest de start- en einddatums; latere datumwijzigingen markeren
de planning automatisch als `Gewijzigd` en blijven tegenover de baseline
zichtbaar.

## Mobiele werfopvolging

De werfmodule beheert maximaal één dagrapport per project en werkdag. De
werfleider koppelt het rapport aan een werkpakket en registreert weer,
temperatuur, uitgevoerde activiteiten, medewerkers, normale uren, overuren,
onderaannemers, materialen, machines, leveringen, stilstanden, problemen,
bezoekers en opmerkingen. Concepten blijven bewerkbaar. Indiening vereist een
inhoudelijke dagregistratie en minstens één medewerker of onderaannemer; daarna
wordt het rapport vergrendeld. Een ingediend rapport kan vervolgens met naam en
tijdstip digitaal worden ondertekend. Alle statusovergangen zijn tenantgebonden
en worden in het auditlog bewaard.

## Foto- en bewijsbeheer

Bij een conceptdagrapport kan de werfleider rechtstreeks met de mobiele camera
een JPEG-, PNG-, WebP- of HEIC-foto tot 10 MB toevoegen. Iedere foto krijgt een
opnamemoment, bijschrift, locatie en optionele koppeling met een werkpakket. De
bestandsbytes worden buiten PostgreSQL opgeslagen onder een door de server
gegenereerde tenantsleutel; alleen metadata staat in de centrale databank.
Teruglezen verloopt via een geauthenticeerde API-route. Een foto kan met een
tweestapsbevestiging worden verwijderd zolang het rapport `Concept` is. Na
indiening is het bewijs vergrendeld en blijft iedere handeling auditbaar.

De lokale opslagmap wordt ingesteld met `UPLOAD_DIR` en staat standaard op
`.data/uploads`. Voor horizontaal geschaalde productie kan dezelfde
`ObjectStorage`-grens later door S3- of Azure Blob-opslag worden ingevuld zonder
het domeinmodel of de foto-API te wijzigen.

## Digitale werfbonnen en meerwerken

Een wijziging wordt per project vastgesteld en kan aan een dagrapport,
werkpakket en een of meer bewijsfoto's worden gekoppeld. De kostenopbouw maakt
onderscheid tussen arbeid, materiaal, materieel, transport, onderaanneming en
overige kosten; de planningimpact wordt afzonderlijk in kalenderdagen bewaard.

De statusflow is `Vastgesteld` → `Berekend` → `Ter goedkeuring` →
`Goedgekeurd` → `Uitgevoerd` → `Klaar voor facturatie`. Voor indiening is een
berekend bedrag en minstens een dagrapport of foto als bewijs vereist. Vanaf
indiening zijn inhoud en bewijs vergrendeld. Goedkeuring bewaart naam en tijdstip
van de ondertekenaar; iedere overgang wordt in dezelfde tenantgebonden
databasetransactie geaudit. Het dashboard toont per project de wachtende,
goedgekeurde en voor facturatie vrijgegeven waarde.

## Vorderingsstaten en factuurconcepten

Per project legt BouwFlow een periode en de cumulatieve voortgang van ieder
werkpakket vast. De server verdeelt de contractwaarde over de werkpakketten,
haalt de vorige ingediende stand op en berekent uitsluitend het bedrag van de
huidige periode. Een cumulatief percentage kan nooit onder een eerder ingediende
stand zakken en periodes mogen elkaar niet overlappen.

Facturatieklare meerwerken kunnen eenmalig aan de vorderingsstaat worden
toegevoegd. Prijsherziening en inhoudingspercentage worden afzonderlijk bewaard,
waarna bruto-, inhoudings- en nettobedrag automatisch worden berekend. De flow is
`Concept` → `Ingediend` → `Goedgekeurd` → `Factuurconcept`. Indiening
vergrendelt de inhoud en reserveert de geselecteerde meerwerken. Na goedkeuring
maakt BouwFlow een verkoopfactuurconcept met factuurdatum, vervaldatum, btw en
totaalbedrag. Een boekhoud- of Peppol-koppeling kan later op dit concept
aansluiten zonder de goedgekeurde vorderingsstaat te wijzigen.

Het factuurformulier neemt de standaard-btw en betaaltermijn van de juridische
entiteit over; dezelfde defaults worden ook op de server afgedwongen. Vanuit
het kasboek kan de gebruiker een printbaar factuurdocument openen, een
boekhoud-CSV downloaden en een UBL 2.1-concept exporteren. De interface maakt
duidelijk dat dit XML-bestand nog geen gevalideerde of via Peppol verzonden
factuur is en toont eerst een controle van de beschikbare stamgegevens.

CRM-organisaties en juridische entiteiten bevatten daarnaast een factuuradres,
btw-nummer, ISO-landcode en Peppol endpoint-ID met scheme. Voor Belgische
ondernemingen ondersteunt BouwFlow scheme `0208` en valideert het
ondernemingsnummer met de mod-97-regel. Alleen wanneer verzender en ontvanger
volledig zijn, voegt de export de Peppol BIS Billing 3.0 `CustomizationID` en
`ProfileID` toe. Ook dan blijft koppeling met een accesspoint en externe
Schematron-validatie vereist voordat netwerkverzending mogelijk is.

## Projectcontrole en eindprognose

Het projectcontroledashboard combineert uitvoeringsbudget, open verplichtingen,
werkelijke kosten, resterende kost, gefactureerde waarde en goedgekeurde
meerwerken. Daaruit berekent BouwFlow live de verwachte eindkost (`Estimate at
Completion`), budgetafwijking, verwachte omzet, prognosemarge en
cashblootstelling.

Een kostenregistratie is een open `Verplichting` of een onmiddellijk geboekte
`Werkelijke kost`, steeds gekoppeld aan een datum, kostensoort, werkpakket,
leverancier en referentie. Een verplichting kan formeel worden omgezet naar de
uiteindelijke leverancierskost. De oorspronkelijke verplichting blijft daarbij
in de audittrail staan en verwijst naar de nieuwe boeking.

Een eindprognose legt per werkpakket de resterende kost vast. Deze waarde omvat
de nog open verplichtingen en mag daarom nooit lager zijn dan het reeds
verplichte bedrag. Iedere prognose wordt als onveranderlijke versie opgeslagen
met de toenmalige werkelijke kosten, verplichtingen, verwachte eindkost en marge,
zodat de evolutie van het projectresultaat traceerbaar blijft.

## Inkoop en leveranciersbeheer

BouwFlow beheert leveranciers en projectgebonden inkoopdossiers volgens de flow
`Behoefte` → `Prijsaanvraag` → `Vergelijken` → `Besteld` → `Afgesloten`. Een
inkoopbehoefte bevat de benodigde datum, kostensoort, optioneel werkpakket en een
of meer artikelen met hoeveelheid, eenheid en richtprijs. Meerdere
leveranciersoffertes kunnen naast elkaar worden vergeleken op totaalprijs,
levertermijn, geldigheid en opmerkingen.

De keuze van een leveranciersofferte maakt atomair een bestelbon en een open
projectverplichting aan. Bij ontvangst worden leverdatum, leverbon, ontvanger en
eventuele afwijkingen vastgelegd. De leveranciersfactuurcontrole vergelijkt het
factuurbedrag met bestelling en ontvangst. Na bevestiging wordt de verplichting
omgezet naar een werkelijke projectkost en wordt het inkoopdossier afgesloten.
Bestelbedrag, factuurbedrag en afwijking blijven zichtbaar en iedere overgang is
tenantgebonden en auditbaar.

## Cashflowbeheer

Het cashflowdashboard combineert de financiële gegevens die al in BouwFlow
aanwezig zijn. Conceptverkoopfacturen verschijnen als `Te verzenden`; na
verzending worden ze `Openstaand` en na registratie van het volledige bedrag
`Betaald`. Een overschreden vervaldatum wordt automatisch als `Achterstallig`
gemarkeerd.

Bestellingen worden eerst als een verwachte uitgaande kasstroom opgenomen. Na de
driewegcontrole gebruikt de prognose de echte leveranciersfactuur en vervaldatum.
De financiële administratie kan daarna de bankdatum, het bedrag en de
betalingsreferentie vastleggen. Per project of over de volledige portefeuille
toont BouwFlow inkomende en uitgaande bedragen per maand, openstaande posten,
achterstallig saldo, gerealiseerde netto cashflow en de netto horizon. De
betalingsstatus wordt niet apart gekopieerd: het dashboard wordt rechtstreeks
afgeleid uit verkoopfacturen en inkoopdossiers.

## Nacalculatie en leerlus

Voor ieder gegund project gebruikt BouwFlow de bewaarde broncalculatie en de
daaruit aangemaakte werkpakketten. Het uitvoeringsbudget wordt volgens de gekozen
calculatie en het offertescenario verdeeld over kostensoorten en
meetstaatposten. Werkelijke projectkosten worden vervolgens per werkpakket en
kostensoort met die oorspronkelijke verdeling vergeleken.

Het dashboard toont budget, werkelijke kosten en afwijking voor het totale
project, per werkpakket en voor arbeid, materiaal, materieel, transport,
onderaanneming en overige kosten. Voor oorspronkelijke meetstaatposten berekent
BouwFlow een gewogen werkelijke eenheidskost. Deze toerekening blijft herkenbaar
als nacalculatie en overschrijft nooit automatisch een bestaande calculatie.

Een calculator of projectmanager kan een bruikbare werkelijke eenheidskost
expliciet als historische referentie naar de kostprijsbibliotheek sturen. De
bron vermeldt het project en de gewogen toerekeningsmethode; dubbele publicatie
wordt geblokkeerd en de toevoeging wordt tenantgebonden geaudit. Zo ontstaat een
controleerbare leerlus zonder dat uitvoeringsgegevens stilzwijgend toekomstige
offertes wijzigen.

## Centraal documentbeheer

Ieder gegund project heeft een centraal dossier voor bestekken, meetstaten,
plannen, technische fiches, vergunningen, contracten, verslagen, as-built- en
opleverdocumenten. Bestanden worden tenantgebonden in objectopslag bewaard en
zijn via het projectdossier te uploaden en downloaden. De toegelaten
bestandstypes worden op de server gecontroleerd.

Een eerste uitgave krijgt automatisch revisie `R1`. Een nieuwe upload maakt een
onveranderlijke volgende revisie, markeert de vorige versie als vervallen en zet
de goedkeuringsflow opnieuw op `Concept`. De workflow verloopt via `Concept` →
`Ter goedkeuring` → `Goedgekeurd`. Alleen een goedgekeurde actuele revisie kan
worden verspreid.

Per verspreiding registreert BouwFlow de ontvanger, het e-mailadres, de
verzenddatum en de leesbevestiging voor precies die revisie. Daardoor blijft ook
na een latere planwijziging zichtbaar wie welke versie heeft ontvangen en
gelezen. Uploads, revisies, goedkeuringen, verspreidingen en leesbevestigingen
worden afzonderlijk in de audittrail vastgelegd.

## QHSE en veiligheidsopvolging

Per project beheert BouwFlow attesten en keuringen voor medewerkers, materieel
en onderaannemers. Ieder attest bevat de houder, het type, attestnummer,
uitgifte- en vervaldatum en kan optioneel verwijzen naar een goedgekeurd bewijs
uit het centrale documentdossier. Alleen documenten uit hetzelfde project en
met status `Goedgekeurd` kunnen als bewijs worden gekoppeld.

Het QHSE-dashboard markeert vervallen attesten onmiddellijk als kritiek en
waarschuwt dertig dagen vóór een vervaldatum. Toolboxmeetings, LMRA's,
werkvergunningen, materieelinspecties en veiligheidsinspecties worden met datum,
locatie, inspecteur en notities geregistreerd. Vaststellingen bevatten ernst,
verantwoordelijke en deadline.

Open of laattijdige vaststellingen verschijnen samen met attestwaarschuwingen in
één actielijst. Iedere vaststelling moet afzonderlijk worden opgelost voordat de
controle kan worden afgesloten. Registratie, oplossing en afsluiting zijn
tenantgebonden en worden in de audittrail vastgelegd.

## Multi-company en bedrijfsstructuur

Binnen één tenant kan BouwFlow meerdere juridische entiteiten beheren. Per
entiteit worden de officiële naam, het btw-nummer, land, functionele valuta en
actieve status bijgehouden. Elke entiteit kan meerdere operationele vestigingen
hebben met een eigen naam, adres en land.

Een gegund project krijgt automatisch de eerste actieve juridische entiteit en
bijbehorende vestiging toegewezen. Directie, projectleiding en administratie
kunnen deze toewijzing daarna expliciet aanpassen. De server controleert dat de
gekozen vestiging werkelijk tot de gekozen entiteit behoort en dat de entiteit
actief is.

Het bedrijfsstructuurdashboard toont projecten en contractwaarde per entiteit,
alle vestigingen en projecten waarvoor nog geen juridisch eigenaarschap werd
vastgelegd. Aanmaak van entiteiten en vestigingen en iedere wijziging van
projecteigenaarschap worden tenantgebonden geaudit. Deze basis kan later worden
gebruikt voor entiteitsgebonden btw, facturatie, rapportering en intercompany-
doorrekeningen.

### Entiteitsgebonden toegang en rapportering

Beheerders en directie kunnen per gebruiker kiezen tussen toegang tot alle
juridische entiteiten of een expliciete lijst. Bij beperkte toegang retourneert
de bootstrap-API uitsluitend toegankelijke entiteiten, vestigingen, projecten en
alle projectgebonden operationele en financiële gegevens. Mutaties op projecten
en onderliggende dossiers worden eveneens server-side tegen deze scope
gecontroleerd.

De webapp bevat een aparte autorisatiematrix en een globale rapportagefilter voor
juridische entiteit en vestiging. De filter werkt door in dashboards, projecten,
werfopvolging, QHSE, documenten, inkoop, facturatie, cashflow en nacalculatie en
blijft ook op mobiel beschikbaar.

### Financiële entiteiten en intercompany

Elke juridische entiteit heeft een eigen factuurprefix en transactionele teller,
standaard-btw, betaaltermijn, IBAN en BIC. Bij het maken van een verkoopfactuur
leidt BouwFlow de uitgevende entiteit af uit het project, reserveert het volgende
factuurnummer en bewaart de entiteitskoppeling op de factuur.

Intercompany-doorrekeningen registreren een verzendende en ontvangende entiteit,
een optioneel project, basisbedrag en opslag. Een project moet tot de ontvangende
entiteit behoren. De workflow loopt van `Concept` via `Goedgekeurd` naar
`Geboekt`; iedere overgang wordt tenantgebonden geaudit en het beheer vereist
toegang tot alle juridische entiteiten.
