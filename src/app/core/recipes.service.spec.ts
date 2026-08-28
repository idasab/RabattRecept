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
  attachmentId?: number
): TastelineRecipe {
  return {
    id,
    link: `https://www.tasteline.com/recept/${id}/`,
    title: { rendered: title },
    ingredient: ingredientIds,
    meta: {
      tasteline_recipe_data: {
        recipe: { rating: { rating, votes } },
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

  ingredientsFor(searches: readonly string[]): Observable<Map<string, TastelineTerm[]>> {
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
    tasteline.terms.set('nötfärs', [{ id: 383, name: 'Nötfärs', count: 489 }]);
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
    tasteline.terms.set('lax', [{ id: 5, name: 'Lax', count: 100 }]);
    tasteline.found = [
      recipe(1, 'Fyra, få röster', 4, 3, [5]),
      recipe(2, 'Fyra, många röster', 4, 900, [5]),
      recipe(3, 'Fem', 5, 1, [5]),
    ];

    service.recipesFor([offer('1', 'Lax')]).subscribe((recipes) => {
      expect(recipes.map((entry) => entry.title)).toEqual([
        'Fem',
        'Fyra, många röster',
        'Fyra, få röster',
      ]);
      done();
    });
  });

  it('sållar bort varor som inte är ingredienser', (done) => {
    // Källan känner inte igen toalettpapper, alltså blir det ingen sökning.
    tasteline.terms.set('toalettpapper', []);

    service.recipesFor([offer('1', 'Toalettpapper')]).subscribe((recipes) => {
      expect(recipes).toEqual([]);
      expect(tasteline.askedFor).toEqual([]);
      done();
    });
  });

  it('avvisar termer som är hela fraser snarare än varan', (done) => {
    // Ordet står sist även i "Vegofärs istället för kyckling", men det är
    // vegofärs, inte kyckling.
    tasteline.terms.set('kyckling', [
      { id: 900, name: 'Vegofärs istället för kyckling', count: 1 },
      { id: 152, name: 'Kyckling', count: 800 },
    ]);
    tasteline.found = [recipe(1, 'Kycklinggryta', 4.2, 10, [152])];

    service.recipesFor([offer('1', 'Kyckling')]).subscribe(() => {
      expect(tasteline.askedFor).toEqual([152]);
      done();
    });
  });

  it('godtar en variant med ett ord framför varan', (done) => {
    tasteline.terms.set('smör', [
      { id: 10, name: 'smörgåsgurka', count: 900 },
      { id: 20, name: 'saltat smör', count: 40 },
      { id: 30, name: 'smör', count: 500 },
    ]);
    tasteline.found = [];

    service.recipesFor([offer('1', 'Smör')]).subscribe(() => {
      expect(tasteline.askedFor).toEqual([30, 20]);
      done();
    });
  });

  it('sätter den vanligaste av likvärdiga termer först', (done) => {
    tasteline.terms.set('nötfärs', [
      { id: 4886, name: 'nötfärs, mager', count: 3 },
      { id: 383, name: 'Nötfärs', count: 489 },
    ]);
    tasteline.found = [];

    service.recipesFor([offer('1', 'Nötfärs')]).subscribe(() => {
      expect(tasteline.askedFor[0]).toBe(383);
      done();
    });
  });

  it('frågar på varans alla dugliga termer, bäst först', (done) => {
    // Källans taxonomi är finkornig: recept taggas med "gul lök(ar)", inte "lök".
    tasteline.terms.set('lök', [
      { id: 100, name: 'bananschalottenlök', count: 22 },
      { id: 200, name: 'gul lök(ar)', count: 3155 },
      { id: 1985, name: 'lök', count: 506 },
    ]);
    tasteline.found = [];

    service.recipesFor([offer('1', 'Lök')]).subscribe(() => {
      // Exakt namn först, sedan varan som eget ord. Sammansättningen faller bort.
      expect(tasteline.askedFor).toEqual([1985, 200]);
      done();
    });
  });

  it('avvisar sammansättningar som bara råkar innehålla ordet', (done) => {
    // "smörgåsgurka" innehåller "smör" men är inte smör.
    tasteline.terms.set('smör', [
      { id: 10, name: 'smörgåsgurka', count: 900 },
      { id: 20, name: 'saltat smör', count: 40 },
    ]);
    tasteline.found = [];

    service.recipesFor([offer('1', 'Smör')]).subscribe(() => {
      expect(tasteline.askedFor).toEqual([20]);
      done();
    });
  });

  it('räknar en vara en gång även när receptet taggats med flera av dess termer', (done) => {
    tasteline.terms.set('lök', [
      { id: 200, name: 'gul lök(ar)', count: 3155 },
      { id: 1985, name: 'lök', count: 506 },
    ]);
    tasteline.found = [recipe(1, 'Löksoppa', 4.5, 10, [200, 1985])];

    service.recipesFor([offer('1', 'Lök', 12)]).subscribe((recipes) => {
      expect(recipes[0].matches.length).toBe(1);
      // Namnet är den bäst rangordnade termens, oavsett vilken som träffade.
      expect(recipes[0].matches[0].ingredient).toBe('lök');
      done();
    });
  });

  it('ser igenom böjningen i parentes', (done) => {
    tasteline.terms.set('gul lök', [{ id: 200, name: 'gul lök(ar)', count: 3155 }]);
    tasteline.found = [];

    service.recipesFor([offer('1', 'Gul lök')]).subscribe(() => {
      expect(tasteline.askedFor).toEqual([200]);
      done();
    });
  });

  it('varvar recepten över varorna i stället för att fylla på med en', (done) => {
    tasteline.terms.set('blåbär', [{ id: 10, name: 'Blåbär', count: 200 }]);
    tasteline.terms.set('lax', [{ id: 20, name: 'Lax', count: 100 }]);
    tasteline.found = [
      recipe(1, 'Blåbär 4.9', 4.9, 10, [10]),
      recipe(2, 'Blåbär 4.8', 4.8, 10, [10]),
      recipe(3, 'Blåbär 4.7', 4.7, 10, [10]),
      recipe(4, 'Lax 4.6', 4.6, 10, [20]),
      recipe(5, 'Lax 4.5', 4.5, 10, [20]),
    ];

    service.recipesFor([offer('1', 'Blåbär'), offer('2', 'Lax')]).subscribe((recipes) => {
      expect(recipes.map((entry) => entry.title)).toEqual([
        'Blåbär 4.9',
        'Lax 4.6',
        'Blåbär 4.8',
        'Lax 4.5',
        'Blåbär 4.7',
      ]);
      done();
    });
  });

  it('berättar vilken rabatterad vara som gav träffen', (done) => {
    tasteline.terms.set('nötfärs', [{ id: 383, name: 'Nötfärs', count: 489 }]);
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

  it('tar med alla rabatterade varor receptet använder', (done) => {
    tasteline.terms.set('nötfärs', [{ id: 383, name: 'Nötfärs', count: 489 }]);
    tasteline.terms.set('lök', [{ id: 400, name: 'Lök', count: 900 }]);
    tasteline.found = [recipe(1, 'Chili con carne', 4.5, 100, [383, 400, 999])];

    service
      .recipesFor([offer('1', 'Nötfärs', 99), offer('2', 'Lök', 12)])
      .subscribe((recipes) => {
        // 999 är ingen av våra varor och ska inte dyka upp i sammanfattningen.
        expect(recipes[0].matches.map((entry) => entry.ingredient)).toEqual(['Nötfärs', 'Lök']);
        expect(recipes[0].matches.map((entry) => entry.price)).toEqual([99, 12]);
        done();
      });
  });

  it('tar receptets förstabild och slår upp bara de bilder som behövs', (done) => {
    tasteline.terms.set('lax', [{ id: 5, name: 'Lax', count: 100 }]);
    tasteline.found = [
      recipe(1, 'Med bild', 4.5, 10, [5], 700),
      recipe(2, 'Bortsållad', 2, 10, [5], 900),
    ];
    tasteline.imageUrls = new Map([[701, 'https://exempel.se/lax.jpg']]);

    service.recipesFor([offer('1', 'Lax')]).subscribe((recipes) => {
      // order 0 vinner över order 1, och det bortsållade receptets bild hämtas inte.
      expect(tasteline.askedForImages).toEqual([701]);
      expect(recipes[0].image).toBe('https://exempel.se/lax.jpg');
      done();
    });
  });

  it('avkodar HTML-entiteter i rubriken', (done) => {
    tasteline.terms.set('lax', [{ id: 5, name: 'Lax', count: 100 }]);
    tasteline.found = [recipe(1, 'Lax &#8211; i ugn', 4.5, 10, [5])];

    service.recipesFor([offer('1', 'Lax')]).subscribe((recipes) => {
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
