interface BrandRule {
  brand: string;
  /** Domäner som kedjans butiksformat pekar på. */
  hosts: string[];
}

/**
 * Erbjudandekällan täcker alla slags butiker — bygg, sport, möbler — och
 * appen ska bara visa mat. Klassningen görs på kedjans webbadress i stället
 * för på namnet, eftersom butiksformaten byter namn och tillkommer med jämna
 * mellanrum medan domänen står still: "ICA Kvantum", "ICA Maxi Stormarknad"
 * och ett format som lanseras nästa år pekar alla på ica.se.
 *
 * Ordningen styr hur kedjorna grupperas i listan.
 */
const BRANDS: BrandRule[] = [
  { brand: 'ICA', hosts: ['ica.se'] },
  { brand: 'Coop', hosts: ['coop.se', 'x-tra.se'] },
  { brand: 'Willys', hosts: ['willys.se'] },
  { brand: 'Hemköp', hosts: ['hemkop.se'] },
  { brand: 'Lidl', hosts: ['lidl.se'] },
  { brand: 'City Gross', hosts: ['citygross.se'] },
  { brand: 'Matöppet', hosts: ['matoppet.se'] },
  { brand: 'Tempo', hosts: ['tempo.se'] },
  { brand: 'Nära Dej', hosts: ['menigo.se'] },
];

/** Var varumärket hamnar i kedjelistan. Okända varumärken sist. */
export function brandOrder(brand: string): number {
  const index = BRANDS.findIndex((rule) => rule.brand === brand);
  return index === -1 ? BRANDS.length : index;
}

/**
 * Varumärket bakom en webbadress, eller null om kedjan inte säljer mat.
 * Matchar på domänslut så att både 'https://www.ica.se/butiker/maxi/' och
 * 'http://coop.se' hittar rätt.
 */
export function groceryBrandFor(website: string | null | undefined): string | null {
  const host = hostOf(website);
  if (!host) {
    return null;
  }

  const match = BRANDS.find((rule) =>
    rule.hosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))
  );

  return match?.brand ?? null;
}

function hostOf(website: string | null | undefined): string | null {
  if (!website) {
    return null;
  }

  try {
    // Adresserna kommer med och utan protokoll, så URL behöver ibland hjälp.
    const withProtocol = /^https?:\/\//i.test(website) ? website : `https://${website}`;
    return new URL(withProtocol).hostname.toLowerCase();
  } catch {
    return null;
  }
}
