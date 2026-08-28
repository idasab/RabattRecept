import { brandOrder, groceryBrandFor } from './grocery-brands';

describe('groceryBrandFor', () => {
  it('känner igen ICA:s butiksformat på domänen', () => {
    expect(groceryBrandFor('https://www.ica.se/butiker/maxi/')).toBe('ICA');
    expect(groceryBrandFor('https://www.ica.se/butiker/nara/')).toBe('ICA');
  });

  it('lägger Coops lågprisformat under Coop', () => {
    expect(groceryBrandFor('http://coop.se/')).toBe('Coop');
    expect(groceryBrandFor('https://x-tra.se/')).toBe('Coop');
  });

  it('klarar adresser utan protokoll', () => {
    expect(groceryBrandFor('willys.se')).toBe('Willys');
  });

  it('sållar bort kedjor som inte säljer mat', () => {
    expect(groceryBrandFor('http://byggmax.se/')).toBeNull();
    expect(groceryBrandFor('http://jysk.se/')).toBeNull();
    expect(groceryBrandFor('http://xn--ob-eka.se')).toBeNull();
  });

  it('svarar null på tom eller trasig adress', () => {
    expect(groceryBrandFor(null)).toBeNull();
    expect(groceryBrandFor('')).toBeNull();
    expect(groceryBrandFor('inte en adress')).toBeNull();
  });

  it('får inte luras av en domän som bara slutar likadant', () => {
    expect(groceryBrandFor('https://fejkica.se')).toBeNull();
  });
});

describe('brandOrder', () => {
  it('ger kända varumärken en fast ordning', () => {
    expect(brandOrder('ICA')).toBeLessThan(brandOrder('Willys'));
  });

  it('lägger okända varumärken sist', () => {
    expect(brandOrder('Okänd kedja')).toBeGreaterThan(brandOrder('Nära Dej'));
  });
});
