import { TestBed } from '@angular/core/testing';
import { Observable, of } from 'rxjs';
import { Offer } from './offers.models';
import { MIN_RATING, RecipesService } from './recipes.service';
import { TastelineRecipe, TastelineService, TastelineTerm } from './tasteline.service';

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

function recipe(
  id: number,
  title: string,
  rating: number,
  votes: number,
  ingredientIds: number[],
  attachmentId?: number,
  totalDuration = 1800
): TastelineRecipe {
  return {
    id,
    link: `https://www.tasteline.com/recept/${id}/`,
    title: { rendered: title },
    ingredient: ingredientIds,
    meta: {
      tasteline_recipe_data: {
        recipe: { rating: { rating, votes }, totalDuration },
        images:
          attachmentId === undefined
            ? {}
            : { a: { attachmentId, order: 1 }, b: { attachmentId: attachmentId + 1, order: 0 } },
      },
    },
  };
}

class StubTastelineService {
  terms = new Map<string, TastelineTerm[]>();
  found: TastelineRecipe[] = [];
  imageUrls = new Map<number, string>();
  askedFor: number[] = [];
  askedForImages: number[] = [];
  askedForTerms: string[] = [];

  ingredientsFor(searches: readonly string[]): Observable<Map<string, TastelineTerm[]>> {
    this.askedForTerms = [...searches];
    return of(new Map(searches.map((search) => [search, this.terms.get(search) ?? []])));
  }

  recipes(termIds: readonly number[]): Observable<TastelineRecipe[]> {
    this.askedFor = [...termIds];
    return of(this.found);
  }

  images(ids: readonly number[]): Observable<Map<number, string>> {
    this.askedForImages = [...ids];
    return of(this.imageUrls);
  }
}

describe('RecipesService', () => {
  let service: RecipesService;
  let tasteline: StubTastelineService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [RecipesService, { provide: TastelineService, useClass: StubTastelineService }],
    });

    service = TestBed.inject(RecipesService);
    tasteline = TestBed.inject(TastelineService) as unknown as StubTastelineService;
  });

  it('visar bara recept med minst 3,5 i betyg', (done) => {
    tasteline.terms.set('Nötfärs', [{ id: 383, name: 'Nötfärs', count: 489 }]);
    tasteline.found = [
      recipe(1, 'För lågt betyg', 3.4, 50, [383]),
      recipe(2, 'Precis på gränsen', MIN_RATING, 12, [383]),
      recipe(3, 'Högt betyg', 4.8, 30, [383]),
      recipe(4, 'Utan betyg', 0, 0, [383]),
    ];

    service.recipesFor([offer('1', 'Nötfärs')]).subscribe((recipes) => {
      expect(recipes.map((entry) => entry.title)).toEqual(['Högt betyg', 'Precis på gränsen']);
      done();
    });
  });

  it('sorterar högsta betyg först och flest röster vid lika betyg', (done) => {
    tasteline.terms.set('Lax', [{ id: 5, name: 'Lax', count: 941 }]);
    tasteline.found = [
      recipe(1, 'Fyra, få röster', 4, 3, [5]),
      recipe(2, 'Fyra, många röster', 4, 900, [5]),
      recipe(3, 'Fem', 5, 1, [5]),
    ];

    service.recipesFor([offer('1', 'Laxloin')]).subscribe((recipes) => {
      expect(recipes.map((entry) => entry.title)).toEqual([
        'Fem',
        'Fyra, många röster',
        'Fyra, få röster',
      ]);
      done();
    });
  });

  it('söker bara på rabatterade huvudråvaror', (done) => {
    tasteline.terms.set('Kyckling', [{ id: 152, name: 'Kyckling', count: 800 }]);

    const offers = [
      offer('1', 'Svenskt smör'),
      offer('2', 'Toalettpapper 12-pack'),
      offer('3', 'Kycklinglårfilé'),
    ];

    service.recipesFor(offers).subscribe(() => {
      // Smöret och toalettpappret ska aldrig ens slås upp.
      expect(tasteline.askedForTerms).toEqual(['Kyckling']);
      done();
    });
  });

  it('svarar tomt när rean inte har någon huvudråvara', (done) => {
    service.recipesFor([offer('1', 'Svenskt smör'), offer('2', 'Läsk')]).subscribe((recipes) => {
      expect(recipes).toEqual([]);
      expect(tasteline.askedForTerms).toEqual([]);
      expect(tasteline.askedFor).toEqual([]);
      done();
    });
  });

  it('sätter den vanligaste av likvärdiga termer först', (done) => {
    tasteline.terms.set('Nötfärs', [
      { id: 4886, name: 'nötfärs, mager', count: 3 },
      { id: 383, name: 'Nötfärs', count: 489 },
    ]);
    tasteline.found = [];

    service.recipesFor([offer('1', 'Nötfärs')]).subscribe(() => {
      expect(tasteline.askedFor[0]).toBe(383);
      done();
    });
  });

  it('frågar på råvarans alla dugliga termer, bäst först', (done) => {
    tasteline.terms.set('Kyckling', [
      { id: 900, name: 'Vegofärs istället för kyckling', count: 1 },
      { id: 300, name: 'grillad kyckling', count: 29 },
      { id: 152, name: 'Kyckling', count: 800 },
    ]);
    tasteline.found = [];

    service.recipesFor([offer('1', 'Kycklinglårfilé')]).subscribe(() => {
      // Exakt namn först, sedan varianten. Frasen faller bort helt.
      expect(tasteline.askedFor).toEqual([152, 300]);
      done();
    });
  });

  it('avvisar sammansättningar som bara råkar innehålla ordet', (done) => {
    // "äggulor" innehåller "ägg" men är inte ägg.
    tasteline.terms.set('Ägg', [
      { id: 10, name: 'äggulor', count: 900 },
      { id: 20, name: 'Ägg', count: 4572 },
    ]);
    tasteline.found = [];

    service.recipesFor([offer('1', 'Ägg 15-pack')]).subscribe(() => {
      expect(tasteline.askedFor).toEqual([20]);
      done();
    });
  });

  it('ser igenom böjningen i parentes', (done) => {
    tasteline.terms.set('Fläskfilé', [{ id: 278, name: 'fläskfilé(er)', count: 278 }]);
    tasteline.found = [];

    service.recipesFor([offer('1', 'Fläskytterfilé')]).subscribe(() => {
      expect(tasteline.askedFor).toEqual([278]);
      done();
    });
  });

  it('räknar en råvara en gång även när receptet taggats med flera av dess termer', (done) => {
    tasteline.terms.set('Räkor', [
      { id: 200, name: 'Räkor', count: 799 },
      { id: 210, name: 'skalade räkor', count: 33 },
    ]);
    tasteline.found = [recipe(1, 'Räksallad', 4.5, 10, [200, 210])];

    service.recipesFor([offer('1', 'STORA RÄKOR I LAKE', 59)]).subscribe((recipes) => {
      expect(recipes[0].matches.length).toBe(1);
      expect(recipes[0].matches[0].ingredient).toBe('Räkor');
      done();
    });
  });

  it('varvar recepten över råvarorna i stället för att fylla på med en', (done) => {
    tasteline.terms.set('Kyckling', [{ id: 10, name: 'Kyckling', count: 800 }]);
    tasteline.terms.set('Lax', [{ id: 20, name: 'Lax', count: 941 }]);
    tasteline.found = [
      recipe(1, 'Kyckling 4.9', 4.9, 10, [10]),
      recipe(2, 'Kyckling 4.8', 4.8, 10, [10]),
      recipe(3, 'Kyckling 4.7', 4.7, 10, [10]),
      recipe(4, 'Lax 4.6', 4.6, 10, [20]),
      recipe(5, 'Lax 4.5', 4.5, 10, [20]),
    ];

    service.recipesFor([offer('1', 'Kycklingfilé'), offer('2', 'Laxloin')]).subscribe((recipes) => {
      expect(recipes.map((entry) => entry.title)).toEqual([
        'Kyckling 4.9',
        'Lax 4.6',
        'Kyckling 4.8',
        'Lax 4.5',
        'Kyckling 4.7',
      ]);
      done();
    });
  });

  it('berättar vilken rabatterad råvara som gav träffen', (done) => {
    tasteline.terms.set('Nötfärs', [{ id: 383, name: 'Nötfärs', count: 489 }]);
    tasteline.found = [recipe(1, 'Chili con carne', 4.5, 100, [383])];

    service.recipesFor([offer('1', 'Nötfärs', 99)]).subscribe((recipes) => {
      expect(recipes[0].matches).toEqual([
        {
          ingredient: 'Nötfärs',
          offerHeading: 'Nötfärs',
          chainName: 'Willys',
          price: 99,
          currency: 'SEK',
        },
      ]);
      done();
    });
  });

  it('tar med alla rabatterade råvaror receptet använder', (done) => {
    tasteline.terms.set('Nötfärs', [{ id: 383, name: 'Nötfärs', count: 489 }]);
    tasteline.terms.set('Bacon', [{ id: 400, name: 'Bacon', count: 703 }]);
    tasteline.found = [recipe(1, 'Cheeseburgare med bacon', 4.5, 100, [383, 400, 999])];

    service.recipesFor([offer('1', 'Nötfärs', 99), offer('2', 'Bacon', 25)]).subscribe((recipes) => {
      // 999 är ingen av våra råvaror och ska inte dyka upp i sammanfattningen.
      expect(recipes[0].matches.map((entry) => entry.ingredient)).toEqual(['Nötfärs', 'Bacon']);
      expect(recipes[0].matches.map((entry) => entry.price)).toEqual([99, 25]);
      done();
    });
  });

  it('tar receptets förstabild och slår upp bara de bilder som behövs', (done) => {
    tasteline.terms.set('Lax', [{ id: 5, name: 'Lax', count: 941 }]);
    tasteline.found = [
      recipe(1, 'Med bild', 4.5, 10, [5], 700),
      recipe(2, 'Bortsållad', 2, 10, [5], 900),
    ];
    tasteline.imageUrls = new Map([[701, 'https://exempel.se/lax.jpg']]);

    service.recipesFor([offer('1', 'Laxloin')]).subscribe((recipes) => {
      // order 0 vinner över order 1, och det bortsållade receptets bild hämtas inte.
      expect(tasteline.askedForImages).toEqual([701]);
      expect(recipes[0].image).toBe('https://exempel.se/lax.jpg');
      done();
    });
  });

  it('räknar om tillagningstiden från sekunder till minuter', (done) => {
    tasteline.terms.set('Lax', [{ id: 5, name: 'Lax', count: 941 }]);
    tasteline.found = [recipe(1, 'Laxgryta', 4.5, 10, [5], undefined, 2700)];

    service.recipesFor([offer('1', 'Laxloin')]).subscribe((recipes) => {
      expect(recipes[0].durationMinutes).toBe(45);
      done();
    });
  });

  it('svarar null på tid när källan skriver noll', (done) => {
    // Noll minuter vore en lögn; källan menar att tiden saknas.
    tasteline.terms.set('Lax', [{ id: 5, name: 'Lax', count: 941 }]);
    tasteline.found = [recipe(1, 'Laxgryta', 4.5, 10, [5], undefined, 0)];

    service.recipesFor([offer('1', 'Laxloin')]).subscribe((recipes) => {
      expect(recipes[0].durationMinutes).toBeNull();
      done();
    });
  });

  it('avkodar HTML-entiteter i rubriken', (done) => {
    tasteline.terms.set('Lax', [{ id: 5, name: 'Lax', count: 941 }]);
    tasteline.found = [recipe(1, 'Lax &#8211; i ugn', 4.5, 10, [5])];

    service.recipesFor([offer('1', 'Laxloin')]).subscribe((recipes) => {
      expect(recipes[0].title).toBe('Lax – i ugn');
      done();
    });
  });

  it('svarar tomt utan erbjudanden, utan att fråga källan', (done) => {
    service.recipesFor([]).subscribe((recipes) => {
      expect(recipes).toEqual([]);
      expect(tasteline.askedFor).toEqual([]);
      done();
    });
  });
});
