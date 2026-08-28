import { isSwedish, onlySwedishOffers } from './origin';
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
    expect(isSwedish(offer('Svenska tomater'))).toBeTrue();
  });

  it('känner igen ursprungsangivelser i beskrivningen', () => {
    expect(isSwedish(offer('Kycklingsteak', 'Kronfågel. Ursprung Sverige. Ca 900 g.'))).toBeTrue();
    expect(isSwedish(offer('Färsk kycklingfilé', 'Sverige/Guldfågeln. Kyld.'))).toBeTrue();
  });

  it('bryr sig inte om versaler', () => {
    expect(isSwedish(offer('SVENSK KYCKLINGFILÉ'))).toBeTrue();
  });

  it('svarar nej när ett annat ursprung anges', () => {
    expect(isSwedish(offer('Nötfärs', 'Hacksta köttdisk. Ursprung Irland/UK.'))).toBeFalse();
  });

  it('svarar nej när ursprunget inte nämns alls', () => {
    // De flesta erbjudanden säger ingenting. De är okända, inte utländska —
    // men filtret svarar på vad vi vet, inte på vad vi gissar.
    expect(isSwedish(offer('KYCKLINGDETALJER', 'KRONFÅGEL • 450 g'))).toBeFalse();
  });
});

describe('onlySwedishOffers', () => {
  it('behåller bara de svenskmärkta, i ordning', () => {
    const offers = [
      offer('Svensk nötfärs'),
      offer('Nötfärs', 'Ursprung Irland/UK.'),
      offer('Kycklingsteak', 'Ursprung Sverige.'),
    ];

    expect(onlySwedishOffers(offers).map((entry) => entry.heading)).toEqual([
      'Svensk nötfärs',
      'Kycklingsteak',
    ]);
  });
});
