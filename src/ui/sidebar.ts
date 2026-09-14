/**
 * Responsive Sidebar and Mobile Drawer component for ConferenceWalker.
 * Houses filter controls, search, tabs (Explore vs Favorites), and POI listing.
 */

import { POIFeature, RegionMetadata, CATEGORY_META } from '../types/poi';
import { FilterStore } from '../state/filterState';
import { FavoritesStore } from '../state/favorites';
import { DebugStore } from '../state/debugState';
import { CategoryFilterComponent } from './categoryFilter';
import { WalkDistanceFilterComponent } from './walkDistanceFilter';
import { CuisineFilterComponent } from './cuisineFilter';
import { evaluateOpeningHours, getOpeningBadge } from '../utils/openingHours';
import { calculateDistanceMeters, formatDistance } from '../utils/directions';

export interface SidebarEvents {
  onSelectPOI: (poi: POIFeature) => void;
  onHoverPOI?: (poi: POIFeature | null) => void;
}

export class SidebarComponent {
  private container: HTMLElement;
  private filterStore: FilterStore;
  private favoritesStore: FavoritesStore;
  private debugStore: DebugStore;
  private allFeatures: POIFeature[] = [];
  private region: RegionMetadata | null = null;
  private events: SidebarEvents;
  private activeTab: 'explore' | 'favorites' = 'explore';
  private isFiltersOpen = true; // Displayed by default in full length with no results
  private isMobileExpanded = false;
  private selectedPoiId: string | null = null;

  private categoryFilter: CategoryFilterComponent;
  private walkDistanceFilter: WalkDistanceFilterComponent;
  private cuisineFilter: CuisineFilterComponent;

  constructor(
    container: HTMLElement,
    filterStore: FilterStore,
    favoritesStore: FavoritesStore,
    events: SidebarEvents,
    debugStore?: DebugStore,
    initialFiltersOpen = true
  ) {
    this.container = container;
    this.filterStore = filterStore;
    this.favoritesStore = favoritesStore;
    this.events = events;
    this.debugStore = debugStore || new DebugStore();
    this.isFiltersOpen = initialFiltersOpen;

    // Create sub-filter components with placeholder elements
    const catContainer = document.createElement('div');
    catContainer.className = 'filter-section-cat';
    this.categoryFilter = new CategoryFilterComponent(catContainer, this.filterStore);

    const walkContainer = document.createElement('div');
    walkContainer.className = 'filter-section-walk';
    this.walkDistanceFilter = new WalkDistanceFilterComponent(walkContainer, this.filterStore);

    const cuisineContainer = document.createElement('div');
    cuisineContainer.className = 'filter-section-cuisine';
    this.cuisineFilter = new CuisineFilterComponent(cuisineContainer, this.filterStore);

    this.render();
  }

  public setDebugStore(debugStore: DebugStore): void {
    this.debugStore = debugStore;
    this.render();
  }

  public isFiltersExpanded(): boolean {
    return this.isFiltersOpen;
  }

  public setFiltersExpanded(expanded: boolean): void {
    this.isFiltersOpen = expanded;
    this.render();
  }

  public setData(allFeatures: POIFeature[], region: RegionMetadata, availableCuisines: string[]): void {
    this.allFeatures = allFeatures;
    this.region = region;

    const favs = this.favoritesStore.getFavorites();
    this.categoryFilter.setData(allFeatures, favs);
    this.walkDistanceFilter.setData(allFeatures, favs);
    this.cuisineFilter.setData(availableCuisines, allFeatures, favs);

    this.render();
  }

  public setActiveTab(tab: 'explore' | 'favorites'): void {
    this.activeTab = tab;
    this.filterStore.setFavoritesOnly(tab === 'favorites', this.allFeatures, this.favoritesStore.getFavorites());
    this.render();
  }

  /**
   * Highlights the specified POI card in the sidebar listing, optionally scrolling it into view.
   */
  public setSelectedPOI(poiId: string | null, scrollIntoView = true): void {
    this.selectedPoiId = poiId;

    // Remove previous selection styling
    this.container.querySelectorAll('.poi-card.selected').forEach((card) => {
      card.classList.remove('selected');
    });

    if (poiId) {
      const card = this.container.querySelector(`.poi-card[data-id="${poiId}"]`) as HTMLElement | null;
      if (card) {
        card.classList.add('selected');
        if (scrollIntoView) {
          const listContainer = this.container.querySelector('.poi-list-container') as HTMLElement | null;
          if (listContainer) {
            const cardTop = card.offsetTop - listContainer.offsetTop;
            const cardHeight = card.offsetHeight;
            const containerHeight = listContainer.clientHeight;
            const currentScroll = listContainer.scrollTop;

            if (cardTop < currentScroll) {
              listContainer.scrollTo({ top: cardTop, behavior: 'smooth' });
            } else if (cardTop + cardHeight > currentScroll + containerHeight) {
              listContainer.scrollTo({ top: cardTop + cardHeight - containerHeight, behavior: 'smooth' });
            }
          }
        }
      }
    }
  }

  public render(): void {
    const state = this.filterStore.getState();
    const favorites = this.favoritesStore.getFavorites();
    const favCount = favorites.size;

    // Filter features
    const matchingFeatures = this.allFeatures.filter((f) =>
      this.filterStore.matches(f, favorites)
    );

    // Sort features by approximate walking distance from conference center (closer items first)
    if (this.region?.center) {
      const centerCoords = this.region.center;
      matchingFeatures.sort((a, b) => {
        const distA = calculateDistanceMeters(centerCoords, a.geometry.coordinates);
        const distB = calculateDistanceMeters(centerCoords, b.geometry.coordinates);
        if (distA !== distB) {
          return distA - distB;
        }
        const walkA = a.properties.walk_time_minutes ?? 999;
        const walkB = b.properties.walk_time_minutes ?? 999;
        return walkA - walkB;
      });
    } else {
      matchingFeatures.sort((a, b) => {
        const walkA = a.properties.walk_time_minutes ?? 999;
        const walkB = b.properties.walk_time_minutes ?? 999;
        return walkA - walkB;
      });
    }

    const confTitle = this.region?.name.split(',')[0] || 'Conference POI Explorer';

    this.container.innerHTML = `
      <div class="sidebar-header">
        <div class="mobile-drawer-handle" id="drawer-handle" aria-label="Toggle drawer">
          <span class="handle-bar"></span>
        </div>
        <div class="header-main">
          <div class="header-brand">
            <span class="brand-icon">🚶</span>
            <div class="brand-text">
              <h1 class="brand-title">ConferenceWalker</h1>
              <span class="conference-name" title="${this.region?.name || ''}">${confTitle}</span>
            </div>
          </div>
          <button
            type="button"
            class="btn-toggle-filters ${this.isFiltersOpen ? 'active' : ''}"
            id="btn-toggle-filters"
            aria-expanded="${this.isFiltersOpen}"
          >
            <span class="icon">${this.isFiltersOpen ? '✕' : '⚙️'}</span>
            <span>${this.isFiltersOpen ? 'Close Filters' : 'Filters'}</span>
          </button>
        </div>

        <div class="search-bar">
          <span class="search-icon" aria-hidden="true">🔍</span>
          <input
            type="search"
            class="search-input"
            id="poi-search-input"
            placeholder="Search food, coffee, transit, names..."
            value="${state.searchQuery}"
            aria-label="Search venues"
          />
          ${
            state.searchQuery
              ? '<button type="button" class="btn-clear-search" id="btn-clear-search" aria-label="Clear search">✕</button>'
              : ''
          }
        </div>

        <div class="tabs-bar" role="tablist">
          <button
            type="button"
            class="tab-btn ${this.activeTab === 'explore' ? 'active' : ''}"
            id="tab-explore"
            role="tab"
            aria-selected="${this.activeTab === 'explore'}"
          >
            Explore <span class="tab-count">(${matchingFeatures.length})</span>
          </button>
          <button
            type="button"
            class="tab-btn ${this.activeTab === 'favorites' ? 'active' : ''}"
            id="tab-favorites"
            role="tab"
            aria-selected="${this.activeTab === 'favorites'}"
          >
            ★ Saved <span class="tab-count">(${favCount})</span>
          </button>
        </div>
      </div>

      <div class="filters-collapsible ${this.isFiltersOpen ? 'open' : 'closed'}">
        <div class="filter-quick-toggles">
          <label class="toggle-checkbox-label">
            <input type="checkbox" id="chk-open-now" ${state.openNowOnly ? 'checked' : ''} />
            <span class="label-text">Open Now</span>
          </label>
          <label class="toggle-checkbox-label ${!state.openNowOnly ? 'disabled' : ''}">
            <input
              type="checkbox"
              id="chk-include-unknown"
              ${state.includeUnknownHours ? 'checked' : ''}
              ${!state.openNowOnly ? 'disabled' : ''}
            />
            <span class="label-text">Include Unknown Hours</span>
          </label>
          <label class="toggle-checkbox-label debug-toggle-label">
            <input
              type="checkbox"
              id="chk-debug-mode"
              ${this.debugStore.isDebugMode() ? 'checked' : ''}
            />
            <span class="label-text">🛠️ Show OSM & GERS IDs</span>
          </label>
          <button type="button" class="btn-text-action" id="btn-reset-filters">Reset Filters</button>
        </div>

        <div id="filter-categories-container"></div>
        <div id="filter-walk-container"></div>
        <div id="filter-cuisines-container"></div>

        <div class="filter-footer-actions">
          <button type="button" class="btn-collapse-filters" id="btn-collapse-filters">
            View ${matchingFeatures.length} Results
          </button>
        </div>
      </div>

      <div class="poi-list-container" role="region" aria-label="Points of Interest List" style="${this.isFiltersOpen ? 'display: none;' : ''}">
        ${
          matchingFeatures.length === 0
            ? `
          <div class="empty-state">
            <span class="empty-icon">📍</span>
            <h3>No matching places found</h3>
            <p>Try adjusting your category, walk distance, or search terms.</p>
            <button type="button" class="btn-reset-empty" id="btn-reset-empty">Clear All Filters</button>
          </div>
        `
            : `
          <div class="poi-list">
            ${matchingFeatures
              .map((feat) => {
                const p = feat.properties;
                const isSelected = p.id === this.selectedPoiId;
                const catMeta = CATEGORY_META[p.category];
                const isFav = favorites.has(p.id);
                const status = evaluateOpeningHours(p.opening_hours);
                const badge = getOpeningBadge(status);
                const walkText = p.walk_time_minutes ? `${p.walk_time_minutes} min` : '>15 min';

                const distMeters = this.region?.center
                  ? calculateDistanceMeters(this.region.center, feat.geometry.coordinates)
                  : null;
                const distText = distMeters !== null ? formatDistance(distMeters) : null;
                const distanceDisplay = distText ? `🚶 ${walkText} (${distText})` : `🚶 ${walkText}`;

                return `
                  <article class="poi-card ${isSelected ? 'selected' : ''}" data-id="${p.id}" tabindex="0" role="button">
                    <div class="poi-card-header">
                      <span class="poi-card-cat" style="color: ${catMeta.color}">
                        ${catMeta.icon} ${catMeta.label}
                      </span>
                      <button
                        type="button"
                        class="btn-star-card ${isFav ? 'active' : ''} tap-target"
                        data-id="${p.id}"
                        aria-label="${isFav ? 'Remove from favorites' : 'Add to favorites'}"
                      >
                        ${isFav ? '★' : '☆'}
                      </button>
                    </div>
                    <h3 class="poi-card-name">${p.name}</h3>
                    ${p.address ? `<div class="poi-card-address">${p.address}</div>` : ''}
                    <div class="poi-card-badges">
                      <span class="walk-badge-sm">${distanceDisplay}</span>
                      <span class="status-badge-sm ${badge.className}">${badge.text}</span>
                      ${
                        p.reservation_url
                          ? `<span class="service-badge-sm" title="Online Reservations Available">📅 Reserve</span>`
                          : ''
                      }
                      ${
                        p.order_url
                          ? `<span class="service-badge-sm" title="Online Ordering Available">🛍️ Order</span>`
                          : ''
                      }
                      ${
                        p.cuisines && p.cuisines.length > 0
                          ? `<span class="cuisine-badge-sm">${p.cuisines[0].replace(/_/g, ' ')}</span>`
                          : ''
                      }
                    </div>
                    ${
                      this.debugStore.isDebugMode()
                        ? `
                      <div class="poi-card-debug-ids">
                        ${p.osm_id ? `<span class="id-pill osm-pill">OSM: ${p.osm_id}</span>` : ''}
                        ${p.overture_id ? `<span class="id-pill gers-pill">GERS: ${p.overture_id}</span>` : ''}
                      </div>
                    `
                        : ''
                    }
                  </article>
                `;
              })
              .join('')}
          </div>
        `
        }
      </div>
    `;

    // Mount sub-filter components into containers
    const catSlot = this.container.querySelector('#filter-categories-container');
    if (catSlot) {
      this.categoryFilter.render();
      catSlot.appendChild(this.categoryFilter['container']);
    }

    const walkSlot = this.container.querySelector('#filter-walk-container');
    if (walkSlot) {
      this.walkDistanceFilter.render();
      walkSlot.appendChild(this.walkDistanceFilter['container']);
    }

    const cuisineSlot = this.container.querySelector('#filter-cuisines-container');
    if (cuisineSlot) {
      this.cuisineFilter.render();
      cuisineSlot.appendChild(this.cuisineFilter['container']);
    }

    this.bindEvents();
  }

  private bindEvents(): void {
    // Mobile drawer handle
    this.container.querySelector('#drawer-handle')?.addEventListener('click', () => {
      this.isMobileExpanded = !this.isMobileExpanded;
      this.container.classList.toggle('mobile-expanded', this.isMobileExpanded);
    });

    // Toggle filters collapsible
    this.container.querySelector('#btn-toggle-filters')?.addEventListener('click', () => {
      this.isFiltersOpen = !this.isFiltersOpen;
      this.render();
    });

    // Collapse filters button in filters footer
    this.container.querySelector('#btn-collapse-filters')?.addEventListener('click', () => {
      this.isFiltersOpen = false;
      this.render();
    });

    // Debug mode toggle
    this.container.querySelector('#chk-debug-mode')?.addEventListener('change', (e) => {
      const checked = (e.target as HTMLInputElement).checked;
      this.debugStore.setDebugMode(checked);
      this.render();
    });

    // Search bar input
    const searchInput = this.container.querySelector('#poi-search-input') as HTMLInputElement | null;
    searchInput?.addEventListener('input', (e) => {
      const q = (e.target as HTMLInputElement).value;
      this.filterStore.setSearchQuery(q, this.allFeatures, this.favoritesStore.getFavorites());
      this.render();
      const nextInput = this.container.querySelector('#poi-search-input') as HTMLInputElement | null;
      nextInput?.focus();
      nextInput?.setSelectionRange(q.length, q.length);
    });

    // Clear search button
    this.container.querySelector('#btn-clear-search')?.addEventListener('click', () => {
      this.filterStore.setSearchQuery('', this.allFeatures, this.favoritesStore.getFavorites());
      this.render();
    });

    // Tab buttons
    this.container.querySelector('#tab-explore')?.addEventListener('click', () => {
      this.setActiveTab('explore');
    });

    this.container.querySelector('#tab-favorites')?.addEventListener('click', () => {
      this.setActiveTab('favorites');
    });

    // Quick toggles: Open Now
    this.container.querySelector('#chk-open-now')?.addEventListener('change', (e) => {
      const checked = (e.target as HTMLInputElement).checked;
      this.filterStore.setOpenNowOnly(checked, this.allFeatures, this.favoritesStore.getFavorites());
      this.render();
    });

    // Quick toggles: Include Unknown Hours
    this.container.querySelector('#chk-include-unknown')?.addEventListener('change', (e) => {
      const checked = (e.target as HTMLInputElement).checked;
      this.filterStore.setIncludeUnknownHours(checked, this.allFeatures, this.favoritesStore.getFavorites());
      this.render();
    });

    // Reset filters buttons
    const handleReset = () => {
      this.filterStore.resetFilters(this.allFeatures, this.favoritesStore.getFavorites());
      this.render();
    };
    this.container.querySelector('#btn-reset-filters')?.addEventListener('click', handleReset);
    this.container.querySelector('#btn-reset-empty')?.addEventListener('click', handleReset);

    // POI Cards click to select
    this.container.querySelectorAll('.poi-card').forEach((card) => {
      card.addEventListener('click', (e) => {
        // If clicked on star button, don't trigger card selection
        if ((e.target as HTMLElement).closest('.btn-star-card')) return;

        const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
        const poi = this.allFeatures.find((f) => f.properties.id === id);
        if (poi) {
          this.setSelectedPOI(poi.properties.id, false);
          this.events.onSelectPOI(poi);
        }
      });

      // Hover preview
      card.addEventListener('mouseenter', (e) => {
        const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
        const poi = this.allFeatures.find((f) => f.properties.id === id) || null;
        if (this.events.onHoverPOI) {
          this.events.onHoverPOI(poi);
        }
      });
    });

    // Star button on card
    this.container.querySelectorAll('.btn-star-card').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
        if (id) {
          this.favoritesStore.toggleFavorite(id);
          this.render();
        }
      });
    });
  }
}
