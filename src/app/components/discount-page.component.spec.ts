import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DiscountPageComponent } from './discount-page.component';
import { byCategory } from '../core/offer-categories';
import { Chain, Offer, OfferGroup } from '../core/offers.models';

function chain(id: string, name: string): Chain {
  return { id, name, brand: name, color: '#e60219', logo: null, distanceKm: 0.4 };
}

/** Varunamn som spänner över flera kategorier, så att indelningen syns. */
const VAROR = ['Nötfärs', 'Bananer', 'Kaffe', 'Laxfilé', 'Ägg', 'Bacon', 'Gurka'];

function offers(chainId: string, chainName: string, count: number): Offer[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `${chainId}-${index}`,
    chainId,
    chainName,
    heading: VAROR[index % VAROR.length],
    description: '',
    price: 10,
    prePrice: null,
    currency: 'SEK',
    discount: null,
    image: null,
    validUntil: '2099-01-01T00:00:00+0000',
  }));
}

function group(name: string, count: number): OfferGroup {
  const id = name.toLowerCase();
  const list = offers(id, name, count);
  return { chain: chain(id, name), offers: list, categories: byCategory(list) };
}

describe('DiscountPageComponent', () => {
  let fixture: ComponentFixture<DiscountPageComponent>;

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function setGroups(groups: OfferGroup[]): void {
    fixture.componentInstance.groups = groups;
    fixture.detectChanges();
  }

  function tabs(): HTMLButtonElement[] {
    return Array.from(host().querySelectorAll<HTMLButtonElement>('.toggle'));
  }

  function categoryTabs(): HTMLButtonElement[] {
    return Array.from(host().querySelectorAll<HTMLButtonElement>('.category-toggle'));
  }

  function labels(): string[] {
    return tabs().map((tab) => tab.textContent?.replace(/\s+/g, ' ').trim() ?? '');
  }

  function categories(): string[] {
    return categoryTabs().map((tab) => tab.textContent?.replace(/\s+/g, ' ').trim() ?? '');
  }

  function rows(): number {
    return host().querySelectorAll('app-offer-list .offer').length;
  }

  function open(index: number): void {
    tabs()[index].click();
    fixture.detectChanges();
  }

  /** Trycker på en varugrupps flik och speglar utfallet, som appen gör. */
  function clickCategory(index: number): void {
    categoryTabs()[index].click();
    fixture.detectChanges();
  }

  function setHidden(names: string[]): void {
    fixture.componentInstance.hiddenCategories = new Set(names);
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [DiscountPageComponent] });
    fixture = TestBed.createComponent(DiscountPageComponent);
    setGroups([group('Willys', 3), group('Coop', 2)]);
  });

  it('visar kedjorna hopfällda, med antalet i fliken', () => {
    expect(labels()).toEqual(['Willys 3', 'Coop 2']);
    expect(categories()).toEqual([]);
    expect(rows()).toBe(0);
  });

  it('räknar ihop varorna och kedjorna överst', () => {
    expect(host().querySelector('.summary')?.textContent).toContain('5 varor från 2 kedjor');
  });

  it('visar kedjans varugrupper utfällda när kedjan öppnas', () => {
    open(0);

    // Nötfärs, Bananer och Kaffe — tre varor i tre grupper, i kategoriordning.
    expect(categories()).toEqual(['Fika & godis 1', 'Kött & chark 1', 'Frukt & grönt 1']);
    expect(rows()).toBe(3);
    expect(tabs()[0].getAttribute('aria-expanded')).toBe('true');
    expect(tabs()[1].getAttribute('aria-expanded')).toBe('false');
  });

  it('fäller ihop den varugrupp som gömts, och bara den', () => {
    open(0);
    setHidden(['Kött & chark']);

    expect(rows()).toBe(2);
    expect(categoryTabs()[1].getAttribute('aria-expanded')).toBe('false');
    expect(categoryTabs()[0].getAttribute('aria-expanded')).toBe('true');
    // Fliken står kvar med sitt antal, så man hittar tillbaka till den.
    expect(categories()[1]).toBe('Kött & chark 1');
  });

  it('säger ifrån till appen vilken varugrupp som trycktes, inte mer', () => {
    // Sidan äger inte vad som är gömt: valet ska bestå mellan besöken och
    // gälla alla kedjor, så det hör hemma bland de sparade inställningarna.
    const tryckta: string[] = [];
    fixture.componentInstance.categoryToggled.subscribe((name) => tryckta.push(name));

    open(0);
    clickCategory(1);

    expect(tryckta).toEqual(['Kött & chark']);
  });

  it('gömmer varugruppen hos alla kedjor på en gång', () => {
    // Det är avdelningen man valt bort, inte butikshyllan.
    open(0);
    open(1);
    setHidden(['Kött & chark']);

    const stängda = categoryTabs().filter(
      (tab) => tab.getAttribute('aria-expanded') === 'false'
    );
    expect(stängda.length).toBe(2);
  });

  it('visar hela varugruppens rea utan att kapa den', () => {
    // Ingen "visa fler": avdelningarna är det som gör en lång lista läsbar,
    // inte en gräns för hur många rader man får se.
    setGroups([group('Willys', 40)]);

    expect(rows()).toBe(40);
    expect(host().querySelector('.more')).toBeNull();
  });

  it('ger panelerna egna id även när två kedjor visar samma varugrupp', () => {
    open(0);
    open(1);

    const ids = categoryTabs().map((tab) => tab.getAttribute('aria-controls'));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('låter flera kedjor vara öppna samtidigt, för att kunna jämföras', () => {
    open(0);
    open(1);

    expect(host().querySelectorAll('.panel').length).toBe(2);
  });

  it('fäller ihop kedjan igen vid ett andra tryck', () => {
    open(0);
    open(0);

    expect(categories()).toEqual([]);
  });

  it('pekar ut panelen den styr, så att den kan följas av en skärmläsare', () => {
    open(0);

    const id = tabs()[0].getAttribute('aria-controls');
    expect(id).toBe('rabatter-willys');
    expect(host().querySelector('#' + id)).not.toBeNull();

    const categoryId = categoryTabs()[0].getAttribute('aria-controls');
    expect(categoryId).toBe('rabatter-willys-fika-godis');
    expect(host().querySelector('#' + categoryId)).not.toBeNull();
  });

  it('upprepar inte kedjenamnet i varje rad när det redan står i fliken', () => {
    open(0);

    expect(host().querySelector('app-offer-list .chain')).toBeNull();
  });

  it('ligger öppen från början när bara en kedja är ikryssad', () => {
    // Då finns inget att välja mellan, och fliken vore bara ett klick i vägen.
    setGroups([group('Willys', 3)]);

    expect(categories().length).toBe(3);
  });

  it('går inte att öppna när kedjan inte hade något', () => {
    setGroups([group('Lidl', 0)]);

    expect(labels()).toEqual(['Lidl inga rabatter']);
    expect(tabs()[0].disabled).toBeTrue();
  });

  it('visar vägen tillbaka till recepten', () => {
    let stängd = 0;
    fixture.componentInstance.closed.subscribe(() => (stängd += 1));

    host().querySelector<HTMLButtonElement>('.back')?.click();

    expect(stängd).toBe(1);
  });
});
