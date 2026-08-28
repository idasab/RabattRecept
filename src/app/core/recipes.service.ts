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
 * Kravet: betyget måste vila på fler röster än så här. Ett femma från en enda
 * röst säger ingenting om receptet, bara om den som råkade rösta.
 */
export const MIN_VOTES = 5;

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
 * Hur många ingredienstermer varje vara får svara mot.
 *
 * Källans taxonomi är finkornig: ett recept som använder lök taggas med
 * "gul lök(ar)" eller "rödlök", inte med "lök". Väljer man bara en term per
 * vara sammanfaller de nästan aldrig — ett recept av sextio matchade både
 * nötfärs och lök i en mätning. Med flera termer per vara hittas både fler
 * recept och de fall där ett recept faktiskt använder flera reavaror.
 */
const TERMS_PER_ITEM = 5;

/** Lägsta rang en term måste ha för att räknas som samma vara. */
const MIN_TERM_RANK = 2;

/**
 * Recept på varor som är på rea hos de valda kedjorna.
 *
 * Kedjan är: erbjudandenas rubriker blir söktermer, receptkällan får avgöra
 * vilka av dem som är ingredienser — den känner inte igen "toalettpapper" —
 * och recepten som använder ingredienserna hämtas och sållas på betyg och på
 * hur många som röstat.
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
   * Kopplar varje vara till de ingredienstermer källan kände igen.
   *
   * Sökningen är luddig och rangordnar dåligt, så urvalet görs här: en term
   * som heter precis som varan går före en där varan är ett eget ord i
   * namnet. Termer där ordet bara ingår i en sammansättning duger inte —
   * annars blir "smör" till "smörgåsgurka" och "lök" till
   * "bananschalottenlök". Bland de godkända vinner de som används i flest
   * recept, och de fem bästa får representera varan.
   *
   * Namnet som visas är den bäst rangordnade termens, så att en vara heter
   * samma sak oavsett vilken av dess termer receptet råkade taggas med.
   */
  private matchTerms(
    candidates: readonly Candidate[],
    terms: Map<string, TastelineTerm[]>
  ): Map<number, MatchedCandidate> {
    const matched = new Map<number, MatchedCandidate>();

    for (const candidate of candidates) {
      const ranked = (terms.get(candidate.term) ?? [])
        .map((term) => ({ term, rank: rankTerm(term.name, candidate.term) }))
        .filter((scored) => scored.rank >= MIN_TERM_RANK)
        .sort((a, b) => b.rank - a.rank || b.term.count - a.term.count)
        .slice(0, TERMS_PER_ITEM);

      const ingredient = ranked[0]?.term.name;
      if (!ingredient) {
        continue;
      }

      for (const scored of ranked) {
        // Första varan som gör anspråk på en term får behålla den, annars
        // skulle "lök" och "gul lök" kunna peka på samma erbjudande två gånger.
        if (!matched.has(scored.term.id)) {
          matched.set(scored.term.id, { ...candidate, ingredient });
        }
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
    matched: Map<number, MatchedCandidate>
  ): Found[] {
    const found: Found[] = [];

    for (const entry of raw) {
      const score = entry.meta?.tasteline_recipe_data?.recipe?.rating;
      const rating = Number(score?.rating ?? 0);
      const votes = Number(score?.votes ?? 0);
      if (!(rating >= MIN_RATING) || !(votes > MIN_VOTES)) {
        continue;
      }

      // Ett recept använder ofta flera av veckans reavaror. Alla tas med, så
      // att listan kan sammanfatta vad man faktiskt får billigt och var.
      // Samma vara kan nås via flera av sina termer, så den räknas bara en gång.
      const sources = new Map<string, MatchedCandidate>();
      for (const id of entry.ingredient ?? []) {
        const source = matched.get(id);
        if (source && !sources.has(source.offer.id)) {
          sources.set(source.offer.id, source);
        }
      }

      if (!sources.size) {
        continue;
      }

      found.push({
        recipe: {
          id: entry.id,
          title: decodeTitle(entry.title?.rendered ?? ''),
          url: entry.link,
          rating,
          votes,
          durationMinutes: toMinutes(
            entry.meta?.tasteline_recipe_data?.recipe?.totalDuration
          ),
          image: null,
          matches: [...sources.values()].map((source) => ({
            ingredient: source.ingredient,
            offerHeading: source.offer.heading,
            chainName: source.offer.chainName,
            price: source.offer.price,
            currency: source.offer.currency,
          })),
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
    // Grupperas på den bäst rabatterade varan, alltså den som står först.
    const key = entry.recipe.matches[0].ingredient;
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

/** En vara med det namn dess ingredienstermer ska visas under. */
type MatchedCandidate = Candidate & { ingredient: string };

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

/**
 * Hur väl en ingrediensterm svarar mot varan.
 *
 * 3 betyder samma namn. 2 betyder att varan är termens huvudord, alltså sitter
 * sist och med högst ett ord framför — så fångas "gul lök(ar)" för lök och
 * "saltat smör" för smör. 1 betyder att ordet bara ingår någonstans, vilket
 * inte duger: "smörgåsgurka" är inte smör, och "vegofärs istället för
 * kyckling" är inte kyckling trots att ordet står sist i namnet.
 */
function rankTerm(termName: string, search: string): number {
  // Källan skriver böjningen i parentes: "gul lök(ar)", "vitlöksklyfta(or)".
  const name = normalizeText(termName.replace(/\([^)]*\)/g, ' '));
  const needle = normalizeText(search);

  if (!name || !needle) {
    return 0;
  }
  if (name === needle) {
    return 3;
  }

  const nameWords = name.split(/\s+/);
  const needleWords = needle.split(/\s+/);
  const headIsNeedle = nameWords.slice(-needleWords.length).join(' ') === needle;

  // Ett extra ord framför är en variant av varan; en hel mening är något annat.
  if (headIsNeedle && nameWords.length <= needleWords.length + 1) {
    return 2;
  }
  if (name.includes(needle) || needle.includes(name)) {
    return 1;
  }

  return 0;
}

/**
 * Tillagningstiden i hela minuter. Källan anger den i sekunder och skriver 0
 * när receptet saknar tid — noll minuter vore en lögn, så det blir null.
 */
function toMinutes(seconds: number | undefined): number | null {
  if (!seconds || seconds <= 0) {
    return null;
  }

  return Math.round(seconds / 60);
}

/** WordPress skickar rubriker med HTML-entiteter, t.ex. &#8211; för tankstreck. */
function decodeTitle(title: string): string {
  const element = document.createElement('textarea');
  element.innerHTML = title;
  return element.value.trim();
}
