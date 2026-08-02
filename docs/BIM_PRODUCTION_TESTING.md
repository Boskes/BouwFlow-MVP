# BIM-productietest voor BouwFlow

Deze checklist test de echte WebIFC-geometrie-engine, de grafische selectie en de koppeling met de calculatie in de vaste demo-tenant. Gebruik hiervoor uitsluitend de klasse-8-democalculatie `CAL-DEMO-OWV-RO`.

## Testmodellen

In de BIM-werkruimte staat onder **IFC-testdata** een vaste set buildingSMART-proefmodellen:

- **Snelle rooktest**: een wand met opening en raam; klein genoeg voor een snelle parser- en rendercontrole.
- **Architectuurmodel**: meerdere bouwkundige objecttypen voor filters, lagen en hoeveelheden.
- **Constructiemodel**: kolommen, balken en platen voor constructieve calculatieposten.
- **Inframodel weg**: IFC4.3-infrastructuur om schema- en schaalverschillen te testen.

Naast deze downloadbare buildingSMART-bestanden bevat **Vorderingen → BIM-meting** vijf uitgebreide, direct bruikbare projectscenario's:

- **Klasse 8 ziekenhuisvleugel**: 88 objectgroepen voor vloerplaten, binnenwanden, gevelmodules en techniekzones.
- **Klasse 8 stedelijke tunnel**: 94 IFC4.3-objectgroepen voor tunnelmoten, wegverharding, vluchtverbindingen en technische tracés.
- **Klasse 8 hoogbouw (38 lagen)**: 152 objectgroepen voor betoncycli, kernen en prefab gevelzones.
- **Onderwijscluster technieken**: 116 objectgroepen voor kanalen, leidingen, kabelgoten en toestellen, inclusief teststatus.
- **Complex verkeersknooppunt**: 88 IFC4.3-objectgroepen voor grondwerk, riolering, verharding en kunstwerken.

Ieder scenario bevat modelversie, discipline, coördinatiestatus, bouwlaag/zone, geplande en gerealiseerde voortgang, verificatiestatus en meetbare hoeveelheden. Een gebruiker kan ook een eigen IFC-bestand importeren; dezelfde selectie- en certificatieflow wordt dan op de echte WebIFC-geometrie toegepast.

De bestanden komen uit de officiële [buildingSMART Sample-Test-Files](https://github.com/buildingSMART/Sample-Test-Files) en vallen onder [CC BY 4.0](https://github.com/buildingSMART/Sample-Test-Files/blob/main/LICENSE).

Ontwikkelaars kunnen bereikbaarheid, IFC-schema en echte geometrie van alle vier bestanden in één keer valideren met `npm run test:bim-fixtures`.

## Uit te voeren controles

1. Open **Calculaties**, kies `CAL-DEMO-OWV-RO` en open **BIM-calculatie**.
2. Download een model via **IFC-testdata** en importeer het met **IFC-model importeren**.
3. Controleer dat de voortgang 100% bereikt en dat de status `WebIFC geometrie actief` vermeldt.
4. Controleer dat het model passend in beeld staat en dat boven-, voor- en rechteraanzicht werken.
5. Selecteer een object in het 3D-model. Het object moet duidelijk oplichten en rechts als calculatieregel verschijnen.
6. Selecteer een laag en daarna een verdieping. De zichtbare en geselecteerde aantallen moeten onmiddellijk wijzigen.
7. Controleer type, naam, verdieping, eenheid, hoeveelheid en geraamde waarde van de selectie.
8. Voeg één gegroepeerde post toe aan de calculatie en controleer dat de bronnotitie het IFC-bestand en GUID/ExpressID bevat.
9. Herhaal met het architectuur-, constructie- en inframodel.
10. Controleer na iedere import de browserconsole op fouten en herlaad de pagina om vast te stellen dat de centrale calculatie bewaard bleef.

## BIM-vordering testen

1. Open **Vorderingen**, kies een project en maak een nieuwe vorderingsstaat.
2. Controleer de waarderingsdatum, betaaldatum, certificaatreferentie, opsteller en contractuele prijsherzieningsformule.
3. Klik bij een werkpakket op **BIM-meting** en kies achtereenvolgens het ziekenhuis-, tunnel-, hoogbouw-, technieken- en wegenisvoorbeeld.
4. Filter op discipline/categorie en bouwlaag/zone, selecteer zichtbare objecten en controleer gemeten en te vorderen hoeveelheid.
5. Kies het juiste werkpakket, stel de cumulatieve uitvoering in en bevestig modelversie en meter.
6. Vink **Model en clashes gecontroleerd** aan en pas de BIM-meting toe.
7. Controleer dat meetmethode `BIM`, cumulatief percentage, geverifieerde hoeveelheid, modelelementen en controlecommentaar op de vorderingsregel staan.
8. Vul voorschot, terugname, andere inhoudingen en de indieningschecklist in. Het netto bedrag moet onmiddellijk herberekenen.
9. Sla het concept op, open het dossier en controleer dat het BIM-meetbewijs in de onveranderlijke auditgegevens aanwezig is.
10. Dien in, keur goed via het klantportaal en maak een factuurconcept. De gecertificeerde waarde moet overeenkomen met de vorderingsstaat.

## Verwachte uitgangsdata

- Klasse-8-democalculatie: 180 hoofdstukken en 2.000 posten.
- Grafisch ingebouwd demomodel: 18 objecten.
- Beschikbare testrollen: Administrator plus tender manager, projectdirecteur, calculator, projectmanager, werfleider, aankoper, financiële administratie, klant, leverancier en onderaannemer.

Geometrisch afgeleide m²- en m³-hoeveelheden blijven gemarkeerd voor controle. Zij zijn geen vervanging voor gevalideerde IFC Quantity Sets.
