import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ChainFilterComponent } from './components/chain-filter.component';
import { OfferListComponent } from './components/offer-list.component';
import { PlaceSearchComponent } from './components/place-search.component';
import { GeocodingService } from './core/geocoding.service';
import { LocationError, LocationService } from './core/location.service';
import { OfferSort, filterOffers } from './core/offer-filter';
import { OfferBoard, Place } from './core/offers.models';
import { OffersService } from './core/offers.service';

/** Versionen i nycklarna gör att sparat från en äldre datamodell ignoreras. */
const SETTINGS_KEY = 'rabatt-recept.settings.v1';
const BOARD_KEY = 'rabatt-recept.board.v1';

/** Avstånden man kan välja mellan, i kilometer. */
const RADII = [2, 5, 10, 25];

interface StoredSettings {
  radiusKm: number;
  sort: OfferSort;
  /**
   * Kedjorna som kryssats ur. Det är urvalet som sparas, inte markeringen —
   * så blir en kedja som dyker upp senare ikryssad från början, vilket är vad
   * man vill när man flyttar sig till en ny ort.
   */
  excluded: string[];
  place: Place | null;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ChainFilterComponent,
    OfferListComponent,
    PlaceSearchComponent,
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnInit {
  private readonly offers = inject(OffersService);
  private readonly location = inject(LocationService);
  private readonly geocoding = inject(GeocodingService);

  readonly radii = RADII;

  readonly board = signal<OfferBoard | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  /** Sant när felet beror på platsen, då hjälper det att peka på sökfältet. */
  readonly canSearchInstead = signal(false);

  readonly radiusKm = signal(5);
  readonly sort = signal<OfferSort>('discount');
  readonly query = signal('');
  readonly excluded = signal<ReadonlySet<string>>(new Set());

  readonly chains = computed(() => this.board()?.chains ?? []);

  readonly selected = computed(() => {
    const excluded = this.excluded();
    return new Set(
      this.chains()
        .map((chain) => chain.id)
        .filter((id) => !excluded.has(id))
    );
  });

  readonly visible = computed(() =>
    filterOffers(this.board()?.offers ?? [], {
      chainIds: this.selected(),
      query: this.query(),
      sort: this.sort(),
    })
  );

  /** Kedjefärg per id, så att erbjudandelistan kan visa samma prick som filtret. */
  readonly chainColors = computed(() =>
    Object.fromEntries(this.chains().map((chain) => [chain.id, chain.color]))
  );

  readonly fetchedLabel = computed(() => {
    const at = this.board()?.fetchedAt;
    if (!at) {
      return '';
    }
    return new Date(at).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
  });

  async ngOnInit(): Promise<void> {
    const settings = this.readSettings();
    if (settings) {
      this.radiusKm.set(settings.radiusKm);
      this.sort.set(settings.sort);
      this.excluded.set(new Set(settings.excluded));
    }

    // Det sparade underlaget visas direkt, så att appen har innehåll redan
    // innan nätet svarat — och något att visa alls när det inte svarar.
    const cached = this.readBoard();
    if (cached) {
      this.board.set(cached);
    }

    const place = settings?.place ?? cached?.place ?? null;
    if (place) {
      await this.load(place);
      return;
    }

    await this.useMyLocation();
  }

  async useMyLocation(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    this.canSearchInstead.set(false);

    try {
      const coordinates = await this.location.current();
      const place = await firstValueFrom(this.geocoding.describe(coordinates));
      await this.load(place);
    } catch (error) {
      this.loading.set(false);
      if (error instanceof LocationError) {
        this.error.set(error.message);
        this.canSearchInstead.set(true);
        return;
      }
      this.error.set('Något gick fel när platsen skulle hämtas.');
    }
  }

  choosePlace(place: Place): void {
    void this.load(place);
  }

  chooseRadius(radiusKm: number): void {
    if (radiusKm === this.radiusKm()) {
      return;
    }
    this.radiusKm.set(radiusKm);

    const place = this.board()?.place;
    if (place) {
      void this.load(place);
    }
  }

  refresh(): void {
    const place = this.board()?.place;
    if (place) {
      void this.load(place);
    } else {
      void this.useMyLocation();
    }
  }

  toggleChain(id: string): void {
    const next = new Set(this.excluded());
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    this.excluded.set(next);
    this.saveSettings();
  }

  selectAllChains(): void {
    const next = new Set(this.excluded());
    for (const chain of this.chains()) {
      next.delete(chain.id);
    }
    this.excluded.set(next);
    this.saveSettings();
  }

  clearChains(): void {
    const next = new Set(this.excluded());
    for (const chain of this.chains()) {
      next.add(chain.id);
    }
    this.excluded.set(next);
    this.saveSettings();
  }

  chooseSort(sort: OfferSort): void {
    this.sort.set(sort);
    this.saveSettings();
  }

  private async load(place: Place): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    this.canSearchInstead.set(false);

    try {
      const board = await firstValueFrom(this.offers.board(place, this.radiusKm()));
      this.board.set(board);
      this.saveBoard(board);
      this.saveSettings();
    } catch {
      this.error.set(
        this.board()
          ? 'Erbjudandena kunde inte uppdateras. Listan nedan är den senast hämtade.'
          : 'Erbjudandena kunde inte hämtas. Kontrollera uppkopplingen och försök igen.'
      );
    } finally {
      this.loading.set(false);
    }
  }

  private saveSettings(): void {
    const settings: StoredSettings = {
      radiusKm: this.radiusKm(),
      sort: this.sort(),
      excluded: [...this.excluded()],
      place: this.board()?.place ?? null,
    };

    this.write(SETTINGS_KEY, settings);
  }

  private saveBoard(board: OfferBoard): void {
    this.write(BOARD_KEY, board);
  }

  private readSettings(): StoredSettings | null {
    const stored = this.read<StoredSettings>(SETTINGS_KEY);
    if (!stored || !RADII.includes(stored.radiusKm)) {
      return null;
    }
    return stored;
  }

  private readBoard(): OfferBoard | null {
    const stored = this.read<OfferBoard>(BOARD_KEY);
    return stored?.offers && stored.chains ? stored : null;
  }

  private read<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      // Privat läge kan neka läsning. Appen fungerar ändå, bara utan minne.
      return null;
    }
  }

  private write(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Fullt eller nekat lagringsutrymme får inte stoppa hämtningen.
    }
  }
}
