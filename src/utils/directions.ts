/**
 * Walking directions and mobile intent generator for ConferenceWalker.
 * Provides deep links to GraphHopper Maps and mobile map intents.
 */

/**
 * Generates a GraphHopper Maps walking navigation URL from the conference center to a POI.
 *
 * Coordinates are passed as [longitude, latitude] in GeoJSON order.
 * Output format: https://graphhopper.com/maps/?point=LAT%2CLON&point=LAT%2CLON&vehicle=foot
 */
export function buildGraphHopperWalkingUrl(
  conferenceCoords: [number, number],
  poiCoords: [number, number]
): string {
  const confLon = Number(conferenceCoords[0]);
  const confLat = Number(conferenceCoords[1]);
  const poiLon = Number(poiCoords[0]);
  const poiLat = Number(poiCoords[1]);

  const url = new URL('https://graphhopper.com/maps/');
  url.searchParams.append('point', `${confLat},${confLon}`);
  url.searchParams.append('point', `${poiLat},${poiLon}`);
  url.searchParams.append('vehicle', 'foot');

  return url.toString();
}

/**
 * Constructs a mobile navigation intent URI (`geo:`) for native mapping applications
 * on Android and iOS devices.
 */
export function buildMobileDirectionsIntent(
  poiCoords: [number, number],
  venueName?: string
): string {
  const lon = Number(poiCoords[0]);
  const lat = Number(poiCoords[1]);

  if (venueName) {
    const encodedName = encodeURIComponent(venueName.trim());
    return `geo:${lat},${lon}?q=${lat},${lon}(${encodedName})`;
  }

  return `geo:${lat},${lon}?q=${lat},${lon}`;
}

/**
 * Universal fallback maps search URL for web browsers.
 */
export function buildUniversalMapsUrl(
  poiCoords: [number, number],
  venueName?: string
): string {
  const lon = Number(poiCoords[0]);
  const lat = Number(poiCoords[1]);

  if (venueName) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${venueName} ${lat},${lon}`)}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
}

/**
 * Calculates the great-circle distance between two geographic coordinates [lon, lat] in meters
 * using the Haversine formula.
 */
export function calculateDistanceMeters(
  coord1: [number, number],
  coord2: [number, number]
): number {
  const [lon1, lat1] = coord1;
  const [lon2, lat2] = coord2;
  const earthRadiusMeters = 6371000;
  const toRadians = Math.PI / 180;
  const deltaLat = (lat2 - lat1) * toRadians;
  const deltaLon = (lon2 - lon1) * toRadians;

  const haversineValue =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1 * toRadians) * Math.cos(lat2 * toRadians) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
  const angularDistance = 2 * Math.atan2(Math.sqrt(haversineValue), Math.sqrt(1 - haversineValue));

  return Math.round(earthRadiusMeters * angularDistance);
}

/**
 * Formats a distance in meters into a human-readable string (e.g. "250 m" or "1.2 km").
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  const km = (Math.round(meters / 100) / 10).toFixed(1);
  return `${km} km`;
}
