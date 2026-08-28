import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RecipeListComponent } from './recipe-list.component';
import { Recipe } from '../core/recipes.models';

function match(ingredient: string, chainName: string, price: number) {
  return { ingredient, offerHeading: `${ingredient} 1 kg`, chainName, price, currency: 'SEK' };
}

function recipe(
  index: number,
  matches = [match('Nötfärs', 'Willys', 99)],
  durationMinutes: number | null = 35
): Recipe {
  return {
    id: `Tasteline:${index}`,
    source: 'Tasteline',
    title: `Recept ${index}`,
    url: `https://www.tasteline.com/recept/${index}/`,
    rating: 4.25,
    votes: index,
    durationMinutes,
    image: null,
    matches,
  };
}

describe('RecipeListComponent', () => {
  let fixture: ComponentFixture<RecipeListComponent>;

  function setRecipes(count: number): void {
    fixture.componentInstance.recipes = Array.from({ length: count }, (_, i) => recipe(i + 1));
    fixture.componentInstance.ngOnChanges();
    fixture.detectChanges();
  }

  function setRecipe(recipes: Recipe[]): void {
    fixture.componentInstance.recipes = recipes;
    fixture.componentInstance.ngOnChanges();
    fixture.detectChanges();
  }

  function matchRows(): string[] {
    return Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.match')
    ).map((element) => (element.textContent ?? '').replace(/\s+/g, ' ').trim());
  }

  function cards(): HTMLAnchorElement[] {
    return Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLAnchorElement>('a.recipe')
    );
  }

  function moreButton(): HTMLButtonElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector('.more');
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [RecipeListComponent] });
    fixture = TestBed.createComponent(RecipeListComponent);
  });

  it('visar fem recept från början', () => {
    setRecipes(12);

    expect(cards().length).toBe(5);
    expect(moreButton()?.textContent).toContain('7 kvar');
  });

  it('lägger till fem recept för varje klick på Visa fler', () => {
    setRecipes(12);

    moreButton()?.click();
    fixture.detectChanges();
    expect(cards().length).toBe(10);

    moreButton()?.click();
    fixture.detectChanges();
    expect(cards().length).toBe(12);
  });

  it('döljer knappen när alla recept visas', () => {
    setRecipes(3);

    expect(cards().length).toBe(3);
    expect(moreButton()).toBeNull();
  });

  it('börjar om på fem när sökningen ger nya recept', () => {
    setRecipes(12);
    moreButton()?.click();
    fixture.detectChanges();
    expect(cards().length).toBe(10);

    setRecipes(12);

    expect(cards().length).toBe(5);
  });

  it('länkar till receptsidan och öppnar den utanför appen', () => {
    setRecipes(1);

    const card = cards()[0];
    expect(card.getAttribute('href')).toBe('https://www.tasteline.com/recept/1/');
    expect(card.getAttribute('target')).toBe('_blank');
    // Utan noopener får den öppnade sidan tillgång till appens fönster.
    expect(card.getAttribute('rel')).toContain('noopener');
  });

  it('visar vilken sajt receptet ligger på', () => {
    setRecipes(1);

    expect((fixture.nativeElement as HTMLElement).querySelector('.source')?.textContent).toContain(
      'Tasteline'
    );
  });

  it('skriver betyget på femgradig skala med antal röster', () => {
    setRecipes(1);

    const rating = (fixture.nativeElement as HTMLElement).querySelector('.rating');
    expect(rating?.textContent).toContain('4,3 av 5');
    expect(rating?.textContent).toContain('(1 röst)');
  });

  it('skriver tillagningstiden i minuter', () => {
    setRecipe([recipe(1, undefined, 35)]);

    expect((fixture.nativeElement as HTMLElement).querySelector('.duration')?.textContent).toContain(
      '35 min'
    );
  });

  it('skriver längre tider i timmar och minuter', () => {
    setRecipe([recipe(1, undefined, 90)]);
    expect((fixture.nativeElement as HTMLElement).querySelector('.duration')?.textContent).toContain(
      '1 h 30 min'
    );

    setRecipe([recipe(2, undefined, 120)]);
    expect((fixture.nativeElement as HTMLElement).querySelector('.duration')?.textContent).toContain(
      '2 h'
    );
  });

  it('skriver ingen tid alls när receptet saknar den', () => {
    setRecipe([recipe(1, undefined, null)]);

    expect((fixture.nativeElement as HTMLElement).querySelector('.duration')).toBeNull();
  });

  it('sammanfattar varje rabatterad vara med pris och butik', () => {
    setRecipe([
      recipe(1, [
        match('Nötfärs', 'Willys', 99),
        match('Lök', 'Hemköp', 12.5),
        match('Krossade tomater', 'Coop', 8),
      ]),
    ]);

    expect(matchRows()).toEqual([
      'Nötfärs 99 kr på Willys',
      'Lök 12,50 kr på Hemköp',
      'Krossade tomater 8 kr på Coop',
    ]);
  });

  it('räknar resten när varorna är fler än tre', () => {
    setRecipe([
      recipe(1, [
        match('Nötfärs', 'Willys', 99),
        match('Lök', 'Hemköp', 12.5),
        match('Krossade tomater', 'Coop', 8),
        match('Vitlök', 'Willys', 15),
        match('Paprika', 'Coop', 20),
      ]),
    ]);

    expect(matchRows().length).toBe(4);
    expect(matchRows()[3]).toBe('+2 varor till');
  });

  it('skriver singular när bara en vara inte fick plats', () => {
    setRecipe([
      recipe(1, [
        match('Nötfärs', 'Willys', 99),
        match('Lök', 'Hemköp', 12.5),
        match('Krossade tomater', 'Coop', 8),
        match('Vitlök', 'Willys', 15),
      ]),
    ]);

    expect(matchRows()[3]).toBe('+1 vara till');
  });
});
