import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  FavoritesStore,
  FAVORITES_STORAGE_KEY,
  mergeDeployedDefaultFavorites,
  SEEN_DEFAULTS_STORAGE_KEY,
} from '../src/state/favorites';
import { generateSavedPoisJson, isExportModeEnabled } from '../src/utils/exportSaved';
import { POIFeature } from '../src/types/poi';

describe('FavoritesStore', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('initializes with empty favorites when no defaults provided', () => {
    const store = new FavoritesStore([]);
    expect(store.getFavorites().size).toBe(0);
    expect(store.isFavorite('poi_1')).toBe(false);
  });

  it('initializes with default saved POIs when localStorage is empty', () => {
    const defaultPois = ['default_venue_1', 'default_venue_2'];
    const store = new FavoritesStore(defaultPois);

    expect(store.getFavorites().size).toBe(2);
    expect(store.isFavorite('default_venue_1')).toBe(true);
    expect(store.isFavorite('default_venue_2')).toBe(true);
    expect(JSON.parse(window.localStorage.getItem(FAVORITES_STORAGE_KEY) || '[]')).toEqual(defaultPois);
    expect(JSON.parse(window.localStorage.getItem(SEEN_DEFAULTS_STORAGE_KEY) || '[]')).toEqual(defaultPois);
  });

  it('preserves existing user favorites and adds deployed defaults', () => {
    window.localStorage.setItem(
      FAVORITES_STORAGE_KEY,
      JSON.stringify(['user_custom_poi'])
    );
    const defaultPois = ['default_venue_1', 'default_venue_2'];
    const store = new FavoritesStore(defaultPois);

    expect(store.getFavorites().size).toBe(3);
    expect(store.isFavorite('user_custom_poi')).toBe(true);
    expect(store.isFavorite('default_venue_1')).toBe(true);
    expect(store.isFavorite('default_venue_2')).toBe(true);
  });

  it('does not re-add a deployed default after the user removes or clears it', () => {
    const defaults = ['deployed_poi'];
    const firstLoad = new FavoritesStore(defaults);

    firstLoad.removeFavorite('deployed_poi');
    expect(JSON.parse(window.localStorage.getItem(SEEN_DEFAULTS_STORAGE_KEY) || '[]')).toEqual(defaults);
    expect(new FavoritesStore(defaults).isFavorite('deployed_poi')).toBe(false);

    const clearedFavorites = new FavoritesStore(defaults);
    clearedFavorites.clearFavorites();
    expect(JSON.parse(window.localStorage.getItem(SEEN_DEFAULTS_STORAGE_KEY) || '[]')).toEqual(defaults);
    expect(new FavoritesStore(defaults).isFavorite('deployed_poi')).toBe(false);
  });

  it('does not overwrite corrupted stored stars while still handling new defaults in memory', () => {
    const corruptedStars = '{invalid-json';
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, corruptedStars);
    window.localStorage.setItem(SEEN_DEFAULTS_STORAGE_KEY, '[]');

    const store = new FavoritesStore(['new_default']);

    expect(store.isFavorite('new_default')).toBe(true);
    expect(window.localStorage.getItem(FAVORITES_STORAGE_KEY)).toBe(corruptedStars);
    expect(JSON.parse(window.localStorage.getItem(SEEN_DEFAULTS_STORAGE_KEY) || '[]')).toEqual(['new_default']);
  });

  it('falls back to in-memory defaults if reading localStorage throws', () => {
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Storage is blocked');
    });

    try {
      const store = new FavoritesStore(['safe_default']);
      expect(store.isFavorite('safe_default')).toBe(true);
    } finally {
      getItemSpy.mockRestore();
    }
  });

  it('toggles favorites and persists to localStorage', () => {
    const store = new FavoritesStore([]);
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
    const store = new FavoritesStore([]);
    expect(store.isFavorite('fav_a')).toBe(true);
    expect(store.isFavorite('fav_b')).toBe(true);
    expect(store.getFavorites().size).toBe(2);
  });

  it('subscribes to favorite changes', () => {
    const store = new FavoritesStore([]);
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

  it('generates valid JSON export format for default saved POIs', () => {
    const favorites = new Set(['venue_1', 'venue_2']);
    const mockPois: POIFeature[] = [
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [-121.49, 38.58] },
        properties: {
          id: 'venue_1',
          name: 'Recommended Bakery',
          category: 'restaurant',
          walk_time_minutes: 5,
          address: '1000 K St',
          phone: null,
          website: null,
          opening_hours: null,
          cuisines: ['bakery'],
          sources: ['osm'],
          osm_id: '1',
          overture_id: null,
        },
      },
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [-121.49, 38.58] },
        properties: {
          id: 'venue_2',
          name: 'Conference Hotel',
          category: 'hotel',
          walk_time_minutes: 2,
          address: '1201 J St',
          phone: null,
          website: null,
          opening_hours: null,
          cuisines: [],
          sources: ['osm'],
          osm_id: '2',
          overture_id: null,
        },
      },
    ];

    const jsonStr = generateSavedPoisJson(favorites, mockPois);
    const parsed = JSON.parse(jsonStr);

    expect(parsed.version).toBe('1.0');
    expect(parsed.count).toBe(2);
    expect(parsed.defaultSavedPois).toEqual(['venue_1', 'venue_2']);
    expect(parsed.venues?.length).toBe(2);
    expect(parsed.venues?.[0].name).toBe('Recommended Bakery');
    expect(parsed.venues?.[1].name).toBe('Conference Hotel');
  });
});

describe('mergeDeployedDefaultFavorites', () => {
  it('adds only unseen deployed defaults and never removes stored stars', () => {
    const firstVisit = mergeDeployedDefaultFavorites(null, null, ['deployed_a', 'deployed_b']);
    expect(firstVisit).toEqual({
      favorites: ['deployed_a', 'deployed_b'],
      seen: ['deployed_a', 'deployed_b'],
      changed: true,
    });

    const returningVisit = mergeDeployedDefaultFavorites(
      ['user_custom', 'deployed_b'],
      ['deployed_a', 'deployed_b'],
      ['deployed_a', 'deployed_b', 'deployed_c']
    );
    expect(returningVisit.favorites).toEqual(['user_custom', 'deployed_b', 'deployed_c']);
    expect(returningVisit.seen).toEqual(['deployed_a', 'deployed_b', 'deployed_c']);
    expect(returningVisit.changed).toBe(true);
  });

  it('keeps an already-seen default unstarred and reports no changes when current', () => {
    const unstarredDefault = mergeDeployedDefaultFavorites(
      ['user_custom'],
      ['deployed_a'],
      ['deployed_a']
    );
    expect(unstarredDefault.favorites).toEqual(['user_custom']);
    expect(unstarredDefault.seen).toEqual(['deployed_a']);
    expect(unstarredDefault.changed).toBe(false);
  });
});
