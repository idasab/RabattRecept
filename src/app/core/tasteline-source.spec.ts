import { TestBed } from '@angular/core/testing';
import { Observable, of } from 'rxjs';
import { Offer } from './offers.models';
import { MIN_RATING, MIN_VOTES } from './recipe-source';
import { TastelineSource } from './tasteline-source';
import { Candidate } from './ingredient-candidates';
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
  totalDuration = 1800,
  occasionIds: number[] = []
): TastelineRecipe {
  return {
    id,
    link: `https://www.tasteline.com/recept/${id}/`,
    title: { rendered: title },
    ingredient: ingredientIds,
    recipe_occasion: occasionIds,
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
  occasionTerms: TastelineTerm[] = [];
  found: TastelineRecipe[] = [];
  imageUrls = new Map<number, string>();
  askedFor: number[] = [];
  askedForImages: number[] = [];
  askedForTerms: string[] = [];

  ingredientsFor(searches: readonly string[]): Observable<Map<string, TastelineTerm[]>> {
    this.askedForTerms = [...searches];
    return of(new Map(searches.map((search) => [search, this.terms.get(search) ?? []])));
  }

  occasions(): Observable<TastelineTerm[]> {
    return of(this.occasionTerms);
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

/** Söktermerna kommer färdiga till källan, en per rabatterad huvudråvara. */
function candidates(...pairs: [string, Offer][]): Candidate[] {
  return pairs.map(([term, offer]) => ({ term, offer }));
}

describe('TastelineSource', () => {
  let service: TastelineSource;
  let tasteline: StubTastelineService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [TastelineSource, { provide: TastelineService, useClass: StubTastelineService }],
    });

    service = TestBed.inject(TastelineSource);
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

    service.recipesFor(candidates(['Nötfärs', offer('1', 'Nötfärs')])).subscribe((recipes) => {
      // Källan sållar men sorterar inte — ordningen sätts av RecipesService.
      expect(recipes.map((entry) => entry.title)).toEqual(['Precis på gränsen', 'Högt betyg']);
      done();
    });
  });

  it('visar bara recept som minst fem har röstat på', (done) => {
    // Ett femma från en enda röst säger inget om receptet.
    tasteline.terms.set('Lax', [{ id: 5, name: 'Lax', count: 941 }]);
    tasteline.found = [
      recipe(1, 'En enda röst', 5, 1, [5]),
      recipe(2, 'Precis för få', 4.8, MIN_VOTES - 1, [5]),
      recipe(3, 'Precis på gränsen', 4.2, MIN_VOTES, [5]),
      recipe(4, 'Väl beprövat', 4.1, 453, [5]),
    ];

    service.recipesFor(candidates(['Lax', offer('1', 'Laxloin')])).subscribe((recipes) => {
      expect(recipes.map((entry) => entry.title)).toEqual(['Precis på gränsen', 'Väl beprövat']);
      done();
    });
  });




  it('sätter den vanligaste av likvärdiga termer först', (done) => {
    tasteline.terms.set('Nötfärs', [
      { id: 4886, name: 'nötfärs, mager', count: 3 },
      { id: 383, name: 'Nötfärs', count: 489 },
    ]);
    tasteline.found = [];

    service.recipesFor(candidates(['Nötfärs', offer('1', 'Nötfärs')])).subscribe(() => {
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

    service.recipesFor(candidates(['Kyckling', offer('1', 'Kycklinglårfilé')])).subscribe(() => {
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

    service.recipesFor(candidates(['Ägg', offer('1', 'Ägg 15-pack')])).subscribe(() => {
      expect(tasteline.askedFor).toEqual([20]);
      done();
    });
  });

  it('ser igenom böjningen i parentes', (done) => {
    tasteline.terms.set('Fläskfilé', [{ id: 278, name: 'fläskfilé(er)', count: 278 }]);
    tasteline.found = [];

    service.recipesFor(candidates(['Fläskfilé', offer('1', 'Fläskytterfilé')])).subscribe(() => {
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

    service.recipesFor(candidates(['Räkor', offer('1', 'STORA RÄKOR I LAKE', 59)])).subscribe((recipes) => {
      expect(recipes[0].matches.length).toBe(1);
      expect(recipes[0].matches[0].ingredient).toBe('Räkor');
      done();
    });
  });


  it('berättar vilken rabatterad råvara som gav träffen', (done) => {
    tasteline.terms.set('Nötfärs', [{ id: 383, name: 'Nötfärs', count: 489 }]);
    tasteline.found = [recipe(1, 'Chili con carne', 4.5, 100, [383])];

    service.recipesFor(candidates(['Nötfärs', offer('1', 'Nötfärs', 99)])).subscribe((recipes) => {
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

    service.recipesFor(candidates(['Nötfärs', offer('1', 'Nötfärs', 99)], ['Bacon', offer('2', 'Bacon', 25)])).subscribe((recipes) => {
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

    service.recipesFor(candidates(['Lax', offer('1', 'Laxloin')])).subscribe((recipes) => {
      // order 0 vinner över order 1, och det bortsållade receptets bild hämtas inte.
      expect(tasteline.askedForImages).toEqual([701]);
      expect(recipes[0].image).toBe('https://exempel.se/lax.jpg');
      done();
    });
  });

  it('räknar om tillagningstiden från sekunder till minuter', (done) => {
    tasteline.terms.set('Lax', [{ id: 5, name: 'Lax', count: 941 }]);
    tasteline.found = [recipe(1, 'Laxgryta', 4.5, 10, [5], undefined, 2700)];

    service.recipesFor(candidates(['Lax', offer('1', 'Laxloin')])).subscribe((recipes) => {
      expect(recipes[0].durationMinutes).toBe(45);
      done();
    });
  });

  it('svarar null på tid när källan skriver noll', (done) => {
    // Noll minuter vore en lögn; källan menar att tiden saknas.
    tasteline.terms.set('Lax', [{ id: 5, name: 'Lax', count: 941 }]);
    tasteline.found = [recipe(1, 'Laxgryta', 4.5, 10, [5], undefined, 0)];

    service.recipesFor(candidates(['Lax', offer('1', 'Laxloin')])).subscribe((recipes) => {
      expect(recipes[0].durationMinutes).toBeNull();
      done();
    });
  });

  it('avkodar HTML-entiteter i rubriken', (done) => {
    tasteline.terms.set('Lax', [{ id: 5, name: 'Lax', count: 941 }]);
    tasteline.found = [recipe(1, 'Lax &#8211; i ugn', 4.5, 10, [5])];

    service.recipesFor(candidates(['Lax', offer('1', 'Laxloin')])).subscribe((recipes) => {
      expect(recipes[0].title).toBe('Lax – i ugn');
      done();
    });
  });

  it('kastar recept som innehåller en utesluten ingrediens', (done) => {
    tasteline.terms.set('Lax', [{ id: 5, name: 'Lax', count: 941 }]);
    tasteline.terms.set('Saffran', [{ id: 77, name: 'Saffran', count: 300 }]);
    tasteline.found = [
      recipe(1, 'Laxgryta med saffran', 4.8, 100, [5, 77]),
      recipe(2, 'Laxgryta med fänkål', 4.7, 100, [5]),
    ];

    service
      .recipesFor(candidates(['Lax', offer('1', 'Laxloin')]), ['Saffran'])
      .subscribe((recipes) => {
        expect(recipes.map((entry) => entry.title)).toEqual(['Laxgryta med fänkål']);
        done();
      });
  });

  it('tar även bort ett recept som säger sig vara utan det uteslutna', (done) => {
    // Rubriknätet skiljer inte på "med" och "utan". Att kasta ett recept för
    // mycket är det säkra felet när skälet kan vara en allergi.
    tasteline.terms.set('Lax', [{ id: 5, name: 'Lax', count: 941 }]);
    tasteline.terms.set('Saffran', []);
    tasteline.found = [recipe(1, 'Laxgryta utan saffran', 4.8, 100, [5])];

    service
      .recipesFor(candidates(['Lax', offer('1', 'Laxloin')]), ['Saffran'])
      .subscribe((recipes) => {
        expect(recipes).toEqual([]);
        done();
      });
  });

  it('kastar recept vars rubrik nämner det uteslutna, som extra nät', (done) => {
    // Källan känner inte alltid igen ordet som ingrediensterm.
    tasteline.terms.set('Lax', [{ id: 5, name: 'Lax', count: 941 }]);
    tasteline.terms.set('Sriracha', []);
    tasteline.found = [
      recipe(1, 'Laxbowl med srirachamajonnäs', 4.8, 100, [5]),
      recipe(2, 'Laxgryta', 4.7, 100, [5]),
    ];

    service
      .recipesFor(candidates(['Lax', offer('1', 'Laxloin')]), ['Sriracha'])
      .subscribe((recipes) => {
        expect(recipes.map((entry) => entry.title)).toEqual(['Laxgryta']);
        done();
      });
  });

  it('låter en uteslutning på flera ord gälla varan och inte recepten', (done) => {
    // "färsk kyckling" säger något om varan i butiken, inte att all kyckling
    // ska bort ur recepten.
    tasteline.terms.set('Kyckling', [{ id: 152, name: 'Kyckling', count: 800 }]);
    tasteline.terms.set('färsk kyckling', [{ id: 152, name: 'Kyckling', count: 800 }]);
    tasteline.found = [recipe(1, 'Kycklinggryta', 4.8, 100, [152])];

    service
      .recipesFor(candidates(['Kyckling', offer('1', 'Kycklinglårfilé')]), ['färsk kyckling'])
      .subscribe((recipes) => {
        expect(recipes.map((entry) => entry.title)).toEqual(['Kycklinggryta']);
        done();
      });
  });

  it('kastar recept som är taggade med en högtid som inte är nu', (done) => {
    // Källans egen tagg är den säkraste signalen: rubriken kan vara neutral.
    tasteline.terms.set('Fläskkarré', [{ id: 9, name: 'Fläskkarré', count: 97 }]);
    tasteline.occasionTerms = [
      { id: 70, name: 'Jul', count: 1261 },
      { id: 64, name: 'Kräftskiva', count: 194 },
    ];
    tasteline.found = [
      recipe(1, 'Janssons frestelse', 4.8, 100, [9], undefined, 1800, [70]),
      recipe(2, 'Karrégryta', 4.7, 100, [9], undefined, 1800, []),
    ];

    service
      .recipesFor(candidates(['Fläskkarré', offer('1', 'Fläskkarré')]))
      .subscribe((recipes) => {
        // Testet körs året runt, så julen är bortsållad utom i november och
        // december. Karrégrytan ska alltid vara kvar.
        const månad = new Date().getMonth() + 1;
        const väntat = [11, 12].includes(månad)
          ? ['Janssons frestelse', 'Karrégryta']
          : ['Karrégryta'];
        expect(recipes.map((entry) => entry.title)).toEqual(väntat);
        done();
      });
  });

  it('kastar recept vars rubrik avslöjar högtiden, som nät', (done) => {
    tasteline.terms.set('Lax', [{ id: 5, name: 'Lax', count: 941 }]);
    tasteline.occasionTerms = [];
    tasteline.found = [
      recipe(1, 'Gravad lax till julbordet', 4.8, 100, [5]),
      recipe(2, 'Gravad lax', 4.7, 100, [5]),
    ];

    service.recipesFor(candidates(['Lax', offer('1', 'Laxloin')])).subscribe((recipes) => {
      const månad = new Date().getMonth() + 1;
      const väntat = [11, 12].includes(månad)
        ? ['Gravad lax till julbordet', 'Gravad lax']
        : ['Gravad lax'];
      expect(recipes.map((entry) => entry.title)).toEqual(väntat);
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
