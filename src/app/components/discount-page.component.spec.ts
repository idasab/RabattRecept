import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DiscountPageComponent } from './discount-page.component';
import { Chain, Offer, OfferGroup } from '../core/offers.models';

function chain(id: string, name: string): Chain {
  return { id, name, brand: name, color: '#e60219', logo: null, distanceKm: 0.4 };
}

function offers(chainId: string, chainName: string, count: number): Offer[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `${chainId}-${index}`,
    chainId,
    chainName,
    heading: `Vara ${index}`,
    description: '',
    price: 10,
    prePrice: null,
    currency: 'SEK',
    discount: null,
    image: null,
    validUntil: '2099-01-01T00:00:00+0000',
  }));
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

  function labels(): string[] {
    return tabs().map((tab) => tab.textContent?.replace(/\s+/g, ' ').trim() ?? '');
  }

  function rows(): number {
    return host().querySelectorAll('app-offer-list .offer').length;
  }

  function open(index: number): void {
    tabs()[index].click();
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [DiscountPageComponent] });
    fixture = TestBed.createComponent(DiscountPageComponent);
    setGroups([
      { chain: chain('willys', 'Willys'), offers: offers('willys', 'Willys', 3) },
      { chain: chain('coop', 'Coop'), offers: offers('coop', 'Coop', 2) },
    ]);
  });

  it('visar kedjorna hopfällda, med antalet i fliken', () => {
    expect(labels()).toEqual(['Willys 3', 'Coop 2']);
    expect(rows()).toBe(0);
  });

  it('räknar ihop varorna och kedjorna överst', () => {
    expect(host().querySelector('.summary')?.textContent).toContain('5 varor från 2 kedjor');
  });

  it('fäller ut den kedja man trycker på, och bara den', () => {
    open(0);

    expect(rows()).toBe(3);
    expect(tabs()[0].getAttribute('aria-expanded')).toBe('true');
    expect(tabs()[1].getAttribute('aria-expanded')).toBe('false');
  });

  it('låter flera kedjor vara öppna samtidigt, för att kunna jämföras', () => {
    open(0);
    open(1);

    expect(rows()).toBe(5);
    expect(host().querySelectorAll('app-offer-list').length).toBe(2);
  });

  it('fäller ihop igen vid ett andra tryck', () => {
    open(0);
    open(0);

    expect(rows()).toBe(0);
  });

  it('pekar ut panelen den styr, så att den kan följas av en skärmläsare', () => {
    open(0);

    const id = tabs()[0].getAttribute('aria-controls');
    expect(id).toBe('rabatter-willys');
    expect(host().querySelector('#' + id)).not.toBeNull();
  });

  it('upprepar inte kedjenamnet i varje rad när det redan står i fliken', () => {
    open(0);

    expect(host().querySelector('app-offer-list .chain')).toBeNull();
  });

  it('ligger öppen från början när bara en kedja är ikryssad', () => {
    // Då finns inget att välja mellan, och fliken vore bara ett klick i vägen.
    setGroups([{ chain: chain('willys', 'Willys'), offers: offers('willys', 'Willys', 3) }]);

    expect(rows()).toBe(3);
  });

  it('går inte att öppna när kedjan inte hade något', () => {
    setGroups([{ chain: chain('lidl', 'Lidl'), offers: [] }]);

    expect(labels()).toEqual(['Lidl inga rabatter']);
    expect(tabs()[0].disabled).toBeTrue();
  });

  it('visar femton rader per kedja och fäller ut resten på begäran', () => {
    // En storstadsradie ger flera hundra rabatter. Alla på en gång gör sidan
    // trög på en telefon, och ingen läser trehundra rader i ett svep.
    setGroups([{ chain: chain('willys', 'Willys'), offers: offers('willys', 'Willys', 40) }]);
    expect(rows()).toBe(15);

    const more = host().querySelector<HTMLButtonElement>('.more');
    expect(more?.textContent).toContain('25 kvar');

    more?.click();
    fixture.detectChanges();
    expect(rows()).toBe(30);
  });

  it('utvidgar en kedja i taget', () => {
    setGroups([
      { chain: chain('willys', 'Willys'), offers: offers('willys', 'Willys', 40) },
      { chain: chain('coop', 'Coop'), offers: offers('coop', 'Coop', 40) },
    ]);
    open(0);
    open(1);

    host().querySelectorAll<HTMLButtonElement>('.more')[0].click();
    fixture.detectChanges();

    const perGroup = Array.from(host().querySelectorAll('app-offer-list')).map(
      (list) => list.querySelectorAll('.offer').length
    );
    expect(perGroup).toEqual([30, 15]);
  });

  it('visar vägen tillbaka till recepten', () => {
    let stängd = 0;
    fixture.componentInstance.closed.subscribe(() => (stängd += 1));

    host().querySelector<HTMLButtonElement>('.back')?.click();

    expect(stängd).toBe(1);
  });
});
