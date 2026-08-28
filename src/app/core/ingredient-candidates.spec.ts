import { candidatesFor, ingredientCandidates } from './ingredient-candidates';
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

describe('candidatesFor', () => {
  it('tar hela varunamnet och dess huvudord', () => {
    // Huvudordet sitter sist på svenska: "röd paprika" är paprika.
    expect(candidatesFor('Röd paprika')).toEqual(['röd paprika', 'paprika']);
  });

  it('faller tillbaka på huvudordet när resten är skyltord', () => {
    expect(candidatesFor('Svenskt smör')).toEqual(['smör']);
  });

  it('ger bara en sökterm när varunamnet är ett ord', () => {
    expect(candidatesFor('Nötfärs')).toEqual(['nötfärs']);
  });

  it('kapar villkorstexten efter varunamnet', () => {
    expect(candidatesFor('PEPSI SUITCASE – MAX 2 KÖP/KUND')).toEqual(['pepsi suitcase', 'suitcase']);
    expect(candidatesFor('Kycklinglårfilé, Sverige/Kronfågel')[0]).toBe('kycklinglårfilé');
  });

  it('tar bort förpackningsstorlekar', () => {
    expect(candidatesFor('Läsk 20-pack')).toEqual(['läsk']);
    expect(candidatesFor('Toapapper 8-pack')).toEqual(['toapapper']);
  });

  it('tar bort skyltord som inte hör till varan', () => {
    expect(candidatesFor('Färsk kyckling max 3 köp')).toEqual(['kyckling']);
  });

  it('kortar ner en hel mening till slutet, där huvudordet sitter', () => {
    expect(candidatesFor('Stora fina saftiga svenska jordgubbar')[0]).toBe('fina saftiga jordgubbar');
  });

  it('svarar tomt på rubriker utan användbara ord', () => {
    // Prisskyltning utan varunamn får inte bli söktermen "för".
    expect(candidatesFor('2 för 40')).toEqual([]);
    expect(candidatesFor('')).toEqual([]);
  });

  it('tar bort småord inne i varunamnet', () => {
    expect(candidatesFor('Kyckling med curry')).toEqual(['kyckling curry', 'curry']);
  });
});

describe('ingredientCandidates', () => {
  it('behåller erbjudandet som gav söktermen', () => {
    const nötfärs = offer('1', 'Nötfärs');

    const [candidate] = ingredientCandidates([nötfärs], 5);

    expect(candidate.term).toBe('nötfärs');
    expect(candidate.offer).toBe(nötfärs);
  });

  it('tar bort dubbletter och behåller det första erbjudandet', () => {
    const first = offer('1', 'Nötfärs');
    const second = offer('2', 'Nötfärs');

    const candidates = ingredientCandidates([first, second], 5);

    expect(candidates.length).toBe(1);
    expect(candidates[0].offer).toBe(first);
  });

  it('kapar listan vid gränsen', () => {
    const offers = [offer('1', 'Nötfärs'), offer('2', 'Kyckling'), offer('3', 'Lax')];

    expect(ingredientCandidates(offers, 2).map((entry) => entry.term)).toEqual([
      'nötfärs',
      'kyckling',
    ]);
  });

  it('behåller erbjudandenas ordning, alltså störst rabatt först', () => {
    const offers = [offer('1', 'Lax'), offer('2', 'Nötfärs')];

    expect(ingredientCandidates(offers, 5).map((entry) => entry.term)).toEqual(['lax', 'nötfärs']);
  });
});
