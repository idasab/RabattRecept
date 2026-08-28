import { Observable } from 'rxjs';
import { Candidate } from './ingredient-candidates';
import { Recipe } from './recipes.models';

/** Kravet: recept med lägre betyg än så här visas inte. */
export const MIN_RATING = 3.5;

/**
 * Kravet: betyget måste vila på minst så här många röster. Ett femma från en
 * enda röst säger ingenting om receptet, bara om den som råkade rösta.
 */
export const MIN_VOTES = 5;

/**
 * En receptsajt appen kan hämta från.
 *
 * Varje källa sköter sin egen sökning och sitt eget format, och tillämpar
 * betygs- och röstgränsen själv — bilder och detaljer kostar anrop, och de
 * ska inte hämtas för recept som ändå faller bort. Att slå ihop, sortera och
 * varva listorna är sedan RecipesService uppgift.
 */
export interface RecipeSource {
  readonly name: string;
  /**
   * Recepten som matchar de rabatterade råvarorna, redan sållade på betyg och
   * på det användaren uteslutit.
   *
   * Uteslutningarna måste hanteras av källan och inte i efterhand, för det är
   * bara källan som vet vad receptet innehåller. Ett recept som heter
   * "Laxgryta med saffran" ska bort när saffran är uteslutet, även om det
   * hittades på laxrean.
   */
  recipesFor(
    candidates: readonly Candidate[],
    excluded: readonly string[]
  ): Observable<Recipe[]>;
}

/** Sant när betyget både är högt nog och vilar på tillräckligt många röster. */
export function passesRating(rating: number, votes: number): boolean {
  return rating >= MIN_RATING && votes >= MIN_VOTES;
}
