import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges } from '@angular/core';
import { formatPrice } from '../core/format';
import { Recipe, RecipeMatch } from '../core/recipes.models';

/** Hur många recept som visas från början, och hur många "Visa fler" lägger till. */
const STEP = 5;

/**
 * Hur många rabatterade varor som räknas upp under receptet. Fler än så gör
 * korten olika höga och listan svårläst; resten sammanfattas som ett antal.
 */
const MAX_MATCHES = 3;

const RATING = new Intl.NumberFormat('sv-SE', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/**
 * Recepten, fem i taget. Varje kort är en länk till receptsidan hos källan —
 * det är där man lagar maten, appen är bara vägen dit — och sammanfattar
 * under rubriken vilka av receptets varor som är rabatterade, till vilket
 * pris och i vilken butik. Det är den sammanfattningen som gör listan
 * användbar i butiken snarare än bara inspirerande.
 */
@Component({
  selector: 'app-recipe-list',
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
              <span class="score">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M12 3.6l2.5 5.06 5.6.81-4.05 3.94.96 5.57L12 16.35l-5.01 2.63.96-5.57L3.9 9.47l5.6-.81z"
                    fill="currentColor"
                  />
                </svg>
                {{ rating(recipe) }}
              </span>
              <span class="votes">{{ votes(recipe) }}</span>
              <span class="duration" *ngIf="duration(recipe) as time">{{ time }}</span>
              <span class="source" [class.zeta]="recipe.source === 'Zeta'">
              {{ recipe.source }}
            </span>
            </span>
            <span class="matches">
              <!-- &ngsp; är ett blanksteg som Angular inte plockar bort. Utan
                   dem klistras varunamn, pris och butik ihop. -->
              <span class="match" *ngFor="let match of shownMatches(recipe)">
                <span class="vara">{{ match.ingredient }}</span>&ngsp;<span class="pris">{{
                  price(match)
                }}</span>&ngsp;på {{ match.chainName }}
              </span>
              <span class="match more-matches" *ngIf="hiddenMatches(recipe) as hidden">
                +{{ hidden }} {{ hidden === 1 ? 'vara till' : 'varor till' }}
              </span>
            </span>
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
        grid-template-columns: 92px minmax(0, 1fr) auto;
        gap: 14px;
        align-items: center;
        padding: 12px 14px 12px 12px;
        color: inherit;
        text-decoration: none;
        -webkit-tap-highlight-color: transparent;
        transition: box-shadow 160ms ease, transform 160ms ease;
      }

      .recipe:hover {
        box-shadow: var(--shadow-lift);
        transform: translateY(-1px);
      }

      @media (prefers-reduced-motion: reduce) {
        .recipe {
          transition: none;
        }

        .recipe:hover {
          transform: none;
        }
      }

      /* Bilden är det som gör en receptlista aptitlig, så den får ta plats. */
      .thumb {
        width: 92px;
        height: 92px;
        border-radius: 16px;
        object-fit: cover;
        background: linear-gradient(140deg, var(--accent-soft), rgba(232, 160, 32, 0.18));
      }

      .thumb-empty {
        display: block;
      }

      .body {
        display: grid;
        gap: 3px;
        min-width: 0;
      }

      /* Två rader räcker för att känna igen rätten, och håller korten lika
         höga. Receptnamn kan vara mycket långa: "Shawarmarostad kålrot i
         pitabröd med hummus och grön tahinisås". */
      .title {
        font-family: var(--font-label);
        font-size: 16px;
        /* Commissioner är en variabel font, så vikten behöver inte hoppa i
           hundrasteg. 560 ger en titel som håller ihop utan att bli tung. */
        font-weight: 560;
        line-height: 1.25;
        /* Commissioner är redan smal, så den negativa spärren som passade
           systemfonten gör den trång här. */
        letter-spacing: 0;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      /* Raden får radbryta i stället för att pressa ihop varje del till en
         smal kolumn. Delarna hålls därför ihop var för sig. */
      .rating {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 2px 8px;
        font-size: 13px;
        font-variant-numeric: tabular-nums;
        color: var(--text-muted);
      }

      .score,
      .votes,
      .duration,
      .source {
        white-space: nowrap;
      }

      .score {
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }

      .rating svg {
        width: 13px;
        height: 13px;
        color: var(--saffron);
      }

      .score {
        font-weight: 600;
        color: var(--text);
      }

      .votes,
      .duration {
        color: var(--text-faint);
      }

      /* Vilken sajt receptet ligger på. Källorna skiljer sig i stil och
         urval, så det är värt att veta innan man klickar. Varsin färg gör
         skillnaden läsbar på en blick. */
      .source {
        padding: 1px 8px;
        border-radius: 999px;
        background: var(--accent-soft);
        font-size: 10.5px;
        font-weight: 600;
        letter-spacing: 0.3px;
        color: var(--accent);
      }

      .source.zeta {
        background: rgba(166, 58, 99, 0.13);
        color: var(--berry);
      }

      .matches {
        display: grid;
        gap: 1px;
        margin-top: 2px;
      }

      .match {
        font-size: 12px;
        color: var(--text-faint);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      /* Varunamnet bär informationen; priset lyfts eftersom det är fyndet. */
      .vara {
        font-weight: 600;
        color: var(--text-muted);
      }

      .pris {
        font-weight: 700;
        color: var(--accent);
      }

      .more-matches {
        font-style: italic;
      }

      .go {
        width: 18px;
        height: 18px;
        color: var(--accent);
      }

      .more {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 7px;
        width: 100%;
        min-height: 48px;
        margin-top: 4px;
        padding: 0 20px;
        border: 0;
        border-radius: 20px;
        background: linear-gradient(120deg, var(--accent), #e0642f);
        box-shadow: var(--shadow);
        color: #fff;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
      }

      .remaining {
        color: rgba(255, 255, 255, 0.72);
        font-weight: 400;
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

  /** '35 min' eller '1 h 30 min'. Tom sträng när receptet inte anger någon tid. */
  duration(recipe: Recipe): string {
    const minutes = recipe.durationMinutes;
    if (minutes === null) {
      return '';
    }
    if (minutes < 60) {
      return `${minutes} min`;
    }

    const rest = minutes % 60;
    const hours = (minutes - rest) / 60;
    return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
  }

  /** Varorna som räknas upp under receptet. */
  shownMatches(recipe: Recipe): readonly RecipeMatch[] {
    return recipe.matches.slice(0, MAX_MATCHES);
  }

  /** Hur många varor som inte fick plats, eller null när alla ryms. */
  hiddenMatches(recipe: Recipe): number | null {
    const hidden = recipe.matches.length - MAX_MATCHES;
    return hidden > 0 ? hidden : null;
  }

  price(match: RecipeMatch): string {
    return formatPrice(match.price, match.currency);
  }

  trackById(_index: number, recipe: Recipe): string {
    return recipe.id;
  }
}
