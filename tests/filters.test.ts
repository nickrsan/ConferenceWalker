import { describe, it, expect } from 'vitest';
import { FilterStore } from '../src/state/filterState';
import { POIFeature } from '../src/types/poi';

describe('FilterStore logic and predicates', () => {
  const samplePOIs: POIFeature[] = [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-121.49, 38.58] },
      properties: {
        id: 'coffee_5min',
        name: 'Temple Coffee',
        category: 'coffee_tea',
        walk_time_minutes: 5,
        address: '1000 K St',
        phone: null,
        website: null,
        opening_hours: 'Mo-Su 06:00-20:00',
        cuisines: ['coffee', 'pastries'],
        sources: ['osm'],
        osm_id: '1',
        overture_id: null,
      },
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-121.49, 38.58] },
      properties: {
        id: 'coffee_15min',
        name: 'Old Soul Coffee',
        category: 'coffee_tea',
        walk_time_minutes: 15,
        address: '1700 L St',
        phone: null,
        website: null,
        opening_hours: 'Mo-Su 07:00-18:00',
        cuisines: ['coffee'],
        sources: ['osm'],
        osm_id: '2',
        overture_id: null,
      },
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-121.49, 38.58] },
      properties: {
        id: 'italian_restaurant',
        name: 'Il Fornaio',
        category: 'restaurant',
        walk_time_minutes: 10,
        address: '400 Capitol Mall',
        phone: null,
        website: null,
        opening_hours: 'Mo-Fr 11:30-21:00',
        cuisines: ['italian', 'pizza'],
        sources: ['overture'],
        osm_id: null,
        overture_id: 'ov_1',
      },
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-121.49, 38.58] },
      properties: {
        id: 'mexican_restaurant',
        name: 'Zocalo',
        category: 'restaurant',
        walk_time_minutes: 10,
        address: '1801 Capitol Ave',
        phone: null,
        website: null,
        opening_hours: null, // Unknown hours
        cuisines: ['mexican'],
        sources: ['overture'],
        osm_id: null,
        overture_id: 'ov_2',
      },
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-121.49, 38.58] },
      properties: {
        id: 'park_outside',
        name: 'Sutter Park',
        category: 'park_outdoors',
        walk_time_minutes: null, // >15 min outside
        address: null,
        phone: null,
        website: null,
        opening_hours: '24/7',
        cuisines: [],
        sources: ['osm'],
        osm_id: '5',
        overture_id: null,
      },
    },
  ];

  it('Scenario 3: Live filter updates by category and walk distance', () => {
    const store = new FilterStore();
    const favorites = new Set<string>();

    // Filter for only coffee_tea within 5 min
    store.clearCategories(samplePOIs, favorites);
    store.toggleCategory('coffee_tea', samplePOIs, favorites);
    store.setAllowedWalkTimes([5], samplePOIs, favorites);

    const matches = Array.from(store.getMatchingIds(samplePOIs, favorites));
    expect(matches).toEqual(['coffee_5min']);
  });

  it('Scenario 4: Restaurant cuisine filtering', () => {
    const store = new FilterStore();
    const favorites = new Set<string>();

    // Select cuisine 'italian'
    store.toggleCuisine('italian', samplePOIs, favorites);

    const matches = Array.from(store.getMatchingIds(samplePOIs, favorites));
    expect(matches.includes('italian_restaurant')).toBe(true);
    expect(matches.includes('mexican_restaurant')).toBe(false);
  });

  it('Scenario 5: Open Now & Unknown Hours filtering', () => {
    const store = new FilterStore();
    const favorites = new Set<string>();

    // Test time: Wednesday at 14:00 (Il Fornaio is open, Zocalo has unknown hours)
    const testNow = new Date('2026-09-09T14:00:00');

    // 1. Open now only, with includeUnknownHours = false
    store.setOpenNowOnly(true, samplePOIs, favorites);
    store.setIncludeUnknownHours(false, samplePOIs, favorites);

    let matching = store.getMatchingIds(samplePOIs, favorites, testNow);
    expect(matching.has('italian_restaurant')).toBe(true);
    expect(matching.has('coffee_5min')).toBe(true);
    expect(matching.has('mexican_restaurant')).toBe(false); // Unknown excluded

    // 2. Open now only, with includeUnknownHours = true
    store.setIncludeUnknownHours(true, samplePOIs, favorites);
    matching = store.getMatchingIds(samplePOIs, favorites, testNow);
    expect(matching.has('italian_restaurant')).toBe(true);
    expect(matching.has('mexican_restaurant')).toBe(true); // Unknown included

    // 3. Late at night (03:00 AM) -> Il Fornaio is closed
    const lateNight = new Date('2026-09-09T03:00:00');
    store.setIncludeUnknownHours(false, samplePOIs, favorites);
    matching = store.getMatchingIds(samplePOIs, favorites, lateNight);
    expect(matching.has('italian_restaurant')).toBe(false);
    // 24/7 park is open
    expect(matching.has('park_outside')).toBe(true);
  });

  it('Scenario 6: Favorites-only filter', () => {
    const store = new FilterStore();
    const favorites = new Set(['italian_restaurant']);

    store.setFavoritesOnly(true, samplePOIs, favorites);
    const matches = Array.from(store.getMatchingIds(samplePOIs, favorites));
    expect(matches).toEqual(['italian_restaurant']);
  });

  it('Filters by search query matching name, address, or cuisine', () => {
    const store = new FilterStore();
    const favorites = new Set<string>();

    // Search by address substring 'Capitol'
    store.setSearchQuery('capitol', samplePOIs, favorites);
    let matches = Array.from(store.getMatchingIds(samplePOIs, favorites));
    expect(matches.sort()).toEqual(['italian_restaurant', 'mexican_restaurant']);

    // Search by cuisine 'pastries'
    store.setSearchQuery('pastries', samplePOIs, favorites);
    matches = Array.from(store.getMatchingIds(samplePOIs, favorites));
    expect(matches).toEqual(['coffee_5min']);
  });

  it('supports configurable default categories and reset behavior', () => {
    const customDefaults = ['restaurant', 'coffee_tea'] as const;
    const store = new FilterStore(undefined, [...customDefaults]);
    const favorites = new Set<string>();

    expect(store.getDefaultCategories()).toEqual(['restaurant', 'coffee_tea']);
    expect(store.getState().categories).toEqual(new Set(['restaurant', 'coffee_tea']));

    // Modify categories
    store.clearCategories(samplePOIs, favorites);
    expect(store.getState().categories.size).toBe(0);

    // Reset filters restores configured defaults rather than all categories
    store.resetFilters(samplePOIs, favorites);
    expect(store.getState().categories).toEqual(new Set(['restaurant', 'coffee_tea']));

    // Dynamically update default categories
    store.setDefaultCategories(['bar', 'hotel'], samplePOIs, favorites);
    expect(store.getDefaultCategories()).toEqual(['bar', 'hotel']);
    expect(store.getState().categories).toEqual(new Set(['bar', 'hotel']));
  });
});
