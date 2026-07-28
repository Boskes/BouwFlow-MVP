# Productie op de Easyhost VPS

> Deze handleiding is voorbereid, maar de stappen onder **Eerste deployment**,
> **DNS en HTTPS** en de handmatige GitHub-productiepromotie worden pas samen
> met de eigenaar uitgevoerd. Een push naar `main` zet BouwFlow niet live.

BouwFlow bestaat in productie uit:

- de React-frontend op `https://aifestival.be`;
- de Node API achter `https://aifestival.be/api/`;
- PostgreSQL op de lokale VPS-interface;
- Microsoft Entra ID voor login, tokens en applicatierollen.

De broncode staat in `git@github.com:Boskes/BouwFlow-MVP.git`. Iedere release
bevat de statische frontend, gecompileerde server en uitsluitend de productie-
dependencies. Frontend en API worden via dezelfde `current`-symlink geactiveerd.

## Releaseflow

1. Pull requests en pushes naar `main` draaien audit, lint, tests en beide builds.
2. De eigenaar start daarna bewust de workflow `Promote BouwFlow to production`.
3. De workflow vraagt de exacte geteste commit-SHA, de tekst `PRODUCTIE` en een
   afzonderlijke goedkeuring van de beveiligde GitHub-omgeving `production`.
4. Pas daarna verplaatst de workflow de tag `production-ready`.
5. De VPS controleert die tag iedere twee minuten, bouwt de release en installeert
   uitsluitend production-dependencies.
6. De release-symlink wordt atomisch omgezet, de API wordt herstart en frontend-
   en API-readinesschecks moeten slagen.
7. Bij een fout worden symlink en API automatisch teruggezet.

Er staan geen VPS-wachtwoorden, databasewachtwoorden of Entra-secrets in GitHub.

## Vereisten

Installeer nginx, git, curl, tar, PostgreSQL, sudo en Node.js 22. BouwFlow gebruikt
`/opt/node-v22`, zodat andere applicaties hun eigen Node-versie behouden.

```bash
nginx -v
git --version
psql --version
/opt/node-v22/bin/node --version
/opt/node-v22/bin/npm --version
```

Maak als `root` de release-, repository- en configuratiemappen:

```bash
install -d -o deploy -g deploy -m 2775 /var/www/bouwflow /var/www/bouwflow/releases
install -d -o deploy -g deploy -m 2775 /var/lib/bouwflow-repository
install -d -o root -g deploy -m 0750 /etc/bouwflow
```

## PostgreSQL

Maak een afzonderlijke database en gebruiker. Kies interactief een sterk,
uniek wachtwoord en zet dat uitsluitend in `/etc/bouwflow/api.env`.

```bash
sudo -u postgres psql
```

```sql
CREATE ROLE bouwflow LOGIN PASSWORD 'KIES-EEN-STERK-WACHTWOORD';
CREATE DATABASE bouwflow OWNER bouwflow;
\q
```

De API voert idempotente schemamigraties uit bij het starten. PostgreSQL hoeft
niet publiek bereikbaar te zijn; poort 5432 blijft door de firewall gesloten.

Plan daarnaast minimaal dagelijkse versleutelde `pg_dump`-back-ups en test
periodiek een restore naar een afzonderlijke database. Neem ook de map
`/var/lib/bouwflow/uploads` mee in de versleutelde back-up en restoretest; deze
bevat de originele werffoto's.

## Microsoft Entra ID

Gebruik twee appregistraties in één Entra-tenant:

1. **BouwFlow API**
   - exposeer een gedelegeerde scope `access_as_user`;
   - maak app-rollen aan die overeenkomen met BouwFlow, bijvoorbeeld
     `Administrator`, `Calculator`, `Tender manager`, `Projectdirecteur` en
     `Commercieel medewerker`;
   - noteer Application (client) ID en Directory (tenant) ID.
2. **BouwFlow Web**
   - platformtype Single-page application;
   - redirect-URI's `https://aifestival.be` en voor lokaal gebruik
     `http://localhost:5173`;
   - geef delegated permission op de scope van BouwFlow API;
   - verleen admin consent waar het organisatiebeleid dat vereist.

Wijs gebruikers of groepen aan de juiste API-app-rollen toe. Zonder passende
rol kan een gebruiker wel aanmelden en lezen, maar geen beschermde mutaties doen.

## Omgevingsbestanden

Maak `/etc/bouwflow/api.env` leesbaar voor de API-service:

```bash
install -o root -g deploy -m 0640 /dev/null /etc/bouwflow/api.env
install -d -o deploy -g deploy -m 0750 /var/lib/bouwflow/uploads
```

Inhoud:

```dotenv
DATABASE_URL=postgresql://bouwflow:URL-ENCODED-WACHTWOORD@127.0.0.1:5432/bouwflow
DATABASE_SSL=false
API_HOST=127.0.0.1
API_PORT=3001
FRONTEND_ORIGIN=https://aifestival.be
AUTH_MODE=entra
TENANT_NAME=Naam van de aannemer
ENTRA_TENANT_ID=directory-tenant-id
ENTRA_CLIENT_ID=application-id-van-bouwflow-api
UPLOAD_DIR=/var/lib/bouwflow/uploads
RATE_LIMIT_MAX=300
RATE_LIMIT_WINDOW_MS=60000
INTEGRATION_ALLOWED_ORIGINS=https://integrations.example.be
INTEGRATION_TOKENS_JSON={"https://integrations.example.be":"connector-token"}
AI_GATEWAY_URL=https://ai-gateway.example.be/analyze
AI_GATEWAY_TOKEN=ai-gateway-token
QUOTE_MAIL_GATEWAY_URL=https://mail-gateway.example.be/quotes
QUOTE_MAIL_GATEWAY_TOKEN=mail-gateway-token
DOCUMENT_MAIL_GATEWAY_URL=https://mail-gateway.example.be/documents
DOCUMENT_MAIL_GATEWAY_TOKEN=document-mail-gateway-token
PEPPOL_VALIDATOR_URL=https://validator.example/validate
PEPPOL_ACCESS_POINT_URL=https://accesspoint.example/documents
PEPPOL_ACCESS_POINT_TOKEN=provider-token
PEPPOL_WEBHOOK_SECRET=lang-willekeurig-providergeheim
PEPPOL_WEBHOOK_PUBLIC_URL=https://aifestival.be/api/integrations/peppol/webhook
PEPPOL_STATUS_POLL_INTERVAL_MS=60000
PEPPOL_NOTIFICATION_URL=https://notifications.example/bouwflow
PEPPOL_NOTIFICATION_TOKEN=connector-token
PEPPOL_ALERT_EMAIL_TO=finance@example.be
PEPPOL_ALERT_TEAMS_TARGETS=Financiën
PEPPOL_NOTIFICATION_DISPATCH_INTERVAL_MS=30000
PEPPOL_CRITICAL_SLA_MINUTES=15
M365_NOTIFICATION_TENANT_ID=directory-tenant-id
M365_NOTIFICATION_CLIENT_ID=notification-application-id
M365_NOTIFICATION_CLIENT_SECRET=notification-client-secret
M365_NOTIFICATION_SENDER=bouwflow@example.be
PEPPOL_TEAMS_WEBHOOKS_JSON={"Financiën":"https://example.logic.azure.com/workflows/..."}
```

Gebruik voor `PEPPOL_WEBHOOK_SECRET` een afzonderlijk cryptografisch willekeurig
geheim en deel het uitsluitend met de accesspointprovider. De publieke webhook-URL
mag geen trailing slash bevatten; BouwFlow voegt per verzending zelf het ID toe.
Beveilig `PEPPOL_NOTIFICATION_URL` eveneens als interne integratie. De connector
moet de meegegeven `Idempotency-Key` respecteren, zodat een retry niet tot dubbele
e-mail- of Teams-meldingen leidt. Laat de doelvariabelen leeg wanneer externe
notificaties voor een omgeving niet gewenst zijn.
Deze ontvangers en SLA vormen de standaard totdat een bevoegde gebruiker ze in
het tenantgebonden scherm `Peppol-meldingen` opslaat. Vanaf dan gebruikt BouwFlow
de database-instellingen; de connector-URL en het token blijven altijd uitsluitend
in `/etc/bouwflow/api.env`.
Gebruik na configuratie de knop `Testmelding` in dit scherm. Een geslaagde test
bevestigt de HTTP-route tot aan de interne connector; controleer daarnaast in het
doelsysteem of de e-mail of Teams-melding werkelijk is aangekomen.

Gebruik óf `PEPPOL_NOTIFICATION_URL` voor een interne relay, óf de directe
Microsoft 365-variabelen. Voor Graph e-mail is een afzonderlijke appregistratie
met application permission `Mail.Send` en tenantbrede admin consent vereist.
Beperk deze app in Exchange tot de gekozen afzendmailbox en roteer het client
secret via dezelfde procedure als andere productiegeheimen. Teams Workflow-URL's
zijn eveneens geheimen: plaats ze alleen in `api.env`, geef iedere mapping een
herkenbare doelnaam en zorg voor minstens één mede-eigenaar van de workflow.

De statuskaart in BouwFlow vermeldt de actieve kanalen afzonderlijk. Bestemmingen
voor een niet-geconfigureerd kanaal blijven zichtbaar als aandachtspunt, maar
worden niet getest, nieuw ingepland of door de dispatcher verwerkt.

Controleer daarna in `Peppol-meldingen` het blok `Productiegereedheid`. Alle zes
configuratiechecks moeten groen zijn: externe validatie, accesspoint, webhook,
statusmonitor, notificatieconnector en notificatiedispatcher. De controle toont
bewust geen secrets of endpoint-URL's. Een groene configuratiecheck vervangt geen
end-to-endtest: verstuur aanvullend een testmelding en een gecontroleerde
testfactuur via het gekoppelde accesspoint.

Open voor die gecontroleerde testfactuur het factuurdocument en kies
`Acceptatietest starten`. Dit is bewust een afzonderlijke actie met een expliciete
waarschuwing: de factuur wordt werkelijk naar het geconfigureerde Peppol-netwerk
verzonden. Bewaar het resulterende run-ID, validatierapport-ID en de
providerreferentie bij het productievrijgaveverslag. De status `Geslaagd` mag pas
verschijnen nadat een callback of statuscontrole `Afgeleverd` heeft bevestigd.

Laat vervolgens een gebruiker met rol `Administrator` of `Directie` de run via
`Productie vrijgeven` goedkeuren. Op dat moment controleert de server opnieuw alle
zes readinesschecks. Download daarna `Rapport PDF` en archiveer dit document in het
productiedossier. Het bevat de vrijgever, vrijgavenotitie, run-ID, documentdigest,
validatierapport-ID en leveringsreferentie; connectorgeheimen worden niet opgenomen.

Vanaf de vrijgave opent de tenantbrede productiepoort. Gewone Peppol-verzendingen
worden server-side geweigerd zolang geen geldig vrijgavebewijs bestaat. De server
controleert bovendien bij elke verzending opnieuw alle zes readinesschecks; een
latere configuratie- of opvolgingsstoring sluit de poort onmiddellijk zonder het
gearchiveerde vrijgavebewijs te verwijderen. Het scherm `Peppol-meldingen` toont
zowel het bewijs als de actuele poortstatus. De afzonderlijke acceptatieroute is de
enige bewuste uitzondering, omdat ze nodig is om een nieuwe of herstelde omgeving
end-to-end te bewijzen.

Gebruik in hetzelfde scherm het `Acceptatiedossier` als operationeel vertrekpunt.
Daar staan alle runs met hun factuur, project, status en vrijgever. Download er het
PDF-bewijs of open rechtstreeks de gekoppelde factuur; BouwFlow benoemt automatisch
of de volgende stap starten, opnieuw uitvoeren, opvolgen of formeel vrijgeven is.

Na `Productie vrijgeven` archiveert de server het PDF-rapport daarnaast automatisch
als goedgekeurd, onveranderlijk document in het gekoppelde projectdossier. Controleer
in `Documenten` of factuurnummer, juridische entiteit en acceptatierun zichtbaar
gekoppeld zijn. Bij een tijdelijke opslagfout kan dezelfde vrijgave veilig opnieuw
worden aangeroepen: de archivering is idempotent en levert maximaal één document per
acceptatierun op.

Voer daarna op het gearchiveerde bewijs de actie `Integriteit` uit. De server leest
de PDF uit de geconfigureerde object storage en vergelijkt de actuele SHA-256 met de
hash die tijdens archivering werd opgeslagen. Alleen `Geldig` bevestigt byte-identieke
bewaring. Behandel `Gewijzigd` als een incident en `Niet beschikbaar` als een
historische versie zonder betrouwbare uploadhash; beide resultaten blijven zichtbaar
in het auditlog.

Maak `/etc/bouwflow/frontend.env` voor de Vite-build:

```bash
install -o root -g deploy -m 0640 /dev/null /etc/bouwflow/frontend.env
```

Inhoud:

```dotenv
VITE_API_URL=https://aifestival.be
VITE_ENTRA_TENANT_ID=directory-tenant-id
VITE_ENTRA_CLIENT_ID=application-id-van-bouwflow-web
VITE_ENTRA_API_SCOPE=api://API-APPLICATION-ID/access_as_user
VITE_ENTRA_REDIRECT_URI=https://aifestival.be
```

Vite-variabelen zijn zichtbaar in de browser en mogen dus nooit secrets bevatten.

## Services en nginx installeren

Kopieer vanuit de repository:

```bash
install -o deploy -g deploy -m 0755 ops/deploy-bouwflow /usr/local/bin/deploy-bouwflow
install -o deploy -g deploy -m 0755 ops/bouwflow-deploy-poller /usr/local/bin/bouwflow-deploy-poller
install -m 0644 ops/bouwflow-deploy-poller.service /etc/systemd/system/bouwflow-deploy-poller.service
install -m 0644 ops/bouwflow-deploy-poller.timer /etc/systemd/system/bouwflow-deploy-poller.timer
install -m 0644 ops/bouwflow-api.service /etc/systemd/system/bouwflow-api.service
install -o root -g root -m 0755 ops/backup-bouwflow /usr/local/bin/backup-bouwflow
install -o root -g root -m 0755 ops/verify-bouwflow-restore /usr/local/bin/verify-bouwflow-restore
install -o root -g root -m 0755 ops/check-bouwflow-health /usr/local/bin/check-bouwflow-health
install -m 0644 ops/bouwflow-backup.service ops/bouwflow-backup.timer /etc/systemd/system/
install -m 0644 ops/bouwflow-restore-test.service ops/bouwflow-restore-test.timer /etc/systemd/system/
install -m 0644 ops/bouwflow-healthcheck.service ops/bouwflow-healthcheck.timer /etc/systemd/system/
install -m 0440 ops/bouwflow-deploy-sudoers /etc/sudoers.d/bouwflow-deploy
visudo -cf /etc/sudoers.d/bouwflow-deploy
install -m 0644 ops/nginx-bouwflow.conf /etc/nginx/sites-available/bouwflow
ln -s /etc/nginx/sites-available/bouwflow /etc/nginx/sites-enabled/bouwflow
nginx -t
systemctl reload nginx
systemctl daemon-reload
systemctl enable bouwflow-api.service
systemctl enable bouwflow-backup.timer bouwflow-restore-test.timer bouwflow-healthcheck.timer
```

De sudo-regel laat `deploy` uitsluitend de BouwFlow API-service herstarten. Laat
de bestaande nginx-sites voor Germanyoungcars en Bosis ongemoeid.

Maak daarnaast een niet-interactieve systeemgebruiker `backup`, importeer diens
GPG-ontvangerssleutel en geef deze gebruiker leesrechten op uploads en create/drop-
rechten voor tijdelijke restoretestdatabases. Bewaar in `/etc/bouwflow/backup.env`
minimaal `DATABASE_URL`, `BACKUP_ROOT`, `UPLOAD_DIR`, `BACKUP_GPG_RECIPIENT`,
`BACKUP_RETENTION_DAYS` en de PostgreSQL-verbinding voor de restoretest. Maak
`/var/backups/bouwflow` eigendom van `backup:backup` met modus `0700`. Test vóór
livegang handmatig één back-up en één restore; alleen het bestaan van een archief
is geen herstelbewijs.

## Eerste deployment

```bash
systemctl enable --now bouwflow-deploy-poller.timer
systemctl start bouwflow-deploy-poller.service
systemctl status bouwflow-api.service
curl --fail http://127.0.0.1:3001/health
curl --fail http://127.0.0.1:3001/api/health/ready
curl --fail http://127.0.0.1:3001/internal/metrics
systemctl start bouwflow-backup.service
systemctl start bouwflow-restore-test.service
systemctl start bouwflow-healthcheck.service
journalctl -u bouwflow-api.service -n 100 --no-pager
journalctl -u bouwflow-deploy-poller.service -n 100 --no-pager
```

## DNS en HTTPS

Controleer eerst het actuele VPS-adres bij Easyhost en configureer daarna:

- `@` als A-record naar de VPS;
- `www` als CNAME naar `aifestival.be`;
- verwijder conflicterende oude A-, AAAA- of CNAME-records.

Zodra nginx via DNS bereikbaar is:

```bash
certbot --nginx -d aifestival.be -d www.aifestival.be \
  --redirect --agree-tos --no-eff-email -m info@aifestival.be
certbot renew --dry-run
```

Controleer login, dashboard, een directe browserrefresh en `/api/health`.

## Dagelijkse ontwikkelworkflow

```bash
git switch -c feature/korte-omschrijving
npm ci
npm run lint
npm test
npm run build
git push -u origin feature/korte-omschrijving
```

## Handmatige rollback

De automatische deployment rolt frontend en API samen terug. Handmatig:

```bash
ls -lt /var/www/bouwflow/releases
ln -sfn /var/www/bouwflow/releases/COMMIT-ID /var/www/bouwflow/current.rollback
mv -Tf /var/www/bouwflow/current.rollback /var/www/bouwflow/current
systemctl restart bouwflow-api.service
curl --fail --header 'Host: aifestival.be' http://127.0.0.1/api/health
```

Zet daarna de gewenste geteste commit opnieuw op `main`, zodat repository en
productierelease weer overeenkomen.
