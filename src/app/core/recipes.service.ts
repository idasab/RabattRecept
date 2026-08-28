import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map, of } from 'rxjs';
import { ingredientCandidates } from './ingredient-candidates';
import { Offer } from './offers.models';
import { RecipeSource } from './recipe-source';
import { Recipe } from './recipes.models';
import { TastelineSource } from './tasteline-source';
import { ZetaSource } from './zeta-source';

export { MIN_RATING, MIN_VOTES } from './recipe-source';

/**
 * Hur många rabatterade varor som får bli söktermer. Varje vara kostar ett
 * anrop per källa, och tio varor ger gott om recept att välja bland.
 */
const MAX_CANDIDATES = 10;

/**
 * Recept på varor som är på rea hos de valda kedjorna.
 *
 * Kedjan är: erbjudandenas huvudråvaror blir söktermer, varje källa söker på
 * sitt sätt och sållar på betyg och röstantal, och listorna slås sedan ihop
 * här. Att lägga sammanslagningen här och inte i källorna gör att en ny sajt
 * bara behöver kunna svara på "vilka recept har du på de här råvarorna".
 */
@Injectable({ providedIn: 'root' })
export class RecipesService {
  private readonly sources: readonly RecipeSource[] = [
    inject(TastelineSource),
    inject(ZetaSource),
  ];

  recipesFor(offers: readonly Offer[]): Observable<Recipe[]> {
    const candidates = ingredientCandidates(offers, MAX_CANDIDATES);
    if (!candidates.length) {
      return of([]);
    }

    return forkJoin(this.sources.map((source) => source.recipesFor(candidates))).pipe(
      map((results) => this.merge(results.flat()))
    );
  }

  /**
   * Högst betyg först, och vid lika betyg det som flest har tyckt till om.
   * Sedan varvas listan över råvarorna.
   */
  private merge(recipes: Recipe[]): Recipe[] {
    recipes.sort((a, b) => b.rating - a.rating || b.votes - a.votes);
    return spreadOverIngredients(recipes);
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
function spreadOverIngredients(recipes: readonly Recipe[]): Recipe[] {
  const queues = new Map<string, Recipe[]>();

  for (const recipe of recipes) {
    // Grupperas på den bäst rabatterade varan, alltså den som står först.
    const key = recipe.matches[0].ingredient;
    const queue = queues.get(key);
    if (queue) {
      queue.push(recipe);
    } else {
      queues.set(key, [recipe]);
    }
  }

  const spread: Recipe[] = [];
  const pending = [...queues.values()];

  while (spread.length < recipes.length) {
    for (const queue of pending) {
      const next = queue.shift();
      if (next) {
        spread.push(next);
      }
    }
  }

  return spread;
}
