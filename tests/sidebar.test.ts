import { describe, it, expect, beforeEach } from 'vitest';
import { SidebarComponent } from '../src/ui/sidebar';
import { FilterStore } from '../src/state/filterState';
import { FavoritesStore } from '../src/state/favorites';
import { DebugStore } from '../src/state/debugState';
import { POIFeature, RegionMetadata } from '../src/types/poi';

describe('SidebarComponent', () => {
  let container: HTMLElement;
  let filterStore: FilterStore;
  let favoritesStore: FavoritesStore;
  let debugStore: DebugStore;

  const mockRegion: RegionMetadata = {
    name: 'Sacramento Convention Center',
    center: [-121.489857, 38.579250],
    isochrones: [
      { minutes: 5, color: '#2b83ba', fillColor: '#2b83ba', label: '5 min' },
      { minutes: 10, color: '#64abb0', fillColor: '#64abb0', label: '10 min' },
      { minutes: 15, color: '#9dd3a7', fillColor: '#9dd3a7', label: '15 min' },
    ],
    geojson: { type: 'FeatureCollection', features: [] },
  };

  // Three sample POIs at varying distances from the conference center:
  // Center: [-121.489857, 38.579250]
  // 1. Close (~150m): [-121.491000, 38.579500]
  // 2. Medium (~600m): [-121.495000, 38.582000]
  // 3. Far (~1200m): [-121.503000, 38.583000]
  const mockFeatures: POIFeature[] = [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-121.503000, 38.583000] },
      properties: {
        id: 'far_venue',
        name: 'Far Away Cafe',
        category: 'coffee_tea',
        walk_time_minutes: 15,
        address: 'Far St',
        phone: null,
        website: null,
        opening_hours: null,
        cuisines: [],
        sources: ['osm'],
        osm_id: 'osm_far',
        overture_id: 'gers_far',
      },
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-121.491000, 38.579500] },
      properties: {
        id: 'close_venue',
        name: 'Close By Diner',
        category: 'restaurant',
        walk_time_minutes: 5,
        address: 'Close St',
        phone: null,
        website: null,
        opening_hours: null,
        cuisines: ['diner'],
        sources: ['overture'],
        osm_id: null,
        overture_id: 'gers_close',
      },
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-121.495000, 38.582000] },
      properties: {
        id: 'mid_venue',
        name: 'Mid Distance Bar',
        category: 'bar',
        walk_time_minutes: 10,
        address: 'Mid St',
        phone: null,
        website: null,
        opening_hours: null,
        cuisines: [],
        sources: ['osm', 'overture'],
        osm_id: 'osm_mid',
        overture_id: 'gers_mid',
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

  it('displays filter panel in full length by default and hides results until collapsed', () => {
    const sidebar = new SidebarComponent(
      container,
      filterStore,
      favoritesStore,
      { onSelectPOI: () => {} },
      debugStore,
      true // initialFiltersOpen
    );

    sidebar.setData(mockFeatures, mockRegion, []);

    expect(sidebar.isFiltersExpanded()).toBe(true);
    const filterPanel = container.querySelector('.filters-collapsible');
    expect(filterPanel?.classList.contains('open')).toBe(true);

    // Results container should be hidden while filter panel is open
    const poiListContainer = container.querySelector('.poi-list-container') as HTMLElement;
    expect(poiListContainer?.style.display).toBe('none');

    // Prominent collapse action button is present in the filters footer
    const collapseBtn = container.querySelector('#btn-collapse-filters') as HTMLButtonElement;
    expect(collapseBtn).toBeDefined();
    expect(collapseBtn.textContent).toContain('View 3 Results');

    // Clicking the collapse button collapses filters and reveals the results
    collapseBtn.click();
    expect(sidebar.isFiltersExpanded()).toBe(false);
    const updatedFilterPanel = container.querySelector('.filters-collapsible');
    expect(updatedFilterPanel?.classList.contains('closed')).toBe(true);
    const updatedPoiListContainer = container.querySelector('.poi-list-container') as HTMLElement;
    expect(updatedPoiListContainer?.style.display).not.toBe('none');
  });

  it('sorts POIs with closer items appearing first in the listing', () => {
    const sidebar = new SidebarComponent(
      container,
      filterStore,
      favoritesStore,
      { onSelectPOI: () => {} },
      debugStore,
      false // collapsed so results are rendered
    );

    sidebar.setData(mockFeatures, mockRegion, []);

    const cards = container.querySelectorAll('.poi-card');
    expect(cards.length).toBe(3);

    // Order should be: Close By Diner, Mid Distance Bar, Far Away Cafe
    expect(cards[0].getAttribute('data-id')).toBe('close_venue');
    expect(cards[1].getAttribute('data-id')).toBe('mid_venue');
    expect(cards[2].getAttribute('data-id')).toBe('far_venue');

    // Check distance badge content
    expect(cards[0].textContent).toContain('5 min');
  });

  it('displays OSM and GERS IDs on cards when debug mode is enabled', () => {
    const sidebar = new SidebarComponent(
      container,
      filterStore,
      favoritesStore,
      { onSelectPOI: () => {} },
      debugStore,
      false
    );

    sidebar.setData(mockFeatures, mockRegion, []);

    // Initially with debug mode off: no ID pills
    expect(container.querySelectorAll('.poi-card-debug-ids').length).toBe(0);

    // Enable debug mode
    debugStore.setDebugMode(true);
    sidebar.render();

    expect(container.querySelectorAll('.poi-card-debug-ids').length).toBe(3);
    const midCard = container.querySelector('.poi-card[data-id="mid_venue"]');
    expect(midCard?.textContent).toContain('OSM: osm_mid');
    expect(midCard?.textContent).toContain('GERS: gers_mid');
  });

  it('updates card selection highlighting via setSelectedPOI', () => {
    const sidebar = new SidebarComponent(
      container,
      filterStore,
      favoritesStore,
      { onSelectPOI: () => {} },
      debugStore,
      false
    );

    sidebar.setData(mockFeatures, mockRegion, []);

    sidebar.setSelectedPOI('mid_venue', false);
    const midCard = container.querySelector('.poi-card[data-id="mid_venue"]');
    expect(midCard?.classList.contains('selected')).toBe(true);

    sidebar.setSelectedPOI('close_venue', false);
    expect(midCard?.classList.contains('selected')).toBe(false);
    const closeCard = container.querySelector('.poi-card[data-id="close_venue"]');
    expect(closeCard?.classList.contains('selected')).toBe(true);

    sidebar.setSelectedPOI(null);
    expect(container.querySelectorAll('.poi-card.selected').length).toBe(0);
  });

  it('renders reservation and online ordering badges on cards when URLs are present', () => {
    const featuresWithLinks: POIFeature[] = [
      {
        ...mockFeatures[1],
        properties: {
          ...mockFeatures[1].properties,
          reservation_url: 'https://opentable.com/venue',
          order_url: 'https://toasttab.com/venue',
        },
      },
    ];

    const sidebar = new SidebarComponent(
      container,
      filterStore,
      favoritesStore,
      { onSelectPOI: () => {} },
      debugStore,
      false
    );

    sidebar.setData(featuresWithLinks, mockRegion, []);

    const card = container.querySelector('.poi-card[data-id="close_venue"]');
    expect(card).not.toBeNull();
    const badges = card!.querySelectorAll('.service-badge-sm');
    expect(badges.length).toBe(2);
    expect(badges[0].textContent).toContain('📅');
    expect(badges[0].textContent).toContain('Reserve');
    expect(badges[1].textContent).toContain('🛍️');
    expect(badges[1].textContent).toContain('Order');
  });

  it('opens and closes the settings panel, coordinating with filters and results', () => {
    const sidebar = new SidebarComponent(
      container,
      filterStore,
      favoritesStore,
      { onSelectPOI: () => {} },
      debugStore,
      false // start collapsed (viewing results)
    );

    sidebar.setData(mockFeatures, mockRegion, []);

    const settingsBtn = container.querySelector('#btn-toggle-settings') as HTMLButtonElement;
    expect(settingsBtn).not.toBeNull();
    const settingsPanel = container.querySelector('#settings-panel') as HTMLElement;
    expect(settingsPanel).not.toBeNull();
    expect(sidebar.isSettingsExpanded()).toBe(false);
    expect(settingsPanel.classList.contains('closed')).toBe(true);

    // Click settings button to open settings panel
    settingsBtn.click();
    expect(sidebar.isSettingsExpanded()).toBe(true);
    expect(sidebar.isFiltersExpanded()).toBe(false);

    const openSettingsPanel = container.querySelector('#settings-panel') as HTMLElement;
    expect(openSettingsPanel.classList.contains('open')).toBe(true);
    expect(openSettingsPanel.style.display).not.toBe('none');

    // Results container is hidden while settings is open
    const poiListContainer = container.querySelector('.poi-list-container') as HTMLElement;
    expect(poiListContainer.style.display).toBe('none');

    // Click Done button in settings panel to close it
    const doneBtn = container.querySelector('#btn-collapse-settings') as HTMLButtonElement;
    expect(doneBtn).not.toBeNull();
    doneBtn.click();
    expect(sidebar.isSettingsExpanded()).toBe(false);

    const closedSettingsPanel = container.querySelector('#settings-panel') as HTMLElement;
    expect(closedSettingsPanel.classList.contains('closed')).toBe(true);
    const restoredPoiList = container.querySelector('.poi-list-container') as HTMLElement;
    expect(restoredPoiList.style.display).not.toBe('none');

    // Opening filters while settings is open closes settings
    settingsBtn.click();
    expect(sidebar.isSettingsExpanded()).toBe(true);
    const filtersBtn = container.querySelector('#btn-toggle-filters') as HTMLButtonElement;
    filtersBtn.click();
    expect(sidebar.isFiltersExpanded()).toBe(true);
    expect(sidebar.isSettingsExpanded()).toBe(false);
  });

  it('toggles excluding Overture-only data via the settings panel', () => {
    const sidebar = new SidebarComponent(
      container,
      filterStore,
      favoritesStore,
      { onSelectPOI: () => {} },
      debugStore,
      false
    );

    sidebar.setData(mockFeatures, mockRegion, []);

    // Initially all 3 POIs visible
    expect(container.querySelectorAll('.poi-card').length).toBe(3);

    // Open settings panel
    const settingsBtn = container.querySelector('#btn-toggle-settings') as HTMLButtonElement;
    settingsBtn.click();

    const overtureChk = container.querySelector('#chk-disable-overture') as HTMLInputElement;
    expect(overtureChk).not.toBeNull();
    expect(overtureChk.checked).toBe(false);

    // Check the toggle to disable Overture-only data
    overtureChk.checked = true;
    overtureChk.dispatchEvent(new Event('change'));

    expect(filterStore.isExcludeOvertureOnly()).toBe(true);

    // Close settings to inspect cards
    const doneBtn = container.querySelector('#btn-collapse-settings') as HTMLButtonElement;
    doneBtn.click();

    // Now only 2 POIs visible: 'close_venue' (Overture only) is excluded,
    // while 'far_venue' (OSM) and 'mid_venue' (OSM + Overture) remain.
    const cards = container.querySelectorAll('.poi-card');
    expect(cards.length).toBe(2);
    const cardIds = Array.from(cards).map((c) => c.getAttribute('data-id'));
    expect(cardIds).not.toContain('close_venue');
    expect(cardIds).toContain('far_venue');
    expect(cardIds).toContain('mid_venue');
  });

  it('toggles OSM and GERS IDs via the debug checkbox inside the settings panel', () => {
    const sidebar = new SidebarComponent(
      container,
      filterStore,
      favoritesStore,
      { onSelectPOI: () => {} },
      debugStore,
      false
    );

    sidebar.setData(mockFeatures, mockRegion, []);

    // Initially debug mode is off
    expect(debugStore.isDebugMode()).toBe(false);
    expect(container.querySelectorAll('.poi-card-debug-ids').length).toBe(0);

    // Open settings
    const settingsBtn = container.querySelector('#btn-toggle-settings') as HTMLButtonElement;
    settingsBtn.click();

    const debugChk = container.querySelector('#chk-debug-mode') as HTMLInputElement;
    expect(debugChk).not.toBeNull();
    expect(debugChk.checked).toBe(false);

    // Enable debug mode in settings
    debugChk.checked = true;
    debugChk.dispatchEvent(new Event('change'));

    expect(debugStore.isDebugMode()).toBe(true);

    // Close settings
    const doneBtn = container.querySelector('#btn-collapse-settings') as HTMLButtonElement;
    doneBtn.click();

    expect(container.querySelectorAll('.poi-card-debug-ids').length).toBe(3);
  });
});
