/**
 * Utility for exporting saved / starred POIs as a configuration file.
 * Used by event organizers to curate default recommended places for conferences.
 */

import { POIFeature } from '../types/poi';

export interface SavedPoisExportPayload {
  version: string;
  exportedAt: string;
  count: number;
  defaultSavedPois: string[];
  venues?: Array<{
    id: string;
    name: string;
    category: string;
    address: string | null;
    walk_time_minutes: number | null;
    description?: string | null;
  }>;
}

/**
 * Checks whether the current URL contains an export flag (e.g. ?export_saved=true or ?export_mode=true).
 */
export function isExportModeEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const params = new URLSearchParams(window.location.search);
    return (
      params.get('export_saved') === 'true' ||
      params.get('export_mode') === 'true' ||
      params.get('export') === 'true' ||
      params.get('export_saved') === '1'
    );
  } catch {
    return false;
  }
}

/**
 * Formats saved POI IDs into a JSON string payload.
 */
export function generateSavedPoisJson(
  favorites: Set<string>,
  allPois: POIFeature[] = []
): string {
  const ids = Array.from(favorites);
  let venues: SavedPoisExportPayload['venues'] = undefined;

  if (allPois.length > 0) {
    const favSet = new Set(ids);
    venues = allPois
      .filter((p) => favSet.has(p.properties.id))
      .map((p) => ({
        id: p.properties.id,
        name: p.properties.name,
        category: p.properties.category,
        address: p.properties.address,
        walk_time_minutes: p.properties.walk_time_minutes,
        description: p.properties.description ?? null,
      }));
  }

  const payload: SavedPoisExportPayload = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    count: ids.length,
    defaultSavedPois: ids,
    venues,
  };

  return JSON.stringify(payload, null, 2);
}

/**
 * Triggers a browser file download of the saved POIs JSON payload.
 */
export function downloadSavedPoisFile(
  favorites: Set<string>,
  allPois: POIFeature[] = [],
  filename = 'default_saved_pois.json'
): void {
  if (typeof document === 'undefined') return;

  const jsonStr = generateSavedPoisJson(favorites, allPois);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Merges venue attributes (such as descriptions) from an exported saved POIs payload into active POI features.
 */
export function mergeExportedVenues(
  payload: SavedPoisExportPayload,
  features: POIFeature[]
): void {
  if (!payload || !Array.isArray(payload.venues)) return;
  const venueMap = new Map(payload.venues.map((v) => [v.id, v]));

  for (const feature of features) {
    const venue = venueMap.get(feature.properties.id);
    if (venue && venue.description) {
      if (!feature.properties.description) {
        feature.properties.description = venue.description;
      }
    }
  }
}
