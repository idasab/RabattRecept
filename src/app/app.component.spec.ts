import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, of } from 'rxjs';
import { AppComponent } from './app.component';
import { GeocodingService } from './core/geocoding.service';
import { LocationError, LocationService } from './core/location.service';
import { Coordinates, Offer, OfferBoard, Place } from './core/offers.models';
import { OffersService } from './core/offers.service';
import { Recipe } from './core/recipes.models';
import { RecipesService } from './core/recipes.service';

const PLACE: Place = { name: 'Testköping', latitude: 59, longitude: 18 };

function offer(
  id: string,
  chainId: string,
  chainName: string,
  heading = `Vara ${id}`,
  description = ''
): Offer {
  return {
    id,
    chainId,
    chainName,
    heading,
    description,
    price: 10,
    prePrice: null,
    currency: 'SEK',
    discount: null,
    image: null,
    validUntil: '2099-01-01T00:00:00+0000',
  };
}

const BOARD: OfferBoard = {
  place: PLACE,
  radiusKm: 5,
  chains: [
    {
      id: 'willys',
      name: 'Willys',
      brand: 'Willys',
      color: '#e60219',
      logo: null,
      offerCount: 1,
      distanceKm: 0.4,
    },
    {
      id: 'coop',
      name: 'Coop',
      brand: 'Coop',
      color: '#005537',
      logo: null,
      offerCount: 1,
      distanceKm: 1.2,
    },
  ],
  offers: [
    offer('1', 'willys', 'Willys', 'Kycklinglårfilé', 'Kronfågel. Ursprung Sverige.'),
    offer('2', 'coop', 'Coop', 'Fläskytterfilé', 'Ursprung Tyskland.'),
  ],
  fetchedAt: '2026-08-28T07:00:00.000Z',
};

class StubLocationService {
  result: Coordinates | LocationError = { latitude: 59, longitude: 18 };

  current(): Promise<Coordinates> {
    if (this.result instanceof LocationError) {
      return Promise.reject(this.result);
    }
    return Promise.resolve(this.result);
  }
}

class StubGeocodingService {
  describe(): Observable<Place> {
    return of(PLACE);
  }
  search(): Observable<Place[]> {
    return of([]);
  }
}

class StubOffersService {
  board(): Observable<OfferBoard> {
    return of(BOARD);
  }
}

class StubRecipesService {
  /** Speglar vilka kedjor som var ikryssade när recepten begärdes. */
  lastSeedChains: string[] = [];

  recipesFor(offers: readonly { chainName: string }[]): Observable<readonly Recipe[]> {
    this.lastSeedChains = [...new Set(offers.map((offer) => offer.chainName))];
    return of([]);
  }
}

describe('AppComponent', () => {
  let fixture: ComponentFixture<AppComponent>;
  let location: StubLocationService;

  async function create(): Promise<void> {
    fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  function element<T extends HTMLElement>(selector: string): T | null {
    return (fixture.nativeElement as HTMLElement).querySelector<T>(selector);
  }

  function stars(): HTMLButtonElement[] {
    return Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(
        'app-chain-filter .star'
      )
    );
  }

  function chainNames(): string[] {
    return Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('app-chain-filter .chain .name')
    ).map((element) => element.textContent?.trim() ?? '');
  }

  function restart(): Promise<void> {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        { provide: LocationService, useClass: StubLocationService },
        { provide: GeocodingService, useClass: StubGeocodingService },
        { provide: OffersService, useClass: StubOffersService },
        { provide: RecipesService, useClass: StubRecipesService },
      ],
    });
    return create();
  }

  function checkboxes(): HTMLInputElement[] {
    return Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLInputElement>(
        'app-chain-filter input[type="checkbox"]'
      )
    );
  }

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        { provide: LocationService, useClass: StubLocationService },
        { provide: GeocodingService, useClass: StubGeocodingService },
        { provide: OffersService, useClass: StubOffersService },
        { provide: RecipesService, useClass: StubRecipesService },
      ],
    });

    location = TestBed.inject(LocationService) as unknown as StubLocationService;
  });

  afterEach(() => localStorage.clear());

  it('visar platsen och alla kedjor ikryssade från början', async () => {
    await create();

    expect(text()).toContain('Testköping');
    expect(checkboxes().length).toBe(2);
    expect(checkboxes().every((box) => box.checked)).toBeTrue();
    expect(fixture.componentInstance.selectedOffers().length).toBe(2);
  });

  it('döljer kedjans erbjudanden när kryssrutan bockas ur', async () => {
    await create();

    checkboxes()[0].click();
    fixture.detectChanges();

    const visible = fixture.componentInstance.selectedOffers();
    expect(visible.length).toBe(1);
    expect(visible[0].chainName).toBe('Coop');
  });

  it('kommer ihåg urvalet till nästa besök när inga favoriter finns', async () => {
    await create();
    checkboxes()[0].click();

    await restart();

    expect(checkboxes().map((box) => box.checked)).toEqual([false, true]);
  });

  it('lyfter favoriten överst och kryssar i den', async () => {
    await create();
    expect(chainNames()).toEqual(['Willys', 'Coop']);

    // Stjärnmärk Coop, som ligger sist.
    stars()[1].click();
    fixture.detectChanges();

    expect(chainNames()).toEqual(['Coop', 'Willys']);
    expect(fixture.componentInstance.favorites().has('coop')).toBeTrue();
    expect(fixture.componentInstance.selected().has('coop')).toBeTrue();
  });

  it('kryssar i exakt favoriterna vid start, inga andra', async () => {
    await create();
    // Allt är ikryssat första besöket, och Coop blir favorit.
    expect(fixture.componentInstance.selected().size).toBe(2);
    stars()[1].click();

    await restart();

    expect(chainNames()).toEqual(['Coop', 'Willys']);
    expect(checkboxes().map((box) => box.checked)).toEqual([true, false]);
    expect(fixture.componentInstance.selectedOffers().map((offer) => offer.chainName)).toEqual(['Coop']);
  });

  it('behåller favoriten men inte ett tillfälligt kryss över en omstart', async () => {
    await create();
    stars()[1].click();
    await restart();
    expect(checkboxes().map((box) => box.checked)).toEqual([true, false]);

    // Willys kryssas i utöver favoriten, alltså bara för det här besöket.
    checkboxes()[1].click();
    expect(fixture.componentInstance.selected().size).toBe(2);

    await restart();

    expect(checkboxes().map((box) => box.checked)).toEqual([true, false]);
  });

  it('tar bort favoritmärkningen när stjärnan trycks igen', async () => {
    await create();
    stars()[1].click();
    fixture.detectChanges();
    expect(fixture.componentInstance.favorites().has('coop')).toBeTrue();

    stars()[0].click();
    fixture.detectChanges();

    expect(fixture.componentInstance.favorites().size).toBe(0);
    expect(chainNames()).toEqual(['Willys', 'Coop']);
  });

  it('utesluter varor man valt bort ur underlaget för recepten', async () => {
    await create();
    expect(fixture.componentInstance.selectedOffers().length).toBe(2);

    fixture.componentInstance.excludeFood('fläsk');
    fixture.detectChanges();

    expect(fixture.componentInstance.selectedOffers().map((entry) => entry.heading)).toEqual([
      'Kycklinglårfilé',
    ]);
  });

  it('kommer ihåg de uteslutna varorna till nästa besök', async () => {
    await create();
    fixture.componentInstance.excludeFood('Fläsk');

    await restart();

    expect(fixture.componentInstance.excludedFoods()).toEqual(['Fläsk']);
    expect(fixture.componentInstance.selectedOffers().length).toBe(1);
  });

  it('tar tillbaka varan när uteslutningen ångras', async () => {
    await create();
    fixture.componentInstance.excludeFood('fläsk');
    fixture.detectChanges();
    expect(fixture.componentInstance.selectedOffers().length).toBe(1);

    fixture.componentInstance.allowFood('FLÄSK');
    fixture.detectChanges();

    expect(fixture.componentInstance.selectedOffers().length).toBe(2);
  });

  it('öppnar och stänger inställningsmenyn från kugghjulet', async () => {
    await create();
    expect(fixture.componentInstance.settingsOpen()).toBeFalse();
    expect(element('app-settings-menu .panel')).toBeNull();

    element<HTMLButtonElement>('.icon.settings')?.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.settingsOpen()).toBeTrue();
    expect(element('app-settings-menu .panel')).not.toBeNull();

    element<HTMLButtonElement>('app-settings-menu .close')?.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.settingsOpen()).toBeFalse();
  });

  it('lämnar fokus på kugghjulet när menyn stängs', async () => {
    await create();
    const gear = element<HTMLButtonElement>('.icon.settings');

    gear?.click();
    fixture.detectChanges();
    fixture.componentInstance.closeSettings();

    expect(document.activeElement).toBe(gear);
  });

  it('markerar kugghjulet med en prick när något är påslaget', async () => {
    await create();
    expect(element('.badge')).toBeNull();

    fixture.componentInstance.excludeFood('fläsk');
    fixture.detectChanges();

    // En prick, ingen siffra: antalet står i den upplästa etiketten.
    expect(element('.badge')).not.toBeNull();
    expect(element('.badge')?.textContent?.trim()).toBe('');
  });

  it('tar bort pricken när inställningarna nollställs', async () => {
    await create();
    fixture.componentInstance.excludeFood('fläsk');
    fixture.detectChanges();
    expect(element('.badge')).not.toBeNull();

    fixture.componentInstance.allowFood('fläsk');
    fixture.detectChanges();

    expect(element('.badge')).toBeNull();
  });

  it('säger i klartext hur många inställningar som är aktiva', async () => {
    await create();
    const gear = () => element<HTMLButtonElement>('.icon.settings');
    expect(gear()?.getAttribute('aria-label')).toBe('Inställningar');

    fixture.componentInstance.excludeFood('fläsk');
    fixture.detectChanges();
    expect(gear()?.getAttribute('aria-label')).toBe('Inställningar, 1 aktiv');

    fixture.componentInstance.chooseSwedishMeat(true);
    fixture.detectChanges();
    expect(gear()?.getAttribute('aria-label')).toBe('Inställningar, 2 aktiva');
  });

  it('kräver svenskmärkning av kött när filtret är på', async () => {
    await create();
    expect(fixture.componentInstance.selectedOffers().length).toBe(2);

    fixture.componentInstance.chooseSwedishMeat(true);
    fixture.detectChanges();

    // Kycklingen är märkt svensk; fläsket kommer från Tyskland.
    expect(fixture.componentInstance.selectedOffers().map((entry) => entry.heading)).toEqual([
      'Kycklinglårfilé',
    ]);
  });

  it('kommer ihåg köttfiltret till nästa besök', async () => {
    await create();
    fixture.componentInstance.chooseSwedishMeat(true);

    await restart();

    expect(fixture.componentInstance.onlySwedishMeat()).toBeTrue();
    expect(fixture.componentInstance.selectedOffers().length).toBe(1);
  });

  it('har en platsknapp på rubrikraden som hämtar positionen', async () => {
    location.result = { latitude: 59, longitude: 18 };
    await create();

    const button = element<HTMLButtonElement>('.place .head .locate');
    expect(button?.textContent?.trim()).toContain('Min plats');

    // Knappen låses medan hämtningen pågår, så den inte trycks två gånger.
    fixture.componentInstance.loading.set(true);
    fixture.detectChanges();
    expect(element<HTMLButtonElement>('.place .head .locate')?.disabled).toBeTrue();
  });

  it('erbjuder ortssökning när platsen nekas', async () => {
    location.result = new LocationError('denied', 'Appen fick inte tillgång till din plats.');

    await create();

    expect(text()).toContain('Appen fick inte tillgång till din plats.');
    expect(fixture.componentInstance.canSearchInstead()).toBeTrue();
  });
});
