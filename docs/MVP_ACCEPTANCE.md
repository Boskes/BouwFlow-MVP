# BouwFlow MVP-acceptatie

Deze matrix is de functionele definitie van gereed voor de eerste BouwFlow-MVP. Een onderdeel telt als gereed wanneer het in de React-interface beschikbaar is, in lokale browsermodus werkt, via de tenantgescheiden API kan worden opgeslagen en in de geautomatiseerde ketentest wordt geraakt.

| # | MVP-onderdeel | Status | Acceptatiebewijs |
|---:|---|---|---|
| 1 | Login en gebruikersbeheer | Gereed | Microsoft Entra ID en lokale ontwikkellogin, rollen en autorisatie per juridische entiteit. |
| 2 | Bedrijven en contactpersonen | Gereed | Klanten en opdrachtgevers aanmaken en bewerken, met primaire contactpersoon, adres-, btw- en Peppol-gegevens. |
| 3 | Prospecten en commerciële pipeline | Gereed | CRM-relaties worden hergebruikt in opportuniteiten; fasen lopen van `Nieuw` tot `Gewonnen` of `Verloren`. |
| 4 | Projectopportuniteiten | Gereed | Aanmaak, opvolging, deadline, geraamde waarde, kans en erkenning. |
| 5 | Calculaties | Gereed | Geavanceerde klasse-8-calculatie met meerdere actieve, versieerbare kostenbibliotheken, WBS-sjablonen, scenario's, postrisico/opslag, eenhedendropdowns, automatische conversies, bulkverplaatsing en collectieve kostprijsactualisatie. |
| 6 | Meetstaat | Gereed | Hoofdstukken en posten, kostensoorten, Excel/CSV-controle en atomaire import. |
| 7 | Kostprijsbibliotheek | Gereed | Arbeid, materiaal, materieel en onderaanneming met bron en verbruiksfactor; meerdere bibliotheken/versies, globale of entiteit-/vestigingsgebonden scope, actiefbeheer, beheerde eenheden en conversieregels, plus feedback uit nacalculatie. |
| 8 | Offertegenerator | Gereed | Offerteversies, voorwaarden, momentopname, preview en downloadbare PDF. |
| 9 | Projectomzetting na gunning | Gereed | Gekozen calculatiescenario wordt omgezet naar een project; opportuniteit wordt gewonnen. |
| 10 | Projectbudget | Gereed | Contractwaarde, kostbudget, marge en werkpakketbudgetten vanuit de calculatie. |
| 11 | Taken en planning | Gereed | Werkpakketactiviteiten, verantwoordelijke planning, afhankelijkheden, mijlpaal, Gantt en baseline-afwijkingen. |
| 12 | Dagrapporten | Gereed | Mobiele aanmaak, wijziging, indiening, vergrendeling en digitale ondertekening. |
| 13 | Urenregistratie | Gereed | Medewerker, rol, normale uren en overuren per dagrapport en werkpakket; verwerking in nacalculatie. |
| 14 | Foto's en documenten | Gereed | Cameraupload, foto-evidence, documentrevisies, goedkeuring, distributie, leesbevestiging en integriteitscontrole. |
| 15 | Meerwerken | Gereed | Oorzaak, bewijs, kostopbouw, planningimpact, klantgoedkeuring, uitvoering en vrijgave. |
| 16 | Vorderingsstaten | Gereed | Cumulatieve voortgang, prijsherziening, inhouding, meerwerken, goedkeuring en verkoopfactuurconcept. |
| 17 | Projectdashboard | Gereed | Voortgang, budget, werkelijke kosten, verplichtingen, prognose, marge en cashflow. |
| 18 | Nacalculatie | Gereed | Vergelijking per werkpakket, kostensoort en meetstaatpost met gecontroleerde terugkoppeling naar de bibliotheek. |

## Geautomatiseerde acceptatie

De API-test `doorloopt de MVP-keten vanaf een nieuwe klant tot nacalculatie met auditlog` begint met een nieuw aangemaakte en gewijzigde klant. Daarna doorloopt hij opportuniteit, calculatie, meetstaat, offerte, gunning, projectopstart, planning, werfregistratie, documenten en foto's, meerwerken, inkoop, vorderingsstaat, factuur, projectcontrole en nacalculatie. De test controleert ook tenantisolatie, rollen en auditregistratie.

Voer de volledige controle uit met:

```powershell
npm.cmd test -- --run
npm.cmd run lint
npm.cmd run build
```

## Grens van deze MVP

De 18 functionele MVP-onderdelen zijn gereed. Productie-uitrol blijft een aparte acceptatiefase: echte Entra-configuratie, PostgreSQL-back-up en hersteltest, objectstorage, e-mail/Teams-connectors, een gecertificeerd Peppol-accesspoint en monitoring moeten per omgeving worden geconfigureerd en operationeel gevalideerd. Deze externe configuratie verandert de functionele MVP-status niet.
