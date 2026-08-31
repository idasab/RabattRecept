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
| Recept och betyg | Tasteline (`tasteline.com/wp-json/wp/v2`) och Zeta (`zeta.nu/wp-json/wp/v2`) | De två svenska receptkällor jag hittade som både har betyg på femgradig skala och svarar med CORS-huvuden. Se **Receptkällorna** nedan för vad som föll bort och varför. |
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

Appen svarar på http://localhost:4200. Testerna, 209 stycken:

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
5. **Kedjelistan byggs på butikerna.** Butikerna hämtas parallellt med
   erbjudandena och ger både vilka kedjor som finns i närheten och avståndet
   till varje kedjas närmaste butik, räknat med haversine i
   [`distance.ts`](src/app/core/distance.ts).

   **Butikerna och inte erbjudandena, för att listan ska växa monotont.**
   Erbjudandena hämtas kapade till fyra sidor, och API:et returnerar dem varken
   i närhetsordning eller i stabil ordning — en bredare radie ger därför inte
   ett större urval utan ett annat. Mätt kring Huskvarna: vid 5 km finns 549
   erbjudanden och 4 kedjor, vid 25 km finns 1000 erbjudanden och 12 kedjor, men
   Willys och Willys Hemma dyker upp först på sida sex och föll bort ur de
   fyra hämtade sidorna. Kedjelistan tappade alltså kedjor när man drog ut
   reglaget. Butikerna växer däremot alltid med radien.

   Kvarstående begränsning: en kedja kan stå i listan utan att dess erbjudanden
   kom med i de fyra sidorna, och då ger den inga recept när man kryssar i den.
   Det åtgärdas genom att hämta fler sidor vid stor radie, vilket kostar
   bandbredd — omkring 3 MB vid 25 km — och inte är gjort.
6. **Kryssrutorna.** Kedjorna listas närmast först, med avstånd. Fyra rader
   visas från början och "Visa fler" lägger till fyra i taget. Erbjudandena
   hämtas en gång per plats och radie; kryssrutorna arbetar sedan på den redan
   hämtade listan.
7. **Recepten.** De ikryssade kedjornas rabatterade huvudråvaror, störst
   rabatt först, blir söktermer. Fem recept visas åt gången.

## Receptkällorna

Appen hämtar från två sajter samtidigt, och varje receptkort visar vilken det
kom från. Kraven är att källan ska ha betyg på femgradig skala och svara med
CORS-huvuden, eftersom appen är en ren statisk sida utan mellanserver.

| Källa | Betyg | Tid | Matchning |
| --- | --- | --- | --- |
| **Tasteline** | JSON-fält | `totalDuration` i sekunder | Ingredienstaxonomi, sökning på term-id |
| **Zeta** | HTML-attribut i betygsmarkupen | `zetacompat_time` i minuter | Fritext, verifierad mot receptets ingredienslista |

Zeta saknar taxonomi, så sökningen är fritext på råvarans namn. Fritext träffar
brett — ett recept som bara nämner kyckling i inledningen kommer med — så varje
träff kontrolleras mot receptets egen ingredienslista, som lyckligtvis finns
strukturerad. Zetas betyg ligger som färdig HTML med summorna i attribut
(`data-total-votes="7" data-total-points="28"` betyder 4,0 av 5), så snittet
räknas i appen. Ändrar Zeta sin markup slutar betygen att läsas, och recepten
faller då bort på röstgränsen i stället för att visas med fel betyg.

Zeta är ett varumärke och inte en allmän receptsajt, så urvalet lutar åt
medelhavsmat och recepten använder ofta deras egna produkter. Det är priset för
att den är öppen.

Följande källor undersöktes och föll bort:

- **Köket.se** har den bästa betygsdatan av alla — `ratingValue` och
  `ratingCount` rakt av — men skickar inga CORS-huvuden på någon endpoint.
  Webbläsaren hämtar sidan men vägrar låta appen läsa svaret. Det skulle kräva
  en mellanserver, vilket appen medvetet inte har.
- **ICA, Coop, Arla, Recept.se, Allt om Mat, Godare, Mitt kök, Kokaihop och
  Santa Maria** har inget öppet API alls.
- **Matgeek.se** svarar med CORS och kör WP Recipe Maker, men har betygen
  avstängda (`count: 0`).

En ny källa behöver bara implementera
[`RecipeSource`](src/app/core/recipe-source.ts): svara på "vilka recept har du
på de här råvarorna" och tillämpa betygs- och röstgränsen. Sammanslagning,
sortering och varvning sköts av
[`RecipesService`](src/app/core/recipes.service.ts).

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
3. Recepten hämtas i ett anrop för alla ingredienser och sållas på betyg:
   **minst 3,5 av 5, från minst 5 röster.** Betygskravet ensamt räcker inte —
   ett femma från en enda röst säger ingenting om receptet, bara om den som
   råkade rösta. Recept helt utan betyg faller bort på samma villkor.
4. **Recept ur säsong faller bort.** Ett julrecept i augusti är inget förslag,
   hur billig fläskkarrén än är. Vad som hör till vilken del av året står i
   [seasons.ts](src/app/core/seasons.ts): jul och nyår, påsk, midsommar,
   kräftskiva, halloween och några fler, med marginal framåt eftersom man lagar
   inför en högtid och inte bara på dagen.

   Tasteline taggar recepten med sina egna tillfällen — Jul, Julgodis, Påskmat —
   och det är den säkraste signalen. I en mätning på sextio recept bar tre en
   tagg utanför säsong, och alla tre hade helt neutrala rubriker: "Tastelines
   köttbullar", "Minihamburgare", "Pestobollar med pumpasallad". Bara taggen
   fångar dem. Taxonomin hämtas en gång per besök och delas.

   Zeta saknar tillfällestaggar, så där läses årstiden ur rubriken. Rubriken
   används som nät även för Tasteline, när taggen saknas.

   Priset: taggen betyder "passar det här tillfället", inte "bara till det här
   tillfället". Tastelines köttbullar är utmärkta i augusti men taggade som
   julmat, och de faller därför bort. Det är den avvägning som gjordes — hellre
   ett bra recept för lite än en pepparkaksdessert i juli.
5. Ordningen är högsta betyg först, men **varvat över varorna**. En populär
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

Bildanropet är det enda undantaget, och det är avsiktligt. Tastelines
`media_details` försvinner helt så fort `_fields` används på den endpointen,
oavsett om man ber om en storlek eller flera, och då återstår bara originalet
på upp till 2560 px — för en bild som visas i 64 px. Ofiltrerat kostar anropet
omkring 150 kB för tjugofem bilder men ger miniatyrer på 424 px, vilket sparar
flera megabyte.

## Inställningar

Avståndet väljs med ett reglage. Stegen — 2, 5, 10 och 25 km — är inte jämnt
fördelade, så reglaget går på index och siffrorna står som skala under. Under
dragningen ändras bara det som visas; erbjudandena hämtas om först när man
släpper, annars hade varje steg på vägen blivit ett anrop.

Platsknappen sitter på rubrikraden och är fylld som reglaget, eftersom en
textlänk bredvid en versalrubrik lätt läses som ännu en rubrik.

Kugghjulet uppe till höger öppnar inställningsmenyn. En **prick** på kugghjulet
visar att något är påslaget, så att en inställning som ändrar hela receptlistan
inte kan glömmas bort bakom en stängd meny.

Det stod en siffra där först, men den räknade både uteslutna varor och
svenskfiltret och gick därför inte att tolka: tre uteslutna varor plus filtret
blev fyra. Att något är påslaget är det man behöver veta, och hur många säger
inte mer än så. Antalet står kvar i knappens upplästa etikett —
"Inställningar, 4 aktiva" — där det får plats att förklaras.

Menyn stängs med Esc, med krysset eller genom att man trycker utanför. Fokus
flyttas till panelen när den öppnas — inte till textfältet, för då fäller
tangentbordet upp sig och döljer halva menyn — och tillbaka till kugghjulet när
den stängs.

### Bara svenskt kött

Kryssrutan kräver att **kött, chark och fågel** är märkta svenska för att ge
receptförslag — i rubriken eller i beskrivningen: "Svensk nötfärs", "Ursprung
Sverige", "Sverige/Kronfågel".

Kravet gäller bara kött. Fisk, ägg, ost och grönsaker släpps igenom oavsett,
eftersom butikerna sällan skriver ut ursprunget på dem. Ett generellt
ursprungskrav hade tagit bort nästan allt utan att säga något om varorna: i en
mätning på 374 erbjudanden i Göteborg var bara 53 svenskmärkta, medan enbart 6
angav ett annat ursprung. Med kravet begränsat till kött föll 21 erbjudanden
bort i stället för 322.

Vad filtret inte gör är att gissa. Kött utan ursprungsuppgift räknas som okänt
och alltså inte som svenskt — det svarar på *vad vi vet är svenskt*, inte på
*vad som är svenskt*.

Vilka råvaror som räknas som kött står som `meat` i
[main-ingredients.ts](src/app/core/main-ingredients.ts). Fisk och skaldjur gör
det inte, i ordets svenska betydelse.

### Uteslutna matvaror

Här anger man varor man inte vill ha receptförslag på — för allergier, för att man inte äter dem, eller
för att man tröttnat. Listan sparas mellan besöken och fältet föreslår de
råvaror appen känner igen.

Uteslutningen gäller **både erbjudandet och receptet**. Är fläsk uteslutet blir
fläskfilén aldrig en sökterm, och recept som innehåller fläsk kastas även när
de hittades på något annat. Det senare är nödvändigt: en laxrea kan mycket väl
ge "Laxgryta med saffran", och den som kryssat ur saffran vill inte se den.

Hur receptets innehåll prövas skiljer sig åt mellan källorna, eftersom de
lämnar ut olika saker:

- **Tasteline** ger ingredienstermer som id:n, så de uteslutna orden slås upp
  som termer i samma vända som råvarorna och recept med de term-id:na kastas.
- **Zeta** ger ingredienslistan i klartext, så den prövas direkt.
- **Båda** prövas dessutom mot rubriken, som ett extra nät när ordet inte finns
  som ingrediens.

Rubriknätet skiljer inte på "med" och "utan", så "Laxgryta utan saffran"
försvinner också. Att kasta ett recept för mycket är det säkra felet när skälet
kan vara en allergi.

En uteslutning på flera ord gäller bara varan, inte recepten: `färsk kyckling`
säger något om varans skick i butiken, inte att all kyckling ska bort ur
matsedeln.

Ett ensamt ord matchar ordets början och slut, precis som råvaruigenkänningen.
Det gör att "fläsk" fångar både "Fläskytterfilé" och "Bacon/Stekfläsk" — vilket
är rätt, för bacon är fläsk — men också att ett kort ord tar med mer än man
tror.

**En uteslutning får bestå av flera ord, och då måste alla finnas i
erbjudandet.** Det är skillnaden mellan att välja bort en råvara och att välja
bort ett visst utförande av den: `kyckling` stoppar all kyckling, medan
`färsk kyckling` lämnar den frysta kvar. Ordföljden spelar ingen roll.

Både rubriken och beskrivningen läses. Det är nödvändigt, för det är i
beskrivningen butikerna skriver om varan är färsk eller fryst — rubriken
"KYCKLINGFILÉ" säger ingenting, beskrivningen "IVARS • 2 kg • Djupfryst" säger
allt. Tjeks egna `category_ids` är tomma på samtliga erbjudanden och går alltså
inte att använda.

Vissa ord räknas som samma sak. **Kyld och färsk är samma tillstånd** för kött
och kyckling — butikerna väljer ord olika, och den som utesluter det ena menar
båda. Detsamma gäller fryst och djupfryst. Synonymerna står i
[food-exclusions.ts](src/app/core/food-exclusions.ts).

Priset för att beskrivningen läses är att den också nämner sådant som inte är
varan — märke, ursprung, jämförpris — så en uteslutning kan träffa bredare än
man tänkt. Att utesluta för mycket är dock det säkra felet när skälet är en
allergi.

## Tid att laga

Mellan kedjorna och recepten står tre kryssrutor på rad: `< 30`, `30–60` och
`> 60` minuter. Enheten står i rubriken så att rutorna kan hållas korta nog att
rymmas bredvid varandra på en telefon. Uppläst är de utskrivna — "< 30" säger
ingenting i en skärmläsare — och varje ruta visar hur många av de hittade
recepten den rymmer.

Tiden kommer från receptkällans `totalDuration`, som anges i sekunder. Källan
skriver 0 när receptet saknar tidsuppgift, och noll minuter vore en lögn, så
det blir null i appen. **Recept utan tid visas bara när alla tre rutorna är
ikryssade**, alltså när man inte filtrerar på tid alls: att lägga dem i ett
spann vore att lova en tid källan inte anger, och att alltid dölja dem vore att
kasta bort recept i onödan.

Gränserna räknas uppåt — 30 minuter hamnar i mittenspannet, inte i det snabba.
Filtret arbetar på de redan hämtade recepten, så ett kryss syns direkt utan
nytt anrop.

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

209 test i arton filer:

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
  sammanställningen: att icke-mat sållas bort, att kedjelistan byggs på
  butikerna och inte på erbjudandena, att en kedja med erbjudanden men utan
  butik i närheten inte listas, och att den närmaste av flera butiker ger
  avståndet.
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
  betygsgränsen och röstgränsen med sina gränsfall, att icke-mat aldrig ens
  slås upp, termrangordningen med sina
  gränsfall ("smörgåsgurka" är inte smör), att en vara räknas en gång även när
  receptet taggats med flera av dess termer, att recepten varvas över varorna,
  och att bara de behållna receptens bilder hämtas.
- **[recipe-list.component.spec.ts](src/app/components/recipe-list.component.spec.ts)**
  täcker fem recept i taget och att korten länkar ut med `rel="noopener"`.
- **[food-exclusions.spec.ts](src/app/core/food-exclusions.spec.ts)** täcker
  uteslutningarna: att ordet fångas i början och slutet av ett sammansatt
  varunamn, att det matchar via råvaran när rubriken stavar annorlunda, att en
  fras kräver alla sina ord, att färskt och fryst läses ur beskrivningen med
  riktiga butikstexter som underlag — "färsk kyckling" stoppar KYCKLINGSTEAK
  men inte den djupfrysta KYCKLINGFILÉ — och att samma vara inte kan läggas
  till två gånger.
- **[cooking-time.spec.ts](src/app/core/cooking-time.spec.ts)** täcker
  tidsspannen: att gränserna räknas uppåt, att flera spann kan visas samtidigt,
  och att recept utan tidsuppgift försvinner så fort man börjar filtrera.
- **[cooking-time-filter.component.spec.ts](src/app/components/cooking-time-filter.component.spec.ts)**
  täcker rutan: de korta etiketterna, enheten i rubriken, antalet per spann och
  att den upplästa etiketten är utskriven.
- **[seasons.spec.ts](src/app/core/seasons.spec.ts)** täcker säsongsregeln mot
  fasta datum, så att testerna inte beror på när de körs: att julen sållas bort
  i augusti men inte i december, att kräftskivan är omvänt, och att "sallad i
  juli", "julienneskurna grönsaker" och "knäckebröd" inte förväxlas med
  högtider.
- **[origin.spec.ts](src/app/core/origin.spec.ts)** täcker svenskmärkningen,
  vilka råvaror som räknas som kött, att kött utan ursprungsuppgift räknas som
  okänt och inte som svenskt, och att fisk och grönsaker släpps igenom oavsett.
- **[settings-menu.component.spec.ts](src/app/components/settings-menu.component.spec.ts)**
  täcker menyn: att den är en dialog, att den stängs på tre sätt, att fokus
  hamnar på panelen och inte i fältet, att köttfiltret speglas och skickas
  vidare åt båda hållen, och att ett halvskrivet fält töms när menyn öppnas på
  nytt.
- **[app.component.spec.ts](src/app/app.component.spec.ts)** kör appen med
  stoppade tjänster och kontrollerar det som knyter ihop den: att en urkryssad
  kedja försvinner ur listan, att en favorit lyfts överst och kryssas i, att
  precis favoriterna är ikryssade efter en omstart medan ett tillfälligt kryss
  inte är det, och att ett nekat platstillstånd leder till ortssökningen i
  stället för till en död skärm.

## Design

Paletten är varm och matglad, inte neutral. En receptapp ska göra en sugen på
att laga något, och ett grått gränssnitt gör inte den saken.

Grunden är gräddvit med en mjuk glöd av saffran och tomat i toppen, texten
mörkbrun i stället för grafit, och accenterna hämtade ur maten själv: tomat för
knappar och val, saffran för betyg, örtgrönt för det snabba och bär för den
andra receptkällan. Färgen sitter i accenterna och inte i ytorna, så att
receptbilderna får vara det som lyser.

Färgen bär också information i stället för att bara dekorera:

- **Kedjornas kryssrutor** fylls med kedjans egen färg, så Coops gröna och
  Willys röda syns direkt i listan.
- **Tidsspannen** har varsin färg — grönt för vardagsmat, saffran för en vanlig
  middag, tomat för långkok — men bara när spannet är valt, annars blir raden
  en tavla av kulörer.
- **Receptkällan** har sin egen ton: tomat för Tasteline, bär för Zeta.
- **Priset** på reavaran är det enda i rött i receptkortet, eftersom det är
  fyndet man är där för.

Receptbilderna ligger i 92 px i stället för 64, och rubrikerna klipps till två
rader så att korten blir lika höga. Ytorna är fortfarande ljusa och linjerna
hårfina — det är accenterna som fått färg, inte bakgrunden.

### Typsnitt

Tre nivåer, med olika uppgifter:

| Nivå | Typsnitt | Var |
| --- | --- | --- |
| Störst | **Permanent Marker** | Ortnamnet, inställningsmenyns titel |
| Rubriker | **Commissioner** | Recepttitlarna, "PLATS", "KEDJOR NÄRA DIG", "LAGA AV VECKANS REA" |
| Allt annat | Systemfonten | Brödtext, priser och siffror |

Markörfonten är för tung för brödtext och för siffror. Commissioner är vald för
att den är smal och lågkontrastig, håller ihop även spärrad i versaler och
fungerar lika bra i en recepttitel som i en etikett — det är den som knyter
ihop korten med kortrubrikerna. Systemfonten får bära brödtext och siffror, där
den redan gör sitt jobb och inte kostar något att ladda.

Fonterna ligger i [src/assets/fonts](src/assets/fonts) i stället för att länkas
från Google. En app som ska öppnas från hemskärmen ska inte behöva vänta på ett
anrop till en tredje part för att kunna rita sina rubriker, och den ska fungera
utan nät — filerna ligger därför i service workerns appskal och laddas med
resten. Licenserna tillåter det. `font-display: swap` gör att rubrikerna visas
i systemfonten tills fonterna laddat, i stället för att vara osynliga.

Bara den latinska delmängden hämtas. Appen är på svenska, och de kyrilliska,
grekiska och vietnamesiska snitten skulle femdubbla vikten utan att någonsin
ritas. Tillsammans väger de två fonterna 66 kB.

Uppdatera fonterna med:

```bash
sh tools/fetch-font.sh
```

## Publicera till GitHub Pages

```bash
python tools/build-pages.py
```

Skriptet bygger appen med rätt base href till `docs/`, som GitHub Pages
serverar. Committa och pusha sedan som vanligt — det blir en enda push,
eftersom bygget ligger på samma gren som källkoden.

Första gången behöver GitHub ställas in: **Settings → Pages → Source: Deploy
from a branch**, gren `main`, mapp `/docs`. Appen hamnar på
`https://<användare>.github.io/RabattRecept/`. Pages kräver att repot är
publikt, om man inte betalar för planen.

Adressen är skiftlägeskänslig: `/RabattRecept/` fungerar, `/rabattrecept/` ger
404. Det går inte att ändra — det sitter i GitHubs servrar och följer
reponamnet. Lägg appen på hemskärmen en gång med rätt adress, då är det en
engångssak.

Tre saker som måste stämma, och som skriptet sköter:

- **Base href.** Pages serverar projektet i en underkatalog, så appen byggs med
  `--base-href /RabattRecept/`. Utan det pekar alla tillgångar fel. Service
  workern följer med automatiskt: `ngsw.json` får samma prefix.
- **`.nojekyll`.** Utan den filen kör Pages allt genom Jekyll först, som
  hoppar över filer och kataloger som börjar med understreck. Den skrivs efter
  bygget, eftersom bygget tömmer katalogen.
- **Bygg inte för hand i Git Bash.** MSYS översätter argument som ser ut som
  sökvägar, så `--base-href /RabattRecept/` blir
  `C:/Program Files/Git/RabattRecept/` och appen får en base href som pekar rakt
  ut i tomma intet. Skriptet anropar npx utan skal och undgår det.

Att bygget ligger i `docs/` i stället för på en egen `gh-pages`-gren är ett
medvetet val: det syns i varje diff, men ger en enda gren och en enda push. I
ett litet projekt med en utvecklare är en ren pushrutin värd mer än en ren diff.

Appen fungerar bra på Pages i övrigt: den har ingen router och behöver därför
ingen 404-omskrivning, och Pages serverar över HTTPS, vilket både geolocation
och service workern kräver.

Det finns inget CI-workflow. Ett sådant provades i systerprojektet
WeatherClothing men gick inte att få grönt på GitHub-runnern, och ett trasigt
workflow som körs vid varje push ger bara röda kryss utan nytta.

## Ikoner

```bash
python tools/generate-icons.py
```

Skriptet ritar ikonerna och `favicon.ico` från grunden, utan beroenden utöver
Pythons standardbibliotek. Motivet är ett procenttecken där snedstrecket är en
gaffel, i gräddvitt mot en varm övergång från saffran till tomat — appens egna
accentfärger, så att ikonen på hemskärmen ser ut som det man möts av när man
öppnar den. Appen handlar om att laga mat av rean, så ikonen säger båda
sakerna: procenten känns igen på avstånd, gaffeln på nära håll.

Piggarna är tjocka och glesa med flit. Ritas de smalare blir de en enda klump
när ikonen krymper till 48 px på hemskärmen, och då försvinner hela poängen —
det är i den storleken ikonen ska fungera, inte i 1024.

## Att veta om datakällan

Erbjudandena kommer från butikernas reklamblad, inte från kassasystemen. Priser
och giltighet kan skilja sig mellan butiker i samma kedja, och ordinarie pris
saknas för de flesta erbjudanden — då visas bara priset, utan påhittad
rabattsiffra. API:et är öppet men odokumenterat; går det sönder är det
[`TjekService`](src/app/core/tjek.service.ts) och mappningen i
[`OffersService`](src/app/core/offers.service.ts) som behöver ses över.

Receptmatchningen är en gissning, inte en varukoppling. Appen vet inte att
butikens "Kycklinglårfilé" och Tastelines "Kyckling" är samma sak i annat än
namnet, så ett recept kan råka föreslås på fel vara. Betygen är Tastelines egna
besökarbetyg; appen kräver minst fem röster, och antalet står i listan så att
man kan väga in det själv därutöver.
