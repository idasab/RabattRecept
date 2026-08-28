import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, switchMap } from 'rxjs';
import { GeocodingService } from '../core/geocoding.service';
import { Place } from '../core/offers.models';

/** Vägen runt när positionen inte går att få: välj ort själv. */
@Component({
  selector: 'app-place-search',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="search">
      <label class="field">
        <input
          type="search"
          name="place"
          autocomplete="off"
          enterkeyhint="search"
          placeholder="Sök på en ort"
          aria-label="Sök på en ort"
          [ngModel]="query()"
          (ngModelChange)="onQuery($event)"
        />
        <button
          *ngIf="query()"
          type="button"
          class="clear"
          aria-label="Rensa sökningen"
          (click)="reset()"
        >
          ✕
        </button>

      </label>

      <ul *ngIf="results().length" class="results">
        <li *ngFor="let place of results()">
          <button type="button" (click)="choose(place)">
            <span class="name">{{ place.name }}</span>
            <span class="where">{{ describe(place) }}</span>
          </button>
        </li>
      </ul>
    </div>
  `,
  styles: [
    `
      .search {
        position: relative;
      }

      .field {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 6px 6px 13px;
        border: 1px solid var(--border);
        border-radius: 12px;
        background: var(--surface-soft);
        transition: border-color 160ms ease;
      }

      .field:focus-within {
        border-color: var(--text-faint);
      }

      input {
        flex: 1;
        min-width: 0;
        /* Håller fältet lika högt oavsett om rensa-knappen visas. */
        height: 28px;
        border: 0;
        background: none;
        color: inherit;
        font: inherit;
        font-size: 14px;
        outline: none;
        -webkit-appearance: none;
      }

      input::placeholder {
        color: var(--text-faint);
      }

      input::-webkit-search-cancel-button {
        display: none;
      }

      .clear {
        flex: none;
        display: grid;
        place-items: center;
        width: 28px;
        height: 28px;
        padding: 0;
        border: 0;
        border-radius: 50%;
        background: none;
        color: var(--text-faint);
        font-size: 12px;
        cursor: pointer;
      }

      .results {
        position: absolute;
        z-index: 2;
        top: calc(100% + 6px);
        right: 0;
        left: 0;
        margin: 0;
        padding: 4px;
        list-style: none;
        border: 1px solid var(--border);
        border-radius: 12px;
        background: var(--bg);
        box-shadow: var(--shadow);
      }

      .results button {
        display: flex;
        flex-direction: column;
        gap: 1px;
        width: 100%;
        padding: 8px 10px;
        border: 0;
        border-radius: 9px;
        background: none;
        color: inherit;
        text-align: left;
        cursor: pointer;
      }

      .results button:hover {
        background: var(--surface-soft);
      }

      .name {
        font-size: 14px;
      }

      .where {
        font-size: 12px;
        color: var(--text-faint);
      }
    `,
  ],
})
export class PlaceSearchComponent {
  private readonly geocoding = inject(GeocodingService);
  private readonly typed = new Subject<string>();

  readonly query = signal('');
  readonly results = signal<Place[]>([]);

  @Output() readonly picked = new EventEmitter<Place>();

  constructor() {
    this.typed
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((query) => this.geocoding.search(query)),
        takeUntilDestroyed()
      )
      .subscribe((places) => this.results.set(places));
  }

  onQuery(value: string): void {
    this.query.set(value);
    this.typed.next(value);
  }

  choose(place: Place): void {
    this.query.set('');
    this.results.set([]);
    this.picked.emit(place);
  }

  reset(): void {
    this.query.set('');
    this.results.set([]);
    this.typed.next('');
  }

  describe(place: Place): string {
    return [place.admin1, place.country].filter(Boolean).join(', ');
  }
}
