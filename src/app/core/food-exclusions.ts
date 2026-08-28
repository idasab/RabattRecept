import { mainIngredientFor } from './main-ingredients';
import { Offer } from './offers.models';
import { normalizeText } from './text';

/**
 * Matvaror man inte vill ha receptförslag på — för att man är allergisk, för
 * att man inte äter dem, eller för att man helt enkelt tröttnat på dem.
 *
 * Uteslutningen görs på erbjudandet, inte på receptet: gäller rean fläskfilé
 * och fläsk är uteslutet, så blir fläskfilén aldrig en sökterm och inga
 * fläskrecept dyker upp. Ett recept kan fortfarande innehålla fläsk som
 * biroll — appen läser inte recepten, den väljer bara vad den söker på.
 *
 * Vissa ord räknas som samma: kyld och färsk är samma tillstånd för kött och
 * kyckling, och den som utesluter det ena menar båda.
 *
 * En uteslutning får bestå av flera ord, och då måste alla finnas i
 * erbjudandet. Det är skillnaden mellan att välja bort en råvara och att välja
 * bort ett visst utförande av den: "kyckling" stoppar all kyckling, medan
 * "färsk kyckling" lämnar den frysta kvar.
 *
 * Både rubriken och beskrivningen läses, för det är i beskrivningen butikerna
 * skriver om varan är färsk, kyld eller djupfryst. Rubriken "KYCKLINGFILÉ"
 * säger ingenting; beskrivningen "IVARS • 2 kg • Djupfryst" säger allt. Priset
 * för det är att beskrivningen också nämner sådant som inte är varan — märke,
 * ursprung, jämförpris — så en uteslutning kan träffa bredare än man tänkt.
 * Att utesluta för mycket är dock det säkra felet när skälet är en allergi.
 */

/**
 * Ord som betyder samma sak i butikstext och därför ska matcha varandra.
 * Kyld och färsk är samma tillstånd för kött och kyckling — butikerna väljer
 * ord olika, och den som utesluter färsk kyckling menar båda. Djupfryst och
 * fryst likaså, åt det håll som ordslutet inte redan täcker.
 */
const SYNONYMS: string[][] = [
  ['färsk', 'kyld'],
  ['fryst', 'djupfryst'],
];

/** Uppslag från ett ord till alla ord som betyder samma sak, inklusive sig självt. */
const SYNONYM_GROUPS = new Map<string, string[]>(
  SYNONYMS.flatMap((group) => {
    const normalized = group.map(normalizeText);
    return normalized.map((word) => [word, normalized] as [string, string[]]);
  })
);

/** Sant när erbjudandet gäller något användaren har uteslutit. */
export function isExcluded(offer: Offer, excluded: readonly string[]): boolean {
  if (!excluded.length) {
    return false;
  }

  const words = [...wordsOf(offer.heading), ...wordsOf(offer.description)];
  const ingredient = mainIngredientFor(offer.heading);
  if (ingredient) {
    words.push(...wordsOf(ingredient));
  }

  return excluded.some((entry) => {
    const needles = wordsOf(entry);

    // Varje ord i uteslutningen måste finnas i erbjudandet. Ordet får sitta i
    // början eller slutet av ett sammansatt varunamn, precis som när råvaran
    // känns igen: "fläsk" ska stoppa "fläskytterfilé".
    return (
      needles.length > 0 &&
      needles.every((needle) =>
        // Ett synonymt ord duger lika bra: "färsk" ska träffa "Kyld."
        (SYNONYM_GROUPS.get(needle) ?? [needle]).some((variant) =>
          words.some((word) => word.startsWith(variant) || word.endsWith(variant))
        )
      )
    );
  });
}

/** Erbjudandena som får ligga till grund för receptsökningen. */
export function withoutExcluded(
  offers: readonly Offer[],
  excluded: readonly string[]
): Offer[] {
  return offers.filter((offer) => !isExcluded(offer, excluded));
}

/**
 * Städar det användaren skrev innan det sparas: trimmat, utan dubbletter och
 * utan tomma rader. Skiftläget behålls så att listan visas som den skrevs.
 */
export function addExclusion(excluded: readonly string[], entry: string): string[] {
  const trimmed = entry.trim();
  if (!trimmed) {
    return [...excluded];
  }

  const needle = normalizeText(trimmed);
  if (excluded.some((existing) => normalizeText(existing) === needle)) {
    return [...excluded];
  }

  return [...excluded, trimmed];
}

export function removeExclusion(excluded: readonly string[], entry: string): string[] {
  const needle = normalizeText(entry);
  return excluded.filter((existing) => normalizeText(existing) !== needle);
}

function wordsOf(value: string): string[] {
  return normalizeText(value)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}
