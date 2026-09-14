import { describe, it, expect, beforeEach } from 'vitest';
import { FavoritesStore } from '../src/state/favorites';

describe('FavoritesStore', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('initializes with empty favorites', () => {
    const store = new FavoritesStore();
    expect(store.getFavorites().size).toBe(0);
    expect(store.isFavorite('poi_1')).toBe(false);
  });

  it('toggles favorites and persists to localStorage', () => {
    const store = new FavoritesStore();
    const isFav = store.toggleFavorite('poi_123');
    expect(isFav).toBe(true);
    expect(store.isFavorite('poi_123')).toBe(true);

    // Verify localStorage persistence
    const saved = JSON.parse(window.localStorage.getItem('conference_walker_favorites_v1') || '[]');
    expect(saved).toContain('poi_123');

    // Toggle off
    const toggledOff = store.toggleFavorite('poi_123');
    expect(toggledOff).toBe(false);
    expect(store.isFavorite('poi_123')).toBe(false);
  });

  it('loads previously saved favorites from localStorage on initialization', () => {
    window.localStorage.setItem('conference_walker_favorites_v1', JSON.stringify(['fav_a', 'fav_b']));
    const store = new FavoritesStore();
    expect(store.isFavorite('fav_a')).toBe(true);
    expect(store.isFavorite('fav_b')).toBe(true);
    expect(store.getFavorites().size).toBe(2);
  });

  it('subscribes to favorite changes', () => {
    const store = new FavoritesStore();
    let changeCount = 0;
    let lastFavorites = new Set<string>();

    const unsubscribe = store.subscribe((favs) => {
      changeCount++;
      lastFavorites = favs;
    });

    store.toggleFavorite('poi_99');
    expect(changeCount).toBe(1);
    expect(lastFavorites.has('poi_99')).toBe(true);

    unsubscribe();
    store.toggleFavorite('poi_100');
    expect(changeCount).toBe(1); // Not called after unsubscribe
  });
});
