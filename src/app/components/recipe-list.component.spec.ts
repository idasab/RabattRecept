import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RecipeListComponent } from './recipe-list.component';
import { Recipe } from '../core/recipes.models';

function recipe(index: number): Recipe {
  return {
    id: index,
    title: `Recept ${index}`,
    url: `https://www.tasteline.com/recept/${index}/`,
    rating: 4.25,
    votes: index,
    image: null,
    match: {
      ingredient: 'Nötfärs',
      offerHeading: 'Nötfärs 1 kg',
      chainName: 'Willys',
      price: 99,
      currency: 'SEK',
    },
  };
}

describe('RecipeListComponent', () => {
  let fixture: ComponentFixture<RecipeListComponent>;

  function setRecipes(count: number): void {
    fixture.componentInstance.recipes = Array.from({ length: count }, (_, i) => recipe(i + 1));
    fixture.componentInstance.ngOnChanges();
    fixture.detectChanges();
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

  it('skriver betyget på femgradig skala med antal röster', () => {
    setRecipes(1);

    const rating = (fixture.nativeElement as HTMLElement).querySelector('.rating');
    expect(rating?.textContent).toContain('4,3 av 5');
    expect(rating?.textContent).toContain('(1 röst)');
  });

  it('visar vilken rabatterad vara receptet kom från', () => {
    setRecipes(2);

    const match = (fixture.nativeElement as HTMLElement).querySelector('.match');
    expect(match?.textContent?.trim()).toBe('Nötfärs · 99 kr på Willys');
  });
});
