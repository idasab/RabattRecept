import { addExclusion, isExcluded, removeExclusion, withoutExcluded } from './food-exclusions';
import { Offer } from './offers.models';

function offer(heading: string): Offer {
  return {
    id: heading,
    chainId: 'a',
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

describe('isExcluded', () => {
  it('släpper igenom allt när inget är uteslutet', () => {
    expect(isExcluded(offer('Fläskytterfilé'), [])).toBeFalse();
  });

  it('stoppar varan när ordet finns i rubriken', () => {
    expect(isExcluded(offer('Fläskytterfilé'), ['fläsk'])).toBeTrue();
    expect(isExcluded(offer('Kycklinglårfilé'), ['kyckling'])).toBeTrue();
  });

  it('stoppar varan när ordet sitter sist i ett sammansatt namn', () => {
    expect(isExcluded(offer('Blandfärs'), ['färs'])).toBeTrue();
  });

  it('stoppar varan via råvaran även när rubriken stavar annorlunda', () => {
    // Rubriken säger "Laxloin", uteslutningen säger "lax".
    expect(isExcluded(offer('Laxloin'), ['lax'])).toBeTrue();
    // Rubriken säger inget om räkor i klartext, men råvaran heter Räkor.
    expect(isExcluded(offer('STORA RÄKOR I LAKE'), ['räkor'])).toBeTrue();
  });

  it('bryr sig varken om versaler eller diakriter', () => {
    expect(isExcluded(offer('FLÄSKKARRÉ'), ['flask'])).toBeTrue();
    expect(isExcluded(offer('Fläskkarré'), ['FLÄSK'])).toBeTrue();
  });

  it('låter obesläktade varor passera', () => {
    expect(isExcluded(offer('Kycklinglårfilé'), ['fläsk', 'lax'])).toBeFalse();
  });

  it('struntar i tomma rader i listan', () => {
    expect(isExcluded(offer('Kycklinglårfilé'), ['', '   '])).toBeFalse();
  });

  it('kräver att alla ord finns när uteslutningen är en fras', () => {
    // Poängen: välja bort ett visst utförande av råvaran, inte råvaran.
    expect(isExcluded(offer('Färsk kycklingfilé'), ['färsk kycklingfilé'])).toBeTrue();
    expect(isExcluded(offer('Fryst kycklingfilé'), ['färsk kycklingfilé'])).toBeFalse();
  });

  it('bryr sig inte om ordföljden i frasen', () => {
    expect(isExcluded(offer('Kycklingfilé, färsk'), ['färsk kycklingfilé'])).toBeTrue();
  });

  it('låter en fras vara mer tillåtande än ett ensamt ord', () => {
    const fryst = offer('Fryst kycklingfilé');

    expect(isExcluded(fryst, ['kyckling'])).toBeTrue();
    expect(isExcluded(fryst, ['färsk kyckling'])).toBeFalse();
  });
});

describe('withoutExcluded', () => {
  it('tar bort de uteslutna och behåller ordningen', () => {
    const offers = [offer('Kycklinglårfilé'), offer('Fläskytterfilé'), offer('Laxloin')];

    expect(withoutExcluded(offers, ['fläsk']).map((entry) => entry.heading)).toEqual([
      'Kycklinglårfilé',
      'Laxloin',
    ]);
  });
});

describe('addExclusion', () => {
  it('lägger till och trimmar', () => {
    expect(addExclusion([], '  fläsk  ')).toEqual(['fläsk']);
  });

  it('lägger inte till samma vara två gånger', () => {
    expect(addExclusion(['Fläsk'], 'fläsk')).toEqual(['Fläsk']);
    expect(addExclusion(['Fläsk'], 'FLASK')).toEqual(['Fläsk']);
  });

  it('lägger inte till tomma rader', () => {
    expect(addExclusion(['fläsk'], '   ')).toEqual(['fläsk']);
  });

  it('behåller skiftläget som det skrevs', () => {
    expect(addExclusion([], 'Fläskfilé')).toEqual(['Fläskfilé']);
  });
});

describe('removeExclusion', () => {
  it('tar bort oavsett skiftläge', () => {
    expect(removeExclusion(['Fläsk', 'Lax'], 'fläsk')).toEqual(['Lax']);
  });

  it('lämnar listan i fred när varan inte finns', () => {
    expect(removeExclusion(['Fläsk'], 'kyckling')).toEqual(['Fläsk']);
  });
});
