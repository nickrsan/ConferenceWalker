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

    // Validate walk time
    let walkTime: number | null = null;
    if (rawProps.walk_time_minutes !== null && rawProps.walk_time_minutes !== undefined) {
      const parsedWalk = Number(rawProps.walk_time_minutes);
      if (!isNaN(parsedWalk)) {
        walkTime = parsedWalk;
      }
    }

    // Parse cuisines
    let cuisines: string[] = [];
    if (Array.isArray(rawProps.cuisines)) {
      cuisines = rawProps.cuisines.map((c) => String(c).trim().toLowerCase()).filter(Boolean);
    }

    // Parse sources
    let sources: ('osm' | 'overture')[] = [];
    if (Array.isArray(rawProps.sources)) {
      sources = rawProps.sources
        .map((s) => String(s).toLowerCase())
        .filter((s): s is 'osm' | 'overture' => s === 'osm' || s === 'overture');
    }
    if (sources.length === 0) {
      sources = ['osm'];
    }

    const properties: POIProperties = {
      id: String(rawProps.id || `poi_${i}`),
      name: String(rawProps.name || 'Unnamed Point of Interest').trim(),
      category,
      walk_time_minutes: walkTime,
      address: rawProps.address ? String(rawProps.address).trim() : null,
      phone: rawProps.phone ? String(rawProps.phone).trim() : null,
      website: rawProps.website ? String(rawProps.website).trim() : null,
      opening_hours: rawProps.opening_hours ? String(rawProps.opening_hours).trim() : null,
      cuisines,
      sources,
      osm_id: rawProps.osm_id ? String(rawProps.osm_id) : null,
      overture_id: rawProps.overture_id ? String(rawProps.overture_id) : null,
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
    for (const cuisine of feature.properties.cuisines) {
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
