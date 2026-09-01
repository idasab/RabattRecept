import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Offer, OfferGroup } from '../core/offers.models';
import { OfferListComponent } from './offer-list.component';

/** Hur många rabatter som visas per kedja, och hur många "Visa fler" lägger till. */
const STEP = 15;

/**
 * Rabatterna som recepten bygger på, en egen sida bakom knappen "Visa
 * rabatter". Recepten är det appen är till för, men ibland vill man se själva
 * rean: vad som är nedsatt och hos vem.
 *
 * Kedjorna får varsin rubrik i stället för ett blandat flöde, eftersom man
 * handlar i en butik i taget. Ordningen är densamma som i kryssrutelistan —
 * favoriter först, sedan närmast — så att sidan känns igen.
 *
 * Varje kedja börjar med femton rader och växer på begäran. En storstadsradie
 * ger flera hundra rabatter, och att rendera alla på en gång gör sidan trög på
 * en telefon.
 */
@Component({
  selector: 'app-discount-page',
  standalone: true,
  imports: [CommonModule, OfferListComponent],
  template: `
    <main class="page">
      <header class="top">
        <button type="button" class="back" (click)="closed.emit()">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M14.5 5.5 8 12l6.5 6.5"
              fill="none"
              stroke="currentColor"
              stroke-width="1.9"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          Recept
        </button>
      </header>

      <div class="title">
        <p class="eyebrow">Veckans rea</p>
        <h1>Rabatter</h1>
        <p class="summary">
          {{ total }} {{ total === 1 ? 'vara' : 'varor' }} från
          {{ groups.length }} {{ groups.length === 1 ? 'kedja' : 'kedjor' }}
        </p>
      </div>

      <section class="group" *ngFor="let group of groups; trackBy: trackByChain">
        <header class="group-head">
          <span class="dot" aria-hidden="true" [style.background]="group.chain.color"></span>
          <h2 class="card-heading">{{ group.chain.name }}</h2>
          <span class="count">{{ group.offers.length }}</span>
        </header>

        <app-offer-list
          *ngIf="group.offers.length"
          [offers]="visible(group)"
          [showChain]="false"
        ></app-offer-list>

        <p class="empty" *ngIf="!group.offers.length">
          Inga rabatter på mat hos {{ group.chain.name }} den här veckan.
        </p>

        <button *ngIf="remaining(group)" type="button" class="more" (click)="showMore(group)">
          Visa fler <span class="remaining">{{ remaining(group) }} kvar</span>
        </button>
      </section>

      <p class="empty" *ngIf="!groups.length">
        Kryssa i minst en kedja för att se vad som är nedsatt.
      </p>

      <footer class="foot">
        Rabatterna som recepten bygger på. Uteslutna varor och svenskfiltret gäller även här.
      </footer>
    </main>
  `,
  styles: [
    `
      .page {
        display: grid;
        gap: 14px;
        max-width: 560px;
        margin: 0 auto;
        padding: calc(18px + env(safe-area-inset-top)) calc(16px + env(safe-area-inset-right))
          calc(28px + env(safe-area-inset-bottom)) calc(16px + env(safe-area-inset-left));
      }

      .top {
        padding: 6px 4px 0;
      }

      /* Vägen tillbaka står överst och till vänster, där iPhone själv har sin
         bakåtknapp. Namnet på målet i stället för "Tillbaka": man vet då vad
         man kommer till. */
      .back {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        min-height: 40px;
        padding: 0 12px 0 6px;
        border: 1px solid var(--border);
        border-radius: 999px;
        background: var(--surface);
        box-shadow: var(--shadow);
        color: var(--accent);
        font-family: var(--font-label);
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
      }

      .back svg {
        width: 18px;
        height: 18px;
      }

      .title {
        padding: 0 4px;
      }

      .eyebrow {
        margin: 0;
        font-family: var(--font-label);
        font-size: 11.5px;
        font-weight: 700;
        letter-spacing: 1.3px;
        text-transform: uppercase;
        color: var(--accent);
      }

      h1 {
        margin: 4px 0 0;
        font-family: var(--font-display);
        font-size: 38px;
        font-weight: 400;
        line-height: 1.05;
        background: linear-gradient(96deg, var(--accent) 12%, var(--saffron) 96%);
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
      }

      .summary {
        margin: 4px 0 0;
        font-size: 13px;
        color: var(--text-muted);
      }

      .group {
        display: grid;
        gap: 8px;
      }

      .group-head {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 4px 0;
      }

      .dot {
        flex: none;
        width: 9px;
        height: 9px;
        border-radius: 50%;
      }

      .group-head .card-heading {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .count {
        flex: none;
        font-size: 12px;
        font-variant-numeric: tabular-nums;
        color: var(--text-faint);
      }

      .more {
        justify-self: start;
        display: flex;
        align-items: center;
        gap: 7px;
        min-height: 36px;
        padding: 0 4px;
        border: 0;
        background: none;
        color: var(--accent);
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
      }

      .remaining {
        color: var(--text-faint);
      }

      .empty {
        margin: 0 4px;
        font-size: 14px;
        color: var(--text-muted);
      }

      .foot {
        margin: 8px 4px 0;
        font-size: 12px;
        line-height: 1.5;
        color: var(--text-faint);
      }
    `,
  ],
})
export class DiscountPageComponent {
  @Input({ required: true }) groups: readonly OfferGroup[] = [];

  @Output() readonly closed = new EventEmitter<void>();

  /** Hur många rader som fällts ut per kedja. Utan post gäller STEP. */
  private readonly shown = new Map<string, number>();

  get total(): number {
    return this.groups.reduce((sum, group) => sum + group.offers.length, 0);
  }

  visible(group: OfferGroup): readonly Offer[] {
    return group.offers.slice(0, this.limit(group));
  }

  remaining(group: OfferGroup): number {
    return Math.max(0, group.offers.length - this.limit(group));
  }

  showMore(group: OfferGroup): void {
    this.shown.set(group.chain.id, this.limit(group) + STEP);
  }

  trackByChain(_index: number, group: OfferGroup): string {
    return group.chain.id;
  }

  private limit(group: OfferGroup): number {
    return this.shown.get(group.chain.id) ?? STEP;
  }
}
