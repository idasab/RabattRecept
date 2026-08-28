import { Offer } from './offers.models';
import { normalizeText } from './text';

/**
 * Ordbörjan som gör ett erbjudande svenskmärkt. "svensk" täcker svenskt,
 * svenska och svenskproducerad; "sverige" fångar ursprungsangivelserna, som
 * skrivs "Sverige/Kronfågel" eller "Ursprung Sverige".
 */
const SWEDISH = ['svensk', 'sverige'];

/**
 * Sant när butiken själv anger varan som svensk, i rubriken eller i
 * beskrivningen.
 *
 * Notera vad det inte betyder. De allra flesta erbjudanden säger ingenting
 * alls om ursprung — i en mätning på 374 erbjudanden var 53 märkta svenska och
 * bara 6 angav ett annat ursprung. Resten är alltså okända, inte utländska.
 * Filtret svarar därför på "vad vet vi är svenskt", inte på "vad är svenskt",
 * och det är med flit: att gissa åt andra hållet vore att påstå något källan
 * inte säger.
 */
export function isSwedish(offer: Offer): boolean {
  const words = normalizeText(`${offer.heading} ${offer.description}`)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

  return SWEDISH.some((marker) => {
    const needle = normalizeText(marker);
    return words.some((word) => word.startsWith(needle));
  });
}

/** Erbjudandena som är märkta svenska. */
export function onlySwedishOffers(offers: readonly Offer[]): Offer[] {
  return offers.filter(isSwedish);
}
