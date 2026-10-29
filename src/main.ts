/**
 * Main application entry point for ConferenceWalker.
 * Bootstraps data loading, MapLibre map engine, filter store, favorites store,
 * and responsive UI components.
 */

import 'maplibre-gl/dist/maplibre-gl.css';
import './style.css';

import { loadRegionData, loadPOIData, extractAvailableCuisines } from './services/dataLoader';
import { MapManager } from './map/mapManager';
import { FilterStore } from './state/filterState';
import { FavoritesStore } from './state/favorites';
import { DebugStore } from './state/debugState';
import { SidebarComponent } from './ui/sidebar';
import { POIDetailComponent } from './ui/poiDetail';
import { POIFeature } from './types/poi';
import { APP_CONFIG } from './config';
import { parseUrlState, syncStateToUrl } from './utils/urlState';

async function bootstrap(): Promise<void> {
  const mapElement = document.getElementById('map-container');
  const sidebarElement = document.getElementById('sidebar-container');
  const detailElement = document.getElementById('poi-detail-container');

  if (!mapElement || !sidebarElement || !detailElement) {
    console.error('ConferenceWalker: Missing required DOM containers.');
    return;
  }

  // 1. Parse initial state from URL parameters
  const urlState = parseUrlState();

  // 2. Initialize State Stores with URL overrides and configurable defaults
  const favoritesStore = new FavoritesStore();
  const debugStore = new DebugStore();
  const filterStore = new FilterStore(
    {
      categories: urlState.categories || undefined,
      allowedWalkTimes: urlState.allowedWalkTimes || undefined,
      selectedCuisines: urlState.selectedCuisines || undefined,
      searchQuery: urlState.searchQuery || undefined,
      openNowOnly: urlState.openNowOnly !== null ? urlState.openNowOnly : undefined,
      includeUnknownHours: urlState.includeUnknownHours !== null ? urlState.includeUnknownHours : undefined,
      nearestOnly: urlState.nearestOnly !== null ? urlState.nearestOnly : undefined,
      excludeOvertureOnly: urlState.excludeOvertureOnly !== null ? urlState.excludeOvertureOnly : undefined,
    },
    APP_CONFIG.defaultCategories
  );

  try {
    // 3. Fetch Region and POI Datasets
    const [regionData, poiCollection] = await Promise.all([
      loadRegionData('./data/region.json'),
      loadPOIData('./data/sacramento_pois.geojson'),
    ]);

    filterStore.setCenterCoords(regionData.center);
    const availableCuisines = extractAvailableCuisines(poiCollection.features);

    // 4. Initialize Map Manager
    const mapManager = new MapManager(mapElement, regionData);

    // Determine initial isochrones visibility (URL param > localStorage > APP_CONFIG default)
    let initialIsochrones = APP_CONFIG.showIsochronesByDefault !== false;
    const storedIso = typeof localStorage !== 'undefined' ? localStorage.getItem('cw_show_isochrones') : null;
    if (storedIso !== null) {
      initialIsochrones = storedIso === 'true';
    }
    if (urlState.showIsochrones !== null) {
      initialIsochrones = urlState.showIsochrones;
    }
    mapManager.setIsochronesVisible(initialIsochrones);

    let selectedPoiIdState: string | null = urlState.poiId;

    const updateUrl = () => {
      syncStateToUrl({
        filterState: filterStore.getState(),
        selectedPoiId: selectedPoiIdState,
        activeTab: sidebar.getActiveTab(),
        basemapStyle: mapManager.getBasemapStyle(),
        showIsochrones: mapManager.getIsochronesVisible(),
      });
    };

    // 5. Initialize POI Detail View
    const poiDetail = new POIDetailComponent(
      detailElement,
      favoritesStore,
      regionData.center,
      {
        onClose: () => {
          selectedPoiIdState = null;
          mapManager.setSelectedPOI(null);
          sidebar.setSelectedPOI(null);
          updateUrl();
        },
        onFavoriteChange: () => {
          sidebar.render();
          mapManager.updateFavorites(favoritesStore.getFavorites());
          updateUrl();
        },
      },
      debugStore
    );

    // 6. Initialize Sidebar & Mobile Drawer
    const sidebar = new SidebarComponent(
      sidebarElement,
      filterStore,
      favoritesStore,
      {
        onSelectPOI: (poi: POIFeature) => {
          selectedPoiIdState = poi.properties.id;
          poiDetail.show(poi);
          mapManager.setSelectedPOI(poi.properties.id);
          mapManager.flyTo(poi.geometry.coordinates, 16);
          sidebar.setSelectedPOI(poi.properties.id);
          updateUrl();

          // On mobile, collapse drawer slightly so map & card are visible
          if (window.innerWidth <= 768) {
            sidebarElement.classList.remove('mobile-expanded');
          }
        },
        onBasemapChange: (style) => {
          mapManager.setBasemapStyle(style);
          updateUrl();
        },
        onIsochronesToggle: (visible) => {
          mapManager.setIsochronesVisible(visible);
          updateUrl();
        },
        onResize: () => {
          mapManager.resize();
        },
      },
      debugStore,
      APP_CONFIG.filtersExpandedByDefault
    );

    // 7. Connect Map Interaction Events
    mapManager.setEvents({
      onPOIClick: (poiId, feature) => {
        // Resolve canonical POI from original loaded collection to guarantee rich attributes
        const canonicalPOI = poiCollection.features.find((f) => f.properties.id === poiId) || feature;
        selectedPoiIdState = poiId;
        poiDetail.show(canonicalPOI);
        mapManager.setSelectedPOI(poiId);
        mapManager.flyTo(canonicalPOI.geometry.coordinates, 16);
        sidebar.setSelectedPOI(poiId);
        updateUrl();
      },
    });

    // Supply initial dataset to components
    sidebar.setData(poiCollection.features, regionData, availableCuisines);

    if (urlState.activeTab) {
      sidebar.setActiveTab(urlState.activeTab);
    } else if (APP_CONFIG.startWithSavedOnlyByDefault) {
      sidebar.setActiveTab('favorites');
    }

    if (urlState.basemapStyle) {
      mapManager.setBasemapStyle(urlState.basemapStyle);
      sidebar.setBasemapStyle(urlState.basemapStyle);
    }

    sidebar.setShowIsochrones(initialIsochrones);

    mapManager.renderPOIs(poiCollection);
    mapManager.updateFavorites(favoritesStore.getFavorites());

    // Apply initial category filtering to the map engine
    const initialFilterExpr = filterStore.buildMapLibreFilter(
      poiCollection.features,
      favoritesStore.getFavorites()
    );
    mapManager.applyFilter(initialFilterExpr);

    // Hydrate deep-linked POI if present in URL
    if (urlState.poiId) {
      const targetPoi = poiCollection.features.find((f) => f.properties.id === urlState.poiId);
      if (targetPoi) {
        poiDetail.show(targetPoi);
        mapManager.setSelectedPOI(targetPoi.properties.id);
        mapManager.flyTo(targetPoi.geometry.coordinates, 16);
        sidebar.setSelectedPOI(targetPoi.properties.id);
      }
    }

    // 8. Connect Reactive Filter Subscriptions
    filterStore.subscribe((_state, _matchingIds) => {
      sidebar.render();
      const filterExpr = filterStore.buildMapLibreFilter(
        poiCollection.features,
        favoritesStore.getFavorites()
      );
      mapManager.applyFilter(filterExpr);
      updateUrl();
    });

    // 9. Connect Favorites Subscriptions
    favoritesStore.subscribe((favs) => {
      sidebar.render();
      mapManager.updateFavorites(favs);
      updateUrl();
    });

    // 10. Connect Debug Store Subscriptions
    debugStore.subscribe(() => {
      sidebar.render();
    });

    // 11. Handle Window Resizing
    window.addEventListener('resize', () => {
      mapManager.resize();
    });

    console.log(
      `ConferenceWalker initialized successfully with ${poiCollection.features.length} POIs across ${regionData.isochrones.length} walksheds.`
    );
  } catch (error) {
    console.error('Failed to initialize ConferenceWalker application:', error);
    sidebarElement.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">⚠️</span>
        <h3>Failed to load conference data</h3>
        <p>Please check your connection or verify that data files are available in public/data/.</p>
      </div>
    `;
  }
}

// Bootstrap on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
