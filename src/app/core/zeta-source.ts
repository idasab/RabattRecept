import { Injectable, inject } from '@angular/core';
import { Observable, map, of } from 'rxjs';
import { excludedBy } from './food-exclusions';
import { Candidate } from './ingredient-candidates';
import { RecipeSource, passesRating } from './recipe-source';
import { Recipe, RecipeMatch } from './recipes.models';
import { isOutOfSeason } from './seasons';
import { normalizeText } from './text';
import { ZetaRecipe, ZetaService, ingredientNamesOf, ratingOf } from './zeta.service';

/**
 * Zeta som receptkälla.
 *
 * Zeta saknar ingredienstaxonomi, så sökningen är fritext på råvarans namn.
 * Fritext träffar brett — ett recept som bara nämner kyckling i inledningen
 * kommer med — så varje träff kontrolleras mot receptets egen ingredienslista,
 * som lyckligtvis finns strukturerad. Det ersätter taxonomin och gör
 * matchningen minst lika säker som hos Tasteline.
 */
@Injectable({ providedIn: 'root' })
export class ZetaSource implements RecipeSource {
  readonly name = 'Zeta';

  private readonly zeta = inject(ZetaService);

  recipesFor(
    candidates: readonly Candidate[],
    excluded: readonly string[] = []
  ): Observable<Recipe[]> {
    if (!candidates.length) {
      return of([]);
    }

    return this.zeta.searchAll(candidates.map((candidate) => candidate.term)).pipe(
      map((results) => this.toRecipes(candidates, results, excluded))
    );
  }

  /**
   * Ett recept kan träffas av flera råvaror, och ska då räknas en gång med
   * alla sina reavaror samlade — samma sammanfattning som Tasteline ger.
   */
  private toRecipes(
    candidates: readonly Candidate[],
    results: Map<string, ZetaRecipe[]>,
    excluded: readonly string[]
  ): Recipe[] {
    const byId = new Map<number, { recipe: ZetaRecipe; matches: RecipeMatch[] }>();

    for (const candidate of candidates) {
      for (const raw of results.get(candidate.term) ?? []) {
        if (!usesIngredient(raw, candidate.term)) {
          continue;
        }

        // Zeta har ingredienslistan, så uteslutningen kan prövas mot vad
        // receptet faktiskt innehåller och inte bara mot vad det heter.
        if (excludedBy([raw.title?.rendered ?? '', ...ingredientNamesOf(raw)], excluded)) {
          continue;
        }

        // Zeta saknar tillfällestaggar, så årstiden kan bara läsas ur rubriken.
        if (isOutOfSeason(raw.title?.rendered ?? '')) {
          continue;
        }

        const entry = byId.get(raw.id);
        const match: RecipeMatch = {
          ingredient: candidate.term,
          offerHeading: candidate.offer.heading,
          chainName: candidate.offer.chainName,
          price: candidate.offer.price,
          currency: candidate.offer.currency,
        };

        if (entry) {
          entry.matches.push(match);
        } else {
          byId.set(raw.id, { recipe: raw, matches: [match] });
        }
      }
    }

    const recipes: Recipe[] = [];

    for (const { recipe: raw, matches } of byId.values()) {
      const { rating, votes } = ratingOf(raw.zetacompat_rating);
      if (!passesRating(rating, votes)) {
        continue;
      }

      recipes.push({
        id: `Zeta:${raw.id}`,
        source: 'Zeta',
        title: decodeTitle(raw.title?.rendered ?? ''),
        url: raw.link,
        rating,
        votes,
        durationMinutes: toMinutes(raw.zetacompat_time),
        image: raw.zetacompat_featured_image ?? null,
        matches,
      });
    }

    return recipes;
  }
}

/**
 * Sant när råvaran står i receptets ingredienslista.
 *
 * Matchningen görs per ord och godtar början och slutet av ordet, precis som
 * när råvaran känns igen i ett erbjudande: "kyckling" ska träffa
 * ingrediensen "kycklinglårfilé", och "färs" ska träffa "nötfärs".
 */
export function usesIngredient(recipe: ZetaRecipe, term: string): boolean {
  const needle = normalizeText(term);
  if (!needle) {
    return false;
  }

  return ingredientNamesOf(recipe).some((name) =>
    normalizeText(name)
      .split(/[^a-z0-9]+/)
      .filter(Boolean)
      .some((word) => word.startsWith(needle) || word.endsWith(needle))
  );
}

/** Zeta anger tiden i minuter, men som text i vissa recept och inte alls i andra. */
function toMinutes(value: number | string | null | undefined): number | null {
  const minutes = Number(value);
  return Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes) : null;
}

/** WordPress skickar rubriker med HTML-entiteter, t.ex. &#8211; för tankstreck. */
function decodeTitle(title: string): string {
  const element = document.createElement('textarea');
  element.innerHTML = title;
  return element.value.trim();
}
