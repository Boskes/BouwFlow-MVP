# BouwFlow MVP

Een eerste klikbaar frontend-prototype voor een geïntegreerde webapplicatie voor
bouw- en infrastructuurbedrijven.

## Inbegrepen

- Directiedashboard
- CRM en relaties
- Opportuniteiten en aanbestedingen
- Calculatiedossiers
- Projectportfolio
- Responsieve mobiele weergave

## Lokaal ontwikkelen

Gebruik Node.js 22 en installeer exact de vastgelegde dependencies:

```bash
npm ci
npm run dev
```

Vite toont in de terminal op welke lokale URL de app beschikbaar is.

## Controleren

Voer vóór iedere push dezelfde controles uit als GitHub Actions:

```bash
npm run lint
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

Deze versie gebruikt demonstratiegegevens en bevat nog geen database,
authenticatie of backend.
