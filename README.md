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

Appen svarar på http://localhost:4200. Testerna, 54 stycken:

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
4. **Avståndet.** Butikerna hämtas parallellt med erbjudandena och ger varje
   kedja avståndet till sin närmaste butik, räknat med haversine i
   [`distance.ts`](src/app/core/distance.ts). Misslyckas den hämtningen står
   kedjorna utan avstånd i stället för att hela sidan blir ett fel.
5. **Kryssrutorna.** Kedjorna listas närmast först, med avstånd och antal
   erbjudanden. Fyra rader visas från början och "Visa fler" lägger till fyra i
   taget. Allt hämtas en gång; kryssrutor, sökfält och sortering arbetar sedan
   på den redan hämtade listan, så en ändrad kryssruta syns direkt.

## Favoriter

Stjärnan bredvid en kedja gör den till favorit. Favoriter ligger alltid överst
och visas alltid: har du fler än fyra favoriter börjar listan på så många rader
som du har favoriter, annars på fyra. En favorit gömd bakom "Visa fler" vore
ingen favorit.

Regeln för vad som är ikryssat är avsiktligt enkel: **när appen öppnas är
precis dina favoriter ikryssade, ingen annan.** Kryssar du i en kedja till
under besöket gäller det tills appen öppnas nästa gång; favoriterna är det som
består. En favorit som inte finns på orten du är på faller bort ur urvalet men
ligger kvar som favorit till nästa gång.

Utan favoriter finns inget att gå på, och då kryssas allt i första gången —
annars möts en ny användare av en tom skärm och en app som ser trasig ut. En
återvändare utan favoriter får tillbaka sitt senaste urval.

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

54 test i sju filer:

- **[grocery-brands.spec.ts](src/app/core/grocery-brands.spec.ts)** täcker
  sållningen: att ICA:s och Coops alla butiksformat hittar rätt varumärke, att
  bygg- och möbelkedjor faller bort, och att en domän som bara *slutar* likadant
  inte släpps igenom.
- **[offer-filter.spec.ts](src/app/core/offer-filter.spec.ts)** täcker
  kryssrutornas och sökfältets logik, inklusive att erbjudanden utan ordinarie
  pris hamnar sist i rabattsorteringen i stället för att räknas som noll procent.
- **[distance.spec.ts](src/app/core/distance.spec.ts)** kontrollerar haversine
  mot ett känt avstånd, Göteborg–Stockholm, och att den är symmetrisk.
- **[format.spec.ts](src/app/core/format.spec.ts)** täcker priser, avstånd och
  giltighetstexten, som räknas i hela dygn och därför måste klara årsskiften och
  tidszoner.
- **[offers.service.spec.ts](src/app/core/offers.service.spec.ts)** täcker
  sammanställningen: att icke-mat sållas bort, att kedjorna sorteras med den
  närmaste butiken först, att den närmaste av flera butiker vinner, och att en
  kedja utan känd butik hamnar sist utan avstånd.
- **[chain-filter.component.spec.ts](src/app/components/chain-filter.component.spec.ts)**
  täcker listan: fyra rader från början, fler när favoriterna är fler, fyra till
  per klick, att knappen försvinner när allt visas, och att en utfälld lista
  varken fälls ihop av ett kryss eller av en ny stjärna.
- **[app.component.spec.ts](src/app/app.component.spec.ts)** kör appen med
  stoppade tjänster och kontrollerar det som knyter ihop den: att en urkryssad
  kedja försvinner ur listan, att en favorit lyfts överst och kryssas i, att
  precis favoriterna är ikryssade efter en omstart medan ett tillfälligt kryss
  inte är det, och att ett nekat platstillstånd leder till ortssökningen i
  stället för till en död skärm.

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
