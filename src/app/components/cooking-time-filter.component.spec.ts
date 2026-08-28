import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CookingTimeFilterComponent } from './cooking-time-filter.component';
import { CookingTimeBand } from '../core/cooking-time';

describe('CookingTimeFilterComponent', () => {
  let fixture: ComponentFixture<CookingTimeFilterComponent>;

  function boxes(): HTMLInputElement[] {
    return Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLInputElement>('input')
    );
  }

  function labels(): string[] {
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.name')).map(
      (name) => name.textContent?.trim() ?? ''
    );
  }

  function setSelected(bands: CookingTimeBand[]): void {
    fixture.componentInstance.selected = new Set(bands);
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [CookingTimeFilterComponent] });
    fixture = TestBed.createComponent(CookingTimeFilterComponent);
    fixture.componentInstance.selected = new Set<CookingTimeBand>([
      'snabbt',
      'lagom',
      'långkok',
    ]);
    fixture.detectChanges();
  });

  it('visar tre spann med korta etiketter', () => {
    expect(labels()).toEqual(['< 30', '30–60', '> 60']);
  });

  it('sätter enheten i rubriken, så att rutorna kan hållas korta', () => {
    const heading = (fixture.nativeElement as HTMLElement).querySelector('.card-heading');
    expect(heading?.textContent).toContain('min');
  });

  it('speglar vilka spann som är ikryssade', () => {
    setSelected(['lagom']);

    expect(boxes().map((box) => box.checked)).toEqual([false, true, false]);
  });

  it('skickar vidare vilket spann som klickades', () => {
    const toggled: CookingTimeBand[] = [];
    fixture.componentInstance.toggle.subscribe((band) => toggled.push(band));

    boxes()[2].click();

    expect(toggled).toEqual(['långkok']);
  });

  it('visar hur många recept varje spann rymmer', () => {
    fixture.componentInstance.counts = { snabbt: 4, lagom: 11, långkok: 2 };
    fixture.detectChanges();

    const counts = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.count')
    ).map((count) => count.textContent?.trim());

    expect(counts).toEqual(['4', '11', '2']);
  });

  it('sätter antalet i etiketten, där siffran får sitt sammanhang', () => {
    fixture.componentInstance.counts = { lagom: 11 };
    fixture.detectChanges();

    // Uppläst är den utskriven: "< 30" säger ingenting i en skärmläsare.
    expect(boxes()[1].getAttribute('aria-label')).toBe('30 till 60 minuter, 11 recept');
  });

  it('skriver noll för spann utan recept', () => {
    expect(boxes()[0].getAttribute('aria-label')).toBe('Under 30 minuter, 0 recept');
  });
});
