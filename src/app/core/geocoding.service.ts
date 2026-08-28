import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { Coordinates, Place } from './offers.models';

interface SearchResponse {
  results?: {
    name: string;
    admin1?: string;
    country?: string;
    latitude: number;
    longitude: number;
  }[];
}

interface ReverseResponse {
  city?: string;
  locality?: string;
  principalSubdivision?: string;
  countryName?: string;
}

@Injectable({ providedIn: 'root' })
export class GeocodingService {
  private readonly http = inject(HttpClient);

  /** Fritextsökning på ortsnamn, används när positionen inte är tillgänglig. */
  search(query: string): Observable<Place[]> {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      return of([]);
    }

    const params = new HttpParams({
      fromObject: { name: trimmed, count: 6, language: 'sv', format: 'json' },
    });

    return this.http
      .get<SearchResponse>('https://geocoding-api.open-meteo.com/v1/search', { params })
      .pipe(
        map((response) =>
          (response.results ?? []).map((result) => ({
            name: result.name,
            admin1: result.admin1,
            country: result.country,
            latitude: result.latitude,
            longitude: result.longitude,
          }))
        ),
        catchError(() => of([]))
      );
  }

  /**
   * Sätter ett namn på koordinaterna vi fick från GPS:en. Misslyckas det får
   * platsen heta "Din plats" — namnet är trevligt men inte nödvändigt.
   */
  describe(coordinates: Coordinates): Observable<Place> {
    const fallback: Place = { ...coordinates, name: 'Din plats' };
    const params = new HttpParams({
      fromObject: {
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        localityLanguage: 'sv',
      },
    });

    return this.http
      .get<ReverseResponse>('https://api.bigdatacloud.net/data/reverse-geocode-client', { params })
      .pipe(
        map((response) => {
          const name = response.city || response.locality;
          if (!name) {
            return fallback;
          }
          return {
            ...coordinates,
            name,
            admin1: response.principalSubdivision,
            country: response.countryName,
          };
        }),
        catchError(() => of(fallback))
      );
  }
}
