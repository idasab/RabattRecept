import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  HostListener,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, debounceTime, firstValueFrom, of, switchMap } from 'rxjs';
import { ChainFilterComponent } from './components/chain-filter.component';
import { DiscountPageComponent } from './components/discount-page.component';
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
import { Chain, Offer, OfferGroup, Place } from './core/offers.models';
import { OffersService } from './core/offers.service';
import { Recipe } from './core/recipes.models';
import { MIN_RATING, MIN_VOTES, RecipesService } from './core/recipes.service';

/**
 * Versionen i nycklarna gör att sparat från en äldre datamodell ignoreras.
 * v2 bytte urvalet från "kedjor jag kryssat ur" till "kedjor jag kryssat i",
 * eftersom favoriter innebär att utgångsläget är omarkerat.
 */
const SETTINGS_KEY = 'rabatt-recept.settings.v2';
/** Kedjelistan sparas så att appen har innehåll direkt när den öppnas. */
const CHAINS_KEY = 'rabatt-recept.chains.v1';

/**
 * Adressen rabattsidan lägger på i historiken. En fragmentdel och ingen egen
 * sökväg: GitHub Pages serverar bara index.html, så en riktig sökväg hade gett
 * 404 om man laddade om eller öppnade appen från hemskärmen där den stod.
 */
const DISCOUNTS_HASH = '#rabatter';

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
    DiscountPageComponent,
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

  readonly radii = RADII;

  /**
   * Radien man drar fram medan man håller i reglaget, innan den släppts.
   * Null när ingen drar. Hämtningen väntar tills man släpper — annars skulle
   * varje steg på vägen bli ett anrop.
   */
  private readonly dragged = signal<number | null>(null);
  /** '3,5' — svenskt decimaltecken, inte punkt. */
  readonly minRating = MIN_RATING.toLocaleString('sv-SE');
  readonly minVotes = MIN_VOTES;
  /** Råvarorna appen känner igen, som förslag i uteslutningsfältet. */
  readonly knownFoods = mainIngredientNames();

  readonly place = signal<Place | null>(null);
  /** Kedjorna som butikerna gav, i källans ordning. */
  private readonly nearbyChains = signal<readonly Chain[]>([]);
  /**
   * Erbjudandena, hämtade först när en kedja är ikryssad. Nyckeln säger vilken
   * plats och radie de gäller, så att ett nytt kryss inte hämtar om dem.
   */
  private readonly offersHeld = signal<readonly Offer[]>([]);
  private readonly offersKey = signal<string | null>(null);
  readonly fetchedAt = signal<string | null>(null);

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

  /**
   * Vilken av appens två sidor som visas. Rabattsidan är en egen vy och inte
   * ett utfällt kort, för listan är lång och recepten är det man normalt är
   * här för.
   */
  readonly view = signal<'recept' | 'rabatter'>('recept');

  @ViewChild('settingsButton') private settingsButton?: ElementRef<HTMLButtonElement>;

  /** Alla recept sökningen gav, före tidsfiltret. */
  readonly recipes = signal<readonly Recipe[]>([]);
  readonly recipesLoading = signal(false);
  readonly recipesError = signal<string | null>(null);

  /**
   * Favoriterna först. I övrigt behålls källans ordning, som redan är
   * närmast först — sorteringen är stabil, så oavgjort lämnar raderna i fred.
   */
  /** Radien som ska visas: den man drar fram, annars den som gäller. */
  readonly shownRadiusKm = computed(() => this.dragged() ?? this.radiusKm());

  /** Reglagets läge som index i RADII, eftersom stegen inte är jämnt fördelade. */
  readonly radiusIndex = computed(() => RADII.indexOf(this.shownRadiusKm()));

  /** Hur stor del av reglaget som är ifylld, som procent. */
  readonly radiusFill = computed(
    () => `${(this.radiusIndex() / (RADII.length - 1)) * 100}%`
  );

  /**
   * Favoriterna först. I övrigt behålls källans ordning, som redan är
   * närmast först — sorteringen är stabil, så oavgjort lämnar raderna i fred.
   */
  readonly chains = computed<readonly Chain[]>(() => {
    const favorites = this.favorites();

    return [...this.nearbyChains()].sort(
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
    const fromChains = filterOffers(this.offersHeld(), {
      chainIds: this.selected(),
      query: '',
      sort: 'discount',
    });

    const allowed = withoutExcluded(fromChains, this.excludedFoods());
    return this.onlySwedishMeat() ? onlySwedishMeat(allowed) : allowed;
  });

  /**
   * Rabatterna grupperade på kedja, i samma ordning som kryssrutelistan.
   * Ikryssade kedjor utan rabatter är med och tomma: att kedjan inte bidrog
   * med något är ett svar, medan en kedja som bara försvann är en gåta.
   */
  readonly offerGroups = computed<readonly OfferGroup[]>(() => {
    const selected = this.selected();
    const byChain = new Map<string, Offer[]>();

    for (const offer of this.selectedOffers()) {
      const held = byChain.get(offer.chainId);
      if (held) {
        held.push(offer);
      } else {
        byChain.set(offer.chainId, [offer]);
      }
    }

    return this.chains()
      .filter((chain) => selected.has(chain.id))
      .map((chain) => ({ chain, offers: byChain.get(chain.id) ?? [] }));
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

  /**
   * Hur många inställningar som är påslagna, som siffra på kugghjulet. Både
   * uteslutna varor och svenskfiltret räknas, för båda ändrar hela
   * receptlistan och ingen av dem syns när menyn är stängd.
   */
  readonly settingsCount = computed(
    () => this.excludedFoods().length + (this.onlySwedishMeat() ? 1 : 0)
  );

  /**
   * Kugghjulets upplästa etikett. Siffran på knappen säger ingenting i en
   * skärmläsare, så antalet måste stå i klartext.
   */
  readonly settingsLabel = computed(() => {
    const count = this.settingsCount();
    if (!count) {
      return 'Inställningar';
    }

    return `Inställningar, ${count} ${count === 1 ? 'aktiv' : 'aktiva'}`;
  });

  readonly fetchedLabel = computed(() => {
    const at = this.fetchedAt();
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
            .recipesFor(seeds, this.excludedFoods())
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
    this.syncView();

    const settings = this.readSettings();
    if (settings) {
      this.radiusKm.set(settings.radiusKm);
      this.selected.set(new Set(settings.selected));
      this.favorites.set(new Set(settings.favorites));
      this.excludedFoods.set(settings.excludedFoods);
      this.onlySwedishMeat.set(settings.onlySwedishMeat);
      if (settings.cookingTimes.length) {
        this.cookingTimes.set(new Set(settings.cookingTimes));
      }
    }

    // Den sparade kedjelistan visas direkt, så att appen har innehåll redan
    // innan nätet svarat — och något att visa alls när det inte svarar.
    const cached = this.readChains();
    if (cached) {
      this.nearbyChains.set(cached);
      this.reconcile(cached);
    }

    const place = settings?.place ?? null;
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

  /** Under dragningen: visa bara det nya värdet, hämta inget. */
  dragRadius(index: string): void {
    this.dragged.set(RADII[Number(index)] ?? this.radiusKm());
  }

  /** När reglaget släpps: nu hämtas erbjudandena om. */
  commitRadius(): void {
    const radiusKm = this.dragged();
    this.dragged.set(null);

    if (radiusKm !== null) {
      this.chooseRadius(radiusKm);
    }
  }

  chooseRadius(radiusKm: number): void {
    if (radiusKm === this.radiusKm()) {
      return;
    }
    this.radiusKm.set(radiusKm);

    const place = this.place();
    if (place) {
      void this.load(place);
    }
  }

  refresh(): void {
    const place = this.place();
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
    void this.ensureOffers();
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
      void this.ensureOffers();
    }

    this.favorites.set(favorites);
    this.saveSettings();
  }

  /**
   * Rabattsidan läggs på historiken, så att telefonens bakåtgest tar en
   * tillbaka till recepten i stället för att lämna appen.
   */
  openDiscounts(): void {
    this.view.set('rabatter');
    history.pushState({ vy: 'rabatter' }, '', DISCOUNTS_HASH);
  }

  /** Knappen i sidan gör samma sak som bakåtgesten: ett steg bakåt. */
  closeDiscounts(): void {
    if (location.hash === DISCOUNTS_HASH) {
      history.back();
      return;
    }
    this.view.set('recept');
  }

  @HostListener('window:popstate')
  syncView(): void {
    this.view.set(location.hash === DISCOUNTS_HASH ? 'rabatter' : 'recept');
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
    void this.ensureOffers();
  }

  allowFood(entry: string): void {
    this.excludedFoods.set(removeExclusion(this.excludedFoods(), entry));
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
      const chains = await firstValueFrom(this.offers.chains(place, this.radiusKm()));
      this.place.set(place);
      this.nearbyChains.set(chains);
      this.reconcile(chains);
      this.saveChains(chains);
      this.saveSettings();

      // Erbjudandena är den tunga hämtningen och behövs bara när något är
      // ikryssat. Utan kryss stannar det här.
      this.offersHeld.set([]);
      this.offersKey.set(null);
      await this.ensureOffers();
    } catch {
      this.error.set(
        this.nearbyChains().length
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
   * Regeln är: finns det favoriter är det precis de som är ikryssade när appen
   * öppnas, ingen annan. Finns inga favoriter är ingen ikryssad — appen gissar
   * inte, den väntar på att man kryssar i något eller stjärnmärker en kedja.
   * Kryssar man i en till under besöket gäller det tills appen öppnas nästa
   * gång; favoriterna är det som består.
   *
   * Kedjor som inte finns i närheten faller bort ur urvalet men ligger kvar som
   * favoriter, ifall man kommer tillbaka.
   */
  private reconcile(chains: readonly Chain[]): void {
    const present = new Set(chains.map((chain) => chain.id));
    const favorites = this.favorites();

    if (favorites.size > 0) {
      this.selected.set(new Set([...favorites].filter((id) => present.has(id))));
      return;
    }

    this.selected.set(new Set([...this.selected()].filter((id) => present.has(id))));
  }

  private saveSettings(): void {
    const settings: StoredSettings = {
      radiusKm: this.radiusKm(),
      selected: [...this.selected()],
      favorites: [...this.favorites()],
      excludedFoods: [...this.excludedFoods()],
      onlySwedishMeat: this.onlySwedishMeat(),
      cookingTimes: [...this.cookingTimes()],
      place: this.place(),
    };

    this.write(SETTINGS_KEY, settings);
  }

  private saveChains(chains: readonly Chain[]): void {
    this.write(CHAINS_KEY, chains);
  }

  /**
   * Hämtar erbjudandena om det behövs: bara när en kedja är ikryssad, och bara
   * en gång per plats och radie. Att kryssa i en kedja till söker om recepten
   * men hämtar inte om erbjudandena.
   */
  private async ensureOffers(): Promise<void> {
    const place = this.place();
    if (!place || !this.selected().size) {
      return;
    }

    const key = `${place.latitude},${place.longitude}:${this.radiusKm()}`;
    if (this.offersKey() === key) {
      this.requestRecipes();
      return;
    }

    this.recipesLoading.set(true);

    try {
      const offers = await firstValueFrom(this.offers.offers(place, this.radiusKm()));
      this.offersHeld.set(offers);
      this.offersKey.set(key);
      this.fetchedAt.set(new Date().toISOString());
      this.requestRecipes();
    } catch {
      this.recipesLoading.set(false);
      this.recipesError.set('Erbjudandena kunde inte hämtas. Försök igen om en stund.');
    }
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

  private readChains(): readonly Chain[] | null {
    const stored = this.read<Chain[]>(CHAINS_KEY);
    return Array.isArray(stored) && stored.length ? stored : null;
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
