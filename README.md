# Rabatter nära dig

Webbapp som hämtar veckans matvaruerbjudanden från butikerna närmast dig och
listar kedjorna som en lista att kryssa i. Byggd för att sparas på hemskärmen på
en iPhone, men fungerar lika bra i en vanlig webbläsare.

## Versioner och varför

| Del | Version | Varför just den |
| --- | --- | --- |
| Angular | 16.2 | Kravet är `^16.14.0 \|\| >=18.10.0`, alltså öppet uppåt, så det fungerar på Node 20.18.0. Nyare Angular kräver Node 20.19 eller senare och startar inte här. |
| angular-eslint | 16.3.1 | `ng add` drar annars in v21 med ESLint 9 och flat config, som kräver Angular 20. Versionen är låst så att `npm install` inte glider iväg. |
| Erbjudanden | Tjek (`squid-api.tjek.com/v2`) | Samma källa som ereklamblad.se. Gratis, ingen nyckel, och skickar CORS-huvuden — därför kan telefonen hämta direkt utan mellanserver. |
| Ortssökning | Open-Meteo Geocoding | Gratis, ingen nyckel. Används bara när positionen inte går att få. |
| Ortsnamn från koordinater | BigDataCloud | Gratis utan nyckel för klientanrop. Namnet är trevligt men inte nödvändigt — misslyckas det heter platsen "Din plats". |

Angular 16 ligger utanför Angulars officiellt testade Node-matris (den listar
Node 16 och 18), men `engines` tillåter Node 20 och CLI:n kör utan invändningar.

## Kom igång

```bash
npm install
```

```bash
npm start
```

Appen svarar på http://localhost:4200. Testerna, 27 stycken:

```bash
npm run test:ci
```

Produktionsbygge hamnar i `dist/rabatt-recept`:

```bash
npm run build
```

Linting med ESLint och @angular-eslint:

```bash
npm run lint
```

## Så fungerar den

1. **Plats.** Webbläsarens geolocation frågar om lov första gången. Nekas det
   går det att söka på en ort i stället — appen ska aldrig bli oanvändbar för
   att ett lov saknas.
2. **Hämtning.** [`TjekService`](src/app/core/tjek.service.ts) hämtar fyra sidor
   à 100 erbjudanden inom vald radie. Första sidan får fela vidare; att en
   senare sida saknas ger en kortare lista i stället för ett felmeddelande.
3. **Sållning.** [`OffersService`](src/app/core/offers.service.ts) kastar allt
   som inte är mat. Källan täcker bygg, sport och möbler också, och klassningen
   sker på kedjans domän i
   [`grocery-brands.ts`](src/app/core/grocery-brands.ts) — butiksformaten byter
   namn medan `ica.se` står still.
4. **Kryssrutorna.** Kedjorna som har erbjudanden i närheten listas med antal.
   Allt hämtas en gång; kryssrutor, sökfält och sortering arbetar sedan på den
   redan hämtade listan, så en ändrad kryssruta syns direkt.

Det som sparas mellan besöken är *urvalet*, alltså kedjorna du kryssat ur. En
kedja som dyker upp först när du är någon annanstans blir därmed ikryssad från
början, vilket är vad man vill när man byter ort.

Senast hämtade lista sparas också, så att appen har innehåll direkt när den
öppnas — och något att visa alls när nätet inte svarar.

## På hemskärmen

Öppna appen i Safari på iPhone, tryck på dela-knappen och välj **Lägg till på
hemskärmen**. `apple-mobile-web-app-capable` gör att den startar utan
adressfält, och `viewport-fit=cover` plus `env(safe-area-inset-*)` håller
innehållet fritt från hakskäran och hemindikatorn.

Notera att Safari kommer ihåg platstillståndet per webbplats. Har du nekat
platsen en gång måste den slås på igen under Inställningar → Safari →
Plats, annars är ortssökningen vägen framåt.

## Tester

27 test i fyra filer:

- **[grocery-brands.spec.ts](src/app/core/grocery-brands.spec.ts)** täcker
  sållningen: att ICA:s och Coops alla butiksformat hittar rätt varumärke, att
  bygg- och möbelkedjor faller bort, och att en domän som bara *slutar* likadant
  inte släpps igenom.
- **[offer-filter.spec.ts](src/app/core/offer-filter.spec.ts)** täcker
  kryssrutornas och sökfältets logik, inklusive att erbjudanden utan ordinarie
  pris hamnar sist i rabattsorteringen i stället för att räknas som noll procent.
- **[format.spec.ts](src/app/core/format.spec.ts)** täcker priser och
  giltighetstexten, som räknas i hela dygn och därför måste klara årsskiften och
  tidszoner.
- **[app.component.spec.ts](src/app/app.component.spec.ts)** kör appen med
  stoppade tjänster och kontrollerar det som knyter ihop den: att alla kedjor är
  ikryssade från början, att en urkryssad kedja försvinner ur listan, att
  urvalet överlever en omstart, och att ett nekat platstillstånd leder till
  ortssökningen i stället för till en död skärm.

## Ikoner

```bash
python tools/generate-icons.py
```

Skriptet ritar ikonerna och `favicon.ico` från grunden, utan beroenden utöver
Pythons standardbibliotek. Motivet är ett procenttecken i grafit mot dämpad
salviegrön.

## Att veta om datakällan

Erbjudandena kommer från butikernas reklamblad, inte från kassasystemen. Priser
och giltighet kan skilja sig mellan butiker i samma kedja, och ordinarie pris
saknas för de flesta erbjudanden — då visas bara priset, utan påhittad
rabattsiffra. API:et är öppet men odokumenterat; går det sönder är det
[`TjekService`](src/app/core/tjek.service.ts) och mappningen i
[`OffersService`](src/app/core/offers.service.ts) som behöver ses över.
