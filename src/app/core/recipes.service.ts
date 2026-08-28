import { Injectable, inject } from '@angular/core';
import { Observable, map, of, switchMap } from 'rxjs';
import { Candidate, ingredientCandidates } from './ingredient-candidates';
import { Offer } from './offers.models';
import { Recipe } from './recipes.models';
import { normalizeText } from './text';
import { TastelineRecipe, TastelineService, TastelineTerm } from './tasteline.service';

/** Kravet: recept med lägre betyg än så här visas inte. */
export const MIN_RATING = 3.5;

/**
 * Hur många rabatterade varor som får bli söktermer. Varje term kostar ett
 * anrop, och tio varor ger gott om recept att välja bland.
 */
const MAX_CANDIDATES = 10;

/**
 * Hur många recept som hämtas innan betygsgränsen tillämpas. Ungefär hälften
 * brukar falla bort på betyget, så det behövs råmarginal för att kunna visa
 * flera omgångar om fem.
 */
const RECIPE_LIMIT = 60;

/**
 * Recept på varor som är på rea hos de valda kedjorna.
 *
 * Kedjan är: erbjudandenas rubriker blir söktermer, receptkällan får avgöra
 * vilka av dem som är ingredienser — den känner inte igen "toalettpapper" —
 * och recepten som använder ingredienserna hämtas och sållas på betyg.
 */
@Injectable({ providedIn: 'root' })
export class RecipesService {
  private readonly tasteline = inject(TastelineService);

  recipesFor(offers: readonly Offer[]): Observable<Recipe[]> {
    const candidates = ingredientCandidates(offers, MAX_CANDIDATES);
    if (!candidates.length) {
      return of([]);
    }

    return this.tasteline.ingredientsFor(candidates.map((candidate) => candidate.term)).pipe(
      switchMap((terms) => {
        const matched = this.matchTerms(candidates, terms);
        if (!matched.size) {
          return of([] as Recipe[]);
        }

        return this.tasteline
          .recipes([...matched.keys()], RECIPE_LIMIT)
          .pipe(switchMap((raw) => this.withImages(this.toFound(raw, matched))));
      })
    );
  }

  /**
   * Kopplar varje sökterm till den ingrediens källan kände igen. Sökningen är
   * luddig och svarar gärna med "Baconlindad kyckling" på "kyckling", så
   * termen måste dela namn med söktermen åt något håll. Bland dem som gör det
   * vinner den som används i flest recept — det är den vanliga varan.
   */
  private matchTerms(
    candidates: readonly Candidate[],
    terms: Map<string, TastelineTerm[]>
  ): Map<number, Candidate & { ingredient: string }> {
    const matched = new Map<number, Candidate & { ingredient: string }>();

    for (const candidate of candidates) {
      const best = (terms.get(candidate.term) ?? [])
        .filter((term) => relates(term.name, candidate.term))
        .sort((a, b) => b.count - a.count)[0];

      if (best && !matched.has(best.id)) {
        matched.set(best.id, { ...candidate, ingredient: best.name });
      }
    }

    return matched;
  }

  /**
   * Recepten som klarar betygsgränsen, med bildens id kvar vid sidan om —
   * adresserna hämtas först efter sållningen, så att inga bilder slås upp i
   * onödan.
   */
  private toFound(
    raw: readonly TastelineRecipe[],
    matched: Map<number, Candidate & { ingredient: string }>
  ): Found[] {
    const found: Found[] = [];

    for (const entry of raw) {
      const rating = Number(entry.meta?.tasteline_recipe_data?.recipe?.rating?.rating ?? 0);
      if (!(rating >= MIN_RATING)) {
        continue;
      }

      // Receptet kan använda flera av varorna; den första räcker som förklaring.
      const source = (entry.ingredient ?? []).map((id) => matched.get(id)).find(Boolean);
      if (!source) {
        continue;
      }

      found.push({
        recipe: {
          id: entry.id,
          title: decodeTitle(entry.title?.rendered ?? ''),
          url: entry.link,
          rating,
          votes: Number(entry.meta?.tasteline_recipe_data?.recipe?.rating?.votes ?? 0),
          image: null,
          match: {
            ingredient: source.ingredient,
            offerHeading: source.offer.heading,
            chainName: source.offer.chainName,
            price: source.offer.price,
            currency: source.offer.currency,
          },
        },
        attachmentId: firstAttachment(entry),
      });
    }

    // Högst betyg först, och vid lika betyg det som flest har tyckt till om.
    found.sort((a, b) => b.recipe.rating - a.recipe.rating || b.recipe.votes - a.recipe.votes);

    return spreadOverIngredients(found);
  }

  /** Bilderna hämtas i ett enda anrop för hela listan. */
  private withImages(found: readonly Found[]): Observable<Recipe[]> {
    const ids = found
      .map((entry) => entry.attachmentId)
      .filter((id): id is number => id !== null);

    return this.tasteline.images(ids).pipe(
      map((urls) =>
        found.map((entry) => ({
          ...entry.recipe,
          image: entry.attachmentId === null ? null : urls.get(entry.attachmentId) ?? null,
        }))
      )
    );
  }
}

/**
 * Ett varv i taget per vara, i stället för alla blåbärsrecept först.
 *
 * En populär ingrediens kan ha dussintals högt betygsatta recept och skulle
 * annars fylla hela första sidan. Poängen med appen är att visa vad man kan
 * laga av rean — plural — så första omgången ska spegla flera av varorna.
 * Inom varje vara gäller fortfarande betygsordningen.
 */
function spreadOverIngredients(found: readonly Found[]): Found[] {
  const queues = new Map<string, Found[]>();

  for (const entry of found) {
    const key = entry.recipe.match.ingredient;
    const queue = queues.get(key);
    if (queue) {
      queue.push(entry);
    } else {
      queues.set(key, [entry]);
    }
  }

  const spread: Found[] = [];
  const pending = [...queues.values()];

  while (spread.length < found.length) {
    for (const queue of pending) {
      const next = queue.shift();
      if (next) {
        spread.push(next);
      }
    }
  }

  return spread;
}

/** Ett recept på väg genom sållningen, med bildens id kvar. */
interface Found {
  recipe: Recipe;
  attachmentId: number | null;
}

/** Receptets förstabild. Bilderna ligger i en uppslagstabell med ordningsnummer. */
function firstAttachment(entry: TastelineRecipe): number | null {
  const images = Object.values(entry.meta?.tasteline_recipe_data?.images ?? {});
  if (!images.length) {
    return null;
  }

  const first = [...images].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0];
  return first?.attachmentId ?? null;
}

/** Sant när termnamnet och söktermen delar ord åt något håll. */
function relates(termName: string, search: string): boolean {
  const a = normalizeText(termName);
  const b = normalizeText(search);
  return a.includes(b) || b.includes(a);
}

/** WordPress skickar rubriker med HTML-entiteter, t.ex. &#8211; för tankstreck. */
function decodeTitle(title: string): string {
  const element = document.createElement('textarea');
  element.innerHTML = title;
  return element.value.trim();
}
