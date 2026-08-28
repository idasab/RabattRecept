import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, debounceTime, firstValueFrom, of, switchMap } from 'rxjs';
import { ChainFilterComponent } from './components/chain-filter.component';
import { CookingTimeFilterComponent } from './components/cooking-time-filter.component';
import { SettingsMenuComponent } from './components/settings-menu.component';
import { PlaceSearchComponent } from './components/place-search.component';
import { RecipeListComponent } from './components/recipe-list.component';
import {
  COOKING_TIME_BANDS,
  CookingTimeBand,
  bandFor,
  withinCookingTime,
} from './core/cooking-time';
import { addExclusion, removeExclusion, withoutExcluded } from './core/food-exclusions';
import { GeocodingService } from './core/geocoding.service';
import { mainIngredientNames } from './core/main-ingredients';
import { onlySwedishMeat } from './core/origin';
import { LocationError, LocationService } from './core/location.service';
import { filterOffers } from './core/offer-filter';
import { Chain, Offer, OfferBoard, Place } from './core/offers.models';
import { OffersService } from './core/offers.service';
import { Recipe } from './core/recipes.models';
import { MIN_RATING, MIN_VOTES, RecipesService } from './core/recipes.service';

/**
 * Versionen i nycklarna gör att sparat från en äldre datamodell ignoreras.
 * v2 bytte urvalet från "kedjor jag kryssat ur" till "kedjor jag kryssat i",
 * eftersom favoriter innebär att utgångsläget är omarkerat.
 */
const SETTINGS_KEY = 'rabatt-recept.settings.v2';
const BOARD_KEY = 'rabatt-recept.board.v1';

/** Avstånden man kan välja mellan, i kilometer. */
const RADII = [2, 5, 10, 25];

/**
 * Hur länge kryssandet får pågå innan recepten hämtas om. Att kryssa i tre
 * kedjor efter varandra ska ge en sökning, inte tre.
 */
const RECIPE_DEBOUNCE_MS = 400;

interface StoredSettings {
  radiusKm: number;
  /** Kedjorna som är ikryssade. */
  selected: string[];
  /** Kedjorna som stjärnmärkts: alltid överst och alltid ikryssade vid start. */
  favorites: string[];
  /** Matvaror man inte vill ha receptförslag på. */
  excludedFoods: string[];
  /** Kräv svenskmärkning av kött, chark och fågel. */
  onlySwedishMeat: boolean;
  /** Tidsspannen som är ikryssade. */
  cookingTimes: CookingTimeBand[];
  place: Place | null;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    ChainFilterComponent,
    CookingTimeFilterComponent,
    PlaceSearchComponent,
    RecipeListComponent,
    SettingsMenuComponent,
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnInit {
  private readonly offers = inject(OffersService);
  private readonly location = inject(LocationService);
  private readonly geocoding = inject(GeocodingService);
  private readonly recipeSource = inject(RecipesService);

  private readonly recipeRequests = new Subject<void>();

  /**
   * Sant tills appen vet vad användaren brukar välja. Först då, och bara då,
   * kryssas allt i — annars möts en ny användare utan favoriter av en tom
   * skärm och en app som ser trasig ut.
   */
  private firstVisit = true;

  readonly radii = RADII;
  /** '3,5' — svenskt decimaltecken, inte punkt. */
  readonly minRating = MIN_RATING.toLocaleString('sv-SE');
  readonly minVotes = MIN_VOTES;
  /** Råvarorna appen känner igen, som förslag i uteslutningsfältet. */
  readonly knownFoods = mainIngredientNames();

  readonly board = signal<OfferBoard | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  /** Sant när felet beror på platsen, då hjälper det att peka på sökfältet. */
  readonly canSearchInstead = signal(false);

  readonly radiusKm = signal(5);
  readonly selected = signal<ReadonlySet<string>>(new Set());
  readonly favorites = signal<ReadonlySet<string>>(new Set());
  readonly excludedFoods = signal<readonly string[]>([]);
  readonly onlySwedishMeat = signal(false);
  /** Alla spann från början: ett tomt filter är inget filter. */
  readonly cookingTimes = signal<ReadonlySet<CookingTimeBand>>(
    new Set(COOKING_TIME_BANDS.map((band) => band.id))
  );
  readonly settingsOpen = signal(false);

  @ViewChild('settingsButton') private settingsButton?: ElementRef<HTMLButtonElement>;

  /** Alla recept sökningen gav, före tidsfiltret. */
  readonly recipes = signal<readonly Recipe[]>([]);
  readonly recipesLoading = signal(false);
  readonly recipesError = signal<string | null>(null);

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

  /**
   * Erbjudandena från de ikryssade kedjorna, störst rabatt först, minus det
   * man valt bort. De visas inte längre utan ligger bakom recepten: det är de
   * här varorna som är söktermerna. Störst rabatt först är därför inte pynt
   * utan urvalsordning — det är de varorna det är värt att laga mat av.
   */
  readonly selectedOffers = computed<readonly Offer[]>(() => {
    const fromChains = filterOffers(this.board()?.offers ?? [], {
      chainIds: this.selected(),
      query: '',
      sort: 'discount',
    });

    const allowed = withoutExcluded(fromChains, this.excludedFoods());
    return this.onlySwedishMeat() ? onlySwedishMeat(allowed) : allowed;
  });

  /** Recepten som visas: de som ryms i de ikryssade tidsspannen. */
  readonly visibleRecipes = computed(() =>
    withinCookingTime(this.recipes(), this.cookingTimes())
  );

  /** Hur många recept varje tidsspann rymmer, som siffra i rutan. */
  readonly cookingTimeCounts = computed(() => {
    const counts: Partial<Record<CookingTimeBand, number>> = {};
    for (const recipe of this.recipes()) {
      const band = bandFor(recipe);
      if (band) {
        counts[band] = (counts[band] ?? 0) + 1;
      }
    }
    return counts;
  });

  /** Hur många inställningar som är påslagna, som siffra på kugghjulet. */
  readonly settingsCount = computed(
    () => this.excludedFoods().length + (this.onlySwedishMeat() ? 1 : 0)
  );

  readonly fetchedLabel = computed(() => {
    const at = this.board()?.fetchedAt;
    if (!at) {
      return '';
    }
    return new Date(at).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
  });

  constructor() {
    this.recipeRequests
      .pipe(
        debounceTime(RECIPE_DEBOUNCE_MS),
        switchMap(() => {
          const seeds = this.selectedOffers();
          if (!seeds.length) {
            return of<readonly Recipe[] | null>([]);
          }

          return this.recipeSource
            .recipesFor(seeds)
            .pipe(catchError(() => of<readonly Recipe[] | null>(null)));
        }),
        takeUntilDestroyed()
      )
      .subscribe((recipes) => {
        this.recipesLoading.set(false);

        if (recipes === null) {
          this.recipesError.set('Recepten kunde inte hämtas just nu. Försök igen om en stund.');
          return;
        }

        this.recipes.set(recipes);
      });
  }

  async ngOnInit(): Promise<void> {
    const settings = this.readSettings();
    if (settings) {
      this.firstVisit = false;
      this.radiusKm.set(settings.radiusKm);
      this.selected.set(new Set(settings.selected));
      this.favorites.set(new Set(settings.favorites));
      this.excludedFoods.set(settings.excludedFoods);
      this.onlySwedishMeat.set(settings.onlySwedishMeat);
      if (settings.cookingTimes.length) {
        this.cookingTimes.set(new Set(settings.cookingTimes));
      }
    }

    // Det sparade underlaget visas direkt, så att appen har innehåll redan
    // innan nätet svarat — och något att visa alls när det inte svarar.
    const cached = this.readBoard();
    if (cached) {
      this.board.set(cached);
      this.reconcile(cached.chains);
      this.requestRecipes();
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
    this.requestRecipes();
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
      this.requestRecipes();
    }

    this.favorites.set(favorites);
    this.saveSettings();
  }

  openSettings(): void {
    this.settingsOpen.set(true);
  }

  closeSettings(): void {
    this.settingsOpen.set(false);
    // Fokus tillbaka dit det kom ifrån, annars hamnar den som navigerar med
    // tangentbord högst upp på sidan igen varje gång menyn stängs.
    this.settingsButton?.nativeElement.focus();
  }

  excludeFood(entry: string): void {
    this.excludedFoods.set(addExclusion(this.excludedFoods(), entry));
    this.saveSettings();
    this.requestRecipes();
  }

  /** Tidsfiltret arbetar på redan hämtade recept, så inget nytt anrop behövs. */
  toggleCookingTime(band: CookingTimeBand): void {
    const next = new Set(this.cookingTimes());
    if (next.has(band)) {
      next.delete(band);
    } else {
      next.add(band);
    }
    this.cookingTimes.set(next);
    this.saveSettings();
  }

  chooseSwedishMeat(only: boolean): void {
    this.onlySwedishMeat.set(only);
    this.saveSettings();
    this.requestRecipes();
  }

  allowFood(entry: string): void {
    this.excludedFoods.set(removeExclusion(this.excludedFoods(), entry));
    this.saveSettings();
    this.requestRecipes();
  }

  selectAllChains(): void {
    this.selected.set(new Set(this.chains().map((chain) => chain.id)));
    this.saveSettings();
    this.requestRecipes();
  }

  clearChains(): void {
    this.selected.set(new Set());
    this.saveSettings();
    this.requestRecipes();
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
      this.requestRecipes();
    } catch {
      this.error.set(
        this.board()
          ? 'Erbjudandena kunde inte uppdateras. Recepten nedan bygger på den senast hämtade rean.'
          : 'Erbjudandena kunde inte hämtas. Kontrollera uppkopplingen och försök igen.'
      );
    } finally {
      this.loading.set(false);
    }
  }

  /** Ber om nya recept. Själva anropet väntar in att kryssandet lugnat sig. */
  private requestRecipes(): void {
    this.recipesLoading.set(true);
    this.recipesError.set(null);
    this.recipeRequests.next();
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
      selected: [...this.selected()],
      favorites: [...this.favorites()],
      excludedFoods: [...this.excludedFoods()],
      onlySwedishMeat: this.onlySwedishMeat(),
      cookingTimes: [...this.cookingTimes()],
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
    return {
      ...stored,
      favorites: stored.favorites ?? [],
      excludedFoods: stored.excludedFoods ?? [],
      onlySwedishMeat: stored.onlySwedishMeat ?? false,
      cookingTimes: stored.cookingTimes ?? [],
    };
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
