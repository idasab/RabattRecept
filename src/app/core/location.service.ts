import { Injectable } from '@angular/core';
import { Coordinates } from './offers.models';

export type LocationErrorKind = 'denied' | 'unavailable' | 'timeout' | 'unsupported';

export class LocationError extends Error {
  constructor(readonly kind: LocationErrorKind, message: string) {
    super(message);
    this.name = 'LocationError';
  }
}

/**
 * Positionen kommer från webbläsarens geolocation-API. På iPhone frågar Safari
 * om lov första gången och kommer ihåg svaret per webbplats, även när appen
 * ligger på hemskärmen — så ett nekat lov behöver en väg runt, inte en ny fråga.
 */
@Injectable({ providedIn: 'root' })
export class LocationService {
  async current(): Promise<Coordinates> {
    if (!('geolocation' in navigator)) {
      throw new LocationError(
        'unsupported',
        'Den här webbläsaren kan inte lämna ut din position. Sök på en ort i stället.'
      );
    }

    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false,
        timeout: 10000,
        // Erbjudanden byts en gång i veckan, så en position från senaste
        // kvarten är lika användbar som en ny och sparar en GPS-fix.
        maximumAge: 15 * 60 * 1000,
      });
    }).catch((error) => {
      throw this.translate(error);
    });

    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };
  }

  private translate(error: unknown): LocationError {
    const raw = error as GeolocationPositionError | undefined;

    // 1 nekad, 2 otillgänglig, 3 timeout.
    if (raw?.code === 1) {
      return new LocationError(
        'denied',
        'Appen fick inte tillgång till din plats. Sök på en ort i stället, eller slå på platstjänster i inställningarna.'
      );
    }

    if (raw?.code === 3) {
      return new LocationError(
        'timeout',
        'Det tog för lång tid att hitta din position. Försök igen eller sök på en ort.'
      );
    }

    return new LocationError(
      'unavailable',
      'Din position går inte att läsa av just nu. Sök på en ort i stället.'
    );
  }
}
