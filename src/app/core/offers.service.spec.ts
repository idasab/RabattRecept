import { TestBed } from '@angular/core/testing';
import { Observable, of } from 'rxjs';
import { OffersService } from './offers.service';
import { Place } from './offers.models';
import { TjekOffer, TjekService, TjekStore } from './tjek.service';

const PLACE: Place = { name: 'Testköping', latitude: 57.7, longitude: 11.97 };

function offer(id: string, dealerId: string, name: string, website: string): TjekOffer {
  return {
    id,
    heading: `Vara ${id}`,
    description: null,
    pricing: { price: 20, pre_price: 40, currency: 'SEK' },
    images: null,
    run_till: '2099-01-01T00:00:00+0000',
    dealer: { id: dealerId, name, website, color: 'e2011a', logo: null },
  };
}

function store(dealerId: string, latitude: number): TjekStore {
  return { id: `s-${dealerId}-${latitude}`, dealer_id: dealerId, latitude, longitude: 11.97 };
}

class StubTjekService {
  offers: TjekOffer[] = [];
  stores: TjekStore[] = [];

  offersNear(): Observable<TjekOffer[]> {
    return of(this.offers);
  }

  storesNear(): Observable<TjekStore[]> {
    return of(this.stores);
  }
}

describe('OffersService', () => {
  let service: OffersService;
  let tjek: StubTjekService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [OffersService, { provide: TjekService, useClass: StubTjekService }],
    });

    service = TestBed.inject(OffersService);
    tjek = TestBed.inject(TjekService) as unknown as StubTjekService;
  });

  it('sållar bort kedjor som inte säljer mat', (done) => {
    tjek.offers = [
      offer('1', 'willys', 'Willys', 'https://willys.se/'),
      offer('2', 'byggmax', 'Byggmax', 'http://byggmax.se/'),
    ];

    service.board(PLACE, 5).subscribe((board) => {
      expect(board.chains.map((chain) => chain.name)).toEqual(['Willys']);
      expect(board.offers.map((entry) => entry.id)).toEqual(['1']);
      done();
    });
  });

  it('sorterar kedjorna med den närmaste butiken först', (done) => {
    tjek.offers = [
      offer('1', 'fjarran', 'Coop', 'http://coop.se'),
      offer('2', 'nara', 'Willys', 'https://willys.se/'),
    ];
    // 0,01 breddgrad är drygt en kilometer, 0,05 drygt fem.
    tjek.stores = [store('fjarran', 57.75), store('nara', 57.71)];

    service.board(PLACE, 5).subscribe((board) => {
      expect(board.chains.map((chain) => chain.name)).toEqual(['Willys', 'Coop']);
      expect(board.chains[0].distanceKm).toBeLessThan(board.chains[1].distanceKm as number);
      done();
    });
  });

  it('tar den närmaste butiken när kedjan har flera', (done) => {
    tjek.offers = [offer('1', 'willys', 'Willys', 'https://willys.se/')];
    tjek.stores = [store('willys', 57.8), store('willys', 57.71), store('willys', 57.9)];

    service.board(PLACE, 5).subscribe((board) => {
      expect(board.chains[0].distanceKm).toBeCloseTo(1.11, 1);
      done();
    });
  });

  it('lägger kedjor utan känd butik sist, utan avstånd', (done) => {
    tjek.offers = [
      offer('1', 'okand', 'Hemköp', 'https://www.hemkop.se/'),
      offer('2', 'nara', 'Willys', 'https://willys.se/'),
    ];
    tjek.stores = [store('nara', 57.71)];

    service.board(PLACE, 5).subscribe((board) => {
      expect(board.chains.map((chain) => chain.name)).toEqual(['Willys', 'Hemköp']);
      expect(board.chains[1].distanceKm).toBeNull();
      done();
    });
  });

  it('räknar rabatten från ordinarie pris', (done) => {
    tjek.offers = [offer('1', 'willys', 'Willys', 'https://willys.se/')];

    service.board(PLACE, 5).subscribe((board) => {
      expect(board.offers[0].discount).toBeCloseTo(0.5, 5);
      done();
    });
  });
});
