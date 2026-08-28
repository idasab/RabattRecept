import { Offer } from './offers.models';

export type OfferSort = 'discount' | 'price';

export interface OfferFilter {
  /** Kedjorna som är ikryssade. Tom mängd betyder att inget ska visas. */
  chainIds: ReadonlySet<string>;
  /** Fritext mot rubrik och beskrivning. Tom sträng släpper igenom allt. */
  query: string;
  sort: OfferSort;
}

/**
 * Erbjudandena som ska visas. Hämtningen görs en gång per plats och radie;
 * kryssrutorna och sökfältet arbetar sedan på den redan hämtade listan, så
 * att en ändrad kryssruta syns direkt utan nytt nätverksanrop.
 */
export function filterOffers(offers: readonly Offer[], filter: OfferFilter): Offer[] {
  const needle = normalize(filter.query);

  const matching = offers.filter(
    (offer) =>
      filter.chainIds.has(offer.chainId) && (!needle || haystackOf(offer).includes(needle))
  );

  return matching.sort(comparatorFor(filter.sort));
}

function comparatorFor(sort: OfferSort): (a: Offer, b: Offer) => number {
  if (sort === 'price') {
    return (a, b) => a.price - b.price || a.heading.localeCompare(b.heading, 'sv');
  }

  // Erbjudanden utan ordinarie pris går inte att rangordna efter rabatt, så de
  // hamnar sist i stället för att räknas som noll procent bland de sämsta.
  return (a, b) =>
    (b.discount ?? -1) - (a.discount ?? -1) || a.heading.localeCompare(b.heading, 'sv');
}

function haystackOf(offer: Offer): string {
  return normalize(`${offer.heading} ${offer.description} ${offer.chainName}`);
}

/** Gemener och utan diakriter, så att "kott" hittar "kött". */
function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}
