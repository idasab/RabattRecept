import { isMeatIngredient, mainIngredientFor } from './main-ingredients';
import { Offer } from './offers.models';
import { normalizeText } from './text';

/**
 * Ordbörjan som gör ett erbjudande svenskmärkt. "svensk" täcker svenskt,
 * svenska och svenskproducerad; "sverige" fångar ursprungsangivelserna, som
 * skrivs "Sverige/Kronfågel" eller "Ursprung Sverige".
 */
const SWEDISH = ['svensk', 'sverige'];

/** Sant när butiken själv anger varan som svensk, i rubriken eller beskrivningen. */
export function isSwedish(offer: Offer): boolean {
  const words = normalizeText(`${offer.heading} ${offer.description}`)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

  return SWEDISH.some((marker) => {
    const needle = normalizeText(marker);
    return words.some((word) => word.startsWith(needle));
  });
}

/** Sant när erbjudandet gäller kött, chark eller fågel. */
export function isMeatOffer(offer: Offer): boolean {
  return isMeatIngredient(mainIngredientFor(offer.heading));
}

/**
 * Erbjudandena som får vara kvar när man bara vill ha svenskt kött.
 *
 * Kravet gäller bara kött, chark och fågel. För det är ursprunget nästan
 * alltid utskrivet, och det är där det spelar roll. Fisk, ägg, ost och
 * grönsaker släpps igenom oavsett, eftersom butikerna sällan skriver ut
 * ursprunget på dem — ett krav där hade tagit bort nästan allt utan att säga
 * något om varorna.
 *
 * Okänt ursprung på kött räknas som icke-svenskt, inte som svenskt. Filtret
 * svarar på vad vi vet, inte på vad vi gissar.
 */
export function onlySwedishMeat(offers: readonly Offer[]): Offer[] {
  return offers.filter((offer) => !isMeatOffer(offer) || isSwedish(offer));
}
