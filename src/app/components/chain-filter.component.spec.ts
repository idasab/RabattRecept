import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChainFilterComponent } from './chain-filter.component';
import { Chain } from '../core/offers.models';

function chain(index: number): Chain {
  return {
    id: `k${index}`,
    name: `Kedja ${index}`,
    brand: `Kedja ${index}`,
    color: '#6b7f96',
    logo: null,
    distanceKm: index * 0.5,
  };
}

describe('ChainFilterComponent', () => {
  let fixture: ComponentFixture<ChainFilterComponent>;

  function setChains(count: number, favorites: string[] = [], selected?: string[]): void {
    const chains = Array.from({ length: count }, (_, index) => chain(index));
    fixture.componentInstance.chains = chains;
    fixture.componentInstance.selected = new Set(selected ?? favorites);
    fixture.componentInstance.favorites = new Set(favorites);
    fixture.componentInstance.ngOnChanges({
      chains: { currentValue: chains, previousValue: [], firstChange: false, isFirstChange: () => false },
    });
    fixture.detectChanges();
  }

  /** Byter favoriter utifrån, som föräldern gör vid ett stjärnklick. */
  function favorite(...ids: string[]): void {
    const previous = fixture.componentInstance.favorites;
    fixture.componentInstance.favorites = new Set(ids);
    fixture.componentInstance.ngOnChanges({
      favorites: {
        currentValue: new Set(ids),
        previousValue: previous,
        firstChange: false,
        isFirstChange: () => false,
      },
    });
    fixture.detectChanges();
  }

  function stars(): HTMLButtonElement[] {
    return Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.star')
    );
  }

  function rows(): string[] {
    return Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.chain .name')
    ).map((element) => element.textContent?.trim() ?? '');
  }

  function bulkButton(): HTMLButtonElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector('.bulk');
  }

  function moreButton(): HTMLButtonElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector('.more');
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ChainFilterComponent] });
    fixture = TestBed.createComponent(ChainFilterComponent);
  });

  it('visar bara de fyra närmaste kedjorna från början', () => {
    setChains(12);

    expect(rows()).toEqual(['Kedja 0', 'Kedja 1', 'Kedja 2', 'Kedja 3']);
    expect(moreButton()?.textContent).toContain('8 kvar');
  });

  it('lägger till fyra kedjor för varje klick på Visa fler', () => {
    setChains(12);

    moreButton()?.click();
    fixture.detectChanges();
    expect(rows().length).toBe(8);

    moreButton()?.click();
    fixture.detectChanges();
    expect(rows().length).toBe(12);
  });

  it('döljer knappen när alla kedjor visas', () => {
    setChains(12);

    moreButton()?.click();
    fixture.detectChanges();
    moreButton()?.click();
    fixture.detectChanges();

    expect(moreButton()).toBeNull();
  });

  it('visar ingen knapp när kedjorna får plats direkt', () => {
    setChains(3);

    expect(rows().length).toBe(3);
    expect(moreButton()).toBeNull();
  });

  it('döljer aldrig en ikryssad kedja bakom "Visa fler"', () => {
    // En kedja som är ikryssad men inte står i listan bidrar med varor till
    // rabattsidan och receptsökningen utan att gå att se eller kryssa ur.
    setChains(12, [], ['k7']);

    expect(rows().length).toBe(8);
    expect(rows()).toContain('Kedja 7');
    expect(moreButton()?.textContent).toContain('4 kvar');
  });

  it('fäller ut listan när en dold kedja kryssas i utifrån', () => {
    setChains(12);
    expect(rows().length).toBe(4);

    // Så här ser det ut när radien ändras medan en fjärran kedja är vald:
    // föräldern skickar in en markering som pekar bortom de synliga raderna.
    fixture.componentInstance.selected = new Set(['k9']);
    fixture.componentInstance.ngOnChanges({
      selected: {
        currentValue: new Set(['k9']),
        previousValue: new Set(),
        firstChange: false,
        isFirstChange: () => false,
      },
    });
    fixture.detectChanges();

    expect(rows()).toContain('Kedja 9');
  });

  it('fäller inte ihop listan när markeringen ändras', () => {
    setChains(12);
    moreButton()?.click();
    fixture.detectChanges();

    // Kryss i en ruta ger en ny mängd utifrån, alltså en ny input.
    fixture.componentInstance.selected = new Set(['k0']);
    fixture.componentInstance.ngOnChanges({
      selected: {
        currentValue: new Set(['k0']),
        previousValue: new Set(),
        firstChange: false,
        isFirstChange: () => false,
      },
    });
    fixture.detectChanges();

    expect(rows().length).toBe(8);
  });

  it('fäller inte ihop en utfälld lista när en kedja stjärnmärks', () => {
    setChains(12);
    moreButton()?.click();
    fixture.detectChanges();

    favorite('k6');

    expect(rows().length).toBe(8);
  });

  it('växer så att en ny favorit får plats', () => {
    setChains(12, ['k0', 'k1', 'k2', 'k3']);
    expect(rows().length).toBe(4);

    favorite('k0', 'k1', 'k2', 'k3', 'k4');

    expect(rows().length).toBe(5);
  });

  it('börjar om kort när en ny hämtning ger andra kedjor', () => {
    setChains(12);
    moreButton()?.click();
    fixture.detectChanges();
    expect(rows().length).toBe(8);

    // En ny ort ger en annan uppsättning kedjor.
    setChains(9);

    expect(rows().length).toBe(4);
  });

  it('behåller utfällningen när samma kedjor sorteras om', () => {
    setChains(12);
    moreButton()?.click();
    fixture.detectChanges();
    expect(rows().length).toBe(8);

    // Föräldern sorterar om listan vid varje stjärnklick och skickar in en ny
    // array med samma kedjor. Det är ingen ny hämtning.
    const resorted = [...fixture.componentInstance.chains].reverse();
    fixture.componentInstance.chains = resorted;
    fixture.componentInstance.ngOnChanges({
      chains: {
        currentValue: resorted,
        previousValue: [],
        firstChange: false,
        isFirstChange: () => false,
      },
    });
    fixture.detectChanges();

    expect(rows().length).toBe(8);
  });

  it('visar ingen rensa-knapp när inget är ikryssat', () => {
    // Det finns inget "markera alla": att vilja se varje kedja samtidigt är
    // inget riktigt behov.
    setChains(6);
    fixture.componentInstance.selected = new Set();
    fixture.detectChanges();

    expect(bulkButton()).toBeNull();
  });

  it('visar rensa-knappen när något är ikryssat', () => {
    setChains(6);
    fixture.componentInstance.selected = new Set(['k1']);
    fixture.detectChanges();

    expect(bulkButton()?.textContent?.trim()).toBe('Rensa');
  });

  it('rensar hela urvalet, inte bara de synliga', () => {
    setChains(12);
    fixture.componentInstance.selected = new Set(['k0', 'k9']);
    fixture.detectChanges();
    let rensat = 0;
    fixture.componentInstance.clear.subscribe(() => (rensat += 1));

    bulkButton()?.click();

    expect(rensat).toBe(1);
  });

  it('visar alla favoriter även när de är fler än fyra', () => {
    setChains(12, ['k0', 'k1', 'k2', 'k3', 'k4', 'k5']);

    expect(rows().length).toBe(6);
    expect(moreButton()?.textContent).toContain('6 kvar');
  });

  it('visar fyra rader när favoriterna är färre än fyra', () => {
    setChains(12, ['k0', 'k1']);

    expect(rows().length).toBe(4);
    expect(moreButton()?.textContent).toContain('8 kvar');
  });

  it('markerar stjärnan för favoriter och lämnar övriga omarkerade', () => {
    setChains(6, ['k2']);

    // En favorit ryms inom de fyra som visas från början.
    expect(stars().map((star) => star.getAttribute('aria-pressed'))).toEqual([
      'false',
      'false',
      'true',
      'false',
    ]);
  });

  it('skickar vidare vilken kedja stjärnan gäller', () => {
    setChains(6);
    const emitted: string[] = [];
    fixture.componentInstance.favorite.subscribe((id) => emitted.push(id));

    stars()[2].click();

    expect(emitted).toEqual(['k2']);
  });

  it('beskriver vad stjärnan gör åt båda hållen', () => {
    setChains(6, ['k1']);

    expect(stars()[0].getAttribute('aria-label')).toBe('Gör Kedja 0 till favorit');
    expect(stars()[1].getAttribute('aria-label')).toBe('Ta bort Kedja 1 som favorit');
  });

  it('skriver avståndet i raden och i etiketten', () => {
    setChains(4);

    const distances = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.chain .distance')
    ).map((element) => element.textContent?.trim());

    expect(distances[0]).toBe('0 m');
    expect(distances[2]).toBe('1,0 km');
    expect(fixture.componentInstance.label(chain(2))).toBe('Kedja 2, 1,0 km');
  });
});
