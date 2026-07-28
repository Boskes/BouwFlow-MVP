# BouwFlow productie-readiness

Dit document is de vrijgavepoort voor BouwFlow. De applicatie is pas liveklaar
wanneer alle codepoorten én alle omgevingspoorten aantoonbaar groen zijn. De
effectieve livegang is bewust niet geautomatiseerd vanuit een push naar `main`.

## In code afgedekt

- Productie start fail-closed: PostgreSQL, Entra ID, HTTPS-origin en absolute
  objectopslag zijn verplicht; publiek binden vereist een expliciete uitzondering.
- Tenantisolatie en juridische-entiteittoegang worden server-side afgedwongen.
- Mutaties vereisen in productie een UUID-idempotentiesleutel en worden veilig
  herhaald of geweigerd bij verkeerd hergebruik.
- Rate limiting, request-ID's, veilige HTTP-headers, CORS en begrensde payloads
  staan vóór de applicatieroutes.
- Liveness, dependency-readiness en laag-cardinale Prometheus-metrics zijn
  afzonderlijk beschikbaar; interne metrics worden niet door nginx gepubliceerd.
- Database-migraties zijn transactioneel en auditmutaties delen de bedrijfs-
  transactie.
- De PWA cachet de shell, nooit API-antwoorden, bewaart de laatste gesynchroniseerde
  momentopname in IndexedDB en herhaalt JSON- en multipartmutaties met dezelfde
  idempotentiesleutel. Bestanden, foto's en hun formuliervelden blijven daarbij
  als binaire IndexedDB-records aan tenant en gebruiker gebonden.
- Back-up scripts versleutelen database en uploads, bewaren controlesommen en
  hebben een aparte wekelijkse restoretest.
- Releases zijn atomisch, bevatten hun commit-SHA, hebben healthchecks en rollen
  bij falen terug.
- Alleen een handmatige GitHub-workflow met exacte SHA, `PRODUCTIE`-bevestiging
  en protected-environmentgoedkeuring kan de VPS-release-tag verplaatsen.

## Verplichte omgevingsacceptatie vóór livegang

- [ ] Productiedomein, DNS en TLS-certificaat samen bevestigd.
- [ ] Entra API- en SPA-appregistraties, rollen, groepen en admin consent getest.
- [ ] Eerste beheerder gecontroleerd; volgende gebruikers hebben standaard geen
      toegang tot alle juridische entiteiten.
- [ ] Productiedatabase op niet-publieke interface; least-privilege gebruiker en
      sterk uniek wachtwoord gecontroleerd.
- [ ] Uploadmap, service-accountrechten, capaciteit en herstelrechten getest.
- [ ] Offsite GPG-ontvanger en sleutelherstelprocedure door twee verantwoordelijken
      gecontroleerd.
- [ ] Handmatige database+uploads-back-up en volledige restoretest geslaagd.
- [ ] Alerting op mislukte systemd-units, readiness, back-upouderdom en schijfruimte
      gekoppeld aan een bemande bestemming.
- [ ] Peppol-validator, accesspoint, webhook, statuspoller en notificatiekanalen
      end-to-end getest en formeel vrijgegeven.
- [ ] Offerte- en documentmailgateways end-to-end getest met de werkelijke PDF of
      actuele documentrevisie; providerreferentie, idempotentie en aflevering
      gecontroleerd.
- [~] ERP/integraties zijn door de opdrachtgever expliciet on hold gezet en maken
      geen deel uit van deze livevrijgave. Activering vereist later een afzonderlijke
      scope, eigenaar, sandboxbewijs, rotatieprocedure en reconciliatierapport.
- [ ] Offline praktijktest op beheerde telefoon/tablet uitgevoerd, inclusief
      reconnect, dubbele verzending en een bewust mislukte foto-upload.
- [ ] Autorisatiematrix per rol en juridische entiteit door proceseigenaars
      geaccepteerd.
- [ ] Dependency-audit, lint, alle tests en productiebuild groen op de exacte SHA.
- [ ] Rollback naar de vorige release en herstel naar de nieuwe release geoefend.
- [ ] Privacy-, bewaartermijn-, verwerkers- en incidentafspraken goedgekeurd.

## Bewuste livegrens

Tot de gezamenlijke livegang worden de productie-tag, VPS-services, DNS, TLS,
productiesecrets, Entra-productietoewijzingen en echte Peppol-transacties niet
gewijzigd. Een lokale groene test verklaart externe diensten niet automatisch
productiegereed; hun bewijs wordt bij de gezamenlijke acceptatie toegevoegd.

## Laatste lokale release-evidence

Op 22 juli 2026 is de lokale releasecontrole volledig geslaagd: lint groen,
19 testbestanden met 102 tests groen, productiebuild groen en 0 bekende
kwetsbaarheden in productieafhankelijkheden volgens `npm audit`.
De schaaltest levert een tenantbootstrap met 250 extra relaties binnen vijf
seconden; de productie-bundel blijft binnen de vastgelegde ruwe en gzipbudgetten.
Documentdossiers openen in API-modus de werkelijke object-storagebytes en in
demomodus een inhoudelijk representatief demobestand. De ERP-module toont
uitsluitend de afgesproken on-holdstatus. De effectieve livegang,
productieomgeving en externe acceptatie blijven een gezamenlijke laatste stap.

De lokale browseracceptatie bevestigt bovendien dat directe document- en
contractroutes na herladen behouden blijven, de formele contractgoedkeuring
zichtbaar is en klant-, onderaannemer- en leveranciersportalen afzonderlijk
openen. Onderaannemersmutaties zijn server-side tot het eigen dossier beperkt.
