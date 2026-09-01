import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { OfferCategory, OfferGroup } from '../core/offers.models';
import { OfferListComponent } from './offer-list.component';

/**
 * Rabatterna som recepten bygger på, en egen sida bakom knappen "Visa
 * rabatter". Recepten är det appen är till för, men ibland vill man se själva
 * rean: vad som är nedsatt och hos vem.
 *
 * Kedjorna ligger hopfällda var för sig, eftersom man handlar i en butik i
 * taget: hela listan får plats på en skärm, och man fäller ut den man är på
 * väg till. Flera får vara öppna samtidigt — att jämföra två butiker är ett
 * riktigt ärende. Ordningen är densamma som i kryssrutelistan, favoriter
 * först och sedan närmast, så att sidan känns igen.
 *
 * En utfälld kedja visar hela sin rea, indelad i varugrupper. Femtio rader i
 * rabattordning blandar kaffe med kotletter, och då är det avdelningarna man
 * saknar — inte en gräns för hur många rader man får se.
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
        <h2 class="group-head">
          <!-- Tom kedja går inte att öppna: det finns inget bakom fliken, och
               en flik som viker undan för att visa ingenting är ett löfte som
               inte hålls. Antalet säger det i stället. -->
          <button
            type="button"
            class="toggle"
            [disabled]="!group.offers.length"
            [attr.aria-expanded]="isOpen(group)"
            [attr.aria-controls]="panelId(group)"
            (click)="toggle(group)"
          >
            <span class="dot" aria-hidden="true" [style.background]="group.chain.color"></span>
            <!-- &ngsp; behövs: Angular klipper bort blanktecknet mellan taggarna,
                 och utan det läses fliken upp som "Tempo22". -->
            <span class="name card-heading">{{ group.chain.name }}</span>&ngsp;
            <span class="count">{{ count(group) }}</span>
            <svg
              *ngIf="group.offers.length"
              class="chevron"
              [class.open]="isOpen(group)"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                d="M6 9.5 12 15.5 18 9.5"
                fill="none"
                stroke="currentColor"
                stroke-width="1.9"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>
        </h2>

        <div class="panel" [id]="panelId(group)" *ngIf="isOpen(group)">
          <div
            class="category"
            *ngFor="let category of group.categories; trackBy: trackByCategory"
          >
            <h3 class="category-head">
              <span class="category-name">{{ category.name }}</span>&ngsp;
              <span class="count">{{ category.offers.length }}</span>
            </h3>

            <app-offer-list [offers]="category.offers" [showChain]="false"></app-offer-list>
          </div>
        </div>
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
        gap: 10px;
      }

      .group-head {
        margin: 0;
      }

      /* Hela raden är fliken. 52 px är väl över minsta bekväma träffyta på en
         telefon, och raden ska se ut som ett kort man trycker på. */
      .toggle {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        min-height: 52px;
        padding: 0 16px;
        border: 1px solid var(--border);
        border-radius: 16px;
        background: var(--surface);
        box-shadow: var(--shadow);
        text-align: left;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
      }

      /* En kedja utan rabatter ska stå kvar i listan men inte se ut som en
         knapp: den är ett besked, inte en väg vidare. */
      .toggle:disabled {
        border-style: dashed;
        background: none;
        box-shadow: none;
        cursor: default;
      }

      .dot {
        flex: none;
        width: 9px;
        height: 9px;
        border-radius: 50%;
      }

      .toggle:disabled .dot {
        opacity: 0.45;
      }

      .name {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .toggle:disabled .name {
        color: var(--text-faint);
      }

      .count {
        flex: none;
        font-size: 12px;
        font-variant-numeric: tabular-nums;
        color: var(--text-faint);
      }

      .chevron {
        flex: none;
        width: 18px;
        height: 18px;
        margin-right: -4px;
        color: var(--accent);
        transition: transform 150ms ease;
      }

      .chevron.open {
        transform: rotate(180deg);
      }

      .panel {
        display: grid;
        gap: 14px;
        margin-bottom: 6px;
      }

      .category {
        display: grid;
        gap: 8px;
      }

      /* Varugruppen är en avdelningsskylt inne i kedjan, inte en rubrik som
         konkurrerar med kedjenamnet: linjen bär den, texten är dämpad. */
      .category-head {
        display: flex;
        align-items: baseline;
        gap: 8px;
        margin: 0;
        padding: 0 4px 6px;
        border-bottom: 1px solid var(--border);
      }

      .category-name {
        flex: 1;
        min-width: 0;
        font-family: var(--font-label);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 1.1px;
        text-transform: uppercase;
        color: var(--text-muted);
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

  /** Vilka kedjor man öppnat eller stängt. Utan post gäller utgångsläget. */
  private readonly opened = new Map<string, boolean>();

  get total(): number {
    return this.groups.reduce((sum, group) => sum + group.offers.length, 0);
  }

  /**
   * Kedjorna börjar hopfällda, så att man ser dem alla och väljer själv vilken
   * man vill titta i. Är bara en kedja ikryssad finns inget att välja mellan,
   * och då är fliken bara ett klick i vägen — den ligger öppen från början.
   */
  isOpen(group: OfferGroup): boolean {
    return this.opened.get(group.chain.id) ?? this.groups.length === 1;
  }

  toggle(group: OfferGroup): void {
    this.opened.set(group.chain.id, !this.isOpen(group));
  }

  /** Antalet i fliken, eller beskedet att kedjan inte hade något alls. */
  count(group: OfferGroup): string {
    return group.offers.length ? String(group.offers.length) : 'inga rabatter';
  }

  panelId(group: OfferGroup): string {
    return 'rabatter-' + group.chain.id;
  }

  trackByChain(_index: number, group: OfferGroup): string {
    return group.chain.id;
  }

  trackByCategory(_index: number, category: OfferCategory): string {
    return category.name;
  }
}
