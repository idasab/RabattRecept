import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map, of, switchMap } from 'rxjs';
import { excludedBy } from './food-exclusions';
import { Candidate } from './ingredient-candidates';
import { RecipeSource, passesRating } from './recipe-source';
import { Recipe } from './recipes.models';
import { isOutOfSeason } from './seasons';
import { TastelineRecipe, TastelineService, TastelineTerm } from './tasteline.service';
import { normalizeText } from './text';

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

/** En vara med det namn dess ingredienstermer ska visas under. */
type MatchedCandidate = Candidate & { ingredient: string };

/** Ett recept på väg genom sållningen, med bildens id kvar. */
interface Found {
  recipe: Recipe;
  attachmentId: number | null;
}

/**
 * Tasteline som receptkälla. Den har en ingredienstaxonomi, så en vara kan
 * slås upp som term och recepten hämtas på term-id i stället för på fritext.
 */
@Injectable({ providedIn: 'root' })
export class TastelineSource implements RecipeSource {
  readonly name = 'Tasteline';

  private readonly tasteline = inject(TastelineService);

  recipesFor(
    candidates: readonly Candidate[],
    excluded: readonly string[] = []
  ): Observable<Recipe[]> {
    if (!candidates.length) {
      return of([]);
    }

    // Råvarorna och uteslutningarna slås upp i samma vända: båda är
    // ingrediensnamn som ska bli term-id, den ena för att hitta recept och
    // den andra för att kasta dem.
    const searches = [...candidates.map((candidate) => candidate.term), ...excluded];

    return forkJoin({
      terms: this.tasteline.ingredientsFor(searches),
      occasions: this.tasteline.occasions(),
    }).pipe(
      switchMap(({ terms, occasions }) => {
        const matched = this.matchTerms(candidates, terms);
        if (!matched.size) {
          return of([] as Recipe[]);
        }

        const banned = bannedTerms(excluded, terms);
        const wrongSeason = outOfSeasonOccasions(occasions);

        return this.tasteline.recipes([...matched.keys()], RECIPE_LIMIT).pipe(
          switchMap((raw) =>
            this.withImages(this.toFound(raw, matched, banned, excluded, wrongSeason))
          )
        );
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
    matched: Map<number, MatchedCandidate>,
    banned: ReadonlySet<number>,
    excluded: readonly string[],
    wrongSeason: ReadonlySet<number>
  ): Found[] {
    const found: Found[] = [];

    for (const entry of raw) {
      // Uteslutet innehåll känns igen på receptets ingredienstermer, och som
      // extra nät på rubriken: "Laxgryta med saffran" ska bort när saffran är
      // uteslutet, även om receptet hittades på laxrean.
      const carries = (entry.ingredient ?? []).some((id) => banned.has(id));
      if (carries || excludedBy([entry.title?.rendered ?? ''], excluded)) {
        continue;
      }

      // Fel årstid: känns igen på receptets egna tillfällestaggar, och som nät
      // på rubriken när taggen saknas.
      const fromWrongSeason = (entry.recipe_occasion ?? []).some((id) => wrongSeason.has(id));
      if (fromWrongSeason || isOutOfSeason(entry.title?.rendered ?? '')) {
        continue;
      }

      const score = entry.meta?.tasteline_recipe_data?.recipe?.rating;
      const rating = Number(score?.rating ?? 0);
      const votes = Number(score?.votes ?? 0);
      if (!passesRating(rating, votes)) {
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
          id: `Tasteline:${entry.id}`,
          source: 'Tasteline',
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

    return found;
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
 * Tillfällena som hör till en annan del av året, som term-id.
 *
 * Källan taggar recepten med sina tillfällen — Jul, Julgodis, Påskmat — och
 * det är den säkraste signalen: ett julrecept med en neutral rubrik fångas
 * ändå. Namnen tolkas av seasons.ts.
 */
function outOfSeasonOccasions(occasions: readonly TastelineTerm[]): Set<number> {
  const wrong = new Set<number>();

  for (const occasion of occasions) {
    if (isOutOfSeason(occasion.name)) {
      wrong.add(occasion.id);
    }
  }

  return wrong;
}

/**
 * Termerna som gör att ett recept ska kastas.
 *
 * Här tas alla dugliga termer, inte bara de fem bästa som vid matchningen —
 * att missa en variant betyder att ett uteslutet recept slinker igenom, och
 * det felet är värre än att kasta ett recept för mycket.
 *
 * En uteslutning på flera ord, som "färsk kyckling", ger ingen term alls.
 * Det är avsiktligt: den säger något om varans skick i butiken, inte att all
 * kyckling ska bort ur recepten.
 */
function bannedTerms(
  excluded: readonly string[],
  terms: Map<string, TastelineTerm[]>
): Set<number> {
  const banned = new Set<number>();

  for (const entry of excluded) {
    for (const term of terms.get(entry) ?? []) {
      if (rankTerm(term.name, entry) >= MIN_TERM_RANK) {
        banned.add(term.id);
      }
    }
  }

  return banned;
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
export function rankTerm(termName: string, search: string): number {
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
