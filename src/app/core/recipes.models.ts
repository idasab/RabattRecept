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

export interface Recipe {
  id: number;
  title: string;
  /** Länk till receptsidan hos källan. */
  url: string;
  /** Betyg på femgradig skala. */
  rating: number;
  votes: number;
  image: string | null;
  match: RecipeMatch;
}
