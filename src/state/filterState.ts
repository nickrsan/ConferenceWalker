/**
 * Reactive filter state store for ConferenceWalker.
 * Manages multi-dimensional filtering across categories, walk distances,
 * open-now status, restaurant cuisines, search query, and favorites.
 */

import {
  POICategory,
  POIFeature,
  FilterState,
  ALL_CATEGORIES,
} from '../types/poi';

import { APP_CONFIG} from "../config";

import { evaluateOpeningHours } from '../utils/openingHours';

export type FilterChangeListener = (state: FilterState, matchingIds: Set<string>) => void;

export class FilterStore {
  private state: FilterState;
  private defaultCategories: POICategory[];
  private listeners: Set<FilterChangeListener> = new Set();
  private readonly STORAGE_KEY_EXCLUDE_OVERTURE = 'conference_walker_exclude_overture';

  constructor(initialState?: Partial<FilterState>, defaultCategories?: POICategory[]) {
    this.defaultCategories = defaultCategories && defaultCategories.length > 0 ? defaultCategories : ALL_CATEGORIES;
    const initialExcludeOverture =
      initialState?.excludeOvertureOnly ?? this.detectInitialExcludeOverture();

    this.state = {
      categories: new Set(initialState?.categories || this.defaultCategories),
      allowedWalkTimes: new Set(initialState?.allowedWalkTimes || [5, 10, 15, 'outside']),
      openNowOnly: initialState?.openNowOnly ?? false,
      includeUnknownHours: initialState?.includeUnknownHours ?? true,
      selectedCuisines: new Set(initialState?.selectedCuisines || []),
      searchQuery: initialState?.searchQuery || '',
      favoritesOnly: initialState?.favoritesOnly ?? false,
      excludeOvertureOnly: initialExcludeOverture,
    };
  }

  private detectInitialExcludeOverture(): boolean {
    if (typeof window === 'undefined') return false;
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('exclude_overture') === 'true' || params.get('no_overture') === 'true') {
        return true;
      }
      let stored_val = window.localStorage.getItem(this.STORAGE_KEY_EXCLUDE_OVERTURE) === 'true';
      if(!stored_val) {
        return APP_CONFIG['excludeOvertureOnlyByDefault'];
      }
      return stored_val;
    } catch {
      return false;
    }
  }

  public getDefaultCategories(): POICategory[] {
    return [...this.defaultCategories];
  }

  public setDefaultCategories(
    categories: POICategory[],
    allFeatures?: POIFeature[],
    favoriteIds?: Set<string>
  ): void {
    this.defaultCategories = categories.length > 0 ? categories : ALL_CATEGORIES;
    this.state.categories = new Set(this.defaultCategories);
    if (allFeatures && favoriteIds) {
      this.notify(allFeatures, favoriteIds);
    }
  }

  public getState(): FilterState {
    return {
      categories: new Set(this.state.categories),
      allowedWalkTimes: new Set(this.state.allowedWalkTimes),
      openNowOnly: this.state.openNowOnly,
      includeUnknownHours: this.state.includeUnknownHours,
      selectedCuisines: new Set(this.state.selectedCuisines),
      searchQuery: this.state.searchQuery,
      favoritesOnly: this.state.favoritesOnly,
      excludeOvertureOnly: this.state.excludeOvertureOnly,
    };
  }

  public subscribe(listener: FilterChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(allFeatures: POIFeature[], favoriteIds: Set<string>, now: Date = new Date()): void {
    const matchingIds = this.getMatchingIds(allFeatures, favoriteIds, now);
    const stateSnapshot = this.getState();
    for (const listener of this.listeners) {
      listener(stateSnapshot, matchingIds);
    }
  }

  /**
   * Evaluates if a given POI matches all active filter criteria.
   */
  public matches(
    poi: POIFeature,
    favoriteIds: Set<string>,
    now: Date = new Date()
  ): boolean {
    const props = poi.properties;

    // 0. Exclude data only sourced from Overture Maps
    if (this.state.excludeOvertureOnly) {
      const rawSources = props.sources || [];
      const sources: string[] = Array.isArray(rawSources)
        ? rawSources
        : typeof rawSources === 'string'
        ? (rawSources as string).split(',').map((s) => s.trim())
        : [];
      const hasOsm = sources.includes('osm');
      const hasOverture = sources.includes('overture');
      // Exclude if venue is only in Overture (no OpenStreetMap source)
      if (hasOverture && !hasOsm) {
        return false;
      }
    }

    // 1. Favorites only filter
    if (this.state.favoritesOnly && !favoriteIds.has(props.id)) {
      return false;
    }

    // 2. Category filter
    if (!this.state.categories.has(props.category)) {
      return false;
    }

    // 3. Walk time filter
    const walkVal: number | 'outside' = props.walk_time_minutes !== null ? props.walk_time_minutes : 'outside';
    if (!this.state.allowedWalkTimes.has(walkVal)) {
      return false;
    }

    // 4. Text search query
    if (this.state.searchQuery.trim()) {
      const q = this.state.searchQuery.trim().toLowerCase();
      const nameMatch = props.name.toLowerCase().includes(q);
      const addrMatch = props.address ? props.address.toLowerCase().includes(q) : false;
      const cuisineMatch = props.cuisines.some((c) => c.toLowerCase().includes(q));
      if (!nameMatch && !addrMatch && !cuisineMatch) {
        return false;
      }
    }

    // 5. Cuisine filter (applies to restaurants or venues tagged with cuisines)
    if (this.state.selectedCuisines.size > 0) {
      if (props.category === 'restaurant') {
        const hasMatchingCuisine = props.cuisines.some((c) => this.state.selectedCuisines.has(c));
        if (!hasMatchingCuisine) {
          return false;
        }
      }
    }

    // 6. Open Now filter
    if (this.state.openNowOnly) {
      const status = evaluateOpeningHours(props.opening_hours, now);
      if (status === 'open') {
        return true;
      }
      if (status === 'unknown' && this.state.includeUnknownHours) {
        return true;
      }
      return false;
    }

    return true;
  }

  /**
   * Returns the set of all POI IDs that satisfy the current filter state.
   */
  public getMatchingIds(
    allFeatures: POIFeature[],
    favoriteIds: Set<string>,
    now: Date = new Date()
  ): Set<string> {
    const matching = new Set<string>();
    for (const feat of allFeatures) {
      if (this.matches(feat, favoriteIds, now)) {
        matching.add(feat.properties.id);
      }
    }
    return matching;
  }

  /**
   * Generates a MapLibre GL filter expression representing the current active filter state.
   */
  public buildMapLibreFilter(
    allFeatures: POIFeature[],
    favoriteIds: Set<string>,
    now: Date = new Date()
  ): any[] {
    const matchingIds = Array.from(this.getMatchingIds(allFeatures, favoriteIds, now));
    return ['in', ['get', 'id'], ['literal', matchingIds]];
  }

  // State Mutators

  public toggleCategory(cat: POICategory, allFeatures: POIFeature[], favoriteIds: Set<string>): void {
    if (this.state.categories.has(cat)) {
      this.state.categories.delete(cat);
    } else {
      this.state.categories.add(cat);
    }
    this.notify(allFeatures, favoriteIds);
  }

  public setAllCategories(allFeatures: POIFeature[], favoriteIds: Set<string>): void {
    this.state.categories = new Set(ALL_CATEGORIES);
    this.notify(allFeatures, favoriteIds);
  }

  public clearCategories(allFeatures: POIFeature[], favoriteIds: Set<string>): void {
    this.state.categories.clear();
    this.notify(allFeatures, favoriteIds);
  }

  public toggleWalkTime(time: number | 'outside', allFeatures: POIFeature[], favoriteIds: Set<string>): void {
    if (this.state.allowedWalkTimes.has(time)) {
      this.state.allowedWalkTimes.delete(time);
    } else {
      this.state.allowedWalkTimes.add(time);
    }
    this.notify(allFeatures, favoriteIds);
  }

  public setAllowedWalkTimes(times: (number | 'outside')[], allFeatures: POIFeature[], favoriteIds: Set<string>): void {
    this.state.allowedWalkTimes = new Set(times);
    this.notify(allFeatures, favoriteIds);
  }

  public setOpenNowOnly(enabled: boolean, allFeatures: POIFeature[], favoriteIds: Set<string>): void {
    this.state.openNowOnly = enabled;
    this.notify(allFeatures, favoriteIds);
  }

  public setIncludeUnknownHours(enabled: boolean, allFeatures: POIFeature[], favoriteIds: Set<string>): void {
    this.state.includeUnknownHours = enabled;
    this.notify(allFeatures, favoriteIds);
  }

  public toggleCuisine(cuisine: string, allFeatures: POIFeature[], favoriteIds: Set<string>): void {
    const norm = cuisine.toLowerCase().trim();
    if (this.state.selectedCuisines.has(norm)) {
      this.state.selectedCuisines.delete(norm);
    } else {
      this.state.selectedCuisines.add(norm);
    }
    this.notify(allFeatures, favoriteIds);
  }

  public clearCuisines(allFeatures: POIFeature[], favoriteIds: Set<string>): void {
    this.state.selectedCuisines.clear();
    this.notify(allFeatures, favoriteIds);
  }

  public setSearchQuery(query: string, allFeatures: POIFeature[], favoriteIds: Set<string>): void {
    this.state.searchQuery = query;
    this.notify(allFeatures, favoriteIds);
  }

  public setFavoritesOnly(enabled: boolean, allFeatures: POIFeature[], favoriteIds: Set<string>): void {
    this.state.favoritesOnly = enabled;
    this.notify(allFeatures, favoriteIds);
  }

  public setExcludeOvertureOnly(
    enabled: boolean,
    allFeatures: POIFeature[],
    favoriteIds: Set<string>
  ): void {
    if (this.state.excludeOvertureOnly === enabled) return;
    this.state.excludeOvertureOnly = enabled;
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(this.STORAGE_KEY_EXCLUDE_OVERTURE, String(enabled));
      }
    } catch {
      // Defensive fallback if localStorage is sandboxed
    }
    this.notify(allFeatures, favoriteIds);
  }

  public isExcludeOvertureOnly(): boolean {
    return this.state.excludeOvertureOnly;
  }

  public resetFilters(allFeatures: POIFeature[], favoriteIds: Set<string>): void {
    this.state.categories = new Set(this.defaultCategories);
    this.state.allowedWalkTimes = new Set([5, 10, 15, 'outside']);
    this.state.openNowOnly = false;
    this.state.includeUnknownHours = true;
    this.state.selectedCuisines.clear();
    this.state.searchQuery = '';
    this.state.favoritesOnly = false;
    this.notify(allFeatures, favoriteIds);
  }
}
