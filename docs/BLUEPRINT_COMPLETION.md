# BouwFlow blauwdruk – uitvoeringsstatus

De eerste MVP is volledig geaccepteerd. De uitbreiding naar de volledige blauwdruk wordt uitgevoerd als negen grote werkpakketten met dezelfde kwaliteitsgrens: browser- en API-modus, tenantisolatie, rolcontrole, auditlog en geautomatiseerde acceptatie.

| Werkpakket | Status | Opgeleverde scope |
|---|---|---|
| Geavanceerde planning en capaciteit | Gereed | Interactieve Gantt met baseline en voortgang, CPM-kritiek pad en totale speling, FS/SS/FF/SF-afhankelijkheden met vertraging, automatische doorplanning, drag-and-drop-resourcebank, verantwoordelijke, ploeggrootte, weersgevoeligheid, bezettingspercentage, attestdatum en projectoverschrijdende conflictcontrole. |
| Materieel, wagenpark, voorraad en magazijn | Gereed | Materieelregister, status, locatie/project, tarieven, draaiuren, onderhoud en keuring; magazijnen, artikelen, min/max, reservaties, ontvangsten, uitgiften, retouren, correcties en automatische bestelindicatie. |
| Onderaannemersbeheer en portaal | Gereed | Centraal register met tarieven, projecttoewijzingen, verzekering en VCA; documentcontrole blokkeert portaaluitnodiging totdat het dossier compleet is. |
| QHSE-verdieping | Gereed | Attesten, inspecties, vaststellingen, incidenten, bijna-ongevallen, LMRA, toolbox, werkvergunningen, PBM en milieumeldingen met corrigerende maatregelen. |
| Multi-company-verdieping | Gereed | Juridische entiteiten, vestigingen, entiteitsautorisatie, intercompany en THV/combinaties met land, valuta, btw-regel, leidende partij en gecontroleerde 100%-verdeelsleutel. |
| ERP- en boekhoudintegraties | **On hold** | Niet opgenomen in deze releasecyclus. De bestaande technische basis blijft afgeschermd bewaard; verdere ontwikkeling, sandboxacceptatie en ingebruikname gebeuren pas na een afzonderlijk besluit. |
| Documentgebonden AI-assistent | Code gereed; externe acceptatie open | Projectvragen, samenvattingen, contractrisico's, ontbrekende documenten en claimconcepten met project-/documentbronnen en verplichte menselijke goedkeuring. Productie vereist een geauthenticeerde AI-gateway die uitsluitend bekende dossierbron-ID's mag citeren. |
| Contract, oplevering, garantie en nazorg | Gereed | Contractdossier met termijnen, verplichtingen en risico's; opleverdossier met punchlist, as-built, onderhoudsdossier, garantie en borgvrijgave. |
| HR, verlof en personeelscapaciteit | Gereed | Medewerkersregister, entiteit en vestiging, arbeidsregime, wekelijkse uren, competenties en verlofrechten; ploegen met ploegbaas en leden; aanvragen en HR-goedkeuring voor afwezigheden; HR-gekoppelde verantwoordelijken en automatische medewerker- en ploegconflicten in de projectplanning. |

## Huidige acceptatie

- De portfolioplanning signaleert dubbele boekingen wanneer dezelfde resource in overlappende activiteiten voor meer dan 100% wordt ingezet.
- De kritieke-padanalyse berekent vroegste en laatste start/einde, netwerkduur en totale speling en blokkeert cyclische afhankelijkheden.
- Afhankelijkheden ondersteunen einde-start, start-start, einde-einde en start-einde met positieve of negatieve vertraging; automatische doorplanning werkt de kalenderdatums bij.
- Medewerkers, HR-ploegen, beschikbaar materieel en goedgekeurde onderaannemers kunnen vanuit één resourcebank naar een Gantt-activiteit worden gesleept of toetsenbordtoegankelijk worden toegewezen.
- Een verlopen attest wordt als kritisch conflict getoond.
- Materieel en voorraad worden tenantgebonden in PostgreSQL opgeslagen via één operationele transactiestaat; iedere mutatie wordt afzonderlijk geaudit.
- Voorraadbewegingen blokkeren negatieve voorraad en reservaties boven de aanwezige hoeveelheid.
- De lokale demomodus bevat voorbeeldmaterieel, een magazijn en een voorraadartikel.
- Onderaannemers krijgen pas portaaltoegang wanneer verzekering en VCA aantoonbaar aanwezig zijn.
- QHSE-meldingen volgen eigenaar, uiterste datum, ernst, maatregel en sluitmoment.
- THV-verdeelsleutels moeten exact 100% zijn en precies één leidende entiteit bevatten.
- De ERP-module is in de navigatie zichtbaar als **On hold** en biedt geen operationele actiestroom in deze release.
- AI-antwoorden bevatten minimaal één traceerbare dossierbron en kunnen zonder bron niet worden goedgekeurd.
- Contractverplichtingen en opleverpunten hebben een afzonderlijke, geauditeerde statusovergang.
- Goedgekeurde afwezigheid maakt een ingeplande medewerker automatisch onbeschikbaar en veroorzaakt een kritisch planningsconflict.
- Een deeltijdse medewerker kan niet boven zijn arbeidsregime worden ingepland zonder capaciteitswaarschuwing.
- De verantwoordelijke van een planningsactiviteit wordt via medewerker-ID aan HR gekoppeld; afwezigheid veroorzaakt een kritisch conflict.
- Ploegen worden in HR samengesteld met ploegbaas en leden; afwezigheid van een ploeglid wordt in de projectplanning gesignaleerd.
- Verlofsaldi worden berekend uit het jaarlijkse recht en de goedgekeurde verlofuren.
- De enterprise-acceptatietest doorloopt nu alle negen werkpakketten en controleert ook medewerker- en verlofstatussen in de tenantbootstrap.
- Kernrecords hebben vaste dossier-URL's met overzicht, gekoppelde dossiers, documenten en recordhistoriek; dit omvat onder meer relaties, opportuniteiten, projecten, werfrapporten, meerwerken, contracten, opleveringen, medewerkers, afwezigheden, materieel, voorraad, onderaannemers, QHSE, verkoopfacturen en AI-analyses.
- Tabelindeling, kolombreedte en kolomfilters worden per gebruiker centraal bewaard, met een lokale cache voor demogebruik.
