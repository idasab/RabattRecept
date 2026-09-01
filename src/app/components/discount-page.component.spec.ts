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

  function headings(): string[] {
    return Array.from(host().querySelectorAll('.group-head .card-heading')).map(
      (element) => element.textContent?.trim() ?? ''
    );
  }

  function rows(): number {
    return host().querySelectorAll('app-offer-list .offer').length;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [DiscountPageComponent] });
    fixture = TestBed.createComponent(DiscountPageComponent);
    setGroups([
      { chain: chain('willys', 'Willys'), offers: offers('willys', 'Willys', 3) },
      { chain: chain('coop', 'Coop'), offers: offers('coop', 'Coop', 2) },
    ]);
  });

  it('samlar rabatterna under varsin kedjerubrik, i den ordning de kommer', () => {
    expect(headings()).toEqual(['Willys', 'Coop']);
    expect(rows()).toBe(5);
  });

  it('räknar ihop varorna och kedjorna överst', () => {
    expect(host().querySelector('.summary')?.textContent).toContain('5 varor från 2 kedjor');
  });

  it('upprepar inte kedjenamnet i varje rad när det redan står i rubriken', () => {
    expect(host().querySelector('app-offer-list .chain')).toBeNull();
  });

  it('säger ifrån när en ikryssad kedja inte hade något', () => {
    setGroups([{ chain: chain('lidl', 'Lidl'), offers: [] }]);

    expect(host().textContent).toContain('Inga rabatter på mat hos Lidl');
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

  it('fäller ut en kedja i taget', () => {
    setGroups([
      { chain: chain('willys', 'Willys'), offers: offers('willys', 'Willys', 40) },
      { chain: chain('coop', 'Coop'), offers: offers('coop', 'Coop', 40) },
    ]);

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
