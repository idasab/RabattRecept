import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

/**
 * Inställningsmenyn, som öppnas från kugghjulet i huvudet.
 *
 * Den ligger över innehållet med en skärm bakom sig och stängs med Esc, med
 * krysset eller genom att man trycker utanför — de tre vägar man förväntar sig
 * av en meny. Fokus flyttas till panelen när den öppnas och tillbaka till
 * kugghjulet när den stängs, annars tappar den som navigerar med tangentbord
 * bort sig.
 */
@Component({
  selector: 'app-settings-menu',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <ng-container *ngIf="open">
      <button
        type="button"
        class="scrim"
        aria-label="Stäng inställningar"
        (click)="closed.emit()"
      ></button>

      <section
        #panel
        class="panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-settings-title"
        tabindex="-1"
      >
        <header class="head">
          <h2 id="app-settings-title">Inställningar</h2>
          <button type="button" class="close" aria-label="Stäng inställningar" (click)="closed.emit()">
            ✕
          </button>
        </header>

        <h3>Uteslut matvaror</h3>
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
      </section>
    </ng-container>
  `,
  styles: [
    `
      /* Skärmen bakom panelen är en knapp och inte en div, så att den går att
         nå med tangentbord. Den ligger utanför dialogen, som är aria-modal, så
         skärmläsare hoppar över den — krysset och Esc är vägarna där. */
      .scrim {
        position: fixed;
        inset: 0;
        z-index: 10;
        padding: 0;
        border: 0;
        background: rgba(28, 30, 34, 0.28);
        backdrop-filter: blur(2px);
        -webkit-backdrop-filter: blur(2px);
        cursor: pointer;
      }

      .panel {
        position: fixed;
        z-index: 11;
        /* Hänger under huvudet där kugghjulet sitter, och håller sig innanför
           hakskäran på en iPhone. */
        top: calc(64px + env(safe-area-inset-top));
        right: calc(16px + env(safe-area-inset-right));
        left: calc(16px + env(safe-area-inset-left));
        max-width: 380px;
        max-height: calc(100vh - 96px - env(safe-area-inset-top));
        margin-left: auto;
        overflow-y: auto;
        padding: 16px 20px 20px;
        border: 1px solid var(--border);
        border-radius: 18px;
        background: var(--bg);
        box-shadow: var(--shadow);
        outline: none;
      }

      .head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 14px;
      }

      h2 {
        margin: 0;
        font-size: 17px;
        font-weight: 600;
      }

      h3 {
        margin: 0 0 4px;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 1.1px;
        text-transform: uppercase;
        color: var(--text-faint);
      }

      .close {
        display: grid;
        place-items: center;
        width: 32px;
        height: 32px;
        margin-right: -6px;
        padding: 0;
        border: 0;
        border-radius: 50%;
        background: var(--surface-soft);
        color: var(--text-muted);
        font-size: 12px;
        cursor: pointer;
      }

      .lead {
        margin: 0 0 12px;
        font-size: 13px;
        line-height: 1.4;
        color: var(--text-muted);
      }

      .add {
        display: flex;
        gap: 8px;
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
        margin: 14px 0 0;
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
        margin: 14px 0 0;
        font-size: 13px;
        color: var(--text-faint);
      }
    `,
  ],
})
export class SettingsMenuComponent implements OnChanges {
  @Input() open = false;
  @Input({ required: true }) excluded: readonly string[] = [];
  /** Råvaror appen känner igen, som förslag i fältet. */
  @Input() suggestions: readonly string[] = [];

  @Output() readonly closed = new EventEmitter<void>();
  @Output() readonly add = new EventEmitter<string>();
  @Output() readonly remove = new EventEmitter<string>();

  @ViewChild('panel') private panel?: ElementRef<HTMLElement>;

  readonly draft = signal('');

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['open']?.currentValue) {
      return;
    }

    this.draft.set('');
    // Panelen tar fokus, inte fältet: ett fokuserat textfält fäller upp
    // tangentbordet direkt på en telefon, vilket döljer halva menyn.
    setTimeout(() => this.panel?.nativeElement.focus());
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open) {
      this.closed.emit();
    }
  }

  submit(): void {
    const entry = this.draft().trim();
    if (!entry) {
      return;
    }

    this.add.emit(entry);
    this.draft.set('');
  }
}
