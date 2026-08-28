import { filterOffers } from './offer-filter';
import { Offer } from './offers.models';

function offer(partial: Partial<Offer> & Pick<Offer, 'id' | 'chainId'>): Offer {
  return {
    chainName: 'Willys',
    heading: 'Kaffe',
    description: '',
    price: 49,
    prePrice: null,
    currency: 'SEK',
    discount: null,
    image: null,
    validUntil: '2026-08-30T21:59:59+0000',
    ...partial,
  };
}

const all = new Set(['a', 'b']);

describe('filterOffers', () => {
  it('visar bara erbjudanden från ikryssade kedjor', () => {
    const offers = [offer({ id: '1', chainId: 'a' }), offer({ id: '2', chainId: 'b' })];

    expect(filterOffers(offers, { chainIds: new Set(['a']), query: '', sort: 'price' })).toEqual([
      offers[0],
    ]);
  });

  it('visar inget när ingen kedja är ikryssad', () => {
    const offers = [offer({ id: '1', chainId: 'a' })];

    expect(filterOffers(offers, { chainIds: new Set(), query: '', sort: 'price' })).toEqual([]);
  });

  it('söker utan hänsyn till versaler och diakriter', () => {
    const offers = [
      offer({ id: '1', chainId: 'a', heading: 'Nötfärs' }),
      offer({ id: '2', chainId: 'a', heading: 'Kaffe' }),
    ];

    const hits = filterOffers(offers, { chainIds: all, query: 'NOTFARS', sort: 'price' });

    expect(hits.map((hit) => hit.id)).toEqual(['1']);
  });

  it('söker även i beskrivningen och kedjenamnet', () => {
    const offers = [
      offer({ id: '1', chainId: 'a', heading: 'Bröd', description: 'Pågen jättefranska' }),
      offer({ id: '2', chainId: 'b', chainName: 'Hemköp', heading: 'Ost' }),
    ];

    expect(filterOffers(offers, { chainIds: all, query: 'pågen', sort: 'price' })[0].id).toBe('1');
    expect(filterOffers(offers, { chainIds: all, query: 'hemköp', sort: 'price' })[0].id).toBe('2');
  });

  it('sorterar lägsta pris först', () => {
    const offers = [
      offer({ id: 'dyr', chainId: 'a', price: 99 }),
      offer({ id: 'billig', chainId: 'a', price: 19 }),
    ];

    expect(
      filterOffers(offers, { chainIds: all, query: '', sort: 'price' }).map((hit) => hit.id)
    ).toEqual(['billig', 'dyr']);
  });

  it('sorterar störst rabatt först och lägger erbjudanden utan rabatt sist', () => {
    const offers = [
      offer({ id: 'utan', chainId: 'a', discount: null }),
      offer({ id: 'liten', chainId: 'a', discount: 0.1 }),
      offer({ id: 'stor', chainId: 'a', discount: 0.5 }),
    ];

    expect(
      filterOffers(offers, { chainIds: all, query: '', sort: 'discount' }).map((hit) => hit.id)
    ).toEqual(['stor', 'liten', 'utan']);
  });
});
