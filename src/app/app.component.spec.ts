import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, of } from 'rxjs';
import { AppComponent } from './app.component';
import { GeocodingService } from './core/geocoding.service';
import { LocationError, LocationService } from './core/location.service';
import { Coordinates, Offer, OfferBoard, Place } from './core/offers.models';
import { OffersService } from './core/offers.service';

const PLACE: Place = { name: 'Testköping', latitude: 59, longitude: 18 };

function offer(id: string, chainId: string, chainName: string): Offer {
  return {
    id,
    chainId,
    chainName,
    heading: `Vara ${id}`,
    description: '',
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
    { id: 'willys', name: 'Willys', brand: 'Willys', color: '#e60219', logo: null, offerCount: 1 },
    { id: 'coop', name: 'Coop', brand: 'Coop', color: '#005537', logo: null, offerCount: 1 },
  ],
  offers: [offer('1', 'willys', 'Willys'), offer('2', 'coop', 'Coop')],
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
    expect(fixture.componentInstance.visible().length).toBe(2);
  });

  it('döljer kedjans erbjudanden när kryssrutan bockas ur', async () => {
    await create();

    checkboxes()[0].click();
    fixture.detectChanges();

    const visible = fixture.componentInstance.visible();
    expect(visible.length).toBe(1);
    expect(visible[0].chainName).toBe('Coop');
  });

  it('kommer ihåg urvalet till nästa besök', async () => {
    await create();
    checkboxes()[0].click();

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        { provide: LocationService, useClass: StubLocationService },
        { provide: GeocodingService, useClass: StubGeocodingService },
        { provide: OffersService, useClass: StubOffersService },
      ],
    });
    await create();

    expect(checkboxes().map((box) => box.checked)).toEqual([false, true]);
  });

  it('erbjuder ortssökning när platsen nekas', async () => {
    location.result = new LocationError('denied', 'Appen fick inte tillgång till din plats.');

    await create();

    expect(text()).toContain('Appen fick inte tillgång till din plats.');
    expect(fixture.componentInstance.canSearchInstead()).toBeTrue();
  });
});
