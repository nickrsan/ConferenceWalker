import { describe, it, expect, beforeEach } from 'vitest';
import { SidebarComponent } from '../src/ui/sidebar';
import { FilterStore } from '../src/state/filterState';
import { FavoritesStore } from '../src/state/favorites';
import { DebugStore } from '../src/state/debugState';
import { POIFeature, RegionMetadata } from '../src/types/poi';

describe('Settings Panel Component and Preferences', () => {
  let container: HTMLElement;
  let filterStore: FilterStore;
  let favoritesStore: FavoritesStore;
  let debugStore: DebugStore;

  const mockRegion: RegionMetadata = {
    name: '1230 J Street, Sacramento, CA, USA',
    center: [-121.489857, 38.57925],
    isochrones: [
      { minutes: 5, color: '#2b83ba', fillColor: '#2b83ba', label: '5 min' },
      { minutes: 10, color: '#abdda4', fillColor: '#abdda4', label: '10 min' },
      { minutes: 15, color: '#9dd3a7', fillColor: '#9dd3a7', label: '15 min' },
    ],
    geojson: { type: 'FeatureCollection', features: [] },
  };

  const samplePOIs: POIFeature[] = [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-121.49, 38.58] },
      properties: {
        id: 'osm_only_poi',
        name: 'OSM Bakery',
        category: 'restaurant',
        walk_time_minutes: 5,
        address: '1000 K St',
        phone: '916-555-1111',
        website: 'https://osmbakery.com',
        opening_hours: 'Mo-Fr 07:00-18:00',
        cuisines: ['bakery'],
        sources: ['osm'],
        osm_id: '123456',
        overture_id: null,
      },
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-121.491, 38.581] },
      properties: {
        id: 'overture_only_poi',
        name: 'Noisy Overture Venue',
        category: 'restaurant',
        walk_time_minutes: 10,
        address: '1100 K St',
        phone: null,
        website: null,
        opening_hours: null,
        cuisines: [],
        sources: ['overture'],
        osm_id: null,
        overture_id: 'gers_08f2e9',
      },
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-121.492, 38.582] },
      properties: {
        id: 'merged_poi',
        name: 'Merged Coffee Bar',
        category: 'coffee_tea',
        walk_time_minutes: 5,
        address: '1200 K St',
        phone: '916-555-2222',
        website: 'https://mergedcoffee.com',
        opening_hours: 'Mo-Su 06:00-20:00',
        cuisines: ['coffee'],
        sources: ['osm', 'overture'],
        osm_id: '789012',
        overture_id: 'gers_08f2fa',
      },
    },
  ];

  beforeEach(() => {
    container = document.createElement('div');
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear();
    }
    filterStore = new FilterStore();
    favoritesStore = new FavoritesStore();
    debugStore = new DebugStore();
    debugStore.setDebugMode(false);
  });

  it('renders settings panel with data source and inspection toggles', () => {
    const sidebar = new SidebarComponent(
      container,
      filterStore,
      favoritesStore,
      { onSelectPOI: () => {} },
      debugStore,
      false
    );
    sidebar.setData(samplePOIs, mockRegion, []);

    // Open settings panel
    sidebar.setSettingsExpanded(true);
    expect(sidebar.isSettingsExpanded()).toBe(true);

    const settingsPanel = container.querySelector('#settings-panel') as HTMLElement;
    expect(settingsPanel).not.toBeNull();
    expect(settingsPanel.classList.contains('open')).toBe(true);

    // Verify sections and options exist
    const titles = Array.from(container.querySelectorAll('.settings-section-title')).map(
      (el) => el.textContent
    );
    expect(titles).toContain('Data Sources');
    expect(titles).toContain('Developer & Inspection');

    const overtureCheckbox = container.querySelector('#chk-disable-overture') as HTMLInputElement;
    expect(overtureCheckbox).not.toBeNull();
    expect(overtureCheckbox.checked).toBe(false);

    const debugCheckbox = container.querySelector('#chk-debug-mode') as HTMLInputElement;
    expect(debugCheckbox).not.toBeNull();
    expect(debugCheckbox.checked).toBe(false);
  });

  it('filters out Overture-only data when toggle is switched in Settings panel', () => {
    const sidebar = new SidebarComponent(
      container,
      filterStore,
      favoritesStore,
      { onSelectPOI: () => {} },
      debugStore,
      false
    );
    sidebar.setData(samplePOIs, mockRegion, []);

    // Initially all 3 POIs visible
    expect(container.querySelectorAll('.poi-card').length).toBe(3);

    // Open settings and enable Overture exclusion
    sidebar.setSettingsExpanded(true);
    const overtureCheckbox = container.querySelector('#chk-disable-overture') as HTMLInputElement;
    overtureCheckbox.checked = true;
    overtureCheckbox.dispatchEvent(new Event('change'));

    // Check localStorage persistence
    expect(window.localStorage.getItem('conference_walker_exclude_overture')).toBe('true');
    expect(filterStore.isExcludeOvertureOnly()).toBe(true);

    // Close settings to view results
    sidebar.setSettingsExpanded(false);

    const remainingCards = container.querySelectorAll('.poi-card');
    expect(remainingCards.length).toBe(2);
    const ids = Array.from(remainingCards).map((c) => c.getAttribute('data-id'));
    expect(ids).toContain('osm_only_poi');
    expect(ids).toContain('merged_poi');
    expect(ids).not.toContain('overture_only_poi');
  });

  it('persists debug mode and toggles OSM & GERS ID pills on POI cards', () => {
    const sidebar = new SidebarComponent(
      container,
      filterStore,
      favoritesStore,
      { onSelectPOI: () => {} },
      debugStore,
      false
    );
    sidebar.setData(samplePOIs, mockRegion, []);

    expect(container.querySelectorAll('.poi-card-debug-ids').length).toBe(0);

    // Open settings and enable debug mode
    sidebar.setSettingsExpanded(true);
    const debugCheckbox = container.querySelector('#chk-debug-mode') as HTMLInputElement;
    debugCheckbox.checked = true;
    debugCheckbox.dispatchEvent(new Event('change'));

    expect(debugStore.isDebugMode()).toBe(true);
    expect(window.localStorage.getItem('conference_walker_debug')).toBe('true');

    // Close settings and inspect cards
    sidebar.setSettingsExpanded(false);
    const debugRows = container.querySelectorAll('.poi-card-debug-ids');
    expect(debugRows.length).toBe(3);

    const osmCard = container.querySelector('.poi-card[data-id="osm_only_poi"]');
    expect(osmCard?.textContent).toContain('OSM: 123456');

    const mergedCard = container.querySelector('.poi-card[data-id="merged_poi"]');
    expect(mergedCard?.textContent).toContain('OSM: 789012');
    expect(mergedCard?.textContent).toContain('GERS: gers_08f2fa');
  });

  it('closes settings panel when clicking close button or done button', () => {
    const sidebar = new SidebarComponent(
      container,
      filterStore,
      favoritesStore,
      { onSelectPOI: () => {} },
      debugStore,
      false
    );
    sidebar.setData(samplePOIs, mockRegion, []);

    sidebar.setSettingsExpanded(true);
    expect(sidebar.isSettingsExpanded()).toBe(true);

    const closeBtn = container.querySelector('#btn-close-settings') as HTMLButtonElement;
    expect(closeBtn).not.toBeNull();
    closeBtn.click();
    expect(sidebar.isSettingsExpanded()).toBe(false);

    sidebar.setSettingsExpanded(true);
    const doneBtn = container.querySelector('#btn-collapse-settings') as HTMLButtonElement;
    expect(doneBtn).not.toBeNull();
    doneBtn.click();
    expect(sidebar.isSettingsExpanded()).toBe(false);
  });
});
