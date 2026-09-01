import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { distanceKm } from './distance';
import { brandOrder, groceryBrandFor } from './grocery-brands';
import { Chain, Offer, Place } from './offers.models';
import { TjekDealer, TjekOffer, TjekService, TjekStore } from './tjek.service';

/** Kedjor utan egen färg i källan får appens neutrala ton. */
const FALLBACK_COLOR = '#6b7f96';

/**
 * Översätter källans data till appens form: kedjelistan byggs på butikerna,
 * erbjudandena sållas till mat, och rabatten räknas fram. Resten av appen ser
 * bara den här formen.
 *
 * Kedjorna och erbjudandena hämtas var för sig, med flit. Kedjelistan är
 * billig och behövs direkt; erbjudandena är den tunga hämtningen — upp till
 * sexton sidor vid stor radie — och behövs först när en kedja är ikryssad.
 */
@Injectable({ providedIn: 'root' })
export class OffersService {
  private readonly tjek = inject(TjekService);

  /** Matkedjorna med butik inom radien, närmast först. */
  chains(place: Place, radiusKm: number): Observable<Chain[]> {
    return this.tjek
      .storesNear(place, radiusKm * 1000)
      .pipe(map((stores) => this.chainsFrom(stores, place)));
  }

  /** Erbjudandena inom radien, sållade till mat. */
  offers(place: Place, radiusKm: number): Observable<Offer[]> {
    return this.tjek.offersNear(place, radiusKm * 1000).pipe(
      map((raw) =>
        raw
          .filter((offer) => groceryBrandFor(offer.dealer?.website))
          .map((offer) => this.toOffer(offer))
      )
    );
  }

  private toOffer(raw: TjekOffer): Offer {
    const price = raw.pricing.price;
    const prePrice = raw.pricing.pre_price;

    return {
      id: raw.id,
      chainId: raw.dealer.id,
      chainName: raw.dealer.name,
      heading: raw.heading?.trim() || 'Erbjudande',
      description: raw.description?.trim() ?? '',
      price,
      prePrice,
      currency: raw.pricing.currency ?? 'SEK',
      // Ordinarie pris saknas för de flesta erbjudanden, och ett påhittat
      // jämförelsetal vore värre än inget: då står bara priset.
      discount: prePrice && prePrice > price ? (prePrice - price) / prePrice : null,
      image: raw.images?.thumb ?? raw.images?.view ?? null,
      validUntil: raw.run_till,
    };
  }

  /**
   * En rad per matkedja med butik inom radien, närmast först.
   *
   * Butikerna är källan och inte erbjudandena, av två skäl. De växer monotont
   * med radien, så listan tappar aldrig en kedja när man drar ut reglaget. Och
   * de bär koordinaterna, så avståndet kommer från samma anrop.
   */
  private chainsFrom(stores: readonly TjekStore[], place: Place): Chain[] {
    const nearest = new Map<string, { dealer: TjekDealer; km: number }>();

    for (const store of stores) {
      const dealer = store.dealer;
      if (!dealer || !groceryBrandFor(dealer.website)) {
        continue;
      }
      if (store.latitude === null || store.longitude === null) {
        continue;
      }

      const km = distanceKm(place, { latitude: store.latitude, longitude: store.longitude });
      const known = nearest.get(dealer.id);
      if (!known || km < known.km) {
        nearest.set(dealer.id, { dealer, km });
      }
    }

    return [...nearest.values()]
      .map(({ dealer, km }) => ({
        id: dealer.id,
        name: dealer.name,
        brand: groceryBrandFor(dealer.website) ?? dealer.name,
        color: this.colorOf(dealer),
        logo: dealer.logo,
        distanceKm: km,
      }))
      .sort(byDistance);
  }

  private colorOf(dealer: TjekDealer): string {
    const color = dealer.color?.trim();
    if (!color || !/^#?[0-9a-f]{6}$/i.test(color)) {
      return FALLBACK_COLOR;
    }
    return color.startsWith('#') ? color : `#${color}`;
  }
}

/**
 * Närmast först. Kedjor utan känt avstånd hamnar sist i stället för att räknas
 * som noll kilometer, och sorteras då varumärkesvis.
 */
function byDistance(a: Chain, b: Chain): number {
  if (a.distanceKm !== null && b.distanceKm !== null) {
    return a.distanceKm - b.distanceKm || a.name.localeCompare(b.name, 'sv');
  }
  if (a.distanceKm !== null) {
    return -1;
  }
  if (b.distanceKm !== null) {
    return 1;
  }

  return brandOrder(a.brand) - brandOrder(b.brand) || a.name.localeCompare(b.name, 'sv');
}
