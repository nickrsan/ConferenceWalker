import { describe, it, expect, beforeEach } from 'vitest';
import { parseAndValidatePOIs, extractAvailableCuisines } from '../src/services/dataLoader';
import { FilterStore } from '../src/state/filterState';
import { FavoritesStore } from '../src/state/favorites';
import { buildGraphHopperWalkingUrl, buildMobileDirectionsIntent } from '../src/utils/directions';
import { evaluateOpeningHours } from '../src/utils/openingHours';
import fs from 'fs';
import path from 'path';

describe('ConferenceWalker End-to-End Integration', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  const poiFilePath = path.resolve(__dirname, '../public/data/sacramento_pois.geojson');
  const regionFilePath = path.resolve(__dirname, '../public/data/region.json');

  const rawPOIs = JSON.parse(fs.readFileSync(poiFilePath, 'utf-8'));
  const rawRegion = JSON.parse(fs.readFileSync(regionFilePath, 'utf-8'));

  const poiCollection = parseAndValidatePOIs(rawPOIs);
  const conferenceCoords: [number, number] = rawRegion.center;

  it('validates conference center coordinates and walkshed bounds', () => {
    expect(conferenceCoords.length).toBe(2);
    expect(rawRegion.isochrones.length).toBe(3);
    const walkTiers = rawRegion.isochrones.map((iso: any) => iso.minutes);
    expect(walkTiers).toEqual([5, 10, 15]);
  });

  it('filters dataset by multiple combined criteria (category + walk distance + open now)', () => {
    const filterStore = new FilterStore();
    const favoritesStore = new FavoritesStore();

    // 1. Select Coffee & Tea category only
    filterStore.clearCategories(poiCollection.features, favoritesStore.getFavorites());
    filterStore.toggleCategory('coffee_tea', poiCollection.features, favoritesStore.getFavorites());

    // 2. Select 5 min walk distance only
    filterStore.setAllowedWalkTimes([5], poiCollection.features, favoritesStore.getFavorites());

    // 3. Enable Open Now with unknown included
    const testMorning = new Date('2026-09-09T08:30:00'); // Wednesday morning
    filterStore.setOpenNowOnly(true, poiCollection.features, favoritesStore.getFavorites());
    filterStore.setIncludeUnknownHours(true, poiCollection.features, favoritesStore.getFavorites());

    const matchingIds = filterStore.getMatchingIds(
      poiCollection.features,
      favoritesStore.getFavorites(),
      testMorning
    );

    expect(matchingIds.size).toBeGreaterThan(0);

    // Verify all matching items satisfy the criteria
    for (const feat of poiCollection.features) {
      if (matchingIds.has(feat.properties.id)) {
        expect(feat.properties.category).toBe('coffee_tea');
        expect(feat.properties.walk_time_minutes).toBe(5);
        const status = evaluateOpeningHours(feat.properties.opening_hours, testMorning);
        expect(status === 'open' || status === 'unknown').toBe(true);
      }
    }
  });

  it('persists favorites and filters by saved favorites in real dataset', () => {
    const filterStore = new FilterStore();
    const favoritesStore = new FavoritesStore();

    // Pick first 3 venues
    const sampleIds = poiCollection.features.slice(0, 3).map((f) => f.properties.id);
    for (const id of sampleIds) {
      favoritesStore.addFavorite(id);
    }

    expect(favoritesStore.getFavorites().size).toBe(3);

    // Toggle Favorites-Only view
    filterStore.setFavoritesOnly(true, poiCollection.features, favoritesStore.getFavorites());
    const matching = filterStore.getMatchingIds(poiCollection.features, favoritesStore.getFavorites());

    expect(matching.size).toBe(3);
    for (const id of sampleIds) {
      expect(matching.has(id)).toBe(true);
    }
  });

  it('generates actionable GraphHopper walking directions for dataset venues', () => {
    const targetPOI = poiCollection.features[0];
    const poiCoords = targetPOI.geometry.coordinates;

    const ghUrl = buildGraphHopperWalkingUrl(conferenceCoords, poiCoords);
    expect(ghUrl.startsWith('https://graphhopper.com/maps/?point=')).toBe(true);
    expect(ghUrl).toContain('&vehicle=foot');

    const mobileIntent = buildMobileDirectionsIntent(poiCoords, targetPOI.properties.name);
    expect(mobileIntent.startsWith('geo:')).toBe(true);
  });

  it('extracts unique cuisines from restaurants and filters dynamically', () => {
    const cuisines = extractAvailableCuisines(poiCollection.features);
    expect(cuisines.length).toBeGreaterThan(0);

    const filterStore = new FilterStore();
    const favoritesStore = new FavoritesStore();

    // Pick first cuisine
    const chosenCuisine = cuisines[0];
    filterStore.toggleCuisine(chosenCuisine, poiCollection.features, favoritesStore.getFavorites());

    const matching = filterStore.getMatchingIds(poiCollection.features, favoritesStore.getFavorites());
    for (const feat of poiCollection.features) {
      if (matching.has(feat.properties.id) && feat.properties.category === 'restaurant') {
        expect(feat.properties.cuisines).toContain(chosenCuisine);
      }
    }
  });
});
