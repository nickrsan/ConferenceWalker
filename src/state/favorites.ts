/**
 * Favorites management service for ConferenceWalker.
 * Persists starred POI identifiers in browser localStorage with graceful
 * fallback for private browsing modes or restricted environments.
 */

import { APP_CONFIG } from '../config';

export const FAVORITES_STORAGE_KEY = 'conference_walker_favorites_v1';
export const SEEN_DEFAULTS_STORAGE_KEY = 'cw_seen_default_saved_pois';

export interface DefaultFavoritesMergeResult {
  favorites: string[];
  seen: string[];
  changed: boolean;
}

/** Adds deployed defaults that this browser has not previously received, without removing stars. */
export function mergeDeployedDefaultFavorites(
  stored: string[] | null,
  seen: string[] | null,
  defaults: string[]
): DefaultFavoritesMergeResult {
  const storedFavorites = stored?.map(String) ?? [];
  const previouslySeenDefaults = seen?.map(String) ?? [];
  const favorites = new Set(storedFavorites);
  const seenDefaults = new Set(previouslySeenDefaults);

  for (const poiId of new Set(defaults.map(String))) {
    if (!seenDefaults.has(poiId)) {
      favorites.add(poiId);
      seenDefaults.add(poiId);
    }
  }

  const mergedFavorites = Array.from(favorites);
  const mergedSeen = Array.from(seenDefaults);
  const changed = !arraysMatch(mergedFavorites, storedFavorites) ||
    !arraysMatch(mergedSeen, previouslySeenDefaults);

  return { favorites: mergedFavorites, seen: mergedSeen, changed };
}

function arraysMatch(first: string[], second: string[]): boolean {
  return first.length === second.length && first.every((value, index) => value === second[index]);
}

function parseStoredStringArray(value: string | null): string[] | null {
  if (value === null) return null;

  try {
    const parsedValue: unknown = JSON.parse(value);
    return Array.isArray(parsedValue) ? parsedValue.map(String) : null;
  } catch {
    return null;
  }
}

export type FavoritesChangeListener = (favorites: Set<string>) => void;

export class FavoritesStore {
  private favorites: Set<string> = new Set();
  private listeners: Set<FavoritesChangeListener> = new Set();

  constructor(defaultPois?: string[]) {
    this.loadFromStorage(defaultPois);
  }

  public getFavorites(): Set<string> {
    return new Set(this.favorites);
  }

  public isFavorite(poiId: string): boolean {
    return this.favorites.has(poiId);
  }

  public toggleFavorite(poiId: string): boolean {
    const isNowFavorite = !this.favorites.has(poiId);
    if (isNowFavorite) {
      this.favorites.add(poiId);
    } else {
      this.favorites.delete(poiId);
    }

    this.saveToStorage();
    this.notify();
    return isNowFavorite;
  }

  public addFavorite(poiId: string): void {
    if (!this.favorites.has(poiId)) {
      this.favorites.add(poiId);
      this.saveToStorage();
      this.notify();
    }
  }

  public removeFavorite(poiId: string): void {
    if (this.favorites.has(poiId)) {
      this.favorites.delete(poiId);
      this.saveToStorage();
      this.notify();
    }
  }

  public clearFavorites(): void {
    this.favorites.clear();
    this.saveToStorage();
    this.notify();
  }

  public setFavorites(poiIds: string[]): void {
    this.favorites = new Set(poiIds.map(String));
    this.saveToStorage();
    this.notify();
  }

  public subscribe(listener: FavoritesChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const copy = this.getFavorites();
    for (const listener of this.listeners) {
      listener(copy);
    }
  }

  private loadFromStorage(defaultPois?: string[]): void {
    const defaults = (defaultPois ?? APP_CONFIG.defaultSavedPois ?? []).map(String);
    let storage: Storage;
    let storedFavoritesValue: string | null;
    let storedSeenDefaultsValue: string | null;

    try {
      if (typeof window === 'undefined') {
        this.favorites = new Set(defaults);
        return;
      }

      storage = window.localStorage;
      storedFavoritesValue = storage.getItem(FAVORITES_STORAGE_KEY);
      storedSeenDefaultsValue = storage.getItem(SEEN_DEFAULTS_STORAGE_KEY);
    } catch {
      // In private browsing or sandbox mode, localStorage access might throw SecurityError.
      // Fallback to in-memory storage safely without crashing.
      this.favorites = new Set(defaults);
      return;
    }

    const storedFavorites = parseStoredStringArray(storedFavoritesValue);
    const storedSeenDefaults = parseStoredStringArray(storedSeenDefaultsValue);
    const corruptedFavorites = storedFavoritesValue !== null && storedFavorites === null;
    const merged = mergeDeployedDefaultFavorites(storedFavorites, storedSeenDefaults, defaults);
    this.favorites = new Set(merged.favorites);

    if (!merged.changed) return;

    try {
      // Preserve malformed stars for recovery; only remember newly delivered defaults.
      if (!corruptedFavorites) {
        storage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(merged.favorites));
      }
      storage.setItem(SEEN_DEFAULTS_STORAGE_KEY, JSON.stringify(merged.seen));
    } catch {
      // Keep the merged state in memory when the browser blocks writes or runs out of space.
    }
  }

  private saveToStorage(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const array = Array.from(this.favorites);
        window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(array));
      }
    } catch {
      // Silently tolerate localStorage quotas or private browsing restrictions
    }
  }
}
