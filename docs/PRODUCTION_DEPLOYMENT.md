# Productie op de Easyhost VPS

BouwFlow draait als statische React/Vite-webapp op dezelfde Easyhost VPS als de
andere websites:

- productie: `https://aifestival.be`
- broncode: `git@github.com:Boskes/BouwFlow-MVP.git`
- webroot: `/var/www/bouwflow/current`

## Releaseflow

De productieflow volgt hetzelfde patroon als Germanyoungcars:

1. een pull request en iedere push naar `main` draaien lint en de productiebouw;
2. alleen een geslaagde workflow op `main` verplaatst de tag
   `production-ready` naar de geteste commit;
3. de VPS controleert die tag elke twee minuten via de publieke HTTPS-repository;
4. de VPS bouwt de release, activeert die via een atomische `current`-symlink en
   bewaart vijf releases;
5. bij een mislukte healthcheck wordt de vorige release teruggezet.

Er staan geen VPS-wachtwoorden of private SSH-sleutels in GitHub. De poller heeft
ook geen GitHub-token nodig, omdat de repository publiek leesbaar is.

## Eenmalige VPS-inrichting

De VPS moet nginx, git, curl, tar, Node.js 22 en npm hebben. Controleer eerst:

```bash
nginx -v
git --version
node --version
npm --version
```

Vite 8 vereist een recente Node.js-versie; gebruik voor deze app Node.js 22. Maak
de release- en repositorymappen als `root`:

```bash
install -d -o deploy -g deploy -m 2775 /var/www/bouwflow/releases
install -d -o deploy -g deploy -m 2775 /var/lib/bouwflow-repository
```

Kopieer daarna vanuit de repository de productieconfiguratie:

```bash
install -o deploy -g deploy -m 0755 ops/deploy-bouwflow \
  /usr/local/bin/deploy-bouwflow
install -o deploy -g deploy -m 0755 ops/bouwflow-deploy-poller \
  /usr/local/bin/bouwflow-deploy-poller
install -m 0644 ops/bouwflow-deploy-poller.service \
  /etc/systemd/system/bouwflow-deploy-poller.service
install -m 0644 ops/bouwflow-deploy-poller.timer \
  /etc/systemd/system/bouwflow-deploy-poller.timer
install -m 0644 ops/nginx-bouwflow.conf \
  /etc/nginx/sites-available/bouwflow
ln -s /etc/nginx/sites-available/bouwflow /etc/nginx/sites-enabled/bouwflow
nginx -t
systemctl reload nginx
systemctl daemon-reload
```

Laat de bestaande nginx-sites voor Germanyoungcars en Bosis ongemoeid.

## Poller starten

De poller leest de publieke repository uitsluitend via HTTPS. Start hem en
controleer de eerste uitvoering:

```bash
systemctl enable --now bouwflow-deploy-poller.timer
systemctl start bouwflow-deploy-poller.service
systemctl status bouwflow-deploy-poller.service
journalctl -u bouwflow-deploy-poller.service -n 100 --no-pager
```

## DNS en HTTPS

Op 18 juli 2026 verwijzen `aifestival.be` en `www.aifestival.be` nog naar
`217.21.190.175`. Germanyoungcars verwijst naar de gedeelde Easyhost VPS op
`136.144.250.194`. Controleer het VPS-adres in Easyhost voordat DNS wordt
gewijzigd en zet vervolgens:

- `@` als A-record naar het IPv4-adres van de Easyhost VPS;
- `www` als CNAME naar `aifestival.be` (of hetzelfde A-record).

Verwijder conflicterende oude A- en AAAA-records. Zodra DNS naar de juiste VPS
wijst en nginx antwoordt:

```bash
certbot --nginx -d aifestival.be -d www.aifestival.be \
  --redirect --agree-tos --no-eff-email -m info@aifestival.be
certbot renew --dry-run
```

Controleer daarna zowel `https://aifestival.be` als
`https://www.aifestival.be`, inclusief een directe browserrefresh op een interne
SPA-route.

## Dagelijkse ontwikkelworkflow

Werk lokaal op een featurebranch en nooit rechtstreeks op de VPS:

```bash
git switch -c feature/korte-omschrijving
npm ci
npm run dev
npm run lint
npm run build
git push -u origin feature/korte-omschrijving
```

Maak een pull request naar `main`. Na een geslaagde merge wordt dezelfde geteste
commit binnen ongeveer twee minuten door de VPS geactiveerd.

## Handmatige rollback

Bekijk de releases en wijs `current` atomisch terug naar een eerdere commit:

```bash
ls -lt /var/www/bouwflow/releases
ln -sfn /var/www/bouwflow/releases/COMMIT-ID /var/www/bouwflow/current.rollback
mv -Tf /var/www/bouwflow/current.rollback /var/www/bouwflow/current
```

Zet daarna de gewenste geteste Git-commit opnieuw op `main`, zodat de volgende
automatische release overeenkomt met de repository.
