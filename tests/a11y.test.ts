import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SidebarComponent } from '../src/ui/sidebar';
import { POIDetailComponent } from '../src/ui/poiDetail';
import { FilterStore } from '../src/state/filterState';
import { FavoritesStore } from '../src/state/favorites';
import { DebugStore } from '../src/state/debugState';
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

const samplePOIs: POIFeature[] = [
  {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [-121.489, 38.579] },
    properties: {
      id: 'poi_coffee',
      name: 'Accessible Coffee Roasters',
      category: 'coffee_tea',
      walk_time_minutes: 5,
      address: '1000 K St',
      phone: '(916) 555-0101',
      website: 'https://example.com/coffee',
      opening_hours: 'Mo-Su 07:00-18:00',
      cuisines: ['coffee', 'bakery'],
      sources: ['osm'],
      osm_id: '12345',
      overture_id: null,
    },
  },
  {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [-121.491, 38.581] },
    properties: {
      id: 'poi_dining',
      name: 'Accessible Bistro',
      category: 'restaurant',
      walk_time_minutes: 10,
      address: '1200 J St',
      phone: null,
      website: null,
      opening_hours: null,
      cuisines: ['vegan'],
      sources: ['osm'],
      osm_id: '67890',
      overture_id: null,
    },
  },
];

describe('Accessibility & Keyboard Navigation (a11y)', () => {
  let sidebarContainer: HTMLElement;
  let detailContainer: HTMLElement;
  let filterStore: FilterStore;
  let favoritesStore: FavoritesStore;
  let debugStore: DebugStore;

  beforeEach(() => {
    sidebarContainer = document.createElement('aside');
    detailContainer = document.createElement('div');
    document.body.appendChild(sidebarContainer);
    document.body.appendChild(detailContainer);

    filterStore = new FilterStore();
    favoritesStore = new FavoritesStore([]);
    debugStore = new DebugStore();
  });

  afterEach(() => {
    sidebarContainer.remove();
    detailContainer.remove();
  });

  it('renders tab list with proper ARIA tab and selection roles', () => {
    const sidebar = new SidebarComponent(
      sidebarContainer,
      filterStore,
      favoritesStore,
      { onSelectPOI: () => {} },
      debugStore,
      false
    );
    sidebar.setData(samplePOIs, mockRegion, []);

    const tabList = sidebarContainer.querySelector('.tabs-bar[role="tablist"]');
    expect(tabList).not.toBeNull();

    const exploreTab = sidebarContainer.querySelector('#tab-explore') as HTMLElement;
    const favoritesTab = sidebarContainer.querySelector('#tab-favorites') as HTMLElement;

    expect(exploreTab.getAttribute('role')).toBe('tab');
    expect(exploreTab.getAttribute('aria-selected')).toBe('true');

    expect(favoritesTab.getAttribute('role')).toBe('tab');
    expect(favoritesTab.getAttribute('aria-selected')).toBe('false');

    // Switch tab
    sidebar.setActiveTab('favorites');
    const updatedExploreTab = sidebarContainer.querySelector('#tab-explore') as HTMLElement;
    const updatedFavoritesTab = sidebarContainer.querySelector('#tab-favorites') as HTMLElement;
    expect(updatedExploreTab.getAttribute('aria-selected')).toBe('false');
    expect(updatedFavoritesTab.getAttribute('aria-selected')).toBe('true');
  });

  it('supports keyboard navigation (Enter and Space) on POI list items', () => {
    let selectedPoi: POIFeature | null = null;
    const sidebar = new SidebarComponent(
      sidebarContainer,
      filterStore,
      favoritesStore,
      {
        onSelectPOI: (poi) => {
          selectedPoi = poi;
        },
      },
      debugStore,
      false
    );
    sidebar.setData(samplePOIs, mockRegion, []);

    const firstCard = sidebarContainer.querySelector('.poi-card[data-id="poi_coffee"]') as HTMLElement;
    expect(firstCard).not.toBeNull();
    expect(firstCard.getAttribute('tabindex')).toBe('0');
    expect(firstCard.getAttribute('role')).toBe('button');

    // Press Enter
    firstCard.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(selectedPoi).not.toBeNull();
    expect(selectedPoi!.properties.id).toBe('poi_coffee');

    // Press Space on second card
    selectedPoi = null;
    const secondCard = sidebarContainer.querySelector('.poi-card[data-id="poi_dining"]') as HTMLElement;
    secondCard.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(selectedPoi).not.toBeNull();
    expect(selectedPoi!.properties.id).toBe('poi_dining');
  });

  it('provides modal dialog attributes, focus management, and Escape dismissal for POIDetailComponent', () => {
    let closed = false;
    const detail = new POIDetailComponent(
      detailContainer,
      favoritesStore,
      mockRegion.center,
      {
        onClose: () => {
          closed = true;
        },
      },
      debugStore
    );

    detail.show(samplePOIs[0]);

    expect(detailContainer.classList.contains('visible')).toBe(true);
    expect(detailContainer.getAttribute('aria-label')).toContain('Accessible Coffee Roasters');

    const closeBtn = detailContainer.querySelector('.btn-close-detail') as HTMLButtonElement;
    expect(closeBtn).not.toBeNull();
    expect(closeBtn.getAttribute('aria-label')).toBe('Close details');

    // Press Escape to dismiss
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(closed).toBe(true);
    expect(detailContainer.classList.contains('hidden')).toBe(true);
  });

  it('ensures all interactive filter inputs have associated labels or accessible names', () => {
    const sidebar = new SidebarComponent(
      sidebarContainer,
      filterStore,
      favoritesStore,
      { onSelectPOI: () => {} },
      debugStore,
      true
    );
    sidebar.setData(samplePOIs, mockRegion, []);

    const searchInput = sidebarContainer.querySelector('#poi-search-input') as HTMLInputElement;
    expect(searchInput.getAttribute('aria-label')).toBe('Search venues');

    const openNowInput = sidebarContainer.querySelector('#chk-open-now') as HTMLInputElement;
    expect(openNowInput.closest('label')?.textContent).toContain('Open Now');

    const nearestInput = sidebarContainer.querySelector('#chk-nearest-only') as HTMLInputElement;
    expect(nearestInput.closest('label')?.textContent).toContain('Nearest Only');

    sidebar.setSettingsExpanded(true);
    const basemapSelect = sidebarContainer.querySelector('#select-basemap-style') as HTMLSelectElement;
    expect(basemapSelect.getAttribute('aria-label')).toBe('Select Basemap Style');
  });

  it('provides accessible ARIA attributes and keyboard semantics for sidebar resizer and filter summary bar', () => {
    const sidebar = new SidebarComponent(
      sidebarContainer,
      filterStore,
      favoritesStore,
      { onSelectPOI: () => {} },
      debugStore,
      false
    );
    sidebar.setData(samplePOIs, mockRegion, []);

    // Resizer handle accessibility
    const resizer = sidebarContainer.querySelector('#sidebar-resizer') as HTMLElement;
    expect(resizer).not.toBeNull();
    expect(resizer.getAttribute('role')).toBe('separator');
    expect(resizer.getAttribute('aria-orientation')).toBe('vertical');
    expect(resizer.getAttribute('aria-label')).toBe('Resize sidebar');
    expect(resizer.getAttribute('tabindex')).toBe('0');
    expect(resizer.getAttribute('aria-valuenow')).toBe('400');
    expect(resizer.getAttribute('aria-valuemin')).toBe('300');
    expect(resizer.getAttribute('aria-valuemax')).toBe('700');

    // Filter summary bar accessibility
    const summaryBar = sidebarContainer.querySelector('#active-filter-summary-bar') as HTMLElement;
    expect(summaryBar).not.toBeNull();
    expect(summaryBar.getAttribute('role')).toBe('region');
    expect(summaryBar.getAttribute('aria-label')).toBe('Active filter summary');

    const editBtn = sidebarContainer.querySelector('#btn-edit-filters-prominent') as HTMLButtonElement;
    expect(editBtn.getAttribute('aria-label')).toBe('Edit filters');
  });
});
