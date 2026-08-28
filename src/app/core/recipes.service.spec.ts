import { TestBed } from '@angular/core/testing';
import { Observable, of } from 'rxjs';
import { Candidate } from './ingredient-candidates';
import { Offer } from './offers.models';
import { RecipesService } from './recipes.service';
import { Recipe, RecipeSourceName } from './recipes.models';
import { TastelineSource } from './tasteline-source';
import { ZetaSource } from './zeta-source';

function offer(id: string, heading: string): Offer {
  return {
    id,
    chainId: 'willys',
    chainName: 'Willys',
    heading,
    description: '',
    price: 20,
    prePrice: 40,
    currency: 'SEK',
    discount: 0.5,
    image: null,
    validUntil: '2099-01-01T00:00:00+0000',
  };
}

function recipe(
  source: RecipeSourceName,
  id: number,
  title: string,
  rating: number,
  votes: number,
  ingredient: string
): Recipe {
  return {
    id: `${source}:${id}`,
    source,
    title,
    url: `https://example.test/${id}`,
    rating,
    votes,
    durationMinutes: 30,
    image: null,
    matches: [
      {
        ingredient,
        offerHeading: ingredient,
        chainName: 'Willys',
        price: 20,
        currency: 'SEK',
      },
    ],
  };
}

class StubSource {
  found: Recipe[] = [];
  asked: Candidate[] = [];
  askedExcluded: string[] = [];

  recipesFor(candidates: readonly Candidate[], excluded: readonly string[]): Observable<Recipe[]> {
    this.asked = [...candidates];
    this.askedExcluded = [...excluded];
    return of(this.found);
  }
}

describe('RecipesService', () => {
  let service: RecipesService;
  let tasteline: StubSource;
  let zeta: StubSource;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        RecipesService,
        { provide: TastelineSource, useClass: StubSource },
        { provide: ZetaSource, useClass: StubSource },
      ],
    });

    service = TestBed.inject(RecipesService);
    tasteline = TestBed.inject(TastelineSource) as unknown as StubSource;
    zeta = TestBed.inject(ZetaSource) as unknown as StubSource;
  });

  it('frågar båda källorna om samma råvaror', (done) => {
    const offers = [offer('1', 'Kycklinglårfilé'), offer('2', 'Laxloin')];

    service.recipesFor(offers).subscribe(() => {
      expect(tasteline.asked.map((entry) => entry.term)).toEqual(['Kyckling', 'Lax']);
      expect(zeta.asked.map((entry) => entry.term)).toEqual(['Kyckling', 'Lax']);
      done();
    });
  });

  it('söker bara på rabatterade huvudråvaror', (done) => {
    const offers = [
      offer('1', 'Svenskt smör'),
      offer('2', 'Toalettpapper 12-pack'),
      offer('3', 'Kycklinglårfilé'),
    ];

    service.recipesFor(offers).subscribe(() => {
      expect(tasteline.asked.map((entry) => entry.term)).toEqual(['Kyckling']);
      done();
    });
  });

  it('svarar tomt när rean inte har någon huvudråvara, utan att fråga källorna', (done) => {
    service.recipesFor([offer('1', 'Svenskt smör')]).subscribe((recipes) => {
      expect(recipes).toEqual([]);
      expect(tasteline.asked).toEqual([]);
      expect(zeta.asked).toEqual([]);
      done();
    });
  });

  it('skickar uteslutningarna vidare till båda källorna', (done) => {
    // Bara källan vet vad receptet innehåller, så filtret måste göras där.
    service.recipesFor([offer('1', 'Kycklinglårfilé')], ['Saffran']).subscribe(() => {
      expect(tasteline.askedExcluded).toEqual(['Saffran']);
      expect(zeta.askedExcluded).toEqual(['Saffran']);
      done();
    });
  });

  it('slår ihop båda källornas recept i en lista', (done) => {
    tasteline.found = [recipe('Tasteline', 1, 'Från Tasteline', 4.5, 40, 'Kyckling')];
    zeta.found = [recipe('Zeta', 1, 'Från Zeta', 4.7, 12, 'Kyckling')];

    service.recipesFor([offer('1', 'Kycklinglårfilé')]).subscribe((recipes) => {
      expect(recipes.map((entry) => entry.source)).toEqual(['Zeta', 'Tasteline']);
      // Samma id-nummer i två källor får inte krocka.
      expect(new Set(recipes.map((entry) => entry.id)).size).toBe(2);
      done();
    });
  });

  it('sorterar högsta betyg först och flest röster vid lika betyg', (done) => {
    tasteline.found = [
      recipe('Tasteline', 1, 'Fyra, få röster', 4, 6, 'Lax'),
      recipe('Tasteline', 2, 'Fyra, många röster', 4, 900, 'Lax'),
    ];
    zeta.found = [recipe('Zeta', 3, 'Fem', 5, 8, 'Lax')];

    service.recipesFor([offer('1', 'Laxloin')]).subscribe((recipes) => {
      expect(recipes.map((entry) => entry.title)).toEqual([
        'Fem',
        'Fyra, många röster',
        'Fyra, få röster',
      ]);
      done();
    });
  });

  it('varvar recepten över råvarorna i stället för att fylla på med en', (done) => {
    tasteline.found = [
      recipe('Tasteline', 1, 'Kyckling 4.9', 4.9, 10, 'Kyckling'),
      recipe('Tasteline', 2, 'Kyckling 4.8', 4.8, 10, 'Kyckling'),
      recipe('Tasteline', 3, 'Kyckling 4.7', 4.7, 10, 'Kyckling'),
    ];
    zeta.found = [
      recipe('Zeta', 4, 'Lax 4.6', 4.6, 10, 'Lax'),
      recipe('Zeta', 5, 'Lax 4.5', 4.5, 10, 'Lax'),
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

  it('klarar att en källa inte hittar något', (done) => {
    tasteline.found = [recipe('Tasteline', 1, 'Ensam', 4.5, 40, 'Kyckling')];
    zeta.found = [];

    service.recipesFor([offer('1', 'Kycklinglårfilé')]).subscribe((recipes) => {
      expect(recipes.map((entry) => entry.title)).toEqual(['Ensam']);
      done();
    });
  });
});
