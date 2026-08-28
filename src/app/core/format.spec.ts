import { formatDiscount, formatDistance, formatPrice, formatValidUntil } from './format';

describe('formatPrice', () => {
  it('skriver hela kronor utan decimaler', () => {
    expect(formatPrice(99)).toBe('99 kr');
  });

  it('skriver alltid två decimaler när priset har ören', () => {
    expect(formatPrice(263.2)).toBe('263,20 kr');
    expect(formatPrice(59.95)).toBe('59,95 kr');
  });

  it('skriver ut andra valutor med sin kod', () => {
    expect(formatPrice(10, 'EUR')).toBe('10 EUR');
  });
});

describe('formatDistance', () => {
  it('skriver meter under en kilometer, avrundat till tiotal', () => {
    expect(formatDistance(0.084)).toBe('80 m');
    expect(formatDistance(0.257)).toBe('260 m');
  });

  it('skriver en decimal upp till en mil', () => {
    expect(formatDistance(1.24)).toBe('1,2 km');
    expect(formatDistance(9.95)).toBe('10,0 km');
  });

  it('skriver hela kilometer på längre avstånd', () => {
    expect(formatDistance(13.7)).toBe('14 km');
  });
});

describe('formatDiscount', () => {
  it('avrundar till hela procent', () => {
    expect(formatDiscount(0.316)).toBe('−32 %');
  });
});

describe('formatValidUntil', () => {
  const now = new Date('2026-08-28T09:00:00+02:00');

  it('säger till när det är sista dagen', () => {
    expect(formatValidUntil('2026-08-28T21:59:59+02:00', now)).toBe('Sista dagen');
  });

  it('säger i morgon i stället för ett datum', () => {
    expect(formatValidUntil('2026-08-29T21:59:59+02:00', now)).toBe('T.o.m. i morgon');
  });

  it('skriver datum längre fram', () => {
    expect(formatValidUntil('2026-08-30T21:59:59+02:00', now)).toContain('30');
  });

  it('markerar utgångna erbjudanden', () => {
    expect(formatValidUntil('2026-08-27T21:59:59+02:00', now)).toBe('Har gått ut');
  });

  it('svarar tomt på ett datum som inte går att läsa', () => {
    expect(formatValidUntil('inte ett datum', now)).toBe('');
  });
});
