import { COOKING_TIME_BANDS, CookingTimeBand, bandFor, withinCookingTime } from './cooking-time';
import { Recipe } from './recipes.models';

function recipe(id: number, durationMinutes: number | null): Recipe {
  return {
    id,
    title: `Recept ${id}`,
    url: `https://www.tasteline.com/recept/${id}/`,
    rating: 4.5,
    votes: 10,
    durationMinutes,
    image: null,
    matches: [
      {
        ingredient: 'Kyckling',
        offerHeading: 'Kycklinglårfilé',
        chainName: 'Willys',
        price: 49,
        currency: 'SEK',
      },
    ],
  };
}

const ALLA = new Set<CookingTimeBand>(COOKING_TIME_BANDS.map((band) => band.id));

describe('bandFor', () => {
  it('lägger korta recept i det snabba spannet', () => {
    expect(bandFor(recipe(1, 15))).toBe('snabbt');
    expect(bandFor(recipe(2, 29))).toBe('snabbt');
  });

  it('räknar gränsen uppåt, inte nedåt', () => {
    expect(bandFor(recipe(1, 30))).toBe('lagom');
    expect(bandFor(recipe(2, 59))).toBe('lagom');
    expect(bandFor(recipe(3, 60))).toBe('långkok');
  });

  it('har inget tak uppåt', () => {
    expect(bandFor(recipe(1, 210))).toBe('långkok');
  });

  it('svarar null när tiden inte är angiven', () => {
    expect(bandFor(recipe(1, null))).toBeNull();
  });
});

describe('withinCookingTime', () => {
  it('visar allt när alla spann är ikryssade', () => {
    const recipes = [recipe(1, 15), recipe(2, 45), recipe(3, 120), recipe(4, null)];

    expect(withinCookingTime(recipes, ALLA).length).toBe(4);
  });

  it('visar bara det ikryssade spannet', () => {
    const recipes = [recipe(1, 15), recipe(2, 45), recipe(3, 120)];

    expect(withinCookingTime(recipes, new Set(['lagom'])).map((r) => r.id)).toEqual([2]);
  });

  it('kan visa flera spann samtidigt', () => {
    const recipes = [recipe(1, 15), recipe(2, 45), recipe(3, 120)];

    expect(withinCookingTime(recipes, new Set(['snabbt', 'långkok'])).map((r) => r.id)).toEqual([
      1, 3,
    ]);
  });

  it('döljer recept utan tid så fort man filtrerar', () => {
    // Att lägga dem i ett spann vore att lova en tid källan inte anger.
    const recipes = [recipe(1, 15), recipe(2, null)];

    expect(withinCookingTime(recipes, new Set(['snabbt'])).map((r) => r.id)).toEqual([1]);
  });

  it('visar inget när inget spann är ikryssat', () => {
    const recipes = [recipe(1, 15), recipe(2, null)];

    expect(withinCookingTime(recipes, new Set())).toEqual([]);
  });

  it('behåller ordningen', () => {
    const recipes = [recipe(3, 120), recipe(1, 15), recipe(2, 45)];

    expect(withinCookingTime(recipes, ALLA).map((r) => r.id)).toEqual([3, 1, 2]);
  });
});
