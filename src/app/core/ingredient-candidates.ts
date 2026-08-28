import { Offer } from './offers.models';

/**
 * Ord som hör till skyltningen eller till satsbygget snarare än till varan.
 * De står ofta kvar efter att skiljetecknen kapats, och utan dem här blir
 * "2 för 40" söktermen "för" — ett anrop som aldrig kan hitta en ingrediens.
 */
const NOISE = new Set([
  'ca',
  'eller',
  'från',
  'för',
  'med',
  'och',
  'per',
  'till',
  'utan',
  'ekologisk',
  'ekologiska',
  'erbjudande',
  'fryst',
  'färsk',
  'färska',
  'gäller',
  'hushåll',
  'jfr',
  'jmf',
  'kg',
  'kund',
  'köp',
  'max',
  'ord',
  'pack',
  'pant',
  'pris',
  'spara',
  'st',
  'stycken',
  'svensk',
  'svenska',
  'svenskt',
  'valfri',
  'valfria',
  'välj',
]);

/** Tecken som inleder villkorstexten efter varunamnet. */
const TAIL = /[,(/•|]|\s[–—-]\s/;

/**
 * Vad ett erbjudande kan tänkas vara för ingrediens, som söktermer.
 *
 * Rubrikerna är butikstext: "Svenskt smör", "Toalettpapper 12-pack",
 * "PEPSI SUITCASE – MAX 2 KÖP/KUND". Först kapas villkoren bort, sedan
 * lämnas två gissningar: hela det rensade uttrycket och dess sista ord.
 * Sista ordet är med därför att svenska varunamn oftast har huvudordet sist —
 * "svenskt smör" är smör, inte svenskt.
 *
 * Ingen bedömning görs här av om det är mat. Det avgör receptkällan, som
 * helt enkelt inte känner igen "toalettpapper" som ingrediens.
 */
export function candidatesFor(heading: string): string[] {
  const cleaned = clean(heading);
  if (!cleaned) {
    return [];
  }

  const words = cleaned.split(' ');
  const last = words[words.length - 1];

  const candidates = [cleaned];
  if (last !== cleaned && last.length >= 3) {
    candidates.push(last);
  }

  return candidates;
}

/** En sökterm och det erbjudande den kom från. */
export interface Candidate {
  term: string;
  offer: Offer;
}

/**
 * Söktermerna för en hel lista erbjudanden, utan dubbletter och i samma
 * ordning som erbjudandena kom. Anropen mot receptkällan kostar, så listan
 * kapas — det är de bästa rabatterna som är värda att laga mat av.
 *
 * Varje term behåller sitt erbjudande, så att receptet sedan kan visa vilken
 * rabatterad vara det var som gav träffen.
 */
export function ingredientCandidates(offers: readonly Offer[], limit: number): Candidate[] {
  const found = new Map<string, Candidate>();

  for (const offer of offers) {
    for (const term of candidatesFor(offer.heading)) {
      if (!found.has(term)) {
        found.set(term, { term, offer });
      }
      if (found.size >= limit) {
        return [...found.values()];
      }
    }
  }

  return [...found.values()];
}

function clean(heading: string): string {
  const head = heading.split(TAIL)[0] ?? '';

  const words = head
    .toLowerCase()
    .replace(/\d+[\s-]?(pack|st|g|kg|ml|cl|dl|l)\b/g, ' ')
    .replace(/[^a-zà-ÿ\s-]/g, ' ')
    .split(/\s+/)
    .map((word) => word.replace(/^-+|-+$/g, ''))
    .filter((word) => word.length >= 3 && !NOISE.has(word));

  // Fler än tre ord är en mening, inte ett varunamn, och söker man på den
  // hittar man ingenting. Huvudordet sitter sist, så det är svansen som sparas.
  return words.slice(-3).join(' ');
}
