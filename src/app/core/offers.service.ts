import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map } from 'rxjs';
import { distanceKm } from './distance';
import { brandOrder, groceryBrandFor } from './grocery-brands';
import { Chain, Offer, OfferBoard, Place } from './offers.models';
import { TjekDealer, TjekOffer, TjekService, TjekStore } from './tjek.service';

/** Kedjor utan egen färg i källan får appens neutrala ton. */
const FALLBACK_COLOR = '#6b7f96';

/**
 * Översätter källans erbjudanden till appens form: sållar bort allt som inte
 * är mat, räknar fram rabatten och sammanställer vilka kedjor som finns i
 * närheten och hur nära de ligger. Resten av appen ser bara den här formen.
 */
@Injectable({ providedIn: 'root' })
export class OffersService {
  private readonly tjek = inject(TjekService);

  board(place: Place, radiusKm: number): Observable<OfferBoard> {
    const radiusMeters = radiusKm * 1000;

    return forkJoin({
      offers: this.tjek.offersNear(place, radiusMeters),
      stores: this.tjek.storesNear(place, radiusMeters),
    }).pipe(
      map(({ offers: raw, stores }) => {
        const grocery = raw.filter((offer) => groceryBrandFor(offer.dealer?.website));

        return {
          place,
          radiusKm,
          chains: this.chainsFrom(grocery, this.nearestStoreByDealer(place, stores)),
          offers: grocery.map((offer) => this.toOffer(offer)),
          fetchedAt: new Date().toISOString(),
        };
      })
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

  /** Avståndet till varje kedjas närmaste butik, i kilometer. */
  private nearestStoreByDealer(place: Place, stores: TjekStore[]): Map<string, number> {
    const nearest = new Map<string, number>();

    for (const store of stores) {
      if (store.latitude === null || store.longitude === null) {
        continue;
      }

      const km = distanceKm(place, { latitude: store.latitude, longitude: store.longitude });
      const known = nearest.get(store.dealer_id);
      if (known === undefined || km < known) {
        nearest.set(store.dealer_id, km);
      }
    }

    return nearest;
  }

  /** En rad per butiksformat, närmast först. */
  private chainsFrom(offers: TjekOffer[], nearest: Map<string, number>): Chain[] {
    const counts = new Map<string, { dealer: TjekDealer; count: number }>();

    for (const offer of offers) {
      const entry = counts.get(offer.dealer.id);
      if (entry) {
        entry.count += 1;
      } else {
        counts.set(offer.dealer.id, { dealer: offer.dealer, count: 1 });
      }
    }

    return [...counts.values()]
      .map(({ dealer, count }) => ({
        id: dealer.id,
        name: dealer.name,
        brand: groceryBrandFor(dealer.website) ?? dealer.name,
        color: this.colorOf(dealer),
        logo: dealer.logo,
        offerCount: count,
        distanceKm: nearest.get(dealer.id) ?? null,
      }))
      .sort(this.byDistance);
  }

  /**
   * Närmast först. Kedjor utan känd butik hamnar sist i stället för att
   * räknas som noll kilometer, och sorteras då varumärkesvis som förut.
   */
  private byDistance = (a: Chain, b: Chain): number => {
    if (a.distanceKm !== null && b.distanceKm !== null) {
      return a.distanceKm - b.distanceKm || a.name.localeCompare(b.name, 'sv');
    }
    if (a.distanceKm !== null) {
      return -1;
    }
    if (b.distanceKm !== null) {
      return 1;
    }

    return (
      brandOrder(a.brand) - brandOrder(b.brand) ||
      b.offerCount - a.offerCount ||
      a.name.localeCompare(b.name, 'sv')
    );
  };

  private colorOf(dealer: TjekDealer): string {
    const color = dealer.color?.trim();
    if (!color || !/^#?[0-9a-f]{6}$/i.test(color)) {
      return FALLBACK_COLOR;
    }
    return color.startsWith('#') ? color : `#${color}`;
  }
}
