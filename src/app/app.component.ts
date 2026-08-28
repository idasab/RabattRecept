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
import { Chain, OfferBoard, Place } from './core/offers.models';
import { OffersService } from './core/offers.service';

/**
 * Versionen i nycklarna gör att sparat från en äldre datamodell ignoreras.
 * v2 bytte urvalet från "kedjor jag kryssat ur" till "kedjor jag kryssat i",
 * eftersom favoriter innebär att utgångsläget är omarkerat.
 */
const SETTINGS_KEY = 'rabatt-recept.settings.v2';
const BOARD_KEY = 'rabatt-recept.board.v1';

/** Avstånden man kan välja mellan, i kilometer. */
const RADII = [2, 5, 10, 25];

interface StoredSettings {
  radiusKm: number;
  sort: OfferSort;
  /** Kedjorna som är ikryssade. */
  selected: string[];
  /** Kedjorna som stjärnmärkts: alltid överst och alltid ikryssade vid start. */
  favorites: string[];
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

  /**
   * Sant tills appen vet vad användaren brukar välja. Först då, och bara då,
   * kryssas allt i — annars möts en ny användare utan favoriter av en tom
   * skärm och en app som ser trasig ut.
   */
  private firstVisit = true;

  readonly radii = RADII;

  readonly board = signal<OfferBoard | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  /** Sant när felet beror på platsen, då hjälper det att peka på sökfältet. */
  readonly canSearchInstead = signal(false);

  readonly radiusKm = signal(5);
  readonly sort = signal<OfferSort>('discount');
  readonly query = signal('');
  readonly selected = signal<ReadonlySet<string>>(new Set());
  readonly favorites = signal<ReadonlySet<string>>(new Set());

  /**
   * Favoriterna först. I övrigt behålls källans ordning, som redan är
   * närmast först — sorteringen är stabil, så oavgjort lämnar raderna i fred.
   */
  readonly chains = computed<readonly Chain[]>(() => {
    const favorites = this.favorites();
    const chains = this.board()?.chains ?? [];

    return [...chains].sort(
      (a, b) => Number(!favorites.has(a.id)) - Number(!favorites.has(b.id))
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
      this.firstVisit = false;
      this.radiusKm.set(settings.radiusKm);
      this.sort.set(settings.sort);
      this.selected.set(new Set(settings.selected));
      this.favorites.set(new Set(settings.favorites));
    }

    // Det sparade underlaget visas direkt, så att appen har innehåll redan
    // innan nätet svarat — och något att visa alls när det inte svarar.
    const cached = this.readBoard();
    if (cached) {
      this.board.set(cached);
      this.reconcile(cached.chains);
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
    const next = new Set(this.selected());
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    this.selected.set(next);
    this.saveSettings();
  }

  /** Stjärnan flyttar kedjan överst. Att märka en kedja kryssar också i den. */
  toggleFavorite(id: string): void {
    const favorites = new Set(this.favorites());

    if (favorites.has(id)) {
      favorites.delete(id);
    } else {
      favorites.add(id);
      const selected = new Set(this.selected());
      selected.add(id);
      this.selected.set(selected);
    }

    this.favorites.set(favorites);
    this.saveSettings();
  }

  selectAllChains(): void {
    this.selected.set(new Set(this.chains().map((chain) => chain.id)));
    this.saveSettings();
  }

  clearChains(): void {
    this.selected.set(new Set());
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
      this.reconcile(board.chains);
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

  /**
   * Vad som ska vara ikryssat bland de kedjor som faktiskt finns här.
   *
   * Regeln är avsiktligt enkel: finns det favoriter är det precis de som är
   * ikryssade när appen öppnas, ingen annan. Kryssar man i en till under
   * besöket gäller det tills appen öppnas nästa gång — favoriterna är det som
   * består. Kedjor som inte finns i närheten faller bort ur urvalet men ligger
   * kvar som favoriter, ifall man kommer tillbaka.
   *
   * Utan favoriter finns inget att gå på: då kryssas allt i första gången,
   * annars möts en ny användare av en tom skärm och en app som ser trasig ut.
   * En återvändare utan favoriter får tillbaka sitt senaste urval.
   */
  private reconcile(chains: readonly Chain[]): void {
    const present = new Set(chains.map((chain) => chain.id));
    const favorites = this.favorites();

    if (favorites.size > 0) {
      this.selected.set(new Set([...favorites].filter((id) => present.has(id))));
      return;
    }

    if (this.firstVisit) {
      this.selected.set(present);
      return;
    }

    this.selected.set(new Set([...this.selected()].filter((id) => present.has(id))));
  }

  private saveSettings(): void {
    this.firstVisit = false;

    const settings: StoredSettings = {
      radiusKm: this.radiusKm(),
      sort: this.sort(),
      selected: [...this.selected()],
      favorites: [...this.favorites()],
      place: this.board()?.place ?? null,
    };

    this.write(SETTINGS_KEY, settings);
  }

  private saveBoard(board: OfferBoard): void {
    this.write(BOARD_KEY, board);
  }

  private readSettings(): StoredSettings | null {
    const stored = this.read<StoredSettings>(SETTINGS_KEY);
    if (!stored || !RADII.includes(stored.radiusKm) || !Array.isArray(stored.selected)) {
      return null;
    }
    return { ...stored, favorites: stored.favorites ?? [] };
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
