const KRONOR = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 });
const ORE = new Intl.NumberFormat('sv-SE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const DAY = new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'short' });
const ONE_DECIMAL = new Intl.NumberFormat('sv-SE', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/**
 * '99 kr', '59,90 kr' — hela kronor utan decimaler, annars alltid två. Ett
 * pris som skrivs '59,9 kr' läses inte som ett pris.
 */
export function formatPrice(value: number, currency = 'SEK'): string {
  const amount = Number.isInteger(value) ? KRONOR.format(value) : ORE.format(value);
  return currency === 'SEK' ? `${amount} kr` : `${amount} ${currency}`;
}

/**
 * '250 m', '1,2 km', '14 km'. Precisionen minskar med avståndet: på nära håll
 * är hundra meter skillnad värt att veta, på en mil är det brus.
 */
export function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000 / 10) * 10} m`;
  }
  if (km < 10) {
    return `${ONE_DECIMAL.format(km)} km`;
  }
  return `${Math.round(km)} km`;
}

/** '−34 %', avrundat. Rabatten anges som andel 0–1. */
export function formatDiscount(discount: number): string {
  return `−${Math.round(discount * 100)} %`;
}

/**
 * Hur länge erbjudandet gäller, räknat i hela dygn från dagens datum. Det är
 * "sista dagen" man vill se, inte ett datum man måste räkna ut själv.
 */
export function formatValidUntil(validUntil: string, now = new Date()): string {
  const end = new Date(validUntil);
  if (Number.isNaN(end.getTime())) {
    return '';
  }

  const days = daysBetween(now, end);
  if (days < 0) {
    return 'Har gått ut';
  }
  if (days === 0) {
    return 'Sista dagen';
  }
  if (days === 1) {
    return 'T.o.m. i morgon';
  }

  return `T.o.m. ${DAY.format(end)}`;
}

/** Skillnaden i hela kalenderdygn, oberoende av klockslag. */
function daysBetween(from: Date, to: Date): number {
  const start = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const end = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((end - start) / 86400000);
}
