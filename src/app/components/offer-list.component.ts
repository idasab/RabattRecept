import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { formatDiscount, formatPrice, formatValidUntil } from '../core/format';
import { Offer } from '../core/offers.models';

@Component({
  selector: 'app-offer-list',
  imports: [CommonModule],
  template: `
    <ul class="offers">
      <li *ngFor="let offer of offers; trackBy: trackById" class="card offer">
        <img
          *ngIf="offer.image"
          class="thumb"
          [src]="offer.image"
          alt=""
          loading="lazy"
          decoding="async"
        />
        <span *ngIf="!offer.image" class="thumb thumb-empty" aria-hidden="true"></span>

        <div class="body">
          <p class="chain" *ngIf="showChain">
            <span class="dot" aria-hidden="true" [style.background]="colors[offer.chainId]"></span>
            {{ offer.chainName }}
          </p>
          <h3 class="heading">{{ offer.heading }}</h3>
          <p *ngIf="offer.description" class="description">{{ offer.description }}</p>
          <p class="until">{{ until(offer) }}</p>
        </div>

        <div class="price">
          <span class="now">{{ price(offer) }}</span>
          <span *ngIf="offer.prePrice" class="before">{{ before(offer) }}</span>
          <span *ngIf="offer.discount" class="off">{{ discount(offer) }}</span>
        </div>
      </li>
    </ul>
  `,
  styles: [
    `
      .offers {
        display: grid;
        gap: 10px;
        margin: 0;
        padding: 0;
        list-style: none;
      }

      .offer {
        display: grid;
        grid-template-columns: 56px minmax(0, 1fr) auto;
        gap: 14px;
        align-items: start;
        padding: 14px 16px;
      }

      .thumb {
        width: 56px;
        height: 56px;
        border-radius: 12px;
        object-fit: contain;
        background: var(--surface-soft);
      }

      .thumb-empty {
        display: block;
      }

      .body {
        min-width: 0;
      }

      .chain {
        display: flex;
        align-items: center;
        gap: 6px;
        margin: 0 0 2px;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.6px;
        text-transform: uppercase;
        color: var(--text-faint);
      }

      .dot {
        flex: none;
        width: 6px;
        height: 6px;
        border-radius: 50%;
      }

      .heading {
        margin: 0;
        font-size: 15px;
        font-weight: 600;
        line-height: 1.3;
      }

      .description {
        margin: 3px 0 0;
        font-size: 13px;
        line-height: 1.35;
        color: var(--text-muted);
        /* Beskrivningarna är butikstext med jämförpris och villkor. Två rader
           räcker för att se vad varan är; resten är sällan avgörande. */
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      .until {
        margin: 6px 0 0;
        font-size: 12px;
        color: var(--text-faint);
      }

      .price {
        display: grid;
        justify-items: end;
        gap: 1px;
        text-align: right;
      }

      .now {
        font-size: 17px;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }

      .before {
        font-size: 12px;
        color: var(--text-faint);
        text-decoration: line-through;
        white-space: nowrap;
      }

      .off {
        margin-top: 3px;
        padding: 1px 7px;
        border-radius: 999px;
        background: var(--surface-soft);
        font-size: 11px;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
        color: var(--text-muted);
        white-space: nowrap;
      }
    `,
  ],
})
export class OfferListComponent {
  @Input({ required: true }) offers: readonly Offer[] = [];
  /** Kedjefärg per kedje-id, så att pricken matchar kryssrutelistan. */
  @Input() colors: Record<string, string> = {};
  /**
   * Om kedjenamnet ska stå på varje rad. Falskt när listan redan står under en
   * kedjerubrik: då vore namnet upprepat i varje rad bara brus.
   */
  @Input() showChain = true;

  price(offer: Offer): string {
    return formatPrice(offer.price, offer.currency);
  }

  before(offer: Offer): string {
    return offer.prePrice === null ? '' : formatPrice(offer.prePrice, offer.currency);
  }

  discount(offer: Offer): string {
    return offer.discount === null ? '' : formatDiscount(offer.discount);
  }

  until(offer: Offer): string {
    return formatValidUntil(offer.validUntil);
  }

  trackById(_index: number, offer: Offer): string {
    return offer.id;
  }
}
