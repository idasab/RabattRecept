import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { COOKING_TIME_BANDS, CookingTimeBand } from '../core/cooking-time';

/**
 * Tidsspannen att kryssa i, mellan kedjorna och recepten.
 *
 * Filtret arbetar på de redan hämtade recepten, precis som kedjelistan gör på
 * de redan hämtade erbjudandena, så ett kryss syns direkt utan nytt anrop.
 */
@Component({
  selector: 'app-cooking-time-filter',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="card">
      <h2 class="card-heading">Tid att laga (min)</h2>

      <ul class="bands">
        <li *ngFor="let band of bands">
          <label class="band">
            <input
              type="checkbox"
              [attr.aria-label]="label(band)"
              [checked]="selected.has(band.id)"
              (change)="toggle.emit(band.id)"
            />
            <span class="name">{{ band.short }}</span>
            <span class="count">{{ counts[band.id] ?? 0 }}</span>
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
        min-height: 44px;
        padding: 0 9px;
        border: 1px solid var(--border);
        border-radius: 12px;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
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
        border-color: var(--text);
        background: var(--text) 50% 50% / 11px 9px no-repeat
          url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 10'%3E%3Cpath d='M1 5.2 4.3 8.5 11 1.5' fill='none' stroke='%23f3f2ef' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
      }

      .name {
        flex: 1;
        min-width: 0;
        font-size: 13px;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }

      input:not(:checked) ~ .name {
        color: var(--text-muted);
      }

      /* Mindre än etiketten, annars läses "30–60 22" som ett enda intervall. */
      .count {
        flex: none;
        font-size: 11px;
        font-variant-numeric: tabular-nums;
        color: var(--text-faint);
      }
    `,
  ],
})
export class CookingTimeFilterComponent {
  @Input({ required: true }) selected: ReadonlySet<CookingTimeBand> = new Set();
  /** Hur många av de hittade recepten som ryms i varje spann. */
  @Input() counts: Partial<Record<CookingTimeBand, number>> = {};

  @Output() readonly toggle = new EventEmitter<CookingTimeBand>();

  readonly bands = COOKING_TIME_BANDS;

  /** Siffran i rutan säger inget utan sitt sammanhang. */
  label(band: { id: CookingTimeBand; label: string; short: string }): string {
    return `${band.label}, ${this.counts[band.id] ?? 0} recept`;
  }
}
