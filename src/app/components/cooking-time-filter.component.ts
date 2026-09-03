import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { COOKING_TIME_BANDS, CookingTimeBand } from '../core/cooking-time';

/**
 * Tidsspannen att kryssa i, mellan kedjorna och recepten.
 *
 * Filtret arbetar på de redan hämtade recepten, precis som kedjelistan gör på
 * de redan hämtade erbjudandena, så ett kryss syns direkt utan nytt anrop.
 *
 * Rutorna bar tidigare var sitt antal. Siffran svarade på en fråga ingen
 * ställde — man kryssar i den tid man har, inte den ruta som råkar rymma
 * flest recept — och tre tal till på en sida full av tal gjorde mest brus.
 */
@Component({
  selector: 'app-cooking-time-filter',
  imports: [CommonModule],
  template: `
    <section class="setting">
      <h2 class="card-heading">Tid att laga (min)</h2>

      <ul class="bands">
        <li *ngFor="let band of bands">
          <label class="band">
            <input
              type="checkbox"
              [attr.aria-label]="band.label"
              [checked]="selected.has(band.id)"
              (change)="toggled.emit(band.id)"
            />
            <span class="name">{{ band.short }}</span>
          </label>
        </li>
      </ul>
    </section>
  `,
  styles: [
    `
      .bands {
        display: flex;
        gap: 8px;
        margin: 8px 0 0;
        padding: 0;
        list-style: none;
      }

      .bands li {
        flex: 1;
        min-width: 0;
      }

      .band {
        display: flex;
        align-items: center;
        gap: 7px;
        /* 44 px är minsta bekväma träffyta på en telefon. */
        min-height: 46px;
        padding: 0 9px;
        border: 1.5px solid var(--border);
        border-radius: 14px;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        transition: background-color 130ms ease, border-color 130ms ease;
      }

      /* Ett spann i taget hade sin egen färg — grönt, saffran, tomat — men ett
         långkok är inte "stopp", och trafikljuset gjorde det minsta filtret
         till sidans starkaste inslag. Nu bär bara krysset färg. Alla tre är
         ikryssade från början, och tre färgade ramar i rad drog mer blickar
         än receptbilderna under dem. */
      .band:has(input:checked) {
        background: var(--accent-soft);
      }

      /* Samma omritade kryssruta som i kedjelistan och inställningarna. */
      input {
        flex: none;
        width: 18px;
        height: 18px;
        margin: 0;
        border: 1.5px solid var(--border-strong);
        border-radius: 5px;
        background: transparent;
        -webkit-appearance: none;
        appearance: none;
        cursor: pointer;
        transition: background-color 130ms ease, border-color 130ms ease;
      }

      input:checked {
        border-color: var(--accent);
        background: var(--accent) 50% 50% / 11px 9px no-repeat
          url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 10'%3E%3Cpath d='M1 5.2 4.3 8.5 11 1.5' fill='none' stroke='%23f3f2ef' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
      }

      .name {
        flex: 1;
        min-width: 0;
        font-size: 13px;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }

      input:not(:checked) ~ .name {
        color: var(--text-muted);
      }
    `,
  ],
})
export class CookingTimeFilterComponent {
  @Input({ required: true }) selected: ReadonlySet<CookingTimeBand> = new Set();

  /** Heter toggled och inte toggle, som krockar med DOM:s egen händelse. */
  @Output() readonly toggled = new EventEmitter<CookingTimeBand>();

  readonly bands = COOKING_TIME_BANDS;
}
