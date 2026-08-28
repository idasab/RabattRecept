/** Det rabatterade som gav receptträffen, så att kopplingen syns i listan. */
export interface RecipeMatch {
  /** Ingrediensen som receptkällan kände igen, t.ex. "Nötfärs". */
  ingredient: string;
  /** Erbjudandets rubrik, som den står i reklambladet. */
  offerHeading: string;
  chainName: string;
  price: number;
  currency: string;
}

/** Sajten receptet kommer från. Visas på kortet, för källorna skiljer sig åt. */
export type RecipeSourceName = 'Tasteline' | 'Zeta';

export interface Recipe {
  /** Källa och id ihop, eftersom sajternas id-serier överlappar. */
  id: string;
  source: RecipeSourceName;
  title: string;
  /** Länk till receptsidan hos källan. */
  url: string;
  /** Betyg på femgradig skala. */
  rating: number;
  votes: number;
  /** Tillagningstid i minuter, eller null när receptet inte anger någon. */
  durationMinutes: number | null;
  image: string | null;
  /**
   * Alla rabatterade varor receptet använder, i erbjudandenas ordning, alltså
   * störst rabatt först. Alltid minst en — ett recept utan träff kommer aldrig
   * med i listan.
   */
  matches: readonly RecipeMatch[];
}
