import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { formatDistance } from '../core/format';
import { Chain } from '../core/offers.models';

/** Hur många kedjor som visas från början, och hur många "Visa fler" lägger till. */
const STEP = 4;

/**
 * Kedjorna med butik i närheten, som en lista att kryssa i.
 * Favoriterna ligger överst, resten närmast först. Listan börjar kort och
 * växer fyra rader i taget — i en storstad finns ett dussin kedjor, och de
 * flesta handlar i ett par av dem.
 *
 * Listan håller varken markering eller favoriter själv utan får dem utifrån,
 * så att valen överlever en ny hämtning och kan sparas mellan besöken. Att en
 * kedja är dold betyder alltså inte att den är urkryssad: "Rensa" gäller alla
 * kedjor, inte bara de synliga.
 */
@Component({
  selector: 'app-chain-filter',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="setting">
      <header class="head">
        <h2 class="card-heading">Kedjor nära dig</h2>
        <!-- Ingen "markera alla": att vilja se varje kedja samtidigt är inget
             riktigt behov, och knappen inbjöd till det. Rensa finns kvar, men
             bara när det finns något att rensa. -->
        <button *ngIf="anySelected" type="button" class="bulk" (click)="clear.emit()">
          Rensa
        </button>
      </header>

      <ul class="chains">
        <li *ngFor="let chain of visibleChains; trackBy: trackById">
          <label class="chain" [style.--kedja]="chain.color">
            <input
              type="checkbox"
              [attr.aria-label]="label(chain)"
              [checked]="selected.has(chain.id)"
              (change)="toggle.emit(chain.id)"
            />
            <span class="dot" aria-hidden="true" [style.background]="chain.color"></span>
            <span class="name">{{ chain.name }}</span>
            <span class="distance">{{ distance(chain) }}</span>
          </label>

          <button
            type="button"
            class="star"
            [class.on]="favorites.has(chain.id)"
            [attr.aria-pressed]="favorites.has(chain.id)"
            [attr.aria-label]="favoriteLabel(chain)"
            (click)="favorite.emit(chain.id)"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M12 3.6l2.5 5.06 5.6.81-4.05 3.94.96 5.57L12 16.35l-5.01 2.63.96-5.57L3.9 9.47l5.6-.81z"
                [attr.fill]="favorites.has(chain.id) ? 'currentColor' : 'none'"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linejoin="round"
              />
            </svg>
          </button>
        </li>
      </ul>

      <button *ngIf="remaining" type="button" class="more" (click)="showMore()">
        Visa fler <span class="remaining">{{ remaining }} kvar</span>
      </button>
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
        font-weight: 600;
        cursor: pointer;
      }

      .chains {
        margin: 0;
        padding: 0;
        list-style: none;
      }

      .chains li {
        display: flex;
        align-items: center;
        gap: 2px;
      }

      .chains li + li {
        border-top: 1px solid var(--border);
      }

      .chain {
        flex: 1;
        min-width: 0;
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
        border-color: var(--kedja, var(--text));
        background: var(--kedja, var(--text)) 50% 50% / 12px 10px no-repeat
          url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 10'%3E%3Cpath d='M1 5.2 4.3 8.5 11 1.5' fill='none' stroke='%23f3f2ef' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
      }

      .dot {
        flex: none;
        width: 9px;
        height: 9px;
        border-radius: 50%;
      }

      .name {
        flex: 1;
        min-width: 0;
        font-size: 15px;
        font-weight: 600;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      input:not(:checked) ~ .name {
        font-weight: 500;
        color: var(--text-muted);
      }

      /* Avståndet får en egen kolumn så att raderna linjerar även när det
         växlar mellan '80 m' och '14 km'. */
      .distance {
        flex: none;
        min-width: 48px;
        font-size: 13px;
        font-variant-numeric: tabular-nums;
        text-align: right;
        color: var(--text-faint);
      }

      .star {
        flex: none;
        display: grid;
        place-items: center;
        width: 34px;
        height: 34px;
        margin-left: 2px;
        padding: 0;
        border: 0;
        border-radius: 50%;
        background: none;
        /* Omärkt stjärna ska synas men inte konkurrera med kedjenamnet. */
        color: var(--text-faint);
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
      }

      .star.on {
        color: var(--saffron);
      }

      .star svg {
        width: 18px;
        height: 18px;
      }

      .more {
        display: flex;
        align-items: center;
        gap: 7px;
        width: 100%;
        min-height: 40px;
        margin-top: 2px;
        padding: 0;
        border: 0;
        border-top: 1px solid var(--border);
        background: none;
        color: var(--accent);
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
      }

      .remaining {
        color: var(--text-faint);
      }
    `,
  ],
})
export class ChainFilterComponent implements OnChanges {
  @Input({ required: true }) chains: readonly Chain[] = [];
  @Input({ required: true }) selected: ReadonlySet<string> = new Set();
  @Input() favorites: ReadonlySet<string> = new Set();

  @Output() readonly toggle = new EventEmitter<string>();
  @Output() readonly favorite = new EventEmitter<string>();
  @Output() readonly clear = new EventEmitter<void>();

  private shown = STEP;
  private chainKey = '';

  /**
   * Listan börjar på fyra rader, eller på så många favoriter man har om de är
   * fler — en favorit gömd bakom "Visa fler" vore inte längre en favorit.
   *
   * Bara en ny uppsättning kedjor får fälla ihop listan igen, och det avgörs
   * på kedjornas identiteter snarare än på att arrayen är ny. Föräldern
   * sorterar om listan varje gång en stjärna sätts, så en jämförelse på
   * referens skulle fälla ihop en utfälld lista vid varje stjärnklick.
   *
   * Blir det bara en omsortering växer listan vid behov men krymper aldrig,
   * och markeringen rör den inte alls: en lista som slog igen så fort man
   * kryssade i något vore obrukbar.
   */
  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['chains'] && !changes['favorites']) {
      return;
    }

    const key = this.chains
      .map((chain) => chain.id)
      .sort()
      .join('|');

    if (changes['chains'] && key !== this.chainKey) {
      this.shown = Math.max(STEP, this.favoriteCount);
    } else {
      this.shown = Math.max(this.shown, this.favoriteCount);
    }

    this.chainKey = key;
  }

  get visibleChains(): readonly Chain[] {
    return this.chains.slice(0, this.shown);
  }

  get remaining(): number {
    return Math.max(0, this.chains.length - this.shown);
  }

  get anySelected(): boolean {
    return this.chains.some((chain) => this.selected.has(chain.id));
  }

  showMore(): void {
    this.shown += STEP;
  }

  distance(chain: Chain): string {
    return chain.distanceKm === null ? '' : formatDistance(chain.distanceKm);
  }

  /** Etiketten som läses upp: avståndet i raden säger inget utan sitt sammanhang. */
  label(chain: Chain): string {
    const near = chain.distanceKm === null ? '' : `, ${formatDistance(chain.distanceKm)}`;
    return `${chain.name}${near}`;
  }

  favoriteLabel(chain: Chain): string {
    return this.favorites.has(chain.id)
      ? `Ta bort ${chain.name} som favorit`
      : `Gör ${chain.name} till favorit`;
  }

  trackById(_index: number, chain: Chain): string {
    return chain.id;
  }

  private get favoriteCount(): number {
    return this.chains.filter((chain) => this.favorites.has(chain.id)).length;
  }
}
