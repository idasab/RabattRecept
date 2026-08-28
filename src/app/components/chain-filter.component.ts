import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Chain } from '../core/offers.models';

/**
 * Kedjorna som har erbjudanden i närheten, som en lista att kryssa i. Listan
 * håller ingen egen markering utan får den utifrån, så att valet överlever en
 * ny hämtning och kan sparas mellan besöken.
 */
@Component({
  selector: 'app-chain-filter',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="card">
      <header class="head">
        <h2 class="card-heading">Kedjor nära dig</h2>
        <button type="button" class="bulk" (click)="allSelected ? clear.emit() : selectAll.emit()">
          {{ allSelected ? 'Rensa alla' : 'Markera alla' }}
        </button>
      </header>

      <ul class="chains">
        <li *ngFor="let chain of chains; trackBy: trackById">
          <label class="chain">
            <input
              type="checkbox"
              [attr.aria-label]="label(chain)"
              [checked]="selected.has(chain.id)"
              (change)="toggle.emit(chain.id)"
            />
            <span class="dot" aria-hidden="true" [style.background]="chain.color"></span>
            <span class="name">{{ chain.name }}</span>
            <span class="count">{{ chain.offerCount }}</span>
          </label>
        </li>
      </ul>
    </section>
  `,
  styles: [
    `
      .head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 6px;
      }

      .bulk {
        padding: 0;
        border: 0;
        background: none;
        color: var(--accent);
        font-size: 13px;
        cursor: pointer;
      }

      .chains {
        margin: 0;
        padding: 0;
        list-style: none;
      }

      .chains li + li {
        border-top: 1px solid var(--border);
      }

      .chain {
        display: flex;
        align-items: center;
        gap: 11px;
        /* Hela raden är träffytan — 44 px är minsta bekväma mål på en telefon. */
        min-height: 44px;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
      }

      /* Kryssrutan är den riktiga rutan, bara omritad. Att gömma en input och
         rita en egen ruta bredvid tappar bort den för skärmläsare i vissa
         lägen, och Safari ritar ändå inte systemrutan som de andra. */
      input {
        flex: none;
        width: 20px;
        height: 20px;
        margin: 0;
        border: 1.5px solid var(--border-strong);
        border-radius: 6px;
        background: transparent;
        -webkit-appearance: none;
        appearance: none;
        cursor: pointer;
        transition: background-color 130ms ease, border-color 130ms ease;
      }

      input:checked {
        border-color: var(--text);
        background: var(--text) 50% 50% / 12px 10px no-repeat
          url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 10'%3E%3Cpath d='M1 5.2 4.3 8.5 11 1.5' fill='none' stroke='%23f3f2ef' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
      }

      .dot {
        flex: none;
        width: 8px;
        height: 8px;
        border-radius: 50%;
      }

      .name {
        flex: 1;
        min-width: 0;
        font-size: 15px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      input:not(:checked) ~ .name {
        color: var(--text-muted);
      }

      .count {
        flex: none;
        font-size: 13px;
        font-variant-numeric: tabular-nums;
        color: var(--text-faint);
      }
    `,
  ],
})
export class ChainFilterComponent {
  @Input({ required: true }) chains: readonly Chain[] = [];
  @Input({ required: true }) selected: ReadonlySet<string> = new Set();

  @Output() readonly toggle = new EventEmitter<string>();
  @Output() readonly selectAll = new EventEmitter<void>();
  @Output() readonly clear = new EventEmitter<void>();

  get allSelected(): boolean {
    return this.chains.length > 0 && this.chains.every((chain) => this.selected.has(chain.id));
  }

  /** Etiketten som läses upp: siffran i raden säger inget utan sitt sammanhang. */
  label(chain: Chain): string {
    const offers = chain.offerCount === 1 ? 'erbjudande' : 'erbjudanden';
    return `${chain.name}, ${chain.offerCount} ${offers}`;
  }

  trackById(_index: number, chain: Chain): string {
    return chain.id;
  }
}
