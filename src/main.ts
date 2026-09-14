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

async function bootstrap(): Promise<void> {
  const mapElement = document.getElementById('map-container');
  const sidebarElement = document.getElementById('sidebar-container');
  const detailElement = document.getElementById('poi-detail-container');

  if (!mapElement || !sidebarElement || !detailElement) {
    console.error('ConferenceWalker: Missing required DOM containers.');
    return;
  }

  // 1. Initialize State Stores with configurable defaults
  const favoritesStore = new FavoritesStore();
  const debugStore = new DebugStore();
  const filterStore = new FilterStore(undefined, APP_CONFIG.defaultCategories);

  try {
    // 2. Fetch Region and POI Datasets
    const [regionData, poiCollection] = await Promise.all([
      loadRegionData('./data/region.json'),
      loadPOIData('./data/sacramento_pois.geojson'),
    ]);

    const availableCuisines = extractAvailableCuisines(poiCollection.features);

    // 3. Initialize Map Manager
    const mapManager = new MapManager(mapElement, regionData);

    // 4. Initialize POI Detail View
    const poiDetail = new POIDetailComponent(
      detailElement,
      favoritesStore,
      regionData.center,
      {
        onClose: () => {
          mapManager.setSelectedPOI(null);
          sidebar.setSelectedPOI(null);
        },
        onFavoriteChange: () => {
          sidebar.render();
          mapManager.updateFavorites(favoritesStore.getFavorites());
        },
      },
      debugStore
    );

    // 5. Initialize Sidebar & Mobile Drawer
    const sidebar = new SidebarComponent(
      sidebarElement,
      filterStore,
      favoritesStore,
      {
        onSelectPOI: (poi: POIFeature) => {
          poiDetail.show(poi);
          mapManager.setSelectedPOI(poi.properties.id);
          mapManager.flyTo(poi.geometry.coordinates, 16);
          sidebar.setSelectedPOI(poi.properties.id);

          // On mobile, collapse drawer slightly so map & card are visible
          if (window.innerWidth <= 768) {
            sidebarElement.classList.remove('mobile-expanded');
          }
        },
      },
      debugStore,
      APP_CONFIG.filtersExpandedByDefault
    );

    // 6. Connect Map Interaction Events
    mapManager.setEvents({
      onPOIClick: (poiId, feature) => {
        // Resolve canonical POI from original loaded collection to guarantee rich attributes
        const canonicalPOI = poiCollection.features.find((f) => f.properties.id === poiId) || feature;
        poiDetail.show(canonicalPOI);
        mapManager.setSelectedPOI(poiId);
        mapManager.flyTo(canonicalPOI.geometry.coordinates, 16);
        sidebar.setSelectedPOI(poiId);
      },
    });

    // Supply initial dataset to components
    sidebar.setData(poiCollection.features, regionData, availableCuisines);
    mapManager.renderPOIs(poiCollection);
    mapManager.updateFavorites(favoritesStore.getFavorites());

    // Apply initial category filtering to the map engine
    const initialFilterExpr = filterStore.buildMapLibreFilter(
      poiCollection.features,
      favoritesStore.getFavorites()
    );
    mapManager.applyFilter(initialFilterExpr);

    // 7. Connect Reactive Filter Subscriptions
    filterStore.subscribe((_state, _matchingIds) => {
      sidebar.render();
      const filterExpr = filterStore.buildMapLibreFilter(
        poiCollection.features,
        favoritesStore.getFavorites()
      );
      mapManager.applyFilter(filterExpr);
    });

    // 8. Connect Favorites Subscriptions
    favoritesStore.subscribe((favs) => {
      sidebar.render();
      mapManager.updateFavorites(favs);
    });

    // 9. Connect Debug Store Subscriptions
    debugStore.subscribe(() => {
      sidebar.render();
    });

    // 10. Handle Window Resizing
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
