import { describe, it, expect } from 'vitest';
import { parseUrlState, buildQueryString, syncStateToUrl } from '../src/utils/urlState';
import { FilterState } from '../src/types/poi';

describe('urlState utility', () => {
  it('parses empty query string to defaults', () => {
    const parsed = parseUrlState('');
    expect(parsed.poiId).toBeNull();
    expect(parsed.activeTab).toBeNull();
    expect(parsed.categories).toBeNull();
    expect(parsed.allowedWalkTimes).toBeNull();
    expect(parsed.selectedCuisines).toBeNull();
    expect(parsed.searchQuery).toBeNull();
    expect(parsed.openNowOnly).toBeNull();
    expect(parsed.nearestOnly).toBeNull();
    expect(parsed.excludeOvertureOnly).toBeNull();
    expect(parsed.basemapStyle).toBeNull();
  });

  it('parses deep link query parameters correctly', () => {
    const query =
      '?poi=sac_poi_123&tab=saved&cat=restaurant,bar&walk=5,10&cuisines=vegan,mexican&q=tacos&open_now=true&unknown_hours=false&nearest=true&exclude_overture=true&basemap=bright';

    const parsed = parseUrlState(query);

    expect(parsed.poiId).toBe('sac_poi_123');
    expect(parsed.activeTab).toBe('favorites');
    expect(parsed.categories).toEqual(new Set(['restaurant', 'bar']));
    expect(parsed.allowedWalkTimes).toEqual(new Set([5, 10]));
    expect(parsed.selectedCuisines).toEqual(new Set(['vegan', 'mexican']));
    expect(parsed.searchQuery).toBe('tacos');
    expect(parsed.openNowOnly).toBe(true);
    expect(parsed.includeUnknownHours).toBe(false);
    expect(parsed.nearestOnly).toBe(true);
    expect(parsed.excludeOvertureOnly).toBe(true);
    expect(parsed.basemapStyle).toBe('bright');
  });

  it('serializes state into query string', () => {
    const filterState: FilterState = {
      categories: new Set(['restaurant', 'coffee_tea']),
      allowedWalkTimes: new Set([5]),
      openNowOnly: true,
      includeUnknownHours: false,
      selectedCuisines: new Set(['pizza']),
      searchQuery: 'downtown',
      favoritesOnly: false,
      excludeOvertureOnly: true,
      nearestOnly: true,
    };

    const qs = buildQueryString({
      filterState,
      selectedPoiId: 'venue_456',
      activeTab: 'favorites',
      basemapStyle: 'liberty',
    });

    expect(qs).toContain('poi=venue_456');
    expect(qs).toContain('tab=saved');
    expect(qs).toContain('cat=restaurant%2Ccoffee_tea');
    expect(qs).toContain('walk=5');
    expect(qs).toContain('cuisines=pizza');
    expect(qs).toContain('q=downtown');
    expect(qs).toContain('open_now=true');
    expect(qs).toContain('unknown_hours=false');
    expect(qs).toContain('nearest=true');
    expect(qs).toContain('exclude_overture=true');
    expect(qs).toContain('basemap=liberty');
  });

  it('performs round-trip serialization and deserialization', () => {
    const filterState: FilterState = {
      categories: new Set(['hotel', 'transit']),
      allowedWalkTimes: new Set([10, 15]),
      openNowOnly: false,
      includeUnknownHours: true,
      selectedCuisines: new Set([]),
      searchQuery: 'station',
      favoritesOnly: false,
      excludeOvertureOnly: false,
      nearestOnly: false,
    };

    const qs = buildQueryString({
      filterState,
      selectedPoiId: 'station_1',
      activeTab: 'explore',
      basemapStyle: 'positron',
    });

    const parsed = parseUrlState(qs);

    expect(parsed.poiId).toBe('station_1');
    expect(parsed.activeTab).toBeNull(); // explore tab is default, omitted from URL
    expect(parsed.categories).toEqual(new Set(['hotel', 'transit']));
    expect(parsed.allowedWalkTimes).toEqual(new Set([10, 15]));
    expect(parsed.searchQuery).toBe('station');
    expect(parsed.nearestOnly).toBeNull();
  });
});
