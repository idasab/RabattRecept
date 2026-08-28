import { normalizeText } from './text';

interface MainIngredient {
  /** Söktermen som skickas till receptkällan. */
  name: string;
  /** Ord i erbjudandets rubrik som pekar ut råvaran. */
  stems: string[];
  /**
   * Ordbörjan som gör att ordet inte räknas, trots att en stam matchar.
   * Kaffebönor är inte bönor, korvbröd är inte korv, och "färsk" börjar på
   * "färs" utan att ha med köttfärs att göra.
   */
  except?: string[];
}

/**
 * Råvaror som en maträtt byggs kring.
 *
 * Poängen med appen är att huvudråvaran ska vara nedsatt — kyckling,
 * fläskytterfilé, köttfärs — inte smör eller grädde, som är en liten del av
 * rätten och finns i nästan varje recept. Bara varor i den här listan blir
 * söktermer; resten av rean används inte för att leta recept, hur stor
 * rabatten än är.
 *
 * Ordningen avgör: den första posten som matchar vinner, så mer specifika
 * råvaror står före de allmänna. Annars skulle falukorv bli "korv" och
 * fläskkotlett bli "kotlett".
 *
 * Varje namn är kontrollerat mot receptkällans ingredienslista och finns där
 * som en egen term. Lägger man till en rad bör den kontrolleras på samma sätt,
 * annars blir varan en sökning som aldrig ger träff.
 */
const MAIN_INGREDIENTS: MainIngredient[] = [
  // Fågel
  { name: 'Kyckling', stems: ['kyckling'], except: ['kycklingbuljong', 'kycklingfond'] },
  { name: 'Kalkon', stems: ['kalkon'] },
  { name: 'Anka', stems: ['anka'] },

  // Nöt — färsvarianterna före den allmänna "färs".
  { name: 'Nötfärs', stems: ['nötfärs'] },
  { name: 'Blandfärs', stems: ['blandfärs'] },
  { name: 'Köttfärs', stems: ['köttfärs', 'färs'], except: ['färsk'] },
  { name: 'Högrev', stems: ['högrev'] },
  { name: 'Entrecôte', stems: ['entrecôte', 'entrecote'] },
  { name: 'Oxfilé', stems: ['oxfilé', 'oxfile'] },
  { name: 'Ryggbiff', stems: ['ryggbiff'] },

  // Fläsk — de sammansatta före karré och kotlett.
  { name: 'Fläskfilé', stems: ['fläskfilé', 'fläskfile', 'ytterfilé', 'ytterfile'] },
  { name: 'Fläskkarré', stems: ['fläskkarré', 'karré'] },
  { name: 'Fläskkotlett', stems: ['fläskkotlett', 'kotlett'] },
  { name: 'Kassler', stems: ['kassler'] },
  { name: 'Revbensspjäll', stems: ['revbensspjäll', 'revben'] },
  { name: 'Bacon', stems: ['bacon'] },
  { name: 'Skinka', stems: ['skinka'] },

  { name: 'Lamm', stems: ['lamm'] },

  // Fisk och skaldjur
  { name: 'Lax', stems: ['lax'] },
  { name: 'Torsk', stems: ['torsk'] },
  { name: 'Sej', stems: ['sej'] },
  { name: 'Kolja', stems: ['kolja'] },
  { name: 'Rödspätta', stems: ['rödspätta'] },
  { name: 'Sill', stems: ['sill'] },
  { name: 'Makrill', stems: ['makrill'] },
  { name: 'Tonfisk', stems: ['tonfisk'] },
  { name: 'Räkor', stems: ['räkor', 'räka'] },
  { name: 'Musslor', stems: ['musslor', 'mussla'] },

  // Korv — falukorven före den allmänna korven.
  { name: 'Falukorv', stems: ['falukorv'] },
  { name: 'Korv', stems: ['korv'], except: ['korvbröd'] },

  { name: 'Ägg', stems: ['ägg'] },

  // Vegetariska huvudråvaror
  { name: 'Tofu', stems: ['tofu'] },
  { name: 'Quorn', stems: ['quorn'] },
  { name: 'Halloumi', stems: ['halloumi'] },
  { name: 'Linser', stems: ['linser'] },
  { name: 'Kikärtor', stems: ['kikärtor', 'kikärter'] },
  { name: 'Bönor', stems: ['bönor'], except: ['kaffebön', 'kakaobön', 'vaniljbön'] },
];

/** Stammarna avdiakritiserade en gång, så att jämförelsen slipper göra om det. */
const PREPARED = MAIN_INGREDIENTS.map((entry) => ({
  name: entry.name,
  stems: entry.stems.map(normalizeText),
  except: (entry.except ?? []).map(normalizeText),
}));

/** Alla huvudråvaror appen känner till, i listans ordning. */
export function mainIngredientNames(): string[] {
  return MAIN_INGREDIENTS.map((entry) => entry.name);
}

/**
 * Huvudråvaran ett erbjudande gäller, som sökterm, eller null när varan inte
 * är något man bygger en måltid kring.
 *
 * Matchningen görs per ord och godtar både början och slutet av ordet, för
 * svenska varunamn sätter ihop råvaran åt båda hållen: "kycklinglårfilé"
 * börjar med råvaran, "blandfärs" slutar med den.
 */
export function mainIngredientFor(heading: string): string | null {
  const words = normalizeText(heading)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

  if (!words.length) {
    return null;
  }

  for (const entry of PREPARED) {
    const usable = words.filter(
      (word) => !entry.except.some((excluded) => word.startsWith(excluded))
    );

    for (const stem of entry.stems) {
      if (usable.some((word) => word.startsWith(stem) || word.endsWith(stem))) {
        return entry.name;
      }
    }
  }

  return null;
}
