/**
 * Domain types and data contracts for ConferenceWalker.
 */

export type POICategory =
  | 'convenience_pharmacy'
  | 'restaurant'
  | 'parking'
  | 'transit'
  | 'coffee_tea'
  | 'bar'
  | 'hotel'
  | 'attraction_art'
  | 'park_outdoors'
  | 'grocery';

export const ALL_CATEGORIES: POICategory[] = [
  'convenience_pharmacy',
  'restaurant',
  'parking',
  'transit',
  'coffee_tea',
  'bar',
  'hotel',
  'attraction_art',
  'park_outdoors',
  'grocery',
];

export const CATEGORY_META: Record<POICategory, { label: string; icon: string; color: string }> = {
  convenience_pharmacy: { label: 'Convenience / Pharmacy', icon: '💊', color: '#e7298a' },
  restaurant: { label: 'Restaurants', icon: '🍽️', color: '#e41a1c' },
  parking: { label: 'Parking', icon: '🅿️', color: '#999999' },
  transit: { label: 'Transit Locations', icon: '🚆', color: '#377eb8' },
  coffee_tea: { label: 'Coffee / Tea', icon: '☕', color: '#8c510a' },
  bar: { label: 'Bars & Pubs', icon: '🍸', color: '#984ea3' },
  hotel: { label: 'Hotels', icon: '🏨', color: '#ff7f00' },
  attraction_art: { label: 'Attractions & Art', icon: '🎨', color: '#ffff33' },
  park_outdoors: { label: 'Parks & Outdoors', icon: '🌳', color: '#4daf4a' },
  grocery: { label: 'Grocery Stores', icon: '🛒', color: '#1b9e77' },
};

export interface POIProperties {
  id: string;
  name: string;
  category: POICategory;
  walk_time_minutes: number | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  opening_hours: string | null;
  cuisines: string[];
  sources: ('osm' | 'overture')[];
  osm_id: string | null;
  overture_id: string | null;
  reservation_url?: string | null;
  order_url?: string | null;
}

export interface POIFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [lon, lat]
  };
  properties: POIProperties;
}

export interface POIFeatureCollection {
  type: 'FeatureCollection';
  features: POIFeature[];
}

export interface IsochroneTier {
  minutes: number;
  color: string;
  fillColor: string;
  label: string;
  area?: string;
}

export interface RegionMetadata {
  name: string;
  center: [number, number]; // [lon, lat]
  isochrones: IsochroneTier[];
  geojson: any;
}

export type OpeningStatus = 'open' | 'closed' | 'unknown';

export interface FilterState {
  categories: Set<POICategory>;
  allowedWalkTimes: Set<number | 'outside'>; // e.g. 5, 10, 15, 'outside'
  openNowOnly: boolean;
  includeUnknownHours: boolean;
  selectedCuisines: Set<string>;
  searchQuery: string;
  favoritesOnly: boolean;
}
