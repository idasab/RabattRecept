import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { PlaceSearchComponent } from './place-search.component';
import { provideHttpClient } from '@angular/common/http';

describe('PlaceSearchComponent', () => {
  let fixture: ComponentFixture<PlaceSearchComponent>;

  function element<T extends HTMLElement>(selector: string): T | null {
    return (fixture.nativeElement as HTMLElement).querySelector<T>(selector);
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PlaceSearchComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    fixture = TestBed.createComponent(PlaceSearchComponent);
    fixture.detectChanges();
  });

  it('visar rensa-knappen först när något är skrivet', () => {
    expect(element('.clear')).toBeNull();

    fixture.componentInstance.query.set('Malmö');
    fixture.detectChanges();

    expect(element('.clear')).not.toBeNull();
  });

  it('tömmer fältet när rensa trycks', () => {
    fixture.componentInstance.query.set('Malmö');
    fixture.detectChanges();

    element<HTMLButtonElement>('.clear')?.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.query()).toBe('');
    expect(element('.clear')).toBeNull();
  });
});
