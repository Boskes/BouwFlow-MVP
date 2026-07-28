# BouwFlow releases 1–6 – opleveringsmatrix

Datum lokale codeacceptatie: 22 juli 2026.

ERP- en boekhoudconnectors zijn uitdrukkelijk uitgesloten. De navigatie toont de
on-holdstatus en alle muterende connectorroutes antwoorden met HTTP 423 totdat de
opdrachtgever ze in een afzonderlijke fase vrijgeeft.

| Release | Status | Aantoonbare dekking |
|---|---|---|
| 1 – Dossierfundament | Code gereed | Permanente dossier-URL's, register, zoeken, filters, favorieten, recent geopend, nieuw tabblad, breadcrumbs, uniforme tabs, echte serveraudit, rol- en entiteitsscope en centrale tabelvoorkeuren. |
| 2 – Documentbeheer | Code gereed | Object storage, upload/download, PDF-/beeld-/tekstviewer, native Office-openactie, revisies, integriteitscontrole, goedkeuring, distributie, leesbevestiging, recordkoppelingen, vervallen revisies en offline documentopslag. Demo opent representatieve binaire bestanden. |
| 3 – Contract en oplevering | Code gereed | Registers en details, contractparameters, zekerheden, verplichtingen, risico's, correspondentie, claims, contractversies met formele indiening en directiegoedkeuring, punchlist, as-built, onderhoud, garanties, borg, service en geauditeerde klantondertekening. |
| 4 – Commercieel en operationeel | Code gereed | CRM/tender/Go-No-Go, offerteflow, digitale goedkeuringen, werfbonnen, uren, QHSE, claims en een offline wachtrij voor JSON, foto's en documenten. |
| 5 – Operationeel en financieel | Code gereed | Inkoopgoedkeuring, vergelijking, PDF-bestelbon, raamcontracten, deelontvangsten, lijncontrole, 3-way-match en afwijkingsgoedkeuring; onderaanneming; onderhoud, schade, verzekering, brandstof, reservaties, tellingen, lot/serie en bestelvoorstellen; kosten, WIP/accrual, EV, CTC/EAC, forecasts en multidimensionale nacalculatie. |
| 6 – Enterprisehardening en pilot | Code gereed; omgevingsacceptatie open | Klant-, onderaannemer- en leveranciersportalen, server-side externe dossierisolatie, eigen documentaanlevering en werfbonondertekening, multi-company, gebruikersvoorkeuren, optimistic locking, offline replay, bundel- en schaalbudgetten en autorisatietests per interne en externe rol. |

## Geautomatiseerd bewijs

- `npm.cmd test`: 19 testbestanden en 102 tests.
- De geïntegreerde API-suite bevat 29 keten- en beveiligingsscenario's.
- Een schaaltest voegt 250 relaties toe en eist een volledige bootstrap binnen
  vijf seconden in de testomgeving.
- De offline praktijktests simuleren netwerkuitval, tenant-/gebruikersisolatie,
  exact-once replay, herstel na blokkering en multipartreplay met bestandsinhoud.
- De productiebuild wordt door TypeScript en Vite opgebouwd en daarna tegen
  afzonderlijke JS-, gzip-, CSS- en lazy-chunkbudgetten gecontroleerd.
- De dependency-audit staat geen hoge of kritieke productiekwetsbaarheden toe.
- De browseracceptatie opent en herlaadt rechtstreekse document- en contract-URL's,
  controleert contractgovernance, de drie portalen en de ERP-on-holdstatus.

## Grens tot gezamenlijke livegang

Codegereed betekent niet dat externe productievoorwaarden stilzwijgend zijn
goedgekeurd. Entra-configuratie, beheerde PostgreSQL/object storage, back-up en
restore, echte toestellen/netwerken, monitoring, privacy-afspraken en externe
Peppol-/AI-diensten worden bij de gezamenlijke livegang met de proceseigenaars
geaccepteerd. De volledige poort staat in `PRODUCTION_READINESS.md`.
