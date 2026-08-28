import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { brandOrder, groceryBrandFor } from './grocery-brands';
import { Chain, Offer, OfferBoard, Place } from './offers.models';
import { TjekDealer, TjekOffer, TjekService } from './tjek.service';

/** Kedjor utan egen färg i källan får appens neutrala ton. */
const FALLBACK_COLOR = '#6b7f96';

/**
 * Översätter källans erbjudanden till appens form: sållar bort allt som inte
 * är mat, räknar fram rabatten och sammanställer vilka kedjor som finns i
 * närheten. Resten av appen ser bara den här formen.
 */
@Injectable({ providedIn: 'root' })
export class OffersService {
  private readonly tjek = inject(TjekService);

  board(place: Place, radiusKm: number): Observable<OfferBoard> {
    return this.tjek.offersNear(place, radiusKm * 1000).pipe(
      map((raw) => {
        const grocery = raw.filter((offer) => groceryBrandFor(offer.dealer?.website));
        const offers = grocery.map((offer) => this.toOffer(offer));

        return {
          place,
          radiusKm,
          chains: this.chainsFrom(grocery),
          offers,
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

  /** En rad per butiksformat, sorterad varumärkesvis med flest erbjudanden först. */
  private chainsFrom(offers: TjekOffer[]): Chain[] {
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
      }))
      .sort(
        (a, b) =>
          brandOrder(a.brand) - brandOrder(b.brand) ||
          b.offerCount - a.offerCount ||
          a.name.localeCompare(b.name, 'sv')
      );
  }

  private colorOf(dealer: TjekDealer): string {
    const color = dealer.color?.trim();
    if (!color || !/^#?[0-9a-f]{6}$/i.test(color)) {
      return FALLBACK_COLOR;
    }
    return color.startsWith('#') ? color : `#${color}`;
  }
}
