import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, map, of } from 'rxjs';
import { Coordinates } from './offers.models';

/**
 * Tjeks öppna erbjudande-API, samma källa som ereklamblad.se läser. Det kräver
 * ingen nyckel och svarar med CORS-huvuden, så appen kan hämta direkt från
 * telefonen utan mellanserver.
 */
const API_BASE = 'https://squid-api.tjek.com/v2';

/** API:et avvisar större sidor än så här. */
const PAGE_SIZE = 100;

/**
 * Fyra sidor räcker: i en storstad ger det ~400 erbjudanden inom radien, och
 * på mindre orter tar erbjudandena slut långt innan dess. Fler sidor gör mest
 * hämtningen långsammare.
 */
const MAX_PAGES = 4;

/**
 * Butikerna kommer i ungefärlig närhetsordning, så tre sidor räcker för att
 * hitta den närmaste butiken i varje kedja. Källan blandar in bygg, sport och
 * kläder, vilket är varför det behövs fler butiker än kedjor.
 */
const MAX_STORE_PAGES = 3;

export interface TjekDealer {
  id: string;
  name: string;
  website: string | null;
  /** Hexfärg utan brädgård, 'e2011a'. */
  color: string | null;
  logo: string | null;
}

export interface TjekStore {
  id: string;
  dealer_id: string;
  latitude: number | null;
  longitude: number | null;
}

export interface TjekOffer {
  id: string;
  heading: string;
  description: string | null;
  pricing: { price: number; pre_price: number | null; currency: string };
  images: { thumb: string | null; view: string | null; zoom: string | null } | null;
  run_till: string;
  dealer: TjekDealer;
}

@Injectable({ providedIn: 'root' })
export class TjekService {
  private readonly http = inject(HttpClient);

  /** Erbjudanden inom radien, hopslagna från alla sidor. */
  offersNear(coordinates: Coordinates, radiusMeters: number): Observable<TjekOffer[]> {
    const [first, ...rest] = Array.from({ length: MAX_PAGES }, (_, index) =>
      this.page(coordinates, radiusMeters, index * PAGE_SIZE)
    );

    return forkJoin([
      // Första sidan får fela vidare: går inte den fram är hämtningen
      // misslyckad och användaren ska få veta det. Att sida tre saknas märks
      // däremot inte, och då är en kortare lista bättre än ett felmeddelande.
      first,
      ...rest.map((page) => page.pipe(catchError(() => of([] as TjekOffer[])))),
    ]).pipe(map((pages) => this.dedupe(pages.flat())));
  }

  /**
   * Butikerna inom radien. Används bara för att räkna ut hur nära varje kedja
   * ligger; misslyckas hämtningen får kedjorna stå utan avstånd i stället för
   * att hela sidan blir ett fel.
   */
  storesNear(coordinates: Coordinates, radiusMeters: number): Observable<TjekStore[]> {
    const pages = Array.from({ length: MAX_STORE_PAGES }, (_, index) =>
      this.http
        .get<TjekStore[]>(`${API_BASE}/stores`, {
          params: this.params(coordinates, radiusMeters, index * PAGE_SIZE),
        })
        .pipe(catchError(() => of([] as TjekStore[])))
    );

    return forkJoin(pages).pipe(map((results) => results.flat()));
  }

  private page(
    coordinates: Coordinates,
    radiusMeters: number,
    offset: number
  ): Observable<TjekOffer[]> {
    return this.http.get<TjekOffer[]>(`${API_BASE}/offers`, {
      params: this.params(coordinates, radiusMeters, offset),
    });
  }

  private params(coordinates: Coordinates, radiusMeters: number, offset: number): HttpParams {
    return new HttpParams({
      fromObject: {
        r_lat: coordinates.latitude,
        r_lng: coordinates.longitude,
        r_radius: Math.round(radiusMeters),
        limit: PAGE_SIZE,
        offset,
      },
    });
  }

  /** Sidorna kan överlappa när katalogen ändras mitt i hämtningen. */
  private dedupe(offers: TjekOffer[]): TjekOffer[] {
    const seen = new Map<string, TjekOffer>();
    for (const offer of offers) {
      if (!seen.has(offer.id)) {
        seen.set(offer.id, offer);
      }
    }
    return [...seen.values()];
  }
}
