import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, map, of } from 'rxjs';

/**
 * Tastelines WordPress-API. Det kräver ingen nyckel och svarar med
 * CORS-huvuden, så telefonen kan hämta direkt utan mellanserver — samma
 * villkor som gäller för erbjudandena.
 *
 * Recepten har betyg på femgradig skala, vilket är det som gör källan
 * användbar här: kravet är minst 3,5.
 */
const API_BASE = 'https://www.tasteline.com/wp-json/wp/v2';

/**
 * Utan fältfiltrering skickar API:et hela receptet med steg, näringsvärden
 * och ingredienslistor — 165 kB för tjugo recept i stället för 7 kB.
 */
const RECIPE_FIELDS = [
  'id',
  'link',
  'title.rendered',
  'meta.tasteline_recipe_data.recipe.rating',
  'meta.tasteline_recipe_data.recipe.totalDuration',
  'meta.tasteline_recipe_data.images',
  'ingredient',
].join(',');

/**
 * Sökningen på termer rangordnar inte på användbarhet: "lök" ger
 * "bananschalottenlök" och "Barilla pastasås vitlök och örter" långt före
 * själva "lök", som dyker upp först en bit ner i listan. Därför hämtas många
 * och rangordnas här i stället. Svaret är litet — bara id, namn och antal.
 */
const TERM_PAGE_SIZE = 50;

export interface TastelineTerm {
  id: number;
  name: string;
  /** Hur många recept som använder ingrediensen. */
  count: number;
}

export interface TastelineRecipe {
  id: number;
  link: string;
  title: { rendered: string };
  /** Ingredienstermernas id:n, används för att koppla receptet till en vara. */
  ingredient: number[];
  meta?: {
    tasteline_recipe_data?: {
      recipe?: {
        rating?: { rating?: number; votes?: number | string };
        /** Tillagningstid i sekunder. 0 när receptet inte anger någon. */
        totalDuration?: number;
      };
      images?: Record<string, { attachmentId?: number; order?: number }>;
    };
  };
}

export interface TastelineMedia {
  id: number;
  source_url: string;
  media_details?: { sizes?: { medium?: { source_url?: string } } };
}

@Injectable({ providedIn: 'root' })
export class TastelineService {
  private readonly http = inject(HttpClient);

  /**
   * Ingredienstermer som matchar söktexten. Tom lista när ingen term finns,
   * vilket är hur icke-mat sållas bort: "toalettpapper" är ingen ingrediens.
   */
  ingredients(search: string): Observable<TastelineTerm[]> {
    const params = new HttpParams({
      fromObject: { search, per_page: TERM_PAGE_SIZE, _fields: 'id,name,count' },
    });

    return this.http
      .get<TastelineTerm[]>(`${API_BASE}/ingredient`, { params })
      .pipe(catchError(() => of([] as TastelineTerm[])));
  }

  /** Recept som använder någon av ingredienserna. */
  recipes(termIds: readonly number[], limit: number): Observable<TastelineRecipe[]> {
    if (!termIds.length) {
      return of([]);
    }

    const params = new HttpParams({
      fromObject: {
        ingredient: termIds.join(','),
        per_page: Math.min(limit, 100),
        _fields: RECIPE_FIELDS,
      },
    });

    return this.http
      .get<TastelineRecipe[]>(`${API_BASE}/recipe`, { params })
      .pipe(catchError(() => of([] as TastelineRecipe[])));
  }

  /**
   * Bildadresser för de bilagor recepten pekar ut. Bilderna ligger som
   * id:n i receptsvaret, så adresserna kräver ett eget anrop — ett, för
   * allihop. Misslyckas det visas recepten utan bild.
   */
  images(attachmentIds: readonly number[]): Observable<Map<number, string>> {
    if (!attachmentIds.length) {
      return of(new Map());
    }

    const params = new HttpParams({
      fromObject: {
        include: attachmentIds.join(','),
        per_page: Math.min(attachmentIds.length, 100),
        _fields: 'id,source_url,media_details.sizes.medium.source_url',
      },
    });

    return this.http.get<TastelineMedia[]>(`${API_BASE}/media`, { params }).pipe(
      map((media) => {
        const urls = new Map<number, string>();
        for (const item of media) {
          const url = item.media_details?.sizes?.medium?.source_url ?? item.source_url;
          if (url) {
            urls.set(item.id, url);
          }
        }
        return urls;
      }),
      catchError(() => of(new Map<number, string>()))
    );
  }

  /** Slår upp flera söktermer samtidigt. */
  ingredientsFor(searches: readonly string[]): Observable<Map<string, TastelineTerm[]>> {
    if (!searches.length) {
      return of(new Map());
    }

    return forkJoin(searches.map((search) => this.ingredients(search))).pipe(
      map((results) => new Map(searches.map((search, index) => [search, results[index]])))
    );
  }
}
