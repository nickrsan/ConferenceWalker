import { describe, it, expect } from 'vitest';
import {
  buildGraphHopperWalkingUrl,
  buildMobileDirectionsIntent,
  buildUniversalMapsUrl,
  calculateDistanceMeters,
  formatDistance,
} from '../src/utils/directions';

describe('Directions and Navigation Links (Scenario 7)', () => {
  const sacramentoConferenceCoords: [number, number] = [-121.489857, 38.579250]; // [lon, lat]
  const targetPoiCoords: [number, number] = [-121.492000, 38.580000]; // [lon, lat]

  it('builds valid GraphHopper walking URL with foot mode and exact lat,lon coordinates', () => {
    const urlString = buildGraphHopperWalkingUrl(sacramentoConferenceCoords, targetPoiCoords);
    const url = new URL(urlString);

    expect(url.origin).toBe('https://graphhopper.com');
    expect(url.pathname).toBe('/maps/');
    expect(url.searchParams.get('vehicle')).toBe('foot');

    const points = url.searchParams.getAll('point');
    expect(points.length).toBe(2);
    // Point 1: Conference lat,lon
    expect(points[0]).toBe('38.57925,-121.489857');
    // Point 2: POI lat,lon
    expect(points[1]).toBe('38.58,-121.492');
  });

  it('builds mobile navigation geo intent URI', () => {
    const intent = buildMobileDirectionsIntent(targetPoiCoords, 'Temple Coffee');
    expect(intent.startsWith('geo:38.58,-121.492')).toBe(true);
    expect(intent).toContain('Temple%20Coffee');
  });

  it('builds universal Google Maps search URL', () => {
    const url = buildUniversalMapsUrl(targetPoiCoords, 'Temple Coffee');
    expect(url.startsWith('https://www.google.com/maps/search/')).toBe(true);
    expect(url).toContain('38.58');
    expect(url).toContain('-121.492');
  });

  it('calculates geographic distance in meters using Haversine formula', () => {
    const distance = calculateDistanceMeters(sacramentoConferenceCoords, targetPoiCoords);
    // The distance between these two Sacramento points is approximately 204 meters
    expect(distance).toBeGreaterThan(180);
    expect(distance).toBeLessThan(230);
    expect(calculateDistanceMeters(sacramentoConferenceCoords, sacramentoConferenceCoords)).toBe(0);
  });

  it('formats distance into human-readable metric strings', () => {
    expect(formatDistance(50)).toBe('50 m');
    expect(formatDistance(950)).toBe('950 m');
    expect(formatDistance(1000)).toBe('1.0 km');
    expect(formatDistance(1450)).toBe('1.5 km');
  });
});
