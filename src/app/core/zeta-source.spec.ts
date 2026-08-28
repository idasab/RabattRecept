import { TestBed } from '@angular/core/testing';
import { Observable, of } from 'rxjs';
import { Candidate } from './ingredient-candidates';
import { Offer } from './offers.models';
import { ZetaRecipe, ZetaService, ratingOf } from './zeta.service';
import { ZetaSource, usesIngredient } from './zeta-source';

function offer(id: string, heading: string, price = 20): Offer {
  return {
    id,
    chainId: 'willys',
    chainName: 'Willys',
    heading,
    description: '',
    price,
    prePrice: 40,
    currency: 'SEK',
    discount: 0.5,
    image: null,
    validUntil: '2099-01-01T00:00:00+0000',
  };
}

/** Zeta skickar betyget som färdig HTML, med summorna i attribut. */
function ratingMarkup(votes: number, points: number): string {
  return `<span class="ratings"><p><span>(${votes})</span></p><span class="stars" data-total-votes="${votes}" data-total-points="${points}"></span></span>`;
}

function zetaRecipe(
  id: number,
  title: string,
  votes: number,
  points: number,
  ingredients: string[],
  time: number | string | null = 30
): ZetaRecipe {
  return {
    id,
    link: `https://www.zeta.nu/recept/${id}/`,
    title: { rendered: title },
    zetacompat_rating: ratingMarkup(votes, points),
    zetacompat_time: time,
    zetacompat_featured_image: `https://www.zeta.nu/bild-${id}.webp`,
    zetacompat_ingridients: [
      { recipe_ingredient_row: ingredients.map((name) => ({ recipe_ingredient_name: name })) },
    ],
  };
}

function candidates(...pairs: [string, Offer][]): Candidate[] {
  return pairs.map(([term, entry]) => ({ term, offer: entry }));
}

class StubZetaService {
  results = new Map<string, ZetaRecipe[]>();
  asked: string[] = [];

  searchAll(terms: readonly string[]): Observable<Map<string, ZetaRecipe[]>> {
    this.asked = [...terms];
    return of(new Map(terms.map((term) => [term, this.results.get(term) ?? []])));
  }
}

describe('ratingOf', () => {
  it('räknar snittet ur röster och poäng', () => {
    expect(ratingOf(ratingMarkup(7, 28))).toEqual({ rating: 4, votes: 7 });
  });

  it('svarar noll när markupen saknas eller ändrats', () => {
    // Ändrar Zeta sin markup faller recepten bort på röstgränsen i stället
    // för att visas med fel betyg.
    expect(ratingOf(null)).toEqual({ rating: 0, votes: 0 });
    expect(ratingOf('<span class="stars"></span>')).toEqual({ rating: 0, votes: 0 });
  });
});

describe('usesIngredient', () => {
  it('hittar råvaran i receptets ingredienslista', () => {
    const recipe = zetaRecipe(1, 'Kycklinggryta', 10, 45, ['kycklinglårfilé', 'grädde']);

    expect(usesIngredient(recipe, 'Kyckling')).toBeTrue();
  });

  it('hittar råvaran även sist i ett sammansatt ingrediensnamn', () => {
    const recipe = zetaRecipe(1, 'Köttbullar', 10, 45, ['nötfärs', 'ägg']);

    expect(usesIngredient(recipe, 'Färs')).toBeTrue();
  });

  it('svarar nej när råvaran bara nämns i rubriken', () => {
    // Fritextsökningen träffar brett; ingredienslistan är kontrollen.
    const recipe = zetaRecipe(1, 'Tillbehör till kyckling', 10, 45, ['potatis', 'smör']);

    expect(usesIngredient(recipe, 'Kyckling')).toBeFalse();
  });
});

describe('ZetaSource', () => {
  let source: ZetaSource;
  let zeta: StubZetaService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ZetaSource, { provide: ZetaService, useClass: StubZetaService }],
    });

    source = TestBed.inject(ZetaSource);
    zeta = TestBed.inject(ZetaService) as unknown as StubZetaService;
  });

  it('söker på råvarornas namn', (done) => {
    source
      .recipesFor(candidates(['Kyckling', offer('1', 'Kycklinglårfilé')]))
      .subscribe(() => {
        expect(zeta.asked).toEqual(['Kyckling']);
        done();
      });
  });

  it('tar med recept som klarar betyg och röster', (done) => {
    zeta.results.set('Kyckling', [
      zetaRecipe(1, 'För få röster', 4, 20, ['kyckling']),
      zetaRecipe(2, 'För lågt betyg', 20, 60, ['kyckling']),
      zetaRecipe(3, 'Godkänt', 10, 45, ['kyckling']),
    ]);

    source.recipesFor(candidates(['Kyckling', offer('1', 'Kycklinglårfilé')])).subscribe((r) => {
      expect(r.map((entry) => entry.title)).toEqual(['Godkänt']);
      expect(r[0].rating).toBe(4.5);
      expect(r[0].votes).toBe(10);
      done();
    });
  });

  it('kastar träffar som inte har råvaran i ingredienslistan', (done) => {
    zeta.results.set('Kyckling', [zetaRecipe(1, 'Sallad', 10, 45, ['sallad', 'tomat'])]);

    source.recipesFor(candidates(['Kyckling', offer('1', 'Kycklinglårfilé')])).subscribe((r) => {
      expect(r).toEqual([]);
      done();
    });
  });

  it('märker receptet med sin källa och ett id som inte krockar', (done) => {
    zeta.results.set('Lax', [zetaRecipe(41650, 'Laxpasta', 10, 45, ['lax'])]);

    source.recipesFor(candidates(['Lax', offer('1', 'Laxloin')])).subscribe((r) => {
      expect(r[0].source).toBe('Zeta');
      expect(r[0].id).toBe('Zeta:41650');
      expect(r[0].url).toBe('https://www.zeta.nu/recept/41650/');
      done();
    });
  });

  it('tar tiden som den står, i minuter', (done) => {
    zeta.results.set('Lax', [
      zetaRecipe(1, 'Snabb', 10, 45, ['lax'], 15),
      zetaRecipe(2, 'Utan tid', 10, 45, ['lax'], null),
      zetaRecipe(3, 'Text', 10, 45, ['lax'], '25'),
    ]);

    source.recipesFor(candidates(['Lax', offer('1', 'Laxloin')])).subscribe((r) => {
      expect(r.map((entry) => entry.durationMinutes)).toEqual([15, null, 25]);
      done();
    });
  });

  it('räknar ett recept en gång men samlar alla dess reavaror', (done) => {
    const gryta = zetaRecipe(7, 'Gryta', 10, 45, ['kyckling', 'lax']);
    zeta.results.set('Kyckling', [gryta]);
    zeta.results.set('Lax', [gryta]);

    source
      .recipesFor(
        candidates(['Kyckling', offer('1', 'Kycklinglårfilé', 49)], ['Lax', offer('2', 'Laxloin', 79)])
      )
      .subscribe((r) => {
        expect(r.length).toBe(1);
        expect(r[0].matches.map((match) => match.ingredient)).toEqual(['Kyckling', 'Lax']);
        expect(r[0].matches.map((match) => match.price)).toEqual([49, 79]);
        done();
      });
  });

  it('kastar recept som har en utesluten ingrediens i listan', (done) => {
    zeta.results.set('Lax', [
      zetaRecipe(1, 'Laxgryta', 10, 45, ['lax', 'saffran', 'fänkål']),
      zetaRecipe(2, 'Laxpasta', 10, 45, ['lax', 'grädde']),
    ]);

    source
      .recipesFor(candidates(['Lax', offer('1', 'Laxloin')]), ['Saffran'])
      .subscribe((r) => {
        expect(r.map((entry) => entry.title)).toEqual(['Laxpasta']);
        done();
      });
  });

  it('kastar recept vars rubrik nämner det uteslutna', (done) => {
    zeta.results.set('Lax', [zetaRecipe(1, 'Laxgryta med saffran', 10, 45, ['lax'])]);

    source
      .recipesFor(candidates(['Lax', offer('1', 'Laxloin')]), ['saffran'])
      .subscribe((r) => {
        expect(r).toEqual([]);
        done();
      });
  });

  it('svarar tomt utan råvaror, utan att fråga källan', (done) => {
    source.recipesFor([]).subscribe((r) => {
      expect(r).toEqual([]);
      expect(zeta.asked).toEqual([]);
      done();
    });
  });
});
