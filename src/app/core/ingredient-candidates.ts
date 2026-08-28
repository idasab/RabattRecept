import { mainIngredientFor } from './main-ingredients';
import { Offer } from './offers.models';

/** En sökterm och det erbjudande den kom från. */
export interface Candidate {
  term: string;
  offer: Offer;
}

/**
 * Söktermerna för en lista erbjudanden: en per rabatterad huvudråvara, utan
 * dubbletter och i samma ordning som erbjudandena kom.
 *
 * Bara huvudråvaror blir söktermer. Ett recept ska föreslås för att dess
 * huvudingrediens är nedsatt, inte för att smöret eller grädden i det råkar
 * vara det — de ingår i nästan varje recept och säger inget om vad man ska
 * laga. Resten av rean sållas därför bort här, hur stor rabatten än är.
 *
 * Anropen mot receptkällan kostar, så listan kapas vid gränsen. Erbjudandena
 * kommer med störst rabatt först, så det är de bästa fynden som blir kvar.
 */
export function ingredientCandidates(offers: readonly Offer[], limit: number): Candidate[] {
  const found = new Map<string, Candidate>();

  for (const offer of offers) {
    const term = mainIngredientFor(offer.heading);
    if (!term || found.has(term)) {
      continue;
    }

    found.set(term, { term, offer });
    if (found.size >= limit) {
      break;
    }
  }

  return [...found.values()];
}
