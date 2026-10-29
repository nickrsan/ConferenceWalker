/**
 * Bidirectional URL state synchronization for ConferenceWalker.
 * Encodes active filters, search query, selected POI, active tab, basemap style,
 * and nearest-mode into browser query parameters without triggering page reloads.
 */

import { FilterState, POICategory, ALL_CATEGORIES } from '../types/poi';
import { BasemapStyleKey } from '../map/mapStyles';

export interface ParsedUrlState {
  poiId: string | null;
  activeTab: 'explore' | 'favorites' | null;
  categories: Set<POICategory> | null;
  allowedWalkTimes: Set<number | 'outside'> | null;
  selectedCuisines: Set<string> | null;
  searchQuery: string | null;
  openNowOnly: boolean | null;
  includeUnknownHours: boolean | null;
  nearestOnly: boolean | null;
  excludeOvertureOnly: boolean | null;
  basemapStyle: BasemapStyleKey | null;
}

export interface UrlSyncOptions {
  filterState: FilterState;
  selectedPoiId: string | null;
  activeTab: 'explore' | 'favorites';
  basemapStyle?: BasemapStyleKey;
}

/**
 * Parses browser URL query string parameters into initial application state.
 */
export function parseUrlState(searchString?: string): ParsedUrlState {
  const query =
    searchString !== undefined
      ? searchString
      : typeof window !== 'undefined'
      ? window.location.search
      : '';

  const params = new URLSearchParams(query);

  // Selected POI
  const poiId = params.get('poi') || params.get('selected') || null;

  // Active Tab
  let activeTab: 'explore' | 'favorites' | null = null;
  const tabParam = params.get('tab');
  if (tabParam === 'favorites' || tabParam === 'saved') {
    activeTab = 'favorites';
  } else if (tabParam === 'explore') {
    activeTab = 'explore';
  }

  // Categories
  let categories: Set<POICategory> | null = null;
  const catParam = params.get('categories') || params.get('cat');
  if (catParam) {
    const list = catParam
      .split(',')
      .map((c) => c.trim().toLowerCase())
      .filter((c): c is POICategory => (ALL_CATEGORIES as string[]).includes(c));
    if (list.length > 0) {
      categories = new Set(list);
    }
  }

  // Walk Times
  let allowedWalkTimes: Set<number | 'outside'> | null = null;
  const walkParam = params.get('walk') || params.get('walk_time');
  if (walkParam) {
    const parsedWalk = walkParam
      .split(',')
      .map((w) => w.trim().toLowerCase())
      .map((w) => (w === 'outside' ? 'outside' : parseInt(w, 10)))
      .filter((w): w is number | 'outside' => w === 'outside' || !isNaN(w as number));
    if (parsedWalk.length > 0) {
      allowedWalkTimes = new Set(parsedWalk);
    }
  }

  // Cuisines
  let selectedCuisines: Set<string> | null = null;
  const cuisineParam = params.get('cuisines') || params.get('cuisine');
  if (cuisineParam) {
    const list = cuisineParam
      .split(',')
      .map((c) => c.trim().toLowerCase())
      .filter(Boolean);
    if (list.length > 0) {
      selectedCuisines = new Set(list);
    }
  }

  // Search Query
  const searchQuery = params.get('q') || params.get('search') || null;

  // Open Now & Unknown Hours
  let openNowOnly: boolean | null = null;
  if (params.has('open_now')) {
    openNowOnly = params.get('open_now') === 'true' || params.get('open_now') === '1';
  }

  let includeUnknownHours: boolean | null = null;
  if (params.has('unknown_hours') || params.has('include_unknown')) {
    const val = params.get('unknown_hours') || params.get('include_unknown');
    includeUnknownHours = val === 'true' || val === '1';
  }

  // Nearest Only Mode
  let nearestOnly: boolean | null = null;
  if (params.has('nearest') || params.has('nearest_only')) {
    const val = params.get('nearest') || params.get('nearest_only');
    nearestOnly = val === 'true' || val === '1';
  }

  // Exclude Overture
  let excludeOvertureOnly: boolean | null = null;
  if (params.has('exclude_overture') || params.has('no_overture')) {
    const val = params.get('exclude_overture') || params.get('no_overture');
    excludeOvertureOnly = val === 'true' || val === '1';
  }

  // Basemap Style
  let basemapStyle: BasemapStyleKey | null = null;
  const basemapParam = params.get('basemap') || params.get('map_style');
  if (basemapParam === 'positron' || basemapParam === 'bright' || basemapParam === 'liberty') {
    basemapStyle = basemapParam;
  }

  return {
    poiId,
    activeTab,
    categories,
    allowedWalkTimes,
    selectedCuisines,
    searchQuery,
    openNowOnly,
    includeUnknownHours,
    nearestOnly,
    excludeOvertureOnly,
    basemapStyle,
  };
}

/**
 * Builds a query string reflecting current application and filter state.
 */
export function buildQueryString(options: UrlSyncOptions, existingSearch?: string): string {
  const currentQuery =
    existingSearch !== undefined
      ? existingSearch
      : typeof window !== 'undefined'
      ? window.location.search
      : '';

  const params = new URLSearchParams(currentQuery);
  const { filterState, selectedPoiId, activeTab, basemapStyle } = options;

  // Selected POI
  if (selectedPoiId) {
    params.set('poi', selectedPoiId);
  } else {
    params.delete('poi');
    params.delete('selected');
  }

  // Active Tab
  if (activeTab === 'favorites') {
    params.set('tab', 'saved');
  } else {
    params.delete('tab');
  }

  // Categories
  if (filterState.categories && filterState.categories.size < ALL_CATEGORIES.length) {
    params.set('cat', Array.from(filterState.categories).join(','));
  } else {
    params.delete('cat');
    params.delete('categories');
  }

  // Walk Times
  if (filterState.allowedWalkTimes && filterState.allowedWalkTimes.size < 4) {
    params.set('walk', Array.from(filterState.allowedWalkTimes).join(','));
  } else {
    params.delete('walk');
    params.delete('walk_time');
  }

  // Cuisines
  if (filterState.selectedCuisines && filterState.selectedCuisines.size > 0) {
    params.set('cuisines', Array.from(filterState.selectedCuisines).join(','));
  } else {
    params.delete('cuisines');
    params.delete('cuisine');
  }

  // Search Query
  if (filterState.searchQuery && filterState.searchQuery.trim()) {
    params.set('q', filterState.searchQuery.trim());
  } else {
    params.delete('q');
    params.delete('search');
  }

  // Open Now & Unknown Hours
  if (filterState.openNowOnly) {
    params.set('open_now', 'true');
  } else {
    params.delete('open_now');
  }

  if (!filterState.includeUnknownHours) {
    params.set('unknown_hours', 'false');
  } else {
    params.delete('unknown_hours');
    params.delete('include_unknown');
  }

  // Nearest Only Mode
  if (filterState.nearestOnly) {
    params.set('nearest', 'true');
  } else {
    params.delete('nearest');
    params.delete('nearest_only');
  }

  // Exclude Overture Only
  if (filterState.excludeOvertureOnly) {
    params.set('exclude_overture', 'true');
  } else {
    params.delete('exclude_overture');
    params.delete('no_overture');
  }

  // Basemap style
  if (basemapStyle && basemapStyle !== 'positron') {
    params.set('basemap', basemapStyle);
  } else {
    params.delete('basemap');
    params.delete('map_style');
  }

  const result = params.toString();
  return result ? `?${result}` : '';
}

/**
 * Updates the browser address bar with current state without causing navigation or page refresh.
 */
export function syncStateToUrl(options: UrlSyncOptions): void {
  if (typeof window === 'undefined' || !window.history || !window.history.replaceState) {
    return;
  }

  const queryString = buildQueryString(options);
  const newUrl = `${window.location.pathname}${queryString}${window.location.hash}`;
  window.history.replaceState(null, '', newUrl);
}
