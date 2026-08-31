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

function store(dealerId: string, latitude: number, name = dealerId, website = 'https://willys.se/'): TjekStore {
  return {
    id: `s-${dealerId}-${latitude}`,
    latitude,
    longitude: 11.97,
    dealer: { id: dealerId, name, website, color: 'e2011a', logo: null },
  };
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
    tjek.stores = [
      store('willys', 57.71, 'Willys', 'https://willys.se/'),
      store('byggmax', 57.72, 'Byggmax', 'http://byggmax.se/'),
    ];

    service.board(PLACE, 5).subscribe((board) => {
      expect(board.chains.map((chain) => chain.name)).toEqual(['Willys']);
      expect(board.offers.map((entry) => entry.id)).toEqual(['1']);
      done();
    });
  });

  it('bygger kedjelistan på butikerna, inte på erbjudandena', (done) => {
    // Erbjudandena hämtas kapade, så en kedja kan ha butik i närheten utan att
    // dess erbjudanden kom med. Den ska ändå stå i listan.
    tjek.offers = [offer('1', 'coop', 'Coop', 'http://coop.se')];
    tjek.stores = [
      store('coop', 57.72, 'Coop', 'http://coop.se'),
      store('willys', 57.71, 'Willys', 'https://willys.se/'),
    ];

    service.board(PLACE, 25).subscribe((board) => {
      expect(board.chains.map((chain) => chain.name)).toEqual(['Willys', 'Coop']);
      done();
    });
  });

  it('utesluter kedjor som har erbjudanden men ingen butik i närheten', (done) => {
    // Motsatt fall: erbjudandet gäller ett större område än butikerna vi hittat.
    tjek.offers = [offer('1', 'hemkop', 'Hemköp', 'https://www.hemkop.se/')];
    tjek.stores = [store('willys', 57.71, 'Willys', 'https://willys.se/')];

    service.board(PLACE, 5).subscribe((board) => {
      expect(board.chains.map((chain) => chain.name)).toEqual(['Willys']);
      done();
    });
  });

  it('sorterar kedjorna med den närmaste butiken först', (done) => {
    // 0,01 breddgrad är drygt en kilometer, 0,05 drygt fem.
    tjek.stores = [
      store('fjarran', 57.75, 'Coop', 'http://coop.se'),
      store('nara', 57.71, 'Willys', 'https://willys.se/'),
    ];

    service.board(PLACE, 5).subscribe((board) => {
      expect(board.chains.map((chain) => chain.name)).toEqual(['Willys', 'Coop']);
      expect(board.chains[0].distanceKm).toBeLessThan(board.chains[1].distanceKm as number);
      done();
    });
  });

  it('tar den närmaste butiken när kedjan har flera', (done) => {
    tjek.stores = [store('willys', 57.8), store('willys', 57.71), store('willys', 57.9)];

    service.board(PLACE, 5).subscribe((board) => {
      expect(board.chains[0].distanceKm).toBeCloseTo(1.11, 1);
      done();
    });
  });


  it('hoppar över butiker utan koordinater', (done) => {
    tjek.stores = [
      { id: 'utan', latitude: null, longitude: null, dealer: { id: 'x', name: 'Coop', website: 'http://coop.se', color: null, logo: null } },
      store('willys', 57.71),
    ];

    service.board(PLACE, 5).subscribe((board) => {
      expect(board.chains.map((chain) => chain.name)).toEqual(['willys']);
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
