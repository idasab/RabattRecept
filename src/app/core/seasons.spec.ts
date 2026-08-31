import { isOutOfSeason, occasionOf, occasionsInSeason } from './seasons';

/** Fasta datum, så att testerna inte beror på när de körs. */
const AUGUSTI = new Date('2026-08-31T12:00:00');
const DECEMBER = new Date('2026-12-05T12:00:00');
const APRIL = new Date('2026-04-02T12:00:00');

describe('occasionOf', () => {
  it('känner igen högtiden i en rubrik', () => {
    expect(occasionOf('Klassisk Janssons frestelse till julbordet')).toBe('Jul');
    expect(occasionOf('Påskmust och ägghalvor')).toBe('Påsk');
    expect(occasionOf('Sill till midsommar')).toBe('Midsommar');
  });

  it('känner igen källans egna tillfällesnamn', () => {
    // Namnen kommer från Tastelines taxonomi.
    expect(occasionOf('Julgodis')).toBe('Jul');
    expect(occasionOf('Varmrätt till nyår')).toBe('Nyår');
    expect(occasionOf('Alla hjärtans dag')).toBe('Alla hjärtans dag');
    expect(occasionOf('Kräftskiva')).toBe('Kräftskiva');
  });

  it('räknar julens följe till julen', () => {
    expect(occasionOf('Pepparkakor')).toBe('Jul');
    expect(occasionOf('Glöggmingel')).toBe('Jul');
    expect(occasionOf('Lussekatter')).toBe('Jul');
  });

  it('låter sig inte luras av ord som bara börjar likadant', () => {
    // Alla tre är riktiga ord som börjar på en högtidsstam.
    expect(occasionOf('Sallad i juli')).toBeNull();
    expect(occasionOf('Julienneskurna grönsaker')).toBeNull();
    expect(occasionOf('Knäckebröd med ost')).toBeNull();
  });

  it('skiljer midsommar från sommar', () => {
    expect(occasionOf('Midsommartårta')).toBe('Midsommar');
    expect(occasionOf('Sommarsalsa')).toBe('Sommar');
  });

  it('svarar null på recept utan tillfälle', () => {
    expect(occasionOf('Kycklinggryta med curry')).toBeNull();
    expect(occasionOf('')).toBeNull();
  });
});

describe('isOutOfSeason', () => {
  it('sållar bort julen i augusti', () => {
    expect(isOutOfSeason('Janssons frestelse till julbordet', AUGUSTI)).toBeTrue();
    expect(isOutOfSeason('Julgodis', AUGUSTI)).toBeTrue();
  });

  it('släpper igenom julen i december', () => {
    expect(isOutOfSeason('Janssons frestelse till julbordet', DECEMBER)).toBeFalse();
  });

  it('släpper igenom kräftskivan i augusti men inte i december', () => {
    expect(isOutOfSeason('Kräftskiva', AUGUSTI)).toBeFalse();
    expect(isOutOfSeason('Kräftskiva', DECEMBER)).toBeTrue();
  });

  it('ger marginal inför högtiden', () => {
    // Man lagar inför påsken, inte bara på påskdagen.
    expect(isOutOfSeason('Påskmat', APRIL)).toBeFalse();
    expect(isOutOfSeason('Påskmat', AUGUSTI)).toBeTrue();
  });

  it('släpper igenom allt som inte hör till en högtid', () => {
    expect(isOutOfSeason('Kycklinggryta med curry', AUGUSTI)).toBeFalse();
    expect(isOutOfSeason('Lax i ugn', DECEMBER)).toBeFalse();
  });

  it('sållar inte bort ord som bara liknar en högtid', () => {
    expect(isOutOfSeason('Sallad i juli', DECEMBER)).toBeFalse();
    expect(isOutOfSeason('Knäckebröd med ost', AUGUSTI)).toBeFalse();
  });
});

describe('occasionsInSeason', () => {
  it('berättar vad som gäller nu', () => {
    expect(occasionsInSeason(AUGUSTI)).toEqual(['Sommar', 'Kräftskiva', 'Skördetid']);
    expect(occasionsInSeason(DECEMBER)).toEqual(['Jul', 'Nyår']);
  });
});
