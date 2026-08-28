import { isMeatOffer, isSwedish, onlySwedishMeat } from './origin';
import { Offer } from './offers.models';

function offer(heading: string, description = ''): Offer {
  return {
    id: heading,
    chainId: 'a',
    chainName: 'Willys',
    heading,
    description,
    price: 20,
    prePrice: null,
    currency: 'SEK',
    discount: null,
    image: null,
    validUntil: '2099-01-01T00:00:00+0000',
  };
}

describe('isSwedish', () => {
  it('känner igen svenskmärkning i rubriken', () => {
    expect(isSwedish(offer('Svensk nötfärs'))).toBeTrue();
    expect(isSwedish(offer('Svenskt smör'))).toBeTrue();
  });

  it('känner igen ursprungsangivelser i beskrivningen', () => {
    expect(isSwedish(offer('Kycklingsteak', 'Kronfågel. Ursprung Sverige. Ca 900 g.'))).toBeTrue();
    expect(isSwedish(offer('Färsk kycklingfilé', 'Sverige/Guldfågeln. Kyld.'))).toBeTrue();
  });

  it('svarar nej när ett annat ursprung anges', () => {
    expect(isSwedish(offer('Nötfärs', 'Hacksta köttdisk. Ursprung Irland/UK.'))).toBeFalse();
  });

  it('svarar nej när ursprunget inte nämns alls', () => {
    expect(isSwedish(offer('KYCKLINGDETALJER', 'KRONFÅGEL • 450 g'))).toBeFalse();
  });
});

describe('isMeatOffer', () => {
  it('räknar kött, chark och fågel som kött', () => {
    expect(isMeatOffer(offer('Kycklinglårfilé'))).toBeTrue();
    expect(isMeatOffer(offer('Fläskytterfilé'))).toBeTrue();
    expect(isMeatOffer(offer('Blandfärs'))).toBeTrue();
    expect(isMeatOffer(offer('Falukorv'))).toBeTrue();
    expect(isMeatOffer(offer('Bacon/Stekfläsk'))).toBeTrue();
  });

  it('räknar inte fisk, ägg eller vegetariskt som kött', () => {
    expect(isMeatOffer(offer('Laxloin'))).toBeFalse();
    expect(isMeatOffer(offer('STORA RÄKOR I LAKE'))).toBeFalse();
    expect(isMeatOffer(offer('Ägg 15-pack'))).toBeFalse();
    expect(isMeatOffer(offer('Halloumi'))).toBeFalse();
  });

  it('räknar inte varor som inte är någon huvudråvara alls', () => {
    expect(isMeatOffer(offer('Svenskt smör'))).toBeFalse();
    expect(isMeatOffer(offer('Toalettpapper 12-pack'))).toBeFalse();
  });
});

describe('onlySwedishMeat', () => {
  it('kräver svenskmärkning av kött', () => {
    const offers = [
      offer('Svensk nötfärs'),
      offer('Nötfärs', 'Ursprung Irland/UK.'),
      offer('KYCKLINGDETALJER', 'KRONFÅGEL • 450 g'),
    ];

    expect(onlySwedishMeat(offers).map((entry) => entry.heading)).toEqual(['Svensk nötfärs']);
  });

  it('släpper igenom allt som inte är kött, oavsett ursprung', () => {
    // Ursprunget står sällan utskrivet på annat än kött, så ett krav där hade
    // tagit bort nästan allt utan att säga något om varorna.
    const offers = [
      offer('Laxloin', 'Kyld. Ca 500 g.'),
      offer('Ägg 15-pack'),
      offer('Halloumi'),
      offer('Svenskt smör'),
    ];

    expect(onlySwedishMeat(offers).length).toBe(4);
  });

  it('behåller ordningen', () => {
    const offers = [offer('Laxloin'), offer('Nötfärs', 'Irland'), offer('Svensk kyckling')];

    expect(onlySwedishMeat(offers).map((entry) => entry.heading)).toEqual([
      'Laxloin',
      'Svensk kyckling',
    ]);
  });
});
