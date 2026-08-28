import { ingredientCandidates } from './ingredient-candidates';
import { Offer } from './offers.models';

function offer(id: string, heading: string, chainId = 'a'): Offer {
  return {
    id,
    chainId,
    chainName: 'Willys',
    heading,
    description: '',
    price: 20,
    prePrice: null,
    currency: 'SEK',
    discount: null,
    image: null,
    validUntil: '2099-01-01T00:00:00+0000',
  };
}

describe('ingredientCandidates', () => {
  it('behåller erbjudandet som gav söktermen', () => {
    const kyckling = offer('1', 'Kycklinglårfilé');

    const [candidate] = ingredientCandidates([kyckling], 5);

    expect(candidate.term).toBe('Kyckling');
    expect(candidate.offer).toBe(kyckling);
  });

  it('hoppar över allt som inte är en huvudråvara', () => {
    const offers = [
      offer('1', 'Svenskt smör'),
      offer('2', 'Toalettpapper 12-pack'),
      offer('3', 'Nötfärs'),
    ];

    expect(ingredientCandidates(offers, 5).map((entry) => entry.term)).toEqual(['Nötfärs']);
  });

  it('tar samma råvara en gång och behåller det första erbjudandet', () => {
    const first = offer('1', 'KYCKLINGFILÉ');
    const second = offer('2', 'Kycklinglårfilé');

    const candidates = ingredientCandidates([first, second], 5);

    expect(candidates.length).toBe(1);
    expect(candidates[0].offer).toBe(first);
  });

  it('kapar listan vid gränsen', () => {
    const offers = [offer('1', 'Nötfärs'), offer('2', 'Kyckling'), offer('3', 'Lax')];

    expect(ingredientCandidates(offers, 2).map((entry) => entry.term)).toEqual([
      'Nötfärs',
      'Kyckling',
    ]);
  });

  it('räknar bara huvudråvaror mot gränsen', () => {
    // Femton smörerbjudanden får inte äta upp utrymmet för de två råvarorna.
    const offers = [
      ...Array.from({ length: 15 }, (_, i) => offer(`s${i}`, 'Svenskt smör')),
      offer('1', 'Högrev'),
      offer('2', 'Laxloin'),
    ];

    expect(ingredientCandidates(offers, 3).map((entry) => entry.term)).toEqual(['Högrev', 'Lax']);
  });

  it('behåller erbjudandenas ordning, alltså störst rabatt först', () => {
    const offers = [offer('1', 'Laxloin'), offer('2', 'Nötfärs')];

    expect(ingredientCandidates(offers, 5).map((entry) => entry.term)).toEqual(['Lax', 'Nötfärs']);
  });

  it('svarar tomt när rean inte innehåller någon huvudråvara', () => {
    expect(ingredientCandidates([offer('1', 'Läsk 20-pack')], 5)).toEqual([]);
  });
});
