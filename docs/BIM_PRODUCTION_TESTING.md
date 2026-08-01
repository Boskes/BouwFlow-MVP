# BIM-productietest voor BouwFlow

Deze checklist test de echte WebIFC-geometrie-engine, de grafische selectie en de koppeling met de calculatie in de vaste demo-tenant. Gebruik hiervoor uitsluitend de klasse-8-democalculatie `CAL-DEMO-OWV-RO`.

## Testmodellen

In de BIM-werkruimte staat onder **IFC-testdata** een vaste set buildingSMART-proefmodellen:

- **Snelle rooktest**: een wand met opening en raam; klein genoeg voor een snelle parser- en rendercontrole.
- **Architectuurmodel**: meerdere bouwkundige objecttypen voor filters, lagen en hoeveelheden.
- **Constructiemodel**: kolommen, balken en platen voor constructieve calculatieposten.
- **Inframodel weg**: IFC4.3-infrastructuur om schema- en schaalverschillen te testen.

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

## Verwachte uitgangsdata

- Klasse-8-democalculatie: 180 hoofdstukken en 2.000 posten.
- Grafisch ingebouwd demomodel: 18 objecten.
- Beschikbare testrollen: Administrator plus tender manager, projectdirecteur, calculator, projectmanager, werfleider, aankoper, financiële administratie, klant, leverancier en onderaannemer.

Geometrisch afgeleide m²- en m³-hoeveelheden blijven gemarkeerd voor controle. Zij zijn geen vervanging voor gevalideerde IFC Quantity Sets.
