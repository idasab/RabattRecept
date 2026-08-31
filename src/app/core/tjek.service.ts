import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, switchMap } from 'rxjs';
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
 * Hur många sidor som hämtas åt gången. Fyra parallella anrop är snabbt utan
 * att bli oförskämt mot källan, och räcker hela vägen på en liten ort.
 */
const WAVE = 4;

/**
 * Taket för antal sidor, beroende på radie.
 *
 * Erbjudandena kommer varken i närhetsordning eller i stabil ordning, så en
 * kapad hämtning ger ett slumpmässigt urval snarare än det närmaste. Taket
 * måste därför räcka till hela populationen inom radien. Mätt kring Huskvarna:
 * 549 erbjudanden inom 5 km, 1000 inom 25 km. Taken har marginal över det.
 */
function maxPagesFor(radiusMeters: number): number {
  const km = radiusMeters / 1000;
  if (km <= 2) {
    return 4;
  }
  if (km <= 5) {
    return 8;
  }
  if (km <= 10) {
    return 12;
  }
  return 16;
}

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
  latitude: number | null;
  longitude: number | null;
  /** Kedjan butiken hör till, med namn, färg och webbadress. */
  dealer?: TjekDealer;
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

  /**
   * Erbjudanden inom radien, hopslagna från alla sidor.
   *
   * Sidorna hämtas i omgångar om fyra och fortsätter så länge hela omgången var
   * full — en halvfull sida betyder att erbjudandena tagit slut. Så slipper en
   * liten ort betala för sexton anrop, medan en stor radie ändå får hela
   * populationen.
   */
  offersNear(coordinates: Coordinates, radiusMeters: number): Observable<TjekOffer[]> {
    return this.wave(coordinates, radiusMeters, 0, maxPagesFor(radiusMeters)).pipe(
      map((offers) => this.dedupe(offers))
    );
  }

  private wave(
    coordinates: Coordinates,
    radiusMeters: number,
    from: number,
    cap: number
  ): Observable<TjekOffer[]> {
    const size = Math.min(WAVE, cap - from);
    if (size <= 0) {
      return of([]);
    }

    const pages = Array.from({ length: size }, (_, index) => {
      const page = this.page(coordinates, radiusMeters, (from + index) * PAGE_SIZE);

      // Allra första sidan får fela vidare: går inte den fram är hämtningen
      // misslyckad och användaren ska få veta det. Att sida tolv saknas märks
      // däremot inte, och då är en kortare lista bättre än ett felmeddelande.
      return from === 0 && index === 0
        ? page
        : page.pipe(catchError(() => of([] as TjekOffer[])));
    });

    return forkJoin(pages).pipe(
      switchMap((results) => {
        const here = results.flat();
        const allFull = results.every((page) => page.length === PAGE_SIZE);

        if (!allFull) {
          return of(here);
        }

        return this.wave(coordinates, radiusMeters, from + size, cap).pipe(
          map((next) => [...here, ...next])
        );
      })
    );
  }

  /**
   * Butikerna inom radien. De bär både kedjelistan och avstånden, och till
   * skillnad från erbjudandena växer de monotont med radien — därför är de
   * källan till vilka kedjor som finns i närheten.
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
