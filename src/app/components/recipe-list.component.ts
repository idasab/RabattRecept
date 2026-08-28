import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges } from '@angular/core';
import { formatPrice } from '../core/format';
import { Recipe } from '../core/recipes.models';

/** Hur många recept som visas från början, och hur många "Visa fler" lägger till. */
const STEP = 5;

const RATING = new Intl.NumberFormat('sv-SE', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/**
 * Recepten, fem i taget. Varje kort är en länk till receptsidan hos källan —
 * det är där man lagar maten, appen är bara vägen dit — och visar vilken
 * rabatterad vara som gav träffen, så att kopplingen till rean syns.
 */
@Component({
  selector: 'app-recipe-list',
  standalone: true,
  imports: [CommonModule],
  template: `
    <ul class="recipes">
      <li *ngFor="let recipe of visibleRecipes; trackBy: trackById">
        <a class="card recipe" [href]="recipe.url" target="_blank" rel="noopener noreferrer">
          <img
            *ngIf="recipe.image"
            class="thumb"
            [src]="recipe.image"
            alt=""
            loading="lazy"
            decoding="async"
          />
          <span *ngIf="!recipe.image" class="thumb thumb-empty" aria-hidden="true"></span>

          <span class="body">
            <span class="title">{{ recipe.title }}</span>
            <span class="rating">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M12 3.6l2.5 5.06 5.6.81-4.05 3.94.96 5.57L12 16.35l-5.01 2.63.96-5.57L3.9 9.47l5.6-.81z"
                  fill="currentColor"
                />
              </svg>
              {{ rating(recipe) }}
              <span class="votes">{{ votes(recipe) }}</span>
            </span>
            <span class="match">{{ match(recipe) }}</span>
          </span>

          <svg class="go" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M9 6l6 6-6 6"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </a>
      </li>
    </ul>

    <button *ngIf="remaining" type="button" class="more" (click)="showMore()">
      Visa fler recept <span class="remaining">{{ remaining }} kvar</span>
    </button>
  `,
  styles: [
    `
      .recipes {
        display: grid;
        gap: 10px;
        margin: 0;
        padding: 0;
        list-style: none;
      }

      .recipe {
        display: grid;
        grid-template-columns: 64px minmax(0, 1fr) auto;
        gap: 14px;
        align-items: center;
        padding: 12px 14px;
        color: inherit;
        text-decoration: none;
        -webkit-tap-highlight-color: transparent;
      }

      .thumb {
        width: 64px;
        height: 64px;
        border-radius: 12px;
        object-fit: cover;
        background: var(--surface-soft);
      }

      .thumb-empty {
        display: block;
      }

      .body {
        display: grid;
        gap: 3px;
        min-width: 0;
      }

      .title {
        font-size: 15px;
        font-weight: 600;
        line-height: 1.3;
      }

      .rating {
        display: flex;
        align-items: center;
        gap: 5px;
        font-size: 13px;
        font-variant-numeric: tabular-nums;
        color: var(--text-muted);
      }

      .rating svg {
        width: 13px;
        height: 13px;
        color: var(--text-faint);
      }

      .votes {
        color: var(--text-faint);
      }

      .match {
        font-size: 12px;
        color: var(--text-faint);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .go {
        width: 18px;
        height: 18px;
        color: var(--text-faint);
      }

      .more {
        display: flex;
        align-items: center;
        gap: 7px;
        width: 100%;
        min-height: 44px;
        margin-top: 2px;
        padding: 0 20px;
        border: 1px solid var(--border);
        border-radius: 18px;
        background: var(--surface);
        color: var(--accent);
        font-size: 13px;
        cursor: pointer;
      }

      .remaining {
        color: var(--text-faint);
      }
    `,
  ],
})
export class RecipeListComponent implements OnChanges {
  @Input({ required: true }) recipes: readonly Recipe[] = [];

  private shown = STEP;

  /** En ny sökning ger nya recept, och då börjar listan om på fem. */
  ngOnChanges(): void {
    this.shown = STEP;
  }

  get visibleRecipes(): readonly Recipe[] {
    return this.recipes.slice(0, this.shown);
  }

  get remaining(): number {
    return Math.max(0, this.recipes.length - this.shown);
  }

  showMore(): void {
    this.shown += STEP;
  }

  rating(recipe: Recipe): string {
    return `${RATING.format(recipe.rating)} av 5`;
  }

  votes(recipe: Recipe): string {
    return recipe.votes === 1 ? '(1 röst)' : `(${recipe.votes} röster)`;
  }

  /** Varan som gav träffen, med kedjan och reapriset. */
  match(recipe: Recipe): string {
    const { ingredient, chainName, price, currency } = recipe.match;
    return `${ingredient} · ${formatPrice(price, currency)} på ${chainName}`;
  }

  trackById(_index: number, recipe: Recipe): number {
    return recipe.id;
  }
}
