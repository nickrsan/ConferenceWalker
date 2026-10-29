/**
 * Responsive Sidebar and Mobile Drawer component for ConferenceWalker.
 * Houses filter controls, search, tabs (Explore vs Favorites), and POI listing.
 */

import { POIFeature, RegionMetadata, CATEGORY_META, ALL_CATEGORIES, POICategory, POIIconSize } from '../types/poi';
import { FilterStore } from '../state/filterState';
import { FavoritesStore } from '../state/favorites';
import { DebugStore } from '../state/debugState';
import { CategoryFilterComponent } from './categoryFilter';
import { WalkDistanceFilterComponent } from './walkDistanceFilter';
import { CuisineFilterComponent } from './cuisineFilter';
import { evaluateOpeningHours, getOpeningBadge } from '../utils/openingHours';
import { calculateDistanceMeters, formatDistance } from '../utils/directions';
import { isExportModeEnabled, downloadSavedPoisFile } from '../utils/exportSaved';
import { BasemapStyleKey } from '../map/mapStyles';
import { APP_CONFIG } from '../config';

export const MIN_SIDEBAR_WIDTH = 300;
export const MAX_SIDEBAR_WIDTH = 700;
export const DEFAULT_SIDEBAR_WIDTH = 400;

export interface SidebarEvents {
  onSelectPOI: (poi: POIFeature) => void;
  onHoverPOI?: (poi: POIFeature | null) => void;
  onBasemapChange?: (style: BasemapStyleKey) => void;
  onIsochronesToggle?: (visible: boolean) => void;
  onIconSizeChange?: (size: POIIconSize) => void;
  onResize?: (width: number) => void;
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
  private isSettingsOpen = false; // Settings panel for data source and debug options
  private isMobileExpanded = false;
  private selectedPoiId: string | null = null;
  private currentBasemapStyle: BasemapStyleKey = 'positron';
  private showIsochrones = true;
  private currentIconSize: POIIconSize = 'medium';
  private isWelcomeDismissed = false;
  private sidebarWidth: number = DEFAULT_SIDEBAR_WIDTH;
  private isResizing = false;
  private resizeStartX = 0;
  private resizeStartWidth = DEFAULT_SIDEBAR_WIDTH;

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

    const savedIso = typeof localStorage !== 'undefined' ? localStorage.getItem('cw_show_isochrones') : null;
    if (savedIso !== null) {
      this.showIsochrones = savedIso === 'true';
    } else if (APP_CONFIG.showIsochronesByDefault !== undefined) {
      this.showIsochrones = APP_CONFIG.showIsochronesByDefault;
    }

    const savedIcon = typeof localStorage !== 'undefined' ? (localStorage.getItem('cw_icon_size') as POIIconSize) : null;
    if (savedIcon && ['small', 'medium', 'large', 'extra-large'].includes(savedIcon)) {
      this.currentIconSize = savedIcon;
    } else if (APP_CONFIG.iconSize) {
      this.currentIconSize = APP_CONFIG.iconSize;
    }

    this.isWelcomeDismissed =
      typeof localStorage !== 'undefined' && localStorage.getItem('cw_welcome_dismissed') === 'true';

    const storedWidth = typeof localStorage !== 'undefined' ? localStorage.getItem('cw_sidebar_width') : null;
    if (storedWidth) {
      const parsed = parseInt(storedWidth, 10);
      if (!isNaN(parsed) && parsed >= MIN_SIDEBAR_WIDTH && parsed <= MAX_SIDEBAR_WIDTH) {
        this.sidebarWidth = parsed;
      }
    }
    this.applySidebarWidth(this.sidebarWidth, false);

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
    if (expanded) {
      this.isSettingsOpen = false;
    }
    this.render();
  }

  public isSettingsExpanded(): boolean {
    return this.isSettingsOpen;
  }

  public setSettingsExpanded(expanded: boolean): void {
    this.isSettingsOpen = expanded;
    if (expanded) {
      this.isFiltersOpen = false;
    }
    this.render();
  }

  public setBasemapStyle(style: BasemapStyleKey): void {
    this.currentBasemapStyle = style;
    this.render();
  }

  public setShowIsochrones(visible: boolean): void {
    this.showIsochrones = visible;
    this.render();
  }

  public getShowIsochrones(): boolean {
    return this.showIsochrones;
  }

  public setIconSize(size: POIIconSize, persist = true): void {
    this.currentIconSize = size;
    if (persist && typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('cw_icon_size', size);
      } catch {
        // ignore
      }
    }
    this.render();
  }

  public getIconSize(): POIIconSize {
    return this.currentIconSize;
  }

  public isWelcomeDismissedState(): boolean {
    return this.isWelcomeDismissed;
  }

  public setSidebarWidth(width: number, persist = true): void {
    const maxAllowed =
      typeof window !== 'undefined'
        ? Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, Math.floor(window.innerWidth * 0.7)))
        : MAX_SIDEBAR_WIDTH;
    const clamped = Math.max(MIN_SIDEBAR_WIDTH, Math.min(maxAllowed, width));
    this.sidebarWidth = clamped;
    this.applySidebarWidth(clamped, persist);
    if (this.events.onResize) {
      this.events.onResize(clamped);
    }
  }

  public getSidebarWidth(): number {
    return this.sidebarWidth;
  }

  private applySidebarWidth(width: number, persist: boolean): void {
    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--sidebar-width', `${width}px`);
    }
    if (this.container) {
      this.container.style.width = `${width}px`;
    }
    const resizer = this.container?.querySelector('#sidebar-resizer');
    if (resizer) {
      resizer.setAttribute('aria-valuenow', String(width));
    }
    if (persist && typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('cw_sidebar_width', String(width));
      } catch {
        // ignore
      }
    }
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

  public getActiveTab(): 'explore' | 'favorites' {
    return this.activeTab;
  }

  public setActiveTab(tab: 'explore' | 'favorites'): void {
    this.activeTab = tab;
    if (this.isSettingsOpen) {
      this.isSettingsOpen = false;
    }
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
    const matchingIds = this.filterStore.getMatchingIds(this.allFeatures, favorites);
    const matchingFeatures = this.allFeatures.filter((f) =>
      matchingIds.has(f.properties.id)
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

    const confTitle = APP_CONFIG.conferenceSubtitle || this.region?.name.split(',')[0] || 'Conference POI Explorer';

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
          <div class="header-actions">
            <button
              type="button"
              class="btn-toggle-settings ${this.isSettingsOpen ? 'active' : ''}"
              id="btn-toggle-settings"
              aria-expanded="${this.isSettingsOpen}"
              aria-label="Settings"
              title="Settings"
            >
              <span class="icon">⚙️</span>
              <span>Settings</span>
            </button>
            <button
              type="button"
              class="btn-toggle-filters ${this.isFiltersOpen ? 'active' : ''}"
              id="btn-toggle-filters"
              aria-expanded="${this.isFiltersOpen}"
              aria-label="${this.isFiltersOpen ? 'Close filters' : 'Open filters'}"
            >
              <span class="icon">${this.isFiltersOpen ? '✕' : '🎛️'}</span>
              <span>${this.isFiltersOpen ? 'Close' : 'Filters'}</span>
            </button>
          </div>
        </div>

        ${
          APP_CONFIG.welcomeHtml && !this.isWelcomeDismissed
            ? `
          <div class="welcome-banner-card" id="welcome-banner" role="region" aria-label="Welcome announcement">
            <div class="welcome-banner-content">
              ${APP_CONFIG.welcomeHtml}
            </div>
            <button type="button" class="btn-dismiss-welcome" id="btn-dismiss-welcome" aria-label="Dismiss announcement" title="Dismiss announcement">✕</button>
          </div>
        `
            : ''
        }

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
          ${
            isExportModeEnabled()
              ? `
            <button
              type="button"
              class="tab-btn btn-export-saved"
              id="btn-export-saved"
              title="Download saved POIs JSON configuration"
              aria-label="Export Saved POIs"
            >
              📥 Export (${favCount})
            </button>
          `
              : ''
          }
        </div>
      </div>

      <div class="filters-collapsible ${this.isFiltersOpen ? 'open' : 'closed'}">
        <div class="filters-scroll-body" id="filters-scroll-body">
          <div class="filter-quick-toggles">
            <label class="toggle-checkbox-label">
              <input type="checkbox" id="chk-nearest-only" ${state.nearestOnly ? 'checked' : ''} />
              <span class="label-text">📍 Nearest Only</span>
            </label>
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
            <button type="button" class="btn-text-action" id="btn-reset-filters">Reset Filters</button>
          </div>

          <div id="filter-categories-container"></div>
          <div id="filter-walk-container"></div>
          <div id="filter-cuisines-container"></div>
        </div>

        <div class="filter-footer-actions">
          <button type="button" class="btn-collapse-filters" id="btn-collapse-filters">
            View ${matchingFeatures.length} Results
          </button>
        </div>
      </div>

      <div
        class="settings-panel ${this.isSettingsOpen ? 'open' : 'closed'}"
        id="settings-panel"
        role="region"
        aria-label="Application Settings"
        style="${this.isSettingsOpen ? '' : 'display: none;'}"
      >
        <div class="settings-panel-header">
          <div class="settings-title-row">
            <h2 class="settings-title">⚙️ Settings</h2>
            <button type="button" class="btn-close-settings" id="btn-close-settings" aria-label="Close settings">✕</button>
          </div>
          <p class="settings-subtitle">Manage data sources and inspection tools.</p>
        </div>

        <div class="settings-content">
          <div class="settings-section">
            <h3 class="settings-section-title">Data Sources</h3>
            <div class="settings-option">
              <label class="toggle-checkbox-label settings-checkbox-label">
                <input
                  type="checkbox"
                  id="chk-disable-overture"
                  ${this.filterStore.isExcludeOvertureOnly() ? 'checked' : ''}
                />
                <span class="label-text">Disable Overture-only data</span>
              </label>
              <p class="settings-option-desc">
                Exclude places only sourced from Overture Maps to reduce noisy locations and poor positional accuracy. OpenStreetMap places and verified merged records remain visible.
              </p>
            </div>
          </div>

          <div class="settings-section">
            <h3 class="settings-section-title">Developer & Inspection</h3>
            <div class="settings-option">
              <label class="toggle-checkbox-label settings-checkbox-label">
                <input
                  type="checkbox"
                  id="chk-debug-mode"
                  ${this.debugStore.isDebugMode() ? 'checked' : ''}
                />
                <span class="label-text">🛠️ Show OSM & GERS IDs</span>
              </label>
              <p class="settings-option-desc">
                Display raw OpenStreetMap node/way IDs and Overture GERS identifiers on venue cards and detail panels.
              </p>
            </div>
          </div>

          <div class="settings-section">
            <h3 class="settings-section-title">Basemap Style</h3>
            <div class="settings-option">
              <label for="select-basemap-style" class="label-text" style="font-weight: 600; margin-bottom: 6px; display: block;">
                Map Theme
              </label>
              <select id="select-basemap-style" class="settings-select" aria-label="Select Basemap Style" style="width: 100%; padding: 8px 12px; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 14px; background: #fff;">
                <option value="positron" ${this.currentBasemapStyle === 'positron' ? 'selected' : ''}>Positron (Light)</option>
                <option value="bright" ${this.currentBasemapStyle === 'bright' ? 'selected' : ''}>Bright</option>
                <option value="liberty" ${this.currentBasemapStyle === 'liberty' ? 'selected' : ''}>Liberty</option>
              </select>
              <p class="settings-option-desc">
                Choose between OpenFreeMap vector styles (Positron, Bright, or Liberty).
              </p>
            </div>
          </div>

          <div class="settings-section">
            <h3 class="settings-section-title">Map Display & Icons</h3>
            <div class="settings-option" style="margin-bottom: 12px;">
              <label for="select-icon-size" class="label-text" style="font-weight: 600; margin-bottom: 6px; display: block;">
                Map Icon Size
              </label>
              <select id="select-icon-size" class="settings-select" aria-label="Select Map Icon Size" style="width: 100%; padding: 8px 12px; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 14px; background: #fff;">
                <option value="small" ${this.currentIconSize === 'small' ? 'selected' : ''}>Small (Compact)</option>
                <option value="medium" ${this.currentIconSize === 'medium' ? 'selected' : ''}>Medium (Default)</option>
                <option value="large" ${this.currentIconSize === 'large' ? 'selected' : ''}>Large</option>
                <option value="extra-large" ${this.currentIconSize === 'extra-large' ? 'selected' : ''}>Extra Large</option>
              </select>
              <p class="settings-option-desc">
                Adjust the scaling of POI icons and category badges on the map.
              </p>
            </div>
            <div class="settings-option">
              <label class="toggle-checkbox-label settings-checkbox-label">
                <input
                  type="checkbox"
                  id="chk-show-isochrones"
                  ${this.showIsochrones ? 'checked' : ''}
                />
                <span class="label-text">Show walking distance zones</span>
              </label>
              <p class="settings-option-desc">
                Display concentric walking distance isochrone zones (5, 10, and 15-minute walksheds) on the map.
              </p>
            </div>
          </div>

          <div class="settings-section">
            <h3 class="settings-section-title">Organizer & Export Tools</h3>
            <div class="settings-option">
              <button type="button" class="btn-text-action btn-export-action" id="btn-export-saved-settings">
                📥 Export Saved POIs (${favCount})
              </button>
              <p class="settings-option-desc">
                Download currently starred POIs as a JSON configuration file to set default recommendations for attendees.
              </p>
            </div>
          </div>
        </div>

        <div class="settings-footer-actions">
          <button type="button" class="btn-collapse-settings" id="btn-collapse-settings">
            Done
          </button>
        </div>
      </div>

      <div class="poi-list-container" role="region" aria-label="Points of Interest List" style="${this.isFiltersOpen || this.isSettingsOpen ? 'display: none;' : ''}">
        ${!this.isFiltersOpen && !this.isSettingsOpen ? this.renderActiveFilterSummary(matchingFeatures.length) : ''}
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

      <div
        id="sidebar-resizer"
        class="sidebar-resizer"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        tabindex="0"
        aria-valuenow="${this.sidebarWidth}"
        aria-valuemin="${MIN_SIDEBAR_WIDTH}"
        aria-valuemax="${MAX_SIDEBAR_WIDTH}"
      ></div>
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

    // Toggle settings panel
    this.container.querySelector('#btn-toggle-settings')?.addEventListener('click', () => {
      this.isSettingsOpen = !this.isSettingsOpen;
      if (this.isSettingsOpen) {
        this.isFiltersOpen = false;
      }
      this.render();
    });

    // Close settings handlers
    const closeSettingsHandler = () => {
      this.isSettingsOpen = false;
      this.render();
    };
    this.container.querySelector('#btn-close-settings')?.addEventListener('click', closeSettingsHandler);
    this.container.querySelector('#btn-collapse-settings')?.addEventListener('click', closeSettingsHandler);

    // Toggle filters collapsible
    this.container.querySelector('#btn-toggle-filters')?.addEventListener('click', () => {
      this.isFiltersOpen = !this.isFiltersOpen;
      if (this.isFiltersOpen) {
        this.isSettingsOpen = false;
      }
      this.render();
    });

    // Collapse filters button in filters footer
    this.container.querySelector('#btn-collapse-filters')?.addEventListener('click', () => {
      this.isFiltersOpen = false;
      this.render();
    });

    // Disable Overture-only data toggle in Settings panel
    this.container.querySelector('#chk-disable-overture')?.addEventListener('change', (e) => {
      const checked = (e.target as HTMLInputElement).checked;
      this.filterStore.setExcludeOvertureOnly(
        checked,
        this.allFeatures,
        this.favoritesStore.getFavorites()
      );
      this.render();
    });

    // Basemap style selector in Settings panel
    this.container.querySelector('#select-basemap-style')?.addEventListener('change', (e) => {
      const val = (e.target as HTMLSelectElement).value as BasemapStyleKey;
      this.currentBasemapStyle = val;
      if (this.events.onBasemapChange) {
        this.events.onBasemapChange(val);
      }
    });

    // Icon size selector in Settings panel
    this.container.querySelector('#select-icon-size')?.addEventListener('change', (e) => {
      const val = (e.target as HTMLSelectElement).value as POIIconSize;
      this.currentIconSize = val;
      try {
        localStorage.setItem('cw_icon_size', val);
      } catch {
        // ignore
      }
      if (this.events.onIconSizeChange) {
        this.events.onIconSizeChange(val);
      }
    });

    // Isochrones visibility toggle in Settings panel
    this.container.querySelector('#chk-show-isochrones')?.addEventListener('change', (e) => {
      const checked = (e.target as HTMLInputElement).checked;
      this.showIsochrones = checked;
      try {
        localStorage.setItem('cw_show_isochrones', String(checked));
      } catch {
        // ignore
      }
      if (this.events.onIsochronesToggle) {
        this.events.onIsochronesToggle(checked);
      }
    });

    // Welcome banner dismiss button
    this.container.querySelector('#btn-dismiss-welcome')?.addEventListener('click', () => {
      this.isWelcomeDismissed = true;
      try {
        localStorage.setItem('cw_welcome_dismissed', 'true');
      } catch {
        // ignore
      }
      this.render();
    });

    // Debug mode toggle in Settings panel
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

    // Export saved POIs buttons
    const handleExport = () => {
      downloadSavedPoisFile(this.favoritesStore.getFavorites(), this.allFeatures);
    };
    this.container.querySelector('#btn-export-saved')?.addEventListener('click', handleExport);
    this.container.querySelector('#btn-export-saved-settings')?.addEventListener('click', handleExport);

    // Quick toggles: Nearest Only
    this.container.querySelector('#chk-nearest-only')?.addEventListener('change', (e) => {
      const checked = (e.target as HTMLInputElement).checked;
      this.filterStore.setNearestOnly(checked, this.allFeatures, this.favoritesStore.getFavorites());
      this.render();
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

      card.addEventListener('keydown', (e: Event) => {
        const keyEvent = e as KeyboardEvent;
        if (keyEvent.key === 'Enter' || keyEvent.key === ' ') {
          keyEvent.preventDefault();
          const id = (card as HTMLElement).getAttribute('data-id');
          const poi = this.allFeatures.find((f) => f.properties.id === id);
          if (poi) {
            this.setSelectedPOI(poi.properties.id, false);
            this.events.onSelectPOI(poi);
          }
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

    // Active filter summary interactions
    this.container.querySelector('#btn-edit-filters-prominent')?.addEventListener('click', () => {
      this.setFiltersExpanded(true);
    });

    this.container.querySelector('#filter-summary-chips-container')?.addEventListener('click', () => {
      this.setFiltersExpanded(true);
    });

    this.container.querySelector('#filter-summary-chips-container')?.addEventListener('keydown', (e: Event) => {
      const ke = e as KeyboardEvent;
      if (ke.key === 'Enter' || ke.key === ' ') {
        ke.preventDefault();
        this.setFiltersExpanded(true);
      }
    });

    // Sidebar resizer drag & keyboard handling
    const resizer = this.container.querySelector('#sidebar-resizer') as HTMLElement | null;
    if (resizer) {
      resizer.addEventListener('pointerdown', (e: PointerEvent) => {
        if (typeof window !== 'undefined' && window.innerWidth <= 768) return;
        this.isResizing = true;
        this.resizeStartX = e.clientX;
        this.resizeStartWidth = this.sidebarWidth;
        try {
          resizer.setPointerCapture(e.pointerId);
        } catch {
          // ignore
        }
        if (typeof document !== 'undefined') {
          document.body.classList.add('resizing-sidebar');
        }
        e.preventDefault();
      });

      resizer.addEventListener('pointermove', (e: PointerEvent) => {
        if (!this.isResizing) return;
        const delta = e.clientX - this.resizeStartX;
        const newWidth = this.resizeStartWidth + delta;
        if (typeof window !== 'undefined' && window.requestAnimationFrame) {
          window.requestAnimationFrame(() => {
            this.setSidebarWidth(newWidth, false);
          });
        } else {
          this.setSidebarWidth(newWidth, false);
        }
      });

      const stopResize = (e: PointerEvent) => {
        if (!this.isResizing) return;
        this.isResizing = false;
        try {
          resizer.releasePointerCapture(e.pointerId);
        } catch {
          // ignore
        }
        if (typeof document !== 'undefined') {
          document.body.classList.remove('resizing-sidebar');
        }
        this.setSidebarWidth(this.sidebarWidth, true);
      };

      resizer.addEventListener('pointerup', stopResize);
      resizer.addEventListener('pointercancel', stopResize);

      resizer.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          this.setSidebarWidth(this.sidebarWidth - 20, true);
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          this.setSidebarWidth(this.sidebarWidth + 20, true);
        } else if (e.key === 'Home') {
          e.preventDefault();
          this.setSidebarWidth(MIN_SIDEBAR_WIDTH, true);
        } else if (e.key === 'End') {
          e.preventDefault();
          this.setSidebarWidth(MAX_SIDEBAR_WIDTH, true);
        }
      });
    }
  }

  /**
   * Renders the active filter summary bar displayed below tabs in list view.
   */
  private renderActiveFilterSummary(matchingCount: number): string {
    const state = this.filterStore.getState();
    const chips: string[] = [];

    // Categories
    if (state.categories.size === 0) {
      chips.push('<span class="filter-chip-summary cat-chip-summary" data-action="edit-filters">No categories</span>');
    } else if (state.categories.size < ALL_CATEGORIES.length) {
      for (const cat of state.categories) {
        const meta = CATEGORY_META[cat];
        if (meta) {
          chips.push(
            `<span class="filter-chip-summary cat-chip-summary" data-action="edit-filters" title="${meta.label}">${meta.icon} ${meta.label}</span>`
          );
        }
      }
    }

    // Walk times
    if (state.allowedWalkTimes.size < 4 && state.allowedWalkTimes.size > 0) {
      const times = Array.from(state.allowedWalkTimes).filter((t): t is number => typeof t === 'number');
      if (times.length > 0) {
        const maxTime = Math.max(...times);
        chips.push(`<span class="filter-chip-summary walk-chip-summary" data-action="edit-filters">⏱️ ≤${maxTime} min</span>`);
      }
    }

    // Nearest Only
    if (state.nearestOnly) {
      chips.push('<span class="filter-chip-summary nearest-chip-summary" data-action="edit-filters">📍 Nearest Only</span>');
    }

    // Open Now
    if (state.openNowOnly) {
      chips.push('<span class="filter-chip-summary open-chip-summary" data-action="edit-filters">🟢 Open Now</span>');
    }

    // Cuisines
    if (state.selectedCuisines.size > 0) {
      for (const cui of state.selectedCuisines) {
        chips.push(`<span class="filter-chip-summary cuisine-chip-summary" data-action="edit-filters">🍽️ ${cui.replace(/_/g, ' ')}</span>`);
      }
    }

    // Exclude Overture
    if (this.filterStore.isExcludeOvertureOnly()) {
      chips.push('<span class="filter-chip-summary overture-chip-summary" data-action="edit-filters">OSM Only</span>');
    }

    const hasSpecificFilters = chips.length > 0;
    const chipsHtml = hasSpecificFilters
      ? chips.join('')
      : '<span class="filter-summary-all-venues" data-action="edit-filters">Showing all venues</span>';

    return `
      <div class="active-filter-summary-bar" id="active-filter-summary-bar" role="region" aria-label="Active filter summary">
        <div class="filter-summary-content">
          <button
            type="button"
            class="btn-edit-filters-prominent"
            id="btn-edit-filters-prominent"
            aria-label="Edit filters"
            title="Edit and adjust filters"
          >
            <span class="icon">🎛️</span>
            <span>Edit Filters</span>
          </button>
          <div class="filter-summary-chips-container" id="filter-summary-chips-container" role="button" tabindex="0" aria-label="Open filter editor">
            ${chipsHtml}
          </div>
        </div>
      </div>
    `;
  }
}
