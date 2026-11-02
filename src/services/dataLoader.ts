/**
 * Data loader and validation service for ConferenceWalker.
 * Loads region metadata and POI GeoJSON collections, ensuring schema compliance.
 */

import {
  POICategory,
  POIFeature,
  POIFeatureCollection,
  POIProperties,
  RegionMetadata,
  ALL_CATEGORIES,
} from '../types/poi';

/**
 * Validates whether a category string is one of the 10 approved POICategory values.
 */
export function isValidCategory(category: unknown): category is POICategory {
  return typeof category === 'string' && ALL_CATEGORIES.includes(category as POICategory);
}

/**
 * Sanitizes and validates raw GeoJSON into a typed POIFeatureCollection.
 * Handles missing fields, string coercion, and coordinate validation gracefully.
 */
export function parseAndValidatePOIs(raw: unknown): POIFeatureCollection {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid GeoJSON input: expected an object.');
  }

  const obj = raw as Record<string, unknown>;
  if (obj.type !== 'FeatureCollection' || !Array.isArray(obj.features)) {
    throw new Error('Invalid GeoJSON: must be a FeatureCollection with a features array.');
  }

  const validFeatures: POIFeature[] = [];

  for (let i = 0; i < obj.features.length; i++) {
    const rawFeat = obj.features[i];
    if (!rawFeat || typeof rawFeat !== 'object') continue;

    const geom = (rawFeat as Record<string, unknown>).geometry as Record<string, unknown> | undefined;
    const rawProps = ((rawFeat as Record<string, unknown>).properties || {}) as Record<string, unknown>;

    // Validate geometry
    if (!geom || geom.type !== 'Point' || !Array.isArray(geom.coordinates) || geom.coordinates.length < 2) {
      continue;
    }

    const lon = Number(geom.coordinates[0]);
    const lat = Number(geom.coordinates[1]);
    if (isNaN(lon) || isNaN(lat)) {
      continue;
    }

    // Validate category
    let category: POICategory = 'restaurant';
    if (isValidCategory(rawProps.category)) {
      category = rawProps.category;
    }

    // Sparse JSON omits null keys, so normalize absent and explicit null values together.
    const rawWalkTime = rawProps.walk_time_minutes ?? null;
    let walkTime: number | null = null;
    if (rawWalkTime !== null) {
      const parsedWalk = Number(rawWalkTime);
      if (!isNaN(parsedWalk)) {
        walkTime = parsedWalk;
      }
    }

    // Parse cuisines
    const rawCuisines = rawProps.cuisines ?? [];
    let cuisines: string[] = [];
    if (Array.isArray(rawCuisines)) {
      cuisines = rawCuisines.map((c) => String(c).trim().toLowerCase()).filter(Boolean);
    }

    // Parse sources
    const rawSources = rawProps.sources ?? [];
    let sources: ('osm' | 'overture')[] = [];
    if (Array.isArray(rawSources)) {
      sources = rawSources
        .map((s) => String(s).toLowerCase())
        .filter((s): s is 'osm' | 'overture' => s === 'osm' || s === 'overture');
    }
    if (sources.length === 0) {
      sources = ['osm'];
    }

    const address = rawProps.address ?? null;
    const phone = rawProps.phone ?? null;
    const website = rawProps.website ?? null;
    const openingHours = rawProps.opening_hours ?? null;
    const osmId = rawProps.osm_id ?? null;
    const overtureId = rawProps.overture_id ?? null;
    const reservationUrl = rawProps.reservation_url ?? null;
    const orderUrl = rawProps.order_url ?? null;
    const description = rawProps.description ?? null;

    const properties: POIProperties = {
      id: String(rawProps.id || `poi_${i}`),
      name: String(rawProps.name || 'Unnamed Point of Interest').trim(),
      category,
      walk_time_minutes: walkTime,
      address: address ? String(address).trim() : null,
      phone: phone ? String(phone).trim() : null,
      website: website ? String(website).trim() : null,
      opening_hours: openingHours ? String(openingHours).trim() : null,
      cuisines,
      sources,
      osm_id: osmId ? String(osmId) : null,
      overture_id: overtureId ? String(overtureId) : null,
      reservation_url: reservationUrl ? String(reservationUrl).trim() : null,
      order_url: orderUrl ? String(orderUrl).trim() : null,
      description: description ? String(description).trim() : null,
    };

    validFeatures.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [lon, lat],
      },
      properties,
    });
  }

  return {
    type: 'FeatureCollection',
    features: validFeatures,
  };
}

/**
 * Extracts and deduplicates all unique cuisines available among restaurant features.
 */
export function extractAvailableCuisines(features: POIFeature[]): string[] {
  const cuisineSet = new Set<string>();
  for (const feature of features) {
    for (const cuisine of feature.properties.cuisines ?? []) {
      if (cuisine) {
        cuisineSet.add(cuisine);
      }
    }
  }
  return Array.from(cuisineSet).sort();
}

/**
 * Fetches and parses region metadata from a remote or static URL.
 */
export async function loadRegionData(url = './data/region.json'): Promise<RegionMetadata> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load region data from ${url} (HTTP ${response.status})`);
  }
  const data = await response.json();
  if (!data || typeof data !== 'object' || !Array.isArray(data.center)) {
    throw new Error('Invalid region data: missing center coordinates.');
  }
  return data as RegionMetadata;
}

/**
 * Fetches and parses POI GeoJSON from a remote or static URL.
 */
export async function loadPOIData(url = './data/sacramento_pois.geojson'): Promise<POIFeatureCollection> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load POI dataset from ${url} (HTTP ${response.status})`);
  }
  const raw = await response.json();
  return parseAndValidatePOIs(raw);
}

function normalizeOsmId(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const normalizedId = String(value).trim().replace(/^osm_/i, '');
  return normalizedId || null;
}

/** Parses organizer descriptions keyed by OSM ID, ignoring blank and malformed entries. */
export function parseDescriptionOverrides(raw: unknown): Map<string, string> {
  const descriptions = new Map<string, string>();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return descriptions;

  const prototype = Object.getPrototypeOf(raw);
  if (prototype !== Object.prototype && prototype !== null) return descriptions;

  for (const [rawOsmId, rawDescription] of Object.entries(raw as Record<string, unknown>)) {
    const osmId = normalizeOsmId(rawOsmId);
    const description = typeof rawDescription === 'string' ? rawDescription.trim() : '';
    if (osmId && description) {
      descriptions.set(osmId, description);
    }
  }

  return descriptions;
}

/** Loads the optional override file; missing, invalid, and offline cases safely return no overrides. */
export async function loadDescriptionOverrides(
  url = './data/poi_descriptions.json'
): Promise<Map<string, string>> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`Unable to load POI description overrides from ${url} (HTTP ${response.status}).`);
      return new Map();
    }

    const raw = await response.json();
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      console.warn(`Invalid POI description overrides in ${url}; expected an object keyed by OSM ID.`);
      return new Map();
    }
    return parseDescriptionOverrides(raw);
  } catch (error) {
    console.warn(`Unable to load POI description overrides from ${url}.`, error);
    return new Map();
  }
}

/** Returns new POI feature objects, applying curated text without mutating the source collection. */
export function applyDescriptionOverrides(
  features: POIFeature[],
  overrides: Map<string, string>
): POIFeature[] {
  return features.map((feature) => {
    const osmId = normalizeOsmId(feature.properties.osm_id);
    const override = osmId ? overrides.get(osmId) : undefined;

    return {
      ...feature,
      properties: {
        ...feature.properties,
        ...(override ? { description: override } : {}),
      },
    };
  });
}
