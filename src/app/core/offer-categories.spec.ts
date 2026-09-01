import { CATEGORY_ORDER, OTHER, byCategory, categoryFor } from './offer-categories';
import { Offer } from './offers.models';

function offer(heading: string, description = ''): Offer {
  return {
    id: heading,
    chainId: 'willys',
    chainName: 'Willys',
    heading,
    description,
    price: 10,
    prePrice: null,
    currency: 'SEK',
    discount: null,
    image: null,
    validUntil: '2099-01-01T00:00:00+0000',
  };
}

describe('categoryFor', () => {
  it('placerar råvarorna där man letar efter dem', () => {
    expect(categoryFor('Kycklinglårfilé')).toBe('Kyckling & fågel');
    expect(categoryFor('Färsk laxfilé')).toBe('Fisk & skaldjur');
    expect(categoryFor('Blandfärs 800g')).toBe('Kött & chark');
    expect(categoryFor('Ägg 15-pack')).toBe('Mejeri & ägg');
    expect(categoryFor('Svenska morötter')).toBe('Frukt & grönt');
    expect(categoryFor('SKOGAHOLMSLIMPA')).toBe('Bröd & bageri');
    expect(categoryFor('Toalettpapper 6-pack')).toBe('Hem & hushåll');
  });

  it('låter den sammansatta rätten gå före sin råvara', () => {
    // En kycklingpizza hör hemma bland färdigmaten, inte bland fågeln.
    expect(categoryFor('Pan Pizza med kyckling')).toBe('Färdigmat');
    expect(categoryFor('Ostbågar 200g')).toBe('Fika & godis');
  });

  it('låter brödet vinna över pålägget, för en smörgås är bröd', () => {
    expect(categoryFor('Baguetter med smör')).toBe('Bröd & bageri');
    expect(categoryFor('Croissant med kalkonkorv')).toBe('Bröd & bageri');
  });

  it('räknar inte köttbullar som fika, trots att de slutar på bullar', () => {
    expect(categoryFor('Köttbullar 1kg')).toBe('Kött & chark');
    expect(categoryFor('Fiskbullar i hummersås')).toBe('Fisk & skaldjur');
    expect(categoryFor('Kanelbullar 6-pack')).toBe('Fika & godis');
  });

  it('går inte på ord som bara råkar innehålla en stam', () => {
    // "färsk" börjar på "färs", "filé" på "fil", och gris slutar på "ris".
    expect(categoryFor('Färsk basilika')).toBe('Frukt & grönt');
    expect(categoryFor('Fläskfilé')).toBe('Kött & chark');
    expect(categoryFor('Grisköttfärs')).toBe('Kött & chark');
    expect(categoryFor('Korvbröd 8-pack')).toBe('Bröd & bageri');
  });

  it('faller tillbaka på beskrivningen när rubriken bara är ett varumärke', () => {
    expect(categoryFor('ZOÉGAS', 'Bryggkaffe, 450g')).toBe('Fika & godis');
  });

  it('lägger det oplacerbara i Övrigt, sist av allt', () => {
    expect(categoryFor('Krysantemum')).toBe(OTHER);
    expect(CATEGORY_ORDER[CATEGORY_ORDER.length - 1]).toBe(OTHER);
  });
});

describe('byCategory', () => {
  it('grupperar i kategoriordning, inte i den ordning varorna kom', () => {
    const grupper = byCategory([
      offer('Bananer'),
      offer('Nötfärs'),
      offer('Klippt gurka'),
      offer('Pizza Ristorante'),
    ]);

    expect(grupper.map((group) => group.name)).toEqual([
      'Färdigmat',
      'Kött & chark',
      'Frukt & grönt',
    ]);
    expect(grupper[2].offers.map((entry) => entry.heading)).toEqual(['Bananer', 'Klippt gurka']);
  });

  it('utelämnar kategorier utan varor', () => {
    expect(byCategory([offer('Bananer')]).map((group) => group.name)).toEqual(['Frukt & grönt']);
  });

  it('behåller ordningen varorna kom i inom kategorin, alltså störst rabatt först', () => {
    const grupper = byCategory([offer('Nötfärs'), offer('Fläskfilé'), offer('Bacon')]);

    expect(grupper[0].offers.map((entry) => entry.heading)).toEqual([
      'Nötfärs',
      'Fläskfilé',
      'Bacon',
    ]);
  });

  it('tar hand om en tom lista', () => {
    expect(byCategory([])).toEqual([]);
  });
});
