import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FilterStore } from '../src/state/filterState';
import { FavoritesStore } from '../src/state/favorites';
import { DebugStore } from '../src/state/debugState';
import { SidebarComponent } from '../src/ui/sidebar';
import { POIDetailComponent } from '../src/ui/poiDetail';
import { parseUrlState, buildQueryString, syncStateToUrl } from '../src/utils/urlState';
import { generateSavedPoisJson } from '../src/utils/exportSaved';
import { POIFeature, RegionMetadata } from '../src/types/poi';

const mockRegion: RegionMetadata = {
  name: 'Sacramento Convention Center',
  center: [-121.489857, 38.579250],
  isochrones: [
    { minutes: 5, color: '#31a354', fillColor: '#31a354', label: '5 min' },
    { minutes: 10, color: '#fec44f', fillColor: '#fec44f', label: '10 min' },
    { minutes: 15, color: '#de2d26', fillColor: '#de2d26', label: '15 min' },
  ],
  geojson: { type: 'FeatureCollection', features: [] },
};

const testFeatures: POIFeature[] = [
  {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [-121.489, 38.579] },
    properties: {
      id: 'venue_coffee_near',
      name: 'Temple Coffee Roasters',
      category: 'coffee_tea',
      walk_time_minutes: 5,
      address: '1010 9th St',
      phone: '(916) 555-1111',
      website: 'https://templecoffee.com',
      opening_hours: 'Mo-Su 06:00-19:00',
      cuisines: ['coffee', 'pastries'],
      sources: ['osm'],
      osm_id: 'osm_101',
      overture_id: null,
    },
  },
  {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [-121.492, 38.582] },
    properties: {
      id: 'venue_coffee_far',
      name: 'Insight Coffee',
      category: 'coffee_tea',
      walk_time_minutes: 15,
      address: '1901 8th St',
      phone: null,
      website: null,
      opening_hours: null,
      cuisines: ['coffee'],
      sources: ['osm'],
      osm_id: 'osm_102',
      overture_id: null,
    },
  },
  {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [-121.490, 38.580] },
    properties: {
      id: 'venue_restaurant_vegan',
      name: 'Mayahuel Mexican & Vegan',
      category: 'restaurant',
      walk_time_minutes: 5,
      address: '1200 K St',
      phone: '(916) 555-2222',
      website: 'https://experience-mayahuel.com',
      opening_hours: 'Tu-Su 11:30-22:00',
      cuisines: ['mexican', 'vegan'],
      sources: ['osm', 'overture'],
      osm_id: 'osm_201',
      overture_id: 'gers_201',
      reservation_url: 'https://opentable.com/mayahuel',
    },
  },
  {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [-121.488, 38.578] },
    properties: {
      id: 'venue_art_mural',
      name: 'Wide Open Walls Mural',
      category: 'attraction_art',
      walk_time_minutes: 5,
      address: '1100 J St',
      phone: null,
      website: null,
      opening_hours: null,
      cuisines: [],
      sources: ['osm'],
      osm_id: 'osm_301',
      overture_id: null,
    },
  },
];

describe('End-to-End User Interaction Flow', () => {
  let sidebarEl: HTMLElement;
  let detailEl: HTMLElement;
  let filterStore: FilterStore;
  let favoritesStore: FavoritesStore;
  let debugStore: DebugStore;

  beforeEach(() => {
    window.localStorage.clear();
    sidebarEl = document.createElement('aside');
    detailEl = document.createElement('div');
    document.body.appendChild(sidebarEl);
    document.body.appendChild(detailEl);

    filterStore = new FilterStore();
    filterStore.setCenterCoords(mockRegion.center);
    favoritesStore = new FavoritesStore([]);
    debugStore = new DebugStore();
  });

  afterEach(() => {
    sidebarEl.remove();
    detailEl.remove();
  });

  it('completes the full flow: deep link -> filtering -> selection -> star favorite -> export JSON', () => {
    // 1. Emulate opening deep link with query params
    const deepLinkUrl =
      '?cat=restaurant,coffee_tea,attraction_art&walk=5,10,15&nearest=true&poi=venue_restaurant_vegan&basemap=bright';
    const parsedState = parseUrlState(deepLinkUrl);

    expect(parsedState.poiId).toBe('venue_restaurant_vegan');
    expect(parsedState.nearestOnly).toBe(true);
    expect(parsedState.basemapStyle).toBe('bright');
    expect(parsedState.categories).toEqual(new Set(['restaurant', 'coffee_tea', 'attraction_art']));

    // Hydrate store from deep link
    if (parsedState.categories) {
      filterStore.setDefaultCategories(Array.from(parsedState.categories), testFeatures, favoritesStore.getFavorites());
    }
    if (parsedState.nearestOnly !== null) {
      filterStore.setNearestOnly(parsedState.nearestOnly, testFeatures, favoritesStore.getFavorites());
    }

    let selectedPoi: POIFeature | null = null;
    const detail = new POIDetailComponent(
      detailEl,
      favoritesStore,
      mockRegion.center,
      {
        onClose: () => {
          selectedPoi = null;
        },
        onFavoriteChange: () => {
          sidebar.render();
        },
      },
      debugStore
    );

    const sidebar = new SidebarComponent(
      sidebarEl,
      filterStore,
      favoritesStore,
      {
        onSelectPOI: (poi) => {
          selectedPoi = poi;
          detail.show(poi);
        },
      },
      debugStore,
      false
    );

    sidebar.setData(testFeatures, mockRegion, ['coffee', 'pastries', 'mexican', 'vegan']);

    // Nearest mode is active: 1 coffee, 1 restaurant, 1 art mural (3 total, ignoring venue_coffee_far)
    const cards = sidebarEl.querySelectorAll('.poi-card');
    expect(cards.length).toBe(3);
    const cardIds = Array.from(cards).map((c) => c.getAttribute('data-id'));
    expect(cardIds).toContain('venue_coffee_near');
    expect(cardIds).not.toContain('venue_coffee_far');
    expect(cardIds).toContain('venue_restaurant_vegan');
    expect(cardIds).toContain('venue_art_mural');

    // 2. Select deep-linked POI
    const initialPoi = testFeatures.find((f) => f.properties.id === parsedState.poiId);
    if (initialPoi) {
      detail.show(initialPoi);
      sidebar.setSelectedPOI(initialPoi.properties.id);
    }

    expect(detailEl.classList.contains('visible')).toBe(true);
    expect(detailEl.textContent).toContain('Mayahuel Mexican & Vegan');
    expect(detailEl.textContent).toContain('Reserve Table Online');

    // 3. Star the POI as favorite
    const favToggleBtn = detailEl.querySelector('#btn-fav-toggle') as HTMLButtonElement;
    expect(favToggleBtn).not.toBeNull();
    favToggleBtn.click();

    expect(favoritesStore.isFavorite('venue_restaurant_vegan')).toBe(true);

    // 4. Switch to Saved tab
    sidebar.setActiveTab('favorites');
    expect(sidebar.getActiveTab()).toBe('favorites');
    const savedCards = sidebarEl.querySelectorAll('.poi-card');
    expect(savedCards.length).toBe(1);
    expect(savedCards[0].getAttribute('data-id')).toBe('venue_restaurant_vegan');

    // 5. Generate export payload for saved POIs
    const exportJson = generateSavedPoisJson(favoritesStore.getFavorites(), testFeatures);
    const parsedExport = JSON.parse(exportJson);
    expect(parsedExport.defaultSavedPois).toEqual(['venue_restaurant_vegan']);
    expect(parsedExport.venues?.[0].name).toBe('Mayahuel Mexican & Vegan');

    // 6. Switch back to Explore tab and disable Nearest Only
    sidebar.setActiveTab('explore');
    filterStore.setNearestOnly(false, testFeatures, favoritesStore.getFavorites());
    sidebar.render();

    const allCardsAfter = sidebarEl.querySelectorAll('.poi-card');
    expect(allCardsAfter.length).toBe(4); // All 4 venues visible now

    // 7. Test URL serialization reflects state updates
    const updatedQs = buildQueryString({
      filterState: filterStore.getState(),
      selectedPoiId: 'venue_restaurant_vegan',
      activeTab: 'explore',
      basemapStyle: 'bright',
    });

    expect(updatedQs).toContain('poi=venue_restaurant_vegan');
    expect(updatedQs).toContain('basemap=bright');
    expect(updatedQs).not.toContain('nearest=true'); // Nearest was disabled
  });
});
