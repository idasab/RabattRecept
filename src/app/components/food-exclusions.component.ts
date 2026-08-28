import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

/**
 * Inställningen för matvaror man inte vill ha receptförslag på.
 *
 * Den ligger hopfälld i en details-tagg, som ger både knappen och
 * öppna-stänga-beteendet utan skript, och som skärmläsare hanterar rätt.
 * Inställningar ska finnas till hands men inte ta plats från recepten.
 */
@Component({
  selector: 'app-food-exclusions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <details class="card">
      <summary>
        <span class="card-heading">Uteslut matvaror</span>
        <span class="count" *ngIf="excluded.length">{{ excluded.length }}</span>
        <svg class="chevron" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M6 9l6 6 6-6"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </summary>

      <p class="lead">
        Varor du inte vill laga av. Är fläsk uteslutet föreslås inga rätter som byggs på fläsk,
        hur billigt det än är.
      </p>

      <form class="add" (ngSubmit)="submit()">
        <input
          type="text"
          name="exclusion"
          autocomplete="off"
          autocapitalize="none"
          enterkeyhint="done"
          placeholder="T.ex. fläsk eller räkor"
          aria-label="Matvara att utesluta"
          list="app-known-foods"
          [ngModel]="draft()"
          (ngModelChange)="draft.set($event)"
        />
        <datalist id="app-known-foods">
          <option *ngFor="let food of suggestions" [value]="food"></option>
        </datalist>
        <button type="submit" [disabled]="!draft().trim()">Lägg till</button>
      </form>

      <ul class="chips" *ngIf="excluded.length">
        <li *ngFor="let food of excluded">
          <span>{{ food }}</span>
          <button
            type="button"
            [attr.aria-label]="'Sluta utesluta ' + food"
            (click)="remove.emit(food)"
          >
            ✕
          </button>
        </li>
      </ul>

      <p class="empty" *ngIf="!excluded.length">Inget är uteslutet. Alla reavaror räknas.</p>
    </details>
  `,
  styles: [
    `
      details {
        padding: 0;
      }

      summary {
        display: flex;
        align-items: center;
        gap: 8px;
        /* 44 px är minsta bekväma träffyta på en telefon. */
        min-height: 44px;
        padding: 0 20px;
        cursor: pointer;
        list-style: none;
      }

      summary::-webkit-details-marker {
        display: none;
      }

      .card-heading {
        flex: 1;
      }

      .count {
        display: grid;
        place-items: center;
        min-width: 20px;
        height: 20px;
        padding: 0 6px;
        border-radius: 999px;
        background: var(--text);
        color: var(--bg);
        font-size: 11px;
        font-variant-numeric: tabular-nums;
      }

      .chevron {
        width: 16px;
        height: 16px;
        color: var(--text-faint);
        transition: transform 160ms ease;
      }

      details[open] .chevron {
        transform: rotate(180deg);
      }

      @media (prefers-reduced-motion: reduce) {
        .chevron {
          transition: none;
        }
      }

      .lead {
        margin: 0 20px 12px;
        font-size: 13px;
        line-height: 1.4;
        color: var(--text-muted);
      }

      .add {
        display: flex;
        gap: 8px;
        margin: 0 20px;
      }

      input {
        flex: 1;
        min-width: 0;
        padding: 9px 14px;
        border: 1px solid var(--border);
        border-radius: 12px;
        background: var(--surface-soft);
        color: inherit;
        font: inherit;
        font-size: 14px;
        outline: none;
        -webkit-appearance: none;
      }

      input:focus {
        border-color: var(--text-faint);
      }

      input::placeholder {
        color: var(--text-faint);
      }

      .add button {
        flex: none;
        padding: 0 14px;
        border: 1px solid var(--border);
        border-radius: 12px;
        background: transparent;
        color: var(--accent);
        font-size: 13px;
        cursor: pointer;
      }

      .add button:disabled {
        color: var(--text-faint);
        cursor: default;
      }

      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin: 12px 20px 18px;
        padding: 0;
        list-style: none;
      }

      .chips li {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 4px 6px 4px 11px;
        border: 1px solid var(--border);
        border-radius: 999px;
        font-size: 13px;
      }

      .chips button {
        display: grid;
        place-items: center;
        width: 22px;
        height: 22px;
        padding: 0;
        border: 0;
        border-radius: 50%;
        background: none;
        color: var(--text-faint);
        font-size: 11px;
        cursor: pointer;
      }

      .empty {
        margin: 12px 20px 18px;
        font-size: 13px;
        color: var(--text-faint);
      }
    `,
  ],
})
export class FoodExclusionsComponent {
  @Input({ required: true }) excluded: readonly string[] = [];
  /** Råvaror appen känner igen, som förslag i fältet. */
  @Input() suggestions: readonly string[] = [];

  @Output() readonly add = new EventEmitter<string>();
  @Output() readonly remove = new EventEmitter<string>();

  readonly draft = signal('');

  submit(): void {
    const entry = this.draft().trim();
    if (!entry) {
      return;
    }

    this.add.emit(entry);
    this.draft.set('');
  }
}
