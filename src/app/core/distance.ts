import { Coordinates } from './offers.models';

/** Jordens medelradie i kilometer. */
const EARTH_RADIUS_KM = 6371.0088;

/**
 * Fågelvägen mellan två punkter, i kilometer. Haversine räcker gott här:
 * avstånden är några få mil och används bara för att sortera kedjor efter
 * närhet, inte för att navigera.
 */
export function distanceKm(from: Coordinates, to: Coordinates): number {
  const fromLat = toRadians(from.latitude);
  const toLat = toRadians(to.latitude);
  const deltaLat = toRadians(to.latitude - from.latitude);
  const deltaLon = toRadians(to.longitude - from.longitude);

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(deltaLon / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
