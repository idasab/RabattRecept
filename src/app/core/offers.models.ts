export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface Place extends Coordinates {
  name: string;
  admin1?: string;
  country?: string;
}

/**
 * En matkedja med butik i närheten. Det är butiksformatet som listas, inte
 * varumärket: skillnaden mellan ICA Nära och ICA Maxi är hela poängen när man
 * ska välja var man handlar.
 *
 * Listan byggs på butikerna och inte på erbjudandena, för erbjudandena hämtas
 * kapade och en bredare radie ger då inte ett större urval utan ett annat. En
 * mätning kring Huskvarna gav tolv kedjor från butikerna men bara tio från
 * erbjudandena vid 25 km: Willys och Willys Hemma låg på sida sex och föll
 * bort. Butikerna växer däremot monotont med radien, som man förväntar sig.
 */
export interface Chain {
  id: string;
  name: string;
  /** Varumärket formatet hör till, används för att sortera listan i grupper. */
  brand: string;
  /** Kedjans egen färg, '#e2011a'. Används bara som liten prick, aldrig som yta. */
  color: string;
  logo: string | null;
  /**
   * Fågelvägen till kedjans närmaste butik, i kilometer. Null när ingen butik
   * hittades inom radien — kedjan kan ha erbjudanden som gäller ett större
   * område än de butiker källan känner till.
   */
  distanceKm: number | null;
}

export interface Offer {
  id: string;
  chainId: string;
  chainName: string;
  heading: string;
  description: string;
  price: number;
  /** Ordinarie pris. Saknas för de flesta erbjudanden — då står bara priset. */
  prePrice: number | null;
  currency: string;
  /** Andel av ordinarie pris man sparar, 0–1. Null när ordinarie pris saknas. */
  discount: number | null;
  image: string | null;
  /** Sista giltighetsdag som ISO-sträng. */
  validUntil: string;
}

/** Allt som en hämtning ger: platsen, kedjorna i närheten och erbjudandena. */
export interface OfferBoard {
  place: Place;
  radiusKm: number;
  chains: Chain[];
  offers: Offer[];
  fetchedAt: string;
}
