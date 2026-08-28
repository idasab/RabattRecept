# Rabatter nära dig

Webbapp som svarar på vad man kan laga av veckans rea. Den hämtar
matvaruerbjudandena från butikerna närmast dig, låter dig kryssa i vilka kedjor
du handlar i, och föreslår recept på de varor som är nedsatta. Byggd för att
sparas på hemskärmen på en iPhone, men fungerar lika bra i en vanlig
webbläsare.

Själva erbjudandelistan visas inte. Den ligger bakom recepten som underlag —
komponenten som ritar den finns kvar i
[offer-list.component.ts](src/app/components/offer-list.component.ts), oanvänd
men kompilerad och lintad, för den dagen den ska fram igen.

## Versioner och varför

| Del | Version | Varför just den |
| --- | --- | --- |
| Angular | 16.2 | Kravet är `^16.14.0 \|\| >=18.10.0`, alltså öppet uppåt, så det fungerar på Node 20.18.0. Nyare Angular kräver Node 20.19 eller senare och startar inte här. |
| angular-eslint | 16.3.1 | `ng add` drar annars in v21 med ESLint 9 och flat config, som kräver Angular 20. Versionen är låst så att `npm install` inte glider iväg. |
| Erbjudanden | Tjek (`squid-api.tjek.com/v2`) | Samma källa som ereklamblad.se. Gratis, ingen nyckel, och skickar CORS-huvuden — därför kan telefonen hämta direkt utan mellanserver. |
| Recept och betyg | Tasteline (`tasteline.com/wp-json/wp/v2`) | Enda svenska receptkällan jag hittade som både har betyg på femgradig skala och svarar med CORS-huvuden. Köket.se har bättre betygsdata men skickar inga CORS-huvuden alls, ICA:s och Arlas recept-API:er svarar inte utan nyckel. |
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

Appen svarar på http://localhost:4200. Testerna, 127 stycken:

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
4. **Uteslutna varor faller bort.** Det man angett under Uteslut matvaror
   sållas ur underlaget innan söktermerna väljs.
5. **Avståndet.** Butikerna hämtas parallellt med erbjudandena och ger varje
   kedja avståndet till sin närmaste butik, räknat med haversine i
   [`distance.ts`](src/app/core/distance.ts). Misslyckas den hämtningen står
   kedjorna utan avstånd i stället för att hela sidan blir ett fel.
6. **Kryssrutorna.** Kedjorna listas närmast först, med avstånd och antal
   erbjudanden. Fyra rader visas från början och "Visa fler" lägger till fyra i
   taget. Erbjudandena hämtas en gång per plats och radie; kryssrutorna arbetar
   sedan på den redan hämtade listan.
7. **Recepten.** De ikryssade kedjornas rabatterade huvudråvaror, störst
   rabatt först, blir söktermer. Fem recept visas åt gången.

## Recepten

Kedjan från rea till recept, i [recipes.service.ts](src/app/core/recipes.service.ts):

1. **Bara rabatterade huvudråvaror blir söktermer.** En rätt föreslås för att
   det den byggs kring är nedsatt — kyckling, fläskfilé, köttfärs — inte för
   att smöret eller grädden i den råkar vara det. Sådana ingredienser finns i
   nästan varje recept och säger inget om vad man ska laga.

   [main-ingredients.ts](src/app/core/main-ingredients.ts) håller listan över
   vad som räknas: kött, fisk, fågel, korv, ägg och de vegetariska
   huvudråvarorna. Matchningen görs per ord och godtar både början och slutet,
   för svenska varunamn sätter ihop råvaran åt båda hållen — "kycklinglårfilé"
   börjar med den, "blandfärs" slutar med den. Ordningen i listan avgör vid
   flera träffar, så falukorv blir Falukorv och inte Korv.

   Att godta ordets början kräver undantag, och de står i samma lista:
   kaffebönor är inte bönor, korvbröd är inte korv, och "färsk" börjar på
   "färs" utan att ha med köttfärs att göra. Alla tre har dykt upp i riktiga
   erbjudanden.

   Varje namn i listan är kontrollerat mot receptkällans ingredienslista och
   finns där som en egen term. En ny rad bör kontrolleras på samma sätt, annars
   blir den en sökning som aldrig ger träff.
2. Söktermerna slås upp i Tastelines ingredienstaxonomi.

   Taxonomin är finkornig och sökningen rangordnar dåligt, så urvalet görs i
   appen. Varan måste vara termens **huvudord** — sitta sist och med högst ett
   ord framför. Då fångas "gul lök(ar)" för lök och "saltat smör" för smör,
   medan "smörgåsgurka" och "vegofärs istället för kyckling" faller bort trots
   att ordet finns i namnet. Varje vara får sedan svara mot sina fem bäst
   rangordnade termer, inte bara en: ett recept som använder lök taggas med
   "gul lök(ar)", aldrig med "lök", så en enda term per vara hittar långt
   färre recept.
3. Recepten hämtas i ett anrop för alla ingredienser och sållas på betyg: minst
   3,5 av 5. Recept utan betyg faller bort på samma villkor.
4. Ordningen är högsta betyg först, men **varvat över varorna**. En populär
   ingrediens kan ha dussintals högt betygsatta recept och skulle annars fylla
   hela första sidan med blåbär — poängen är att visa vad man kan laga av rean,
   plural.

Varje recept länkar till receptsidan hos Tasteline och sammanfattar under
rubriken vilka av receptets varor som är rabatterade, till vilket pris och i
vilken butik — upp till tre, resten som ett antal. Samma vara räknas en gång
även när receptet taggats med flera av dess termer.

Oftast står det en vara per recept, ibland flera. Att det inte blir fler beror
på att receptkällans ingredienstaxonomi är finkornig: två råvaror i samma
recept sammanfaller mer sällan än man tror.

Fältfiltrering (`_fields`) är inte en detalj utan en förutsättning: utan den
skickar API:et hela receptet med steg, näringsvärden och ingredienslistor, 165
kB för tjugo recept i stället för 7 kB.

## Uteslutna matvaror

Under **Uteslut matvaror** anger man varor man inte vill ha receptförslag på —
för allergier, för att man inte äter dem, eller för att man tröttnat. Listan
sparas mellan besöken och fältet föreslår de råvaror appen känner igen.

Uteslutningen görs på **erbjudandet**, inte på receptet. Är fläsk uteslutet
blir fläskfilén aldrig en sökterm, och inga rätter som byggs på fläsk föreslås.
Ett recept kan fortfarande innehålla fläsk i en biroll: appen läser inte
recepten, den väljer bara vad den söker på.

Matchningen godtar ordets början och slut, precis som råvaruigenkänningen. Det
gör att "fläsk" fångar både "Fläskytterfilé" och "Bacon/Stekfläsk" — vilket är
rätt, för bacon är fläsk — men också att ett kort ord tar med mer än man tror.

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

127 test i tretton filer:

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
- **[main-ingredients.spec.ts](src/app/core/main-ingredients.spec.ts)** täcker
  vad som räknas som huvudråvara: att råvaran hittas både i början och slutet
  av ett sammansatt varunamn, att den mer specifika vinner, att undantagen
  håller kaffebönor och färskost utanför, och — själva poängen — att smör,
  grädde och bakpulver svarar null.
- **[ingredient-candidates.spec.ts](src/app/core/ingredient-candidates.spec.ts)**
  täcker urvalet av söktermer: att bara huvudråvaror räknas mot gränsen, att
  samma råvara tas en gång, och att erbjudandenas ordning behålls.
- **[recipes.service.spec.ts](src/app/core/recipes.service.spec.ts)** täcker
  betygsgränsen, att icke-mat aldrig ens slås upp, termrangordningen med sina
  gränsfall ("smörgåsgurka" är inte smör), att en vara räknas en gång även när
  receptet taggats med flera av dess termer, att recepten varvas över varorna,
  och att bara de behållna receptens bilder hämtas.
- **[recipe-list.component.spec.ts](src/app/components/recipe-list.component.spec.ts)**
  täcker fem recept i taget och att korten länkar ut med `rel="noopener"`.
- **[food-exclusions.spec.ts](src/app/core/food-exclusions.spec.ts)** täcker
  uteslutningarna: att ordet fångas i början och slutet av ett sammansatt
  varunamn, att det matchar via råvaran när rubriken stavar annorlunda, och att
  samma vara inte kan läggas till två gånger.
- **[food-exclusions.component.spec.ts](src/app/components/food-exclusions.component.spec.ts)**
  täcker inställningen: att den börjar hopfälld, räknar de uteslutna varorna,
  tömmer fältet efter tillägg och inte skickar tomma rader.
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

Receptmatchningen är en gissning, inte en varukoppling. Appen vet inte att
butikens "Kycklinglårfilé" och Tastelines "Kyckling" är samma sak i annat än
namnet, så ett recept kan råka föreslås på fel vara. Betygen är Tastelines
egna besökarbetyg och säger inget om hur många som röstat — antalet röster
står i listan så att man kan väga in det själv.
