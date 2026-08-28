import { distanceKm } from './distance';

describe('distanceKm', () => {
  it('ger noll för samma punkt', () => {
    expect(distanceKm({ latitude: 57.7, longitude: 11.97 }, { latitude: 57.7, longitude: 11.97 })).toBe(
      0
    );
  });

  it('räknar Göteborg–Stockholm till knappt 40 mil', () => {
    const göteborg = { latitude: 57.7089, longitude: 11.9746 };
    const stockholm = { latitude: 59.3293, longitude: 18.0686 };

    expect(distanceKm(göteborg, stockholm)).toBeCloseTo(396.89, 1);
  });

  it('är symmetrisk', () => {
    const a = { latitude: 55.605, longitude: 13.0038 };
    const b = { latitude: 63.8258, longitude: 20.263 };

    expect(distanceKm(a, b)).toBeCloseTo(distanceKm(b, a), 9);
  });

  it('klarar korta avstånd inom en stad', () => {
    // Cirka 1,1 km rakt norrut: en breddgrad är ungefär 111 km.
    const from = { latitude: 57.7, longitude: 11.97 };
    const to = { latitude: 57.71, longitude: 11.97 };

    expect(distanceKm(from, to)).toBeCloseTo(1.11, 2);
  });
});
