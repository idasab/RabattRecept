import { normalizeText } from './text';

interface Occasion {
  /** Visningsnamn, för läsbarhet i koden och i testerna. */
  name: string;
  /** Månaderna då tillfället är i säsong, 1 till 12. */
  months: readonly number[];
  /** Ordbörjan som pekar ut tillfället. */
  stems: readonly string[];
  /** Ordbörjan som inte räknas, trots att en stam matchar. */
  except?: readonly string[];
}

/**
 * Tillfällen som bara hör till en del av året.
 *
 * Ett julrecept i augusti är inget förslag, hur billig fläskkarrén än är.
 * Listan används åt två håll: för att känna igen receptkällans egna
 * tillfällestaggar, och som nät mot receptets rubrik när taggen saknas.
 *
 * Månaderna har marginal framåt, för man lagar inför en högtid och inte bara
 * på dagen. Julen börjar därför i november och påsken i mars.
 */
const OCCASIONS: readonly Occasion[] = [
  {
    name: 'Jul',
    months: [11, 12],
    stems: [
      'jul',
      'advent',
      'pepparkak',
      'glögg',
      'knäck',
      'lussekatt',
      'lucia',
      'saffransbulle',
    ],
    // "juli" och "julienne" börjar på jul utan att ha med julen att göra, och
    // knäckebröd är inte knäck.
    except: ['juli', 'julien', 'knäckebröd', 'knäckig'],
  },
  { name: 'Nyår', months: [12, 1], stems: ['nyår'] },
  { name: 'Alla hjärtans dag', months: [2], stems: ['hjärtans', 'valentin'] },
  { name: 'Fettisdag', months: [2, 3], stems: ['semla', 'semlor', 'fettisdag'] },
  { name: 'Påsk', months: [3, 4], stems: ['påsk'] },
  { name: 'Valborg', months: [4, 5], stems: ['valborg'] },
  { name: 'Student', months: [5, 6], stems: ['student'] },
  { name: 'Midsommar', months: [6], stems: ['midsommar'] },
  { name: 'Sommar', months: [5, 6, 7, 8], stems: ['sommar'], except: ['midsommar'] },
  { name: 'Kräftskiva', months: [8, 9], stems: ['kräftskiva', 'kräftor'] },
  { name: 'Skördetid', months: [8, 9, 10], stems: ['skördetid', 'skörde'] },
  { name: 'Halloween', months: [10], stems: ['halloween'] },
];

/** Tillfället en text handlar om, eller null när den inte hör till något. */
export function occasionOf(text: string): string | null {
  const words = normalizeText(text)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

  if (!words.length) {
    return null;
  }

  for (const occasion of OCCASIONS) {
    const usable = words.filter(
      (word) => !(occasion.except ?? []).some((skip) => word.startsWith(normalizeText(skip)))
    );

    if (occasion.stems.some((stem) => usable.some((word) => word.startsWith(normalizeText(stem))))) {
      return occasion.name;
    }
  }

  return null;
}

/**
 * Sant när texten handlar om ett tillfälle som inte är nu.
 *
 * Texter utan tillfälle svarar false: de flesta recept hör inte till någon
 * högtid, och de ska förstås visas. Bara det som uttryckligen tillhör en annan
 * del av året sållas bort.
 */
export function isOutOfSeason(text: string, now = new Date()): boolean {
  const name = occasionOf(text);
  if (name === null) {
    return false;
  }

  const occasion = OCCASIONS.find((entry) => entry.name === name);
  return occasion ? !occasion.months.includes(now.getMonth() + 1) : false;
}

/** Tillfällena som är i säsong just nu, för att kunna berätta vad som gäller. */
export function occasionsInSeason(now = new Date()): string[] {
  const month = now.getMonth() + 1;
  return OCCASIONS.filter((entry) => entry.months.includes(month)).map((entry) => entry.name);
}
