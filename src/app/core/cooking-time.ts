import { Recipe } from './recipes.models';

export type CookingTimeBand = 'snabbt' | 'lagom' | 'långkok';

interface Band {
  id: CookingTimeBand;
  /** Kort etikett i rutan. Enheten står i rubriken, så den upprepas inte här. */
  short: string;
  /** Utskriven etikett, som läses upp och ger siffran sitt sammanhang. */
  label: string;
  /** Undre gräns i minuter, inklusive. */
  from: number;
  /** Övre gräns i minuter, exklusive. Null betyder uppåt utan tak. */
  to: number | null;
}

/**
 * Tidsspannen man kan kryssa i. Gränserna är valda efter hur man planerar mat
 * i verkligheten snarare än efter jämna tal: under en halvtimme är vardagsmat,
 * upp till en timme är en vanlig middag, och däröver är något man börjar med i
 * god tid.
 */
export const COOKING_TIME_BANDS: readonly Band[] = [
  { id: 'snabbt', short: '< 30', label: 'Under 30 minuter', from: 0, to: 30 },
  { id: 'lagom', short: '30–60', label: '30 till 60 minuter', from: 30, to: 60 },
  { id: 'långkok', short: '> 60', label: 'Över 60 minuter', from: 60, to: null },
];

/** Tidsspannet ett recept hör till, eller null när tiden inte är angiven. */
export function bandFor(recipe: Recipe): CookingTimeBand | null {
  const minutes = recipe.durationMinutes;
  if (minutes === null) {
    return null;
  }

  const band = COOKING_TIME_BANDS.find(
    (entry) => minutes >= entry.from && (entry.to === null || minutes < entry.to)
  );

  return band?.id ?? null;
}

/**
 * Recepten som ryms i de ikryssade tidsspannen.
 *
 * Recept utan angiven tid visas bara när alla spann är ikryssade, alltså när
 * man inte filtrerar på tid alls. Att lägga dem i ett spann vore att lova en
 * tid källan inte anger, och att alltid dölja dem vore att kasta bort recept
 * i onödan.
 */
export function withinCookingTime(
  recipes: readonly Recipe[],
  bands: ReadonlySet<CookingTimeBand>
): Recipe[] {
  const filtering = bands.size < COOKING_TIME_BANDS.length;

  return recipes.filter((recipe) => {
    const band = bandFor(recipe);
    return band === null ? !filtering : bands.has(band);
  });
}
