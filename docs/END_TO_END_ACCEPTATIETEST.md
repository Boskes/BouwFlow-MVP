# BouwFlow end-to-end acceptatietest

Dit script doorloopt BouwFlow van een nieuwe klant tot een financieel en operationeel afgewerkt project. Het test één volledige projectketen over twee juridische entiteiten, meerdere vestigingen, interne rollen en externe portalen.

Gebruik dit document als handmatig productietestscript. Iedere teststap bevat een actor, handeling en verwacht resultaat. Vul tijdens de uitvoering de kolom **Resultaat** in met `OK`, `NOK`, `NVT` of een defectnummer.

## 1. Doel en acceptatiegrens

De test is geslaagd wanneer:

- de commerciële, calculatie-, project-, werf-, inkoop-, financiële en opleveringsketen zonder blokkerende fout is doorlopen;
- gegevens van Entiteit A en Entiteit B correct gescheiden blijven;
- een geautoriseerde gebruiker de groepsbrede samenwerking, THV-verdeling en intercompanyboeking wel ziet;
- een beperkt profiel alleen de toegewezen entiteit, projecten en portaalgegevens ziet;
- statussen, bedragen, documenten, revisies en auditinformatie na herladen bewaard blijven;
- calculatieversies en momentopnamen aantoonbaar met elkaar vergeleken kunnen worden;
- BIM-selecties zichtbaar gekoppeld worden aan calculatieposten;
- projectoverschrijdende resourceconflicten naar alle betrokken planningen leiden en daar aangepast kunnen worden;
- nacalculatie en oplevering een controleerbaar eindbeeld geven.

ERP-integraties zijn in deze release **On hold**. Een echte Peppol-netwerkverzending is alleen een acceptatiecriterium wanneer een gecertificeerd accesspoint en externe validator in de productieomgeving zijn geconfigureerd. De lokale Peppol-preflight blijft altijd onderdeel van deze test.

## 2. Productieveilig uitvoeren

1. Kies één unieke runcode: `E2E-JJJJMMDD-NN`, bijvoorbeeld `E2E-20260802-01`.
2. Zet die runcode vooraan in elke nieuwe naam, titel, referentie en documentnaam.
3. Gebruik uitsluitend fictieve adressen onder `.example` en geen echte klant- of leveranciersmailboxen.
4. Gebruik twee bestaande actieve juridische entiteiten. Maak geen nieuwe juridische entiteit aan als productie al twee bruikbare entiteiten bevat.
5. Verstuur geen echte e-mail, Teams-melding of Peppol-factuur zonder voorafgaande toestemming van de productiebeheerder.
6. Verwijder testrecords niet. Laat ze herkenbaar staan voor auditbewijs en zet waar mogelijk de status op `Afgesloten`, `Inactief` of `Test afgerond`.
7. Maak na iedere hoofdsectie een schermopname en noteer de vaste dossier-URL.
8. Stop onmiddellijk bij tenantoverschrijding, ongeautoriseerde inzage, een verkeerd factuurnummer of verzending naar een echte externe bestemming.

## 3. Testregistratie

| Gegeven | In te vullen |
|---|---|
| Runcode | `E2E-________________` |
| Productie-URL |  |
| Startdatum en -tijd |  |
| Tester |  |
| Browser en versie |  |
| Entiteit A |  |
| Vestiging A |  |
| Entiteit B |  |
| Vestiging B |  |
| Administrator |  |
| Einddatum en -tijd |  |
| Eindoordeel | Go / Go met opmerkingen / No-go |

### Rollen die nodig zijn

Gebruik echte testaccounts of de beveiligde profielpreview bovenaan BouwFlow. Wissel vóór iedere stap naar de genoemde rol.

| Rol | Hoofdtaak in deze test |
|---|---|
| Administrator | Bedrijfsstructuur, rechten, audit en herstelcontrole |
| Commercieel medewerker | Klant en CRM-opvolging |
| Tender manager | Tenderdossier en indiening |
| Directie | Go/No-Go en hoge goedkeuringen |
| Calculator | Calculatie, versies, BIM, scenario en offerte |
| Projectdirecteur | Gunning, contract en formele goedkeuring |
| Projectmanager | Overdracht, planning, voortgang en forecast |
| Planner | Capaciteit en projectoverschrijdende conflicten |
| Werfleider | Dagrapport, uren, foto, werfbon en meerwerk |
| Aankoper | Leverancier, prijsaanvraag en bestelling |
| Financiële administratie | Vorderingsstaat, facturen, betalingen en intercompany |
| Preventieadviseur | QHSE-inspectie, incident en sluiting |
| Kwaliteitsverantwoordelijke | Documenten en oplevering |
| Klant | Offerte, documenten en klantgoedkeuring |
| Leverancier | Prijsaanvraag en levering |
| Onderaannemer | Medewerkers, documenten en prestaties |

## 4. Vaste testdata

Vervang `{RUN}` overal door de gekozen runcode.

| Onderdeel | Testwaarde |
|---|---|
| Klant | `{RUN} Stad Rivierenburg` |
| Klantcontact | Emma Test, `emma.test@rivierenburg.example` |
| Project | `{RUN} Mobiliteitshub Rivierenburg` |
| Locatie | Testlaan 100, 1000 Rivierenburg |
| Erkenning | C – Klasse 8 |
| Geraamde waarde | EUR 2.500.000 |
| Kans bij aanmaak | 25% |
| Leverancier | `{RUN} Betonleveringen BV` |
| Leverancierscontact | Lars Levering, `lars@betonleveringen.example` |
| Onderaannemer | `{RUN} Grondwerken BV` |
| Onderaannemerscontact | Olivia Onder, `olivia@grondwerken.example` |
| Medewerker A | `{RUN} Pieter Planning`, 40 uur/week, Entiteit A |
| Medewerker B | `{RUN} Sara Service`, 32 uur/week, Entiteit B |
| Materieel | `{RUN} Rupskraan 25t`, Entiteit B |
| Magazijnartikel | `{RUN} Betonstraatsteen`, eenheid `st` |
| THV/combinatie | `{RUN} THV Mobiliteitshub`, 70% A / 30% B, A leidend |
| Intercompany | B factureert A EUR 12.500 voor materieelinzet |

### Calculatie-inhoud

| Hoofdstuk | Post | Hoeveelheid | Eenheid | Arbeid | Materiaal | Materieel | Onderaanneming |
|---|---|---:|---|---:|---:|---:|---:|
| 01 Voorbereiding | 01.01 Werfinrichting | 1 | lot | 75.000 | 35.000 | 40.000 | 0 |
| 02 Grondwerken | 02.01 Uitgraving en afvoer | 20.000 | m³ | 8 | 4 | 12 | 6 |
| 03 Betonwerken | 03.01 Betonvloer | 5.000 | m² | 28 | 62 | 12 | 18 |
| 04 Wegenis | 04.01 Asfaltverharding | 10.000 | m² | 12 | 38 | 10 | 5 |

Stel algemene kosten in op 8%, risico op 4% en doelmarge op 10%. Noteer het door BouwFlow berekende totaal als de contractwaarde; bereken dit niet buiten BouwFlow opnieuw.

## 5. Fase A – omgeving, entiteiten en autorisatie

| ID | Actor | Handeling | Verwacht resultaat | Resultaat |
|---|---|---|---|---|
| A01 | Administrator | Open **Bedrijfsstructuur** en selecteer Entiteit A en Entiteit B. | Beide entiteiten zijn actief en tonen elk een btw-nummer, valuta, factuurprefix en minstens één vestiging. |  |
| A02 | Administrator | Open **Financiële entiteiten** en controleer IBAN, BIC, betaaltermijn, btw-percentage en Peppol-ID van beide entiteiten. | Financiële gegevens zijn volledig; factuurprefixen verschillen. |  |
| A03 | Administrator | Noteer één vestiging per entiteit. Maak alleen indien nodig een vestiging `{RUN} Testvestiging` aan. | De vestiging is aan exact één juridische entiteit gekoppeld. |  |
| A04 | Administrator | Open **Instellingen & Beheer** en controleer de interne en externe testprofielen. | Rollen, entiteitstoegang, projecttoegang en eventuele organisatie-/leverancier-/onderaannemerskoppeling zijn zichtbaar. |  |
| A05 | Administrator | Beperk een intern testprofiel tijdelijk tot Entiteit A en nog geen projecten. | De toegangssamenvatting vermeldt uitsluitend Entiteit A. |  |
| A06 | Beperkt profiel | Open dashboard, bedrijfsstructuur en financiële pagina's. | Niet-toegestane pagina's ontbreken of weigeren toegang; gegevens van Entiteit B lekken niet. |  |
| A07 | Administrator | Herstel het profiel naar de voor de rest van de test benodigde toegang. | Het profiel kan de toegewezen projecttaken uitvoeren. |  |

## 6. Fase B – klant en CRM

| ID | Actor | Handeling | Verwacht resultaat | Resultaat |
|---|---|---|---|---|
| B01 | Commercieel medewerker | Ga naar **CRM & Relaties** en maak klant `{RUN} Stad Rivierenburg` aan met type `Overheid`, adres, btw-nummer, Peppol-schema `0208` en een fictief endpoint-ID. | De klant krijgt een vaste dossierpagina en blijft na herladen bestaan. |  |
| B02 | Commercieel medewerker | Voeg Emma Test toe als primair contact. | Naam, functie, e-mail en primaire status zijn zichtbaar. |  |
| B03 | Commercieel medewerker | Vul facturatiegegevens en een betaaltermijn van 30 dagen aan. | De facturatiegegevens verschijnen in het klantdossier. |  |
| B04 | Commercieel medewerker | Registreer activiteit `Intake mobiliteitshub` met eigenaar, datum en notitie. | De activiteit staat in de tijdlijn met actor en tijdstip. |  |
| B05 | Commercieel medewerker | Koppel de klant aan één bestaande relatie als `Studiebureau` of `Partner`. | De relatie is vanuit beide relevante dossiercontexten navigeerbaar. |  |
| B06 | Administrator | Open **Dossiers**, zoek op de runcode en open het klantrecord. | Zoeken levert één herkenbaar klantrecord op; gekoppelde dossiers en historie zijn beschikbaar. |  |

## 7. Fase C – opportuniteit, tender en Go/No-Go

| ID | Actor | Handeling | Verwacht resultaat | Resultaat |
|---|---|---|---|---|
| C01 | Commercieel medewerker | Maak in **Opportuniteiten** `{RUN} Mobiliteitshub Rivierenburg` aan voor de nieuwe klant, waarde EUR 2.500.000, kans 25%, locatie, deadline en erkenning C – Klasse 8. Kies Entiteit A en Vestiging A. | Een uniek opportuniteitsnummer ontstaat met status `Nieuw`; klant, entiteit en vestiging zijn gekoppeld. |  |
| C02 | Commercieel medewerker | Open het opportuniteitsdossier en kies **Kwalificeren**. | Status wordt `Gekwalificeerd`; de wijziging staat in de historie. |  |
| C03 | Tender manager | Vul tenderverantwoordelijke, reviewer, indieningsdeadline, erkenningsklasse, selectiecriteria, vragen en indieningschecklist in. | Tenderstatus en voortgang worden afgeleid uit de ingevulde onderdelen. |  |
| C04 | Tender manager | Upload een klein testdocument `{RUN}-selectieleidraad.pdf` en koppel het aan de opportuniteit. | Document opent in de viewer, downloadt als PDF en toont geen tekstpagina in de browser. |  |
| C05 | Directie | Vul de Go/No-Go-score in voor strategische fit, capaciteit, risico, klant en marge. Kies `Go` met motivatie. | Besluit, gemiddelde score, beoordelaar en tijdstip worden bewaard; status wordt `Go/No-Go`. |  |
| C06 | Calculator | Kies **Calculatie starten**. | Eén calculatie wordt aangemaakt, de opportuniteit krijgt status `Calculatie` en beide dossiers verwijzen naar elkaar. |  |

## 8. Fase D – calculatie, momentopnamen, scenario's en BIM

| ID | Actor | Handeling | Verwacht resultaat | Resultaat |
|---|---|---|---|---|
| D01 | Calculator | Open de nieuwe calculatie en voeg de vier hoofdstukken en vier posten uit de testdatatabel toe. | Aantallen, eenheden en vier kostensoorten worden zonder afrondingsverlies bewaard. |  |
| D02 | Calculator | Stel algemene kosten 8%, risico 4% en marge 10% in. | Directe kost, toeslagen en verkoopwaarde worden direct herberekend. |  |
| D03 | Calculator | Pas minstens één kostbibliotheekregel toe met bron en verbruiksfactor. | De post toont de bron, factor, prijs en kostensoort. |  |
| D04 | Calculator | Maak calculatieversie `V1 Basis {RUN}` met reden `Eerste volledige meetstaat`. | Een onveranderlijke momentopname met datum, actor en reden verschijnt. |  |
| D05 | Calculator | Verhoog de materiaalprijs van post 03.01 met 10% en maak `V2 Materiaalstijging {RUN}`. | De tweede momentopname bewaart de aangepaste waarde zonder V1 te wijzigen. |  |
| D06 | Calculator | Open **Versies vergelijken** en vergelijk V1 met V2. | Totalen en gewijzigde posten zijn naast elkaar zichtbaar; 03.01 is duidelijk gemarkeerd met oud, nieuw en verschil. |  |
| D07 | Calculator | Herlaad de browser en open dezelfde vergelijking opnieuw. | Beide versies en hetzelfde verschil blijven beschikbaar. |  |
| D08 | Calculator | Maak scenario's `Verwacht`, `Conservatief` en `Optimistisch`; geef Conservatief hogere materiaal-, materieel- en risicopercentages. | Scenario's hebben verschillende totalen; het geselecteerde scenario is duidelijk aangeduid. |  |
| D09 | Calculator | Selecteer `Verwacht` als offertescenario en noteer directe kost en verkoopwaarde. | De gekozen scenario-indicator en bedragen zijn na herladen gelijk. |  |
| D10 | Calculator | Open **BIM-calculatie**, download de snelle rooktest onder **IFC-testdata** en importeer het bestand. | Het bestand downloadt als `.ifc`, WebIFC bereikt 100% en meldt `WebIFC geometrie actief`. |  |
| D11 | Calculator | Controleer passend beeld en wissel tussen boven-, voor- en rechteraanzicht. | Het model blijft grafisch correct, reageert vloeiend en geeft geen consolefout. |  |
| D12 | Calculator | Selecteer één object in het 3D-model. | Het object licht duidelijk op en de selectie toont type, naam, verdieping, eenheid, hoeveelheid en geraamde waarde. |  |
| D13 | Calculator | Selecteer achtereenvolgens een laag, verdieping en meervoudige objectselectie. | Zichtbare en geselecteerde aantallen veranderen onmiddellijk en blijven consistent. |  |
| D14 | Calculator | Voeg de BIM-selectie als gegroepeerde calculatiepost toe. | De post bevat IFC-bestandsnaam en GUID/ExpressID in de bronnotitie en is vanuit de selectie herkenbaar. |  |
| D15 | Calculator | Maak `V3 BIM-toevoeging {RUN}` en vergelijk V2 met V3. | De nieuwe BIM-post en het financiële verschil zijn zichtbaar; eerdere momentopnamen blijven ongewijzigd. |  |

Voer voor een afzonderlijke geometrische regressie ook [de BIM-productietest](BIM_PRODUCTION_TESTING.md) uit met architectuur-, constructie- en inframodel.

## 9. Fase E – offerte, klantinteractie en gunning

| ID | Actor | Handeling | Verwacht resultaat | Resultaat |
|---|---|---|---|---|
| E01 | Calculator | Genereer een offerte vanuit het geselecteerde scenario met onderwerp, geldigheid, betalingsvoorwaarden, inclusies en uitsluitingen. | Offerteversie 1 heeft status `Concept` en bevat een vaste snapshot van klant, project, regels, scenario en totaal. |  |
| E02 | Calculator | Open de preview en download de PDF. | Preview en PDF hebben hetzelfde offertenummer en totaal; de PDF downloadt als bestand. |  |
| E03 | Projectdirecteur | Keur de offerte intern goed. | Status wordt `Intern goedgekeurd`; actor en tijdstip staan in de eventhistorie. |  |
| E04 | Tender manager | Verstuur naar `emma.test@rivierenburg.example`. | Status wordt `Verzonden`, opportuniteit wordt `Offerte verstuurd` en ontvanger/tijdstip zijn vastgelegd. Er vertrekt geen bericht naar een echt adres. |  |
| E05 | Klant | Open de offerte via het klantprofiel/klantportaal. | Status wordt `Geopend`; de klant ziet alleen het eigen dossier. |  |
| E06 | Klant | Onderteken de offerte als Emma Test. | Status wordt `Ondertekend`; ondertekenaar en tijdstip worden vastgelegd. |  |
| E07 | Calculator | Probeer na ondertekening een calculatiepost te wijzigen en controleer de bestaande offertesnapshot. | De nieuwe calculatiestand kan veranderen, maar offerteversie 1 behoudt zijn oorspronkelijke regels en totaal. |  |
| E08 | Projectdirecteur | Kies **Gunning / Omzetten naar project**. | Opportuniteit wordt `Gewonnen` met 100%; één project ontstaat met contractwaarde, kostbudget, marge, broncalculatie en werkpakketten. |  |

## 10. Fase F – projectoverdracht, multi-company en THV

| ID | Actor | Handeling | Verwacht resultaat | Resultaat |
|---|---|---|---|---|
| F01 | Projectdirecteur | Open het nieuwe project en controleer juridische entiteit en vestiging. | Entiteit A en Vestiging A zijn overgenomen van de opportuniteit. |  |
| F02 | Projectdirecteur | Open **Bedrijfstoewijzing** en bevestig Entiteit A als projectvoerende entiteit. Voeg waar ondersteund Vestiging A toe. | Project, budget en latere verkoopfacturen blijven aan Entiteit A gekoppeld. |  |
| F03 | Projectmanager | Vul overdracht in: projectmanager, geplande start/einde, werfadres, risico's, aandachtspunten, uitsluitingen en controles. Zet alle werkpakketten op `Klaar voor planning`. | Overdrachtschecklist is volledig en werkpakketten tonen uren/status. |  |
| F04 | Projectmanager | Zet overdracht op `Aanvaard`. | Acceptatiedatum ontstaat; planning genereren wordt beschikbaar. |  |
| F05 | Projectdirecteur | Ga naar **THV & Combinaties** en maak `{RUN} THV Mobiliteitshub` met Entiteit A als leidende partij (70%) en Entiteit B (30%). Koppel het project. | Status is `Actief`, één partij is leidend en de verdeling is exact 100%. |  |
| F06 | Projectdirecteur | Probeer in een tijdelijke invoer 70% + 20% vast te leggen. Annuleer daarna. | BouwFlow blokkeert een verdeling die niet exact 100% is. |  |
| F07 | Beperkt profiel Entiteit A | Open project en THV-overzicht. | Alleen toegestane entiteits- en projectinformatie is zichtbaar; financiële stamgegevens van Entiteit B zijn niet vrij toegankelijk. |  |

## 11. Fase G – contract en documenten

| ID | Actor | Handeling | Verwacht resultaat | Resultaat |
|---|---|---|---|---|
| G01 | Projectmanager | Open **Contract & Oplevering** en maak een contract met contractnummer `{RUN}-CON-01`, waarde gelijk aan de offerte, start/einde, betalingstermijn, 5% inhouding, dagboete en prijsherziening. | Contractdossier ontstaat met status `Actief` en goedkeuringsstatus `Concept`. |  |
| G02 | Projectmanager | Voeg één verplichting, één risico en één bankgarantie toe. | Elk onderdeel toont eigenaar, datum/status en blijft na herladen bestaan. |  |
| G03 | Kwaliteitsverantwoordelijke | Upload `{RUN}-aannemingsovereenkomst.pdf`, koppel aan project en contract en dien ter goedkeuring in. | Document heeft revisie R1 en status `Ter goedkeuring`; koppelingen zijn zichtbaar. |  |
| G04 | Projectdirecteur | Open het document in de ingebouwde viewer en download het. | Zowel openen als downloaden werkt; MIME-type is PDF en de bestandsnaam eindigt op `.pdf`. |  |
| G05 | Projectdirecteur | Keur het document goed en keur daarna het contract goed. | Document en contract tonen `Goedgekeurd`, inclusief actor en tijdstip. |  |
| G06 | Kwaliteitsverantwoordelijke | Upload revisie R2 met revisienotitie en vergelijk historie. | R1 blijft beschikbaar; R2 is de actuele revisie en de revisievolgorde klopt. |  |
| G07 | Projectmanager | Distribueer het document uitsluitend naar het fictieve klantprofiel en vraag leesbevestiging. | Ontvanger, distributietijdstip en leesstatus zijn zichtbaar; geen echte externe verzending vindt plaats. |  |

## 12. Fase H – HR, materieel, voorraad en onderaannemer

| ID | Actor | Handeling | Verwacht resultaat | Resultaat |
|---|---|---|---|---|
| H01 | HR/Administrator | Maak Medewerker A onder Entiteit A aan met 40 uur/week en Medewerker B onder Entiteit B met 32 uur/week. | Unieke personeelsnummers, entiteit, arbeidsregime en competenties zijn zichtbaar. |  |
| H02 | HR/Administrator | Maak een ploeg met Medewerker A als ploegbaas en Medewerker B als lid. | Ploeg en leden zijn beschikbaar in de planningsresourcebank. |  |
| H03 | Aankoper/Planner | Maak materieel `{RUN} Rupskraan 25t` aan onder Entiteit B met tarief, keuringsdatum en status `Beschikbaar`. | Materieel is beschikbaar als resource en blijft eigendom van Entiteit B. |  |
| H04 | Magazijnier/Administrator | Maak magazijnartikel `{RUN} Betonstraatsteen` aan, ontvang 1.000 stuks, reserveer 300 en geef later 100 uit. | Voorraadbewegingen zijn geaudit; voorraad wordt nooit negatief. |  |
| H05 | Aankoper | Maak onderaannemer `{RUN} Grondwerken BV` met tarieven en projecttoewijzing aan. Laat eerst verzekering of VCA ontbreken en probeer uit te nodigen. | Uitnodiging wordt geblokkeerd zolang het dossier onvolledig is. |  |
| H06 | Preventieadviseur/Aankoper | Voeg geldige verzekering en VCA-documenten toe en nodig opnieuw uit. | Dossier is compleet, status wordt goedgekeurd en portaaluitnodiging wordt geregistreerd. |  |
| H07 | Aankoper | Voeg een actieve onderaannemingsovereenkomst toe met projectsom en 5% inhouding. | Overeenkomst is aan het juiste project en de juiste onderaannemer gekoppeld. |  |

## 13. Fase I – planning en projectoverschrijdende capaciteit

| ID | Actor | Handeling | Verwacht resultaat | Resultaat |
|---|---|---|---|---|
| I01 | Projectmanager | Genereer de projectplanning vanuit de aanvaarde overdracht. | Voor elk werkpakket ontstaat een activiteit plus eindmijlpaal; planning is `Concept`. |  |
| I02 | Planner | Vul afhankelijkheden, verantwoordelijke, ploeg, materieel, bezettingspercentage en weersgevoeligheid in. | Gantt, detailpaneel en resourcebank tonen dezelfde toewijzingen. |  |
| I03 | Planner | Maak baseline `B1 Goedgekeurde startplanning {RUN}` met reden. | Planning wordt `Baseline`; B1 heeft actor, datum en goedkeuringsstatus. |  |
| I04 | Planner | Plan Medewerker A in dit project voor 100% en in een tweede bestaand testproject op overlappende datums ook voor 100%. | Een kritische waarschuwing van 200% verschijnt en noemt resource, periode en betrokken projecten/activiteiten. |  |
| I05 | Planner | Open de waarschuwing. | Een detailvenster toont **alle** boekingen, ook die uit de andere projectplanning, met project, activiteit, datums en percentage. |  |
| I06 | Planner | Open vanuit de waarschuwing de boeking van het andere project en verlaag die naar 50%, of verschuif de datums. | De juiste planning opent; na opslaan wordt de totale capaciteit opnieuw berekend en verdwijnt de 200%-waarschuwing of daalt tot het juiste percentage. |  |
| I07 | HR | Vraag voor Medewerker B afwezigheid aan op een geplande werkdag en keur die goed. | De planning toont automatisch een kritisch afwezigheidsconflict. |  |
| I08 | Planner | Vervang Medewerker B of verschuif de activiteit buiten de afwezigheid. | Het conflict verdwijnt zonder andere toewijzingen te verliezen. |  |
| I09 | Planner | Laat de keuring van het testmaterieel tijdelijk vóór de activiteit eindigen. | Een kritisch attestconflict verschijnt. Herstel daarna een geldige datum. |  |
| I10 | Planner | Verschuif één activiteit twee werkdagen en sla op. | Status wordt `Gewijzigd`; afwijking tegenover B1 is zichtbaar. |  |
| I11 | Projectdirecteur | Maak baseline B2 met reden `Goedgekeurde fasering`. | B1 wordt `Vervangen`, B2 `Goedgekeurd`; beide blijven raadpleegbaar. |  |

## 14. Fase J – werfuitvoering, uren en QHSE

| ID | Actor | Handeling | Verwacht resultaat | Resultaat |
|---|---|---|---|---|
| J01 | Werfleider | Maak in **Werf** een dagrapport voor het eerste werkpakket met weer, activiteiten, 8 normale uren voor Medewerker A, materiaal, machine, levering, bezoeker en notitie. | Dagrapport ontstaat als `Concept` en is aan project, datum en werkpakket gekoppeld. |  |
| J02 | Werfleider | Upload een kleine testfoto met omschrijving en locatie. | Thumbnail en beveiligde viewer werken; foto is aan dagrapport/project gekoppeld. |  |
| J03 | Werfleider | Dien het dagrapport in. | Status wordt `Ingediend`; inhoud en foto-evidence zijn vergrendeld. |  |
| J04 | Projectmanager | Onderteken het dagrapport. | Status wordt `Ondertekend`; ondertekenaar en tijdstip zijn zichtbaar. |  |
| J05 | Werfleider | Maak en dien een aparte tijdregistratie in voor dezelfde medewerker en dag. | Registratie volgt `Concept` → `Ingediend` en is in nacalculatie herleidbaar. |  |
| J06 | Werfleider | Maak een werfbon met twee regels en dien die ter ondertekening in. | Totaal is automatisch berekend en status wordt `Ter ondertekening`. |  |
| J07 | Klant/Projectmanager | Onderteken de werfbon. | Status wordt `Ondertekend`; ondertekenaar en tijdstip zijn vastgelegd. |  |
| J08 | Preventieadviseur | Maak een QHSE-inspectie met minstens één vaststelling, eigenaar en vervaldatum. | Inspectie en vaststelling zijn aan het project gekoppeld en status is open/in behandeling. |  |
| J09 | Werfleider | Maak een bijna-ongeval `{RUN} Losliggende kabel` met ernst `Hoog`, maatregel en verantwoordelijke. | Gebeurtenis staat als `Open` in QHSE en dossierzoeking. |  |
| J10 | Preventieadviseur | Registreer de corrigerende actie en sluit inspectie en gebeurtenis. | Beide tonen `Gesloten`, sluitmoment en volledige historie. |  |

## 15. Fase K – inkoop en leveranciersportaal

| ID | Actor | Handeling | Verwacht resultaat | Resultaat |
|---|---|---|---|---|
| K01 | Aankoper | Maak leverancier `{RUN} Betonleveringen BV` met contact- en facturatiegegevens. | Leverancier krijgt een uniek dossier en is selecteerbaar in inkoop. |  |
| K02 | Aankoper | Maak een inkoopbehoefte van EUR 60.000 voor het project. | Vereiste goedkeuringsrol wordt automatisch `Projectdirecteur`. |  |
| K03 | Projectmanager | Probeer de behoefte goed te keuren. | Goedkeuring wordt geweigerd omdat de rol onvoldoende is. |  |
| K04 | Projectdirecteur | Keur dezelfde behoefte goed. | Goedkeuringsstatus wordt `Goedgekeurd` met actor en tijdstip. |  |
| K05 | Aankoper | Verstuur de prijsaanvraag naar de testleverancier. | Status wordt prijsaanvraag/verstuurd en de leverancier ziet alleen deze aanvraag. |  |
| K06 | Leverancier | Open **Leveranciersportaal** en dien een offerte met prijs, geldigheid en levertermijn in. | Leveranciersofferte verschijnt bij de juiste aanvraag; andere leveranciers en projecten zijn niet zichtbaar. |  |
| K07 | Aankoper | Voeg een tweede offerte toe, vergelijk en selecteer de beste offerte met motivatie. | Vergelijking toont prijzen en voorwaarden; één offerte is geselecteerd. |  |
| K08 | Aankoper | Maak de bestelling aan. | Een bestelnummer en open verplichting ontstaan; projectcontrol toont het bedrag. |  |
| K09 | Magazijnier/Aankoper | Registreer een gedeeltelijke ontvangst en daarna de restontvangst. | Ontvangen hoeveelheden en bestelstatus worden correct bijgewerkt. |  |
| K10 | Financiële administratie | Registreer een leveranciersfactuur die exact overeenkomt. | Driewegcontrole bestelling–ontvangst–factuur is akkoord. |  |
| K11 | Financiële administratie | Voer daarnaast een afwijkende testfactuur in of wijzig tijdelijk het factuurbedrag. | Afwijking wordt geblokkeerd of vraagt expliciete goedkeuring en reden. |  |
| K12 | Bevoegde goedkeurder | Keur de afwijking met reden goed en registreer betaling. | Goedkeuring, reden, betaling en resterend saldo zijn geaudit. |  |

## 16. Fase L – meerwerk, klantgoedkeuring en claim

| ID | Actor | Handeling | Verwacht resultaat | Resultaat |
|---|---|---|---|---|
| L01 | Werfleider | Maak meerwerk `{RUN} Onvoorziene nutsleiding` vanuit het dagrapport met oorzaak, bewijs, kosten en twee dagen planningimpact. | Meerwerk heeft status `Vastgesteld` en linkt naar dagrapport/foto. |  |
| L02 | Projectmanager | Werk de berekening af en dien ter goedkeuring in. | Status loopt via `Berekend` naar `Ter goedkeuring`; bedrag en planningimpact staan vast. |  |
| L03 | Klant | Open het klantportaal en keur het meerwerk goed. | De klant ziet alleen het eigen meerwerk; status wordt `Goedgekeurd` met actor/tijdstip. |  |
| L04 | Projectmanager | Markeer uitgevoerd en daarna klaar voor facturatie. | Status loopt naar `Uitgevoerd` en `Klaar voor facturatie`. |  |
| L05 | Projectmanager | Maak een claim voor twee dagen termijnverlenging met het meerwerk als onderbouwing. | Claim heeft nummer, bronkoppeling en status `Concept`. |  |
| L06 | Projectdirecteur | Keur de claim intern goed en leg indiening vast. | Status en gebeurtenissen volgen de ingestelde claimworkflow. |  |

## 17. Fase M – projectcontrol, vordering, facturatie en intercompany

| ID | Actor | Handeling | Verwacht resultaat | Resultaat |
|---|---|---|---|---|
| M01 | Projectmanager | Registreer minstens één werkelijke projectkost per werkpakket en één open verplichting. | Projectcontrol toont budget, werkelijk, verplicht en prognose zonder dubbeltelling. |  |
| M02 | Projectmanager | Maak forecast F1 met resterende kosten per werkpakket en dien goedgekeurd in. | Eindkost en verwachte marge worden automatisch berekend; F1 is `Goedgekeurd`. |  |
| M03 | Projectmanager | Maak F2 met een hogere eindkost en keur goed. | F1 wordt `Vervallen`; F2 is actueel en de marge-afwijking is zichtbaar. |  |
| M04 | Financiële administratie | Maak een vorderingsstaat met cumulatieve voortgang, prijsherziening, 5% inhouding en het vrijgegeven meerwerk. | Te factureren bedrag is herleidbaar; meerwerk wordt niet dubbel opgenomen. |  |
| M05 | Projectmanager | Dien de vorderingsstaat in. | Status wordt `Ingediend`; cumulatieve waarden zijn vergrendeld. |  |
| M06 | Klant/Financiële administratie | Leg klantgoedkeuring vast en keur financieel goed. | Status wordt `Goedgekeurd`; goedkeuringsactor en datum zijn zichtbaar. |  |
| M07 | Financiële administratie | Maak vanuit de vorderingsstaat een verkoopfactuurconcept. | Factuur is gekoppeld aan Entiteit A, klant, project en vorderingsstaat; factuurregels en btw sluiten aan. |  |
| M08 | Financiële administratie | Voer de Peppol-preflight uit. | BouwFlow controleert profiel, endpoints, rekening, regels en totalen en bewaart het rapport. Zonder externe validator is `networkReady` terecht niet beschikbaar. |  |
| M09 | Financiële administratie | Geef de factuur uit. Verstuur alleen via Peppol wanneer de productiebeheerder bevestigt dat de externe gate groen is. | Factuurnummer gebruikt de prefix en teller van Entiteit A. Geen nummer van Entiteit B wordt verbruikt. |  |
| M10 | Financiële administratie | Registreer een deelbetaling en daarna de slotbetaling. | Openstaand saldo daalt correct; eindstatus wordt `Betaald`. Cashflow wordt bijgewerkt. |  |
| M11 | Financiële administratie | Maak in **Financiële entiteiten** een intercompanykost van Entiteit B naar Entiteit A voor EUR 12.500, omschrijving `{RUN} materieelinzet`, gekoppeld aan het project. | Boeking staat als `Concept`, met bron- en doelentiteit en projectlink. |  |
| M12 | Projectdirecteur/Directie | Keur de intercompanykost goed en boek hem. | Status loopt naar `Goedgekeurd`/`Geboekt`; Entiteit B en Entiteit A tonen spiegelende impact zonder dubbele groepskost. |  |
| M13 | Financiële administratie | Open **Cashflow** en filter op project en beide entiteiten. | Verkoopfactuur, leveranciersbetaling en intercompanybeweging staan in de juiste periode en entiteit. |  |
| M14 | Projectdirecteur | Open **Projectcontrole** en vergelijk contractwaarde, budget, werkelijk, verplichtingen, eindkost en marge. | Alle bedragen zijn naar bronrecords navigeerbaar en sluiten logisch aan. |  |

## 18. Fase N – externe portalen en gegevensafscherming

| ID | Actor | Handeling | Verwacht resultaat | Resultaat |
|---|---|---|---|---|
| N01 | Klant | Open **Klantportaal**. | Alleen het toegewezen klantproject, documenten, offerte, meerwerk en goedkeuringsacties zijn zichtbaar; interne kostprijzen ontbreken. |  |
| N02 | Onderaannemer | Open **Onderaannemersportaal**, voeg een medewerker toe en dien een prestatiestaat in met brutobedrag EUR 20.000 en contractuele inhouding. | Alleen eigen projecten zijn zichtbaar; netto wordt volgens de overeenkomst berekend en status wordt `Ingediend`. |  |
| N03 | Leverancier | Open **Leveranciersportaal**. | Alleen eigen prijsaanvragen, bestellingen en leveringen zijn zichtbaar; concurrerende offertes ontbreken. |  |
| N04 | Extern profiel | Probeer via een gekopieerde dossier-URL een niet-toegewezen project te openen. | BouwFlow weigert toegang en toont geen dossierdata in scherm of netwerkrespons. |  |
| N05 | Administrator | Controleer na de externe acties de recordhistorie/audit. | Externe actor, handeling en tijdstip zijn traceerbaar. |  |

## 19. Fase O – nacalculatie, oplevering en nazorg

| ID | Actor | Handeling | Verwacht resultaat | Resultaat |
|---|---|---|---|---|
| O01 | Calculator/Projectmanager | Open **Nacalculatie** voor het project en vergelijk begroting, werkelijk en afwijking per werkpakket, kostensoort en meetstaatpost. | Totalen sluiten aan op projectcontrol; uren, inkoop en projectkosten zijn herleidbaar. |  |
| O02 | Calculator | Publiceer één gevalideerde werkelijke eenheidskost als feedback naar een testkostbibliotheek. | Een nieuw historisch bibliotheekitem vermeldt projectnummer en bron `Nacalculatie`; bestaande gepubliceerde prijzen worden niet stil overschreven. |  |
| O03 | Kwaliteitsverantwoordelijke | Maak in **Contract & Oplevering** een opleverdossier met status `Voorbereiding`, geplande voorlopige en definitieve opleverdatum. | Opleverdossier is aan project en contract gekoppeld. |  |
| O04 | Kwaliteitsverantwoordelijke | Voeg as-builtplan, onderhoudsdossier en één punchlistpunt toe. | Documenten openen/downloaden; punchlistpunt heeft eigenaar, deadline en status `Open`. |  |
| O05 | Werfleider | Los het punchlistpunt op met notitie/bewijs. | Punt wordt `Opgelost` met oplosdatum; open teller wordt nul. |  |
| O06 | Projectdirecteur | Zet status op `Voorlopig opgeleverd` en registreer datum. | Voorlopige oplevering, garantieperiode en eventuele borgstatus worden zichtbaar. |  |
| O07 | Klant | Maak een nazorgmelding `{RUN} Deurafstelling` aan. | Opleverdossier gaat naar `Nazorg`; melding heeft nummer/status, eigenaar en dossierhistorie. |  |
| O08 | Projectmanager | Handel de nazorgmelding af en controleer dat alle contractverplichtingen voltooid zijn. | Melding en verplichtingen zijn gesloten; open tellers staan op nul. |  |
| O09 | Projectdirecteur | Registreer definitieve oplevering en borgvrijgave. Zet het dossier/project waar mogelijk op `Definitief opgeleverd`/`Afgesloten`. | Eindstatus, datum, borgvrijgave, documenten en volledige historie blijven raadpleegbaar. |  |
| O10 | Administrator | Herlaad de applicatie, zoek op `{RUN}` in **Dossiers** en open klant → opportuniteit → calculatie → project → factuur → oplevering. | De volledige keten is via vaste links navigeerbaar en alle hoofdstatussen zijn bewaard. |  |

## 20. Eindcontrole en financiële aansluiting

Vul na O10 de werkelijk berekende waarden in. Verschillen moeten verklaard kunnen worden door een gekoppeld bronrecord.

| Controle | Verwachte relatie | Werkelijk | Resultaat |
|---|---|---:|---|
| Offerte versus project | Ondertekende offertesnapshot = contractwaarde project |  |  |
| Projectbudget | Kostbudget + begrote marge = contractwaarde, volgens BouwFlow-berekening |  |  |
| Vorderingsstaat | Goedgekeurde productie + prijsherziening + meerwerk − inhouding = factuurbasis |  |  |
| Verkoopfactuur | Netto + btw = brutototaal |  |  |
| Betaling | Som betalingen = brutototaal; openstaand = 0 |  |  |
| Inkoop | Bestelling, ontvangst en leveranciersfactuur sluiten aan of hebben goedgekeurde afwijking |  |  |
| Forecast | Werkelijk + verplicht + resterend = verwachte eindkost |  |  |
| Intercompany | B → A EUR 12.500; geen dubbele kost op groepsniveau |  |  |
| Nacalculatie | Som per post = som per werkpakket = totale werkelijke projectkost |  |  |
| Oplevering | Open punchlist, verplichtingen en nazorgmeldingen = 0 |  |  |

## 21. Fase P – AI, meldingen, ERP-status en dashboard

Deze controles raken de resterende beheer- en inzichtmodules. Noteer `NVT – externe gateway niet geconfigureerd` wanneer de productiebeheerder bevestigt dat een externe dienst bewust nog niet actief is.

| ID | Actor | Handeling | Verwacht resultaat | Resultaat |
|---|---|---|---|---|
| P01 | Projectmanager | Open **AI-assistent**, selecteer het testproject en vraag: `Welke open contractrisico's en ontbrekende opleverdocumenten heeft {RUN}?` | Een antwoord wordt alleen getoond met traceerbare project- of documentbronnen; zonder gateway volgt een duidelijke, veilige melding. |  |
| P02 | Projectdirecteur | Open de AI-analyse, controleer de bronnen en keur alleen goed wanneer iedere conclusie door een dossierbron wordt gedragen. | Een analyse zonder bron kan niet worden goedgekeurd; een geldige analyse bewaart beoordelaar en tijdstip. |  |
| P03 | Financiële administratie | Open **Peppol-meldingen** en controleer de ingestelde e-mail- en Teams-bestemmingen. | Alleen geautoriseerde rollen zien de instellingen; secrets of tokens worden nooit getoond. |  |
| P04 | Financiële administratie | Verstuur uitsluitend na toestemming een testmelding naar een goedgekeurd intern testkanaal. | Resultaat toont kanaal, bestemming en aflever-/foutstatus zonder een echte factuur te verzenden. |  |
| P05 | Administrator | Open **ERP-integraties**. | Module vermeldt duidelijk `On hold`; er is geen misleidende operationele synchronisatie of productieactie beschikbaar. |  |
| P06 | Projectdirecteur | Open **Dashboard** en filter waar mogelijk op Entiteit A, Entiteit B en het testproject. | KPI's, risico's, cashflow en projectstatus sluiten aan op de onderliggende dossiers en respecteren het entiteitsfilter. |  |

## 22. Persistente en technische controles

| ID | Controle | Verwacht resultaat | Resultaat |
|---|---|---|---|
| T01 | Herlaad na mutaties in CRM, calculatie, planning, werf, financiën en oplevering. | Geen gegevensverlies of terugval van status. |  |
| T02 | Open de applicatie in een tweede browsersessie met een beperkt profiel. | Rechten worden server-side afgedwongen; verborgen records verschijnen ook niet via directe URL. |  |
| T03 | Controleer browserconsole tijdens BIM, PDF-viewer, planning en portalen. | Geen onbehandelde fout, eindeloze requestlus of WebIFC-crash. |  |
| T04 | Controleer downloads van PDF, IFC en offerte. | Correcte extensie, MIME-type en bestandsnaam; bestanden openen niet als tekstpagina. |  |
| T05 | Controleer audit/recordhistorie voor minimaal klant, opportuniteit, calculatieversie, document, meerwerk, factuur en oplevering. | Actor, tijdstip, record, actie en relevante statusovergang zijn aanwezig. |  |
| T06 | Controleer de zoekfunctie met de volledige runcode. | Alle testrecords zijn vindbaar zonder records van andere tenants te tonen. |  |

## 23. Afwijkingen registreren

Maak per afwijking één defect met:

- defectnummer en test-ID;
- productie-URL en vaste dossier-URL;
- actieve rol, entiteit en project;
- exacte invoer en klikvolgorde;
- verwacht en werkelijk resultaat;
- schermopname en tijdstip;
- console- of netwerkfout zonder tokens of persoonsgegevens;
- reproduceerbaarheid: altijd, soms of eenmalig.

| Ernst | Betekenis | Besluit |
|---|---|---|
| P0 Kritiek | Datalek, tenantoverschrijding, verkeerde externe verzending, financiële corruptie | Direct stoppen; productie-no-go |
| P1 Hoog | Hoofdketen geblokkeerd, gegevensverlies, verkeerde factuur of niet-herstelbare status | No-go tot opgelost en hertest |
| P2 Middel | Functie werkt met veilige omweg; geen gegevensverlies | Go alleen met eigenaar en oplosdatum |
| P3 Laag | Tekst, uitlijning of beperkte gebruiksvriendelijkheid | Mag na acceptatie worden ingepland |

## 24. Testrapport

| Onderdeel | Totaal | OK | NOK | NVT | Bewijslink |
|---|---:|---:|---:|---:|---|
| A – omgeving en autorisatie | 7 |  |  |  |  |
| B – klant en CRM | 6 |  |  |  |  |
| C – opportuniteit en tender | 6 |  |  |  |  |
| D – calculatie en BIM | 15 |  |  |  |  |
| E – offerte en gunning | 8 |  |  |  |  |
| F – overdracht en multi-company | 7 |  |  |  |  |
| G – contract en documenten | 7 |  |  |  |  |
| H – HR, resources en onderaannemer | 7 |  |  |  |  |
| I – planning en capaciteit | 11 |  |  |  |  |
| J – werf en QHSE | 10 |  |  |  |  |
| K – inkoop | 12 |  |  |  |  |
| L – meerwerk en claim | 6 |  |  |  |  |
| M – financiën en intercompany | 14 |  |  |  |  |
| N – portalen | 5 |  |  |  |  |
| O – nacalculatie en oplevering | 10 |  |  |  |  |
| P – AI, meldingen, ERP-status en dashboard | 6 |  |  |  |  |
| T – technische controles | 6 |  |  |  |  |
| **Totaal** | **143** |  |  |  |  |

### Formele afronding

- [ ] Geen open P0- of P1-defecten.
- [ ] Alle financiële aansluitingen verklaard.
- [ ] Autorisatie over beide entiteiten en drie externe portalen getest.
- [ ] Calculatieversies, BIM-koppeling en projectoverschrijdende planning getest.
- [ ] Documenten openen én downloaden correct.
- [ ] Auditbewijs en schermopnamen opgeslagen.
- [ ] Testrecords herkenbaar afgesloten en niet verwijderd.
- [ ] Productie-eindoordeel vastgelegd door functioneel beheer en projectdirectie.

Ondertekening functioneel beheer: ____________________  Datum: __________

Ondertekening projectdirectie: _______________________  Datum: __________
