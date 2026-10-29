/**
 * Favorites management service for ConferenceWalker.
 * Persists starred POI identifiers in browser localStorage with graceful
 * fallback for private browsing modes or restricted environments.
 */

import { APP_CONFIG } from '../config';

const STORAGE_KEY = 'conference_walker_favorites_v1';

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
    const defaults = defaultPois ?? APP_CONFIG.defaultSavedPois ?? [];
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored !== null) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            this.favorites = new Set(parsed.map(String));
            return;
          }
        }
      }
      this.favorites = new Set(defaults.map(String));
    } catch {
      // In private browsing or sandbox mode, localStorage access might throw SecurityError.
      // Fallback to in-memory storage safely without crashing.
      this.favorites = new Set(defaults.map(String));
    }
  }

  private saveToStorage(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const array = Array.from(this.favorites);
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(array));
      }
    } catch {
      // Silently tolerate localStorage quotas or private browsing restrictions
    }
  }
}
