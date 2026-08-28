import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FoodExclusionsComponent } from './food-exclusions.component';

describe('FoodExclusionsComponent', () => {
  let fixture: ComponentFixture<FoodExclusionsComponent>;

  function setExcluded(excluded: string[]): void {
    fixture.componentInstance.excluded = excluded;
    fixture.detectChanges();
  }

  function element<T extends HTMLElement>(selector: string): T | null {
    return (fixture.nativeElement as HTMLElement).querySelector<T>(selector);
  }

  function chips(): string[] {
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.chips li span')).map(
      (chip) => chip.textContent?.trim() ?? ''
    );
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [FoodExclusionsComponent] });
    fixture = TestBed.createComponent(FoodExclusionsComponent);
    fixture.componentInstance.excluded = [];
    fixture.detectChanges();
  });

  it('börjar hopfälld', () => {
    expect(element<HTMLDetailsElement>('details')?.open).toBeFalse();
  });

  it('säger till när inget är uteslutet', () => {
    expect(element('.empty')?.textContent).toContain('Inget är uteslutet');
    expect(element('.count')).toBeNull();
  });

  it('räknar de uteslutna varorna i rubriken', () => {
    setExcluded(['fläsk', 'räkor']);

    expect(element('.count')?.textContent?.trim()).toBe('2');
    expect(chips()).toEqual(['fläsk', 'räkor']);
  });

  it('skickar vidare det man skrivit och tömmer fältet', () => {
    const added: string[] = [];
    fixture.componentInstance.add.subscribe((entry) => added.push(entry));

    fixture.componentInstance.draft.set('  fläsk  ');
    element<HTMLFormElement>('.add')?.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(added).toEqual(['fläsk']);
    expect(fixture.componentInstance.draft()).toBe('');
  });

  it('skickar inget när fältet bara innehåller blanksteg', () => {
    const added: string[] = [];
    fixture.componentInstance.add.subscribe((entry) => added.push(entry));

    fixture.componentInstance.draft.set('   ');
    element<HTMLFormElement>('.add')?.dispatchEvent(new Event('submit'));

    expect(added).toEqual([]);
  });

  it('låser knappen tills något är skrivet', () => {
    expect(element<HTMLButtonElement>('.add button')?.disabled).toBeTrue();

    fixture.componentInstance.draft.set('lax');
    fixture.detectChanges();

    expect(element<HTMLButtonElement>('.add button')?.disabled).toBeFalse();
  });

  it('skickar vidare vilken vara som ska tas bort', () => {
    setExcluded(['fläsk', 'räkor']);
    const removed: string[] = [];
    fixture.componentInstance.remove.subscribe((entry) => removed.push(entry));

    (fixture.nativeElement as HTMLElement)
      .querySelectorAll<HTMLButtonElement>('.chips button')[1]
      .click();

    expect(removed).toEqual(['räkor']);
  });

  it('erbjuder de kända råvarorna som förslag', () => {
    fixture.componentInstance.suggestions = ['Kyckling', 'Lax'];
    fixture.detectChanges();

    const options = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('datalist option')
    ).map((option) => option.getAttribute('value'));

    expect(options).toEqual(['Kyckling', 'Lax']);
  });

  it('beskriver borttagningsknappen för skärmläsare', () => {
    setExcluded(['fläsk']);

    expect(element('.chips button')?.getAttribute('aria-label')).toBe('Sluta utesluta fläsk');
  });
});
