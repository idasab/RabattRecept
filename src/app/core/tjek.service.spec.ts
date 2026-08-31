import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TjekOffer, TjekService } from './tjek.service';

const PLACE = { latitude: 57.7, longitude: 11.97 };

let nästaId = 0;

/** Ett svar med så många erbjudanden som begärts, med unika id:n. */
function page(count: number): TjekOffer[] {
  return Array.from({ length: count }, () => ({
    id: `o${nästaId++}`,
    heading: 'Vara',
    description: null,
    pricing: { price: 10, pre_price: null, currency: 'SEK' },
    images: null,
    run_till: '2099-01-01T00:00:00+0000',
    dealer: { id: 'd', name: 'Willys', website: 'https://willys.se/', color: null, logo: null },
  }));
}

describe('TjekService', () => {
  let service: TjekService;
  let http: HttpTestingController;

  beforeEach(() => {
    nästaId = 0;
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(TjekService);
    http = TestBed.inject(HttpTestingController);
  });

  /**
   * Besvarar omgång efter omgång tills tjänsten slutar fråga, och returnerar
   * hur många sidanrop det blev. Måste loopa: varje omgång skapas först när
   * den förra besvarats.
   */
  function körKlart(perSida: number): number {
    let sidor = 0;

    for (let varv = 0; varv < 20; varv += 1) {
      const väntande = http.match((request) => request.url.endsWith('/offers'));
      if (!väntande.length) {
        break;
      }
      sidor += väntande.length;
      väntande.forEach((request) => request.flush(page(perSida)));
    }

    return sidor;
  }

  it('hämtar fyra sidor vid liten radie', () => {
    let hämtade = 0;
    service.offersNear(PLACE, 2000).subscribe((offers) => (hämtade = offers.length));

    expect(körKlart(100)).toBe(4);
    expect(hämtade).toBe(400);
  });

  it('hämtar åtta sidor vid mellanradie', () => {
    service.offersNear(PLACE, 5000).subscribe();

    expect(körKlart(100)).toBe(8);
  });

  it('hämtar sexton sidor vid största radien', () => {
    // Erbjudandena kommer i ostabil ordning, så en kapad hämtning ger ett
    // slumpmässigt urval. Taket måste räcka till hela populationen.
    service.offersNear(PLACE, 25000).subscribe();

    expect(körKlart(100)).toBe(16);
  });

  it('slutar fråga när en omgång inte var full', () => {
    // En halvfull sida betyder att erbjudandena tagit slut. En liten ort ska
    // inte betala för sexton anrop.
    let hämtade = 0;
    service.offersNear(PLACE, 25000).subscribe((offers) => (hämtade = offers.length));

    expect(körKlart(50)).toBe(4);
    expect(hämtade).toBe(200);
  });

  it('tar bort dubbletter mellan sidorna', () => {
    let hämtade = 0;
    service.offersNear(PLACE, 2000).subscribe((offers) => (hämtade = offers.length));

    const väntande = http.match((request) => request.url.endsWith('/offers'));
    const samma = page(50);
    väntande.forEach((request) => request.flush(samma));

    expect(hämtade).toBe(50);
  });

  it('låter första sidans fel gå vidare', () => {
    let fel: unknown = null;
    service.offersNear(PLACE, 2000).subscribe({ error: (error) => (fel = error) });

    const väntande = http.match((request) => request.url.endsWith('/offers'));
    väntande[0].flush('nej', { status: 500, statusText: 'Server Error' });

    expect(fel).not.toBeNull();
  });

  it('sväljer fel på senare sidor', () => {
    let hämtade = -1;
    service.offersNear(PLACE, 2000).subscribe((offers) => (hämtade = offers.length));

    const väntande = http.match((request) => request.url.endsWith('/offers'));
    väntande[0].flush(page(10));
    väntande
      .slice(1)
      .forEach((request) => request.flush('nej', { status: 500, statusText: 'Server Error' }));

    // En kortare lista är bättre än ett felmeddelande när bara en sida saknas.
    expect(hämtade).toBe(10);
  });
});
