import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, map, of } from 'rxjs';

/**
 * Zetas WordPress-API. Ingen nyckel, CORS öppet för alla, 1 455 recept.
 *
 * Till skillnad från Tasteline saknar recepten taxonomier, så sökningen är
 * fritext på råvarans namn. I gengäld finns tillagningstiden som ett rent
 * heltal minuter och ingredienserna som en strukturerad lista, vilket gör att
 * en träff går att kontrollera mot receptets faktiska ingredienser.
 */
const API_BASE = 'https://www.zeta.nu/wp-json/wp/v2';

/** Fälten som behövs. Utan filtret följer hela receptets brödtext med. */
const RECIPE_FIELDS = [
  'id',
  'link',
  'title.rendered',
  'zetacompat_rating',
  'zetacompat_time',
  'zetacompat_featured_image',
  'zetacompat_ingridients',
].join(',');

/** Hur många recept varje råvara får bidra med. */
const PER_SEARCH = 20;

interface IngredientRow {
  recipe_ingredient_name?: string;
}

interface IngredientGroup {
  recipe_ingredient_row?: IngredientRow[];
}

export interface ZetaRecipe {
  id: number;
  link: string;
  title: { rendered: string };
  /** Betyget som färdig HTML, med rösterna i attribut. Se ratingOf. */
  zetacompat_rating?: string | null;
  /** Tillagningstid i minuter. */
  zetacompat_time?: number | string | null;
  zetacompat_featured_image?: string | null;
  zetacompat_ingridients?: IngredientGroup[] | null;
}

/** Betyg och antal röster, utplockade ur betygsmarkupen. */
export interface ZetaRating {
  rating: number;
  votes: number;
}

/**
 * Zeta skickar betyget som färdig HTML i stället för som värden, med summorna
 * i attribut: data-total-votes="7" data-total-points="28" betyder 4,0 av 5.
 * Snittet räknas alltså här. Ändrar Zeta sin markup slutar betygen att läsas,
 * och då faller recepten bort på röstgränsen i stället för att visas fel.
 */
export function ratingOf(markup: string | null | undefined): ZetaRating {
  const votes = Number(/data-total-votes="(\d+)"/.exec(markup ?? '')?.[1] ?? 0);
  const points = Number(/data-total-points="(\d+)"/.exec(markup ?? '')?.[1] ?? 0);

  if (!votes) {
    return { rating: 0, votes: 0 };
  }

  return { rating: points / votes, votes };
}

/** Ingrediensnamnen i ett recept, platt lista. */
export function ingredientNamesOf(recipe: ZetaRecipe): string[] {
  return (recipe.zetacompat_ingridients ?? []).flatMap((group) =>
    (group.recipe_ingredient_row ?? [])
      .map((row) => row.recipe_ingredient_name ?? '')
      .filter(Boolean)
  );
}

@Injectable({ providedIn: 'root' })
export class ZetaService {
  private readonly http = inject(HttpClient);

  /** Recept som matchar söktexten. Tom lista när sökningen misslyckas. */
  search(term: string): Observable<ZetaRecipe[]> {
    const params = new HttpParams({
      fromObject: { search: term, per_page: PER_SEARCH, _fields: RECIPE_FIELDS },
    });

    return this.http
      .get<ZetaRecipe[]>(`${API_BASE}/oa_recipe`, { params })
      .pipe(catchError(() => of([] as ZetaRecipe[])));
  }

  /** Söker på flera råvaror samtidigt och behåller vilken som gav vad. */
  searchAll(terms: readonly string[]): Observable<Map<string, ZetaRecipe[]>> {
    if (!terms.length) {
      return of(new Map());
    }

    return forkJoin(terms.map((term) => this.search(term))).pipe(
      map((results) => new Map(terms.map((term, index) => [term, results[index]])))
    );
  }
}
