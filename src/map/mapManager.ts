/**
 * MapLibre GL JS Manager for ConferenceWalker.
 * Controls map initialization, isochrone boundaries, POI layer rendering,
 * hover tooltips, click selection, and dynamic layer filtering.
 */

import maplibregl, { Map as MapLibreMap, Popup, Marker } from 'maplibre-gl';
import { POICategory, CATEGORY_META, POIFeature, POIFeatureCollection, RegionMetadata, POIIconSize } from '../types/poi';
import { APP_CONFIG } from '../config';
import {
  DEFAULT_MAP_STYLE,
  DEFAULT_ZOOM,
  SACRAMENTO_FALLBACK_CENTER,
  buildCategoryColorExpression,
  CATEGORY_ICON_PREFIX,
  getCategoryMarkerSvg,
  registerCategoryImages,
  BASEMAP_STYLES,
  BasemapStyleKey,
} from './mapStyles';

export const ICON_SIZE_MULTIPLIERS: Record<POIIconSize, number> = {
  small: 0.75,
  medium: 1.0,
  large: 1.3,
  'extra-large': 1.65,
};

export interface MapManagerEvents {
  onPOIClick?: (poiId: string, feature: POIFeature) => void;
  onPOIHover?: (poiId: string | null, feature: POIFeature | null) => void;
}

export class MapManager {
  private map: MapLibreMap;
  private region: RegionMetadata | null = null;
  private poiData: POIFeatureCollection | null = null;
  private conferenceMarker: Marker | null = null;
  private hoverPopup: Popup | null = null;
  private selectedPoiId: string | null = null;
  private favoriteIds: Set<string> = new Set();
  private isLoaded = false;
  private isochronesVisible = true;
  private currentIconSize: POIIconSize = APP_CONFIG.iconSize || 'medium';
  private activeFilter: any[] | null = null;
  private currentStyleKey: BasemapStyleKey = 'positron';
  private events: MapManagerEvents = {};

  constructor(container: string | HTMLElement, region?: RegionMetadata, events?: MapManagerEvents) {
    this.region = region || null;
    this.events = events || {};

    const center = this.region?.center || SACRAMENTO_FALLBACK_CENTER;

    this.map = new maplibregl.Map({
      container,
      style: DEFAULT_MAP_STYLE,
      center,
      zoom: DEFAULT_ZOOM,
      attributionControl: { compact: true },
    });

    this.map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');

    // On-demand rasterization listener if an icon image is requested before preload finishes
    this.map.on('styleimagemissing', (e: any) => {
      const id = e.id;
      if (typeof id === 'string' && id.startsWith(CATEGORY_ICON_PREFIX)) {
        const cat = id.replace(CATEGORY_ICON_PREFIX, '') as POICategory;
        if (CATEGORY_META[cat]) {
          const svg = getCategoryMarkerSvg(cat, CATEGORY_META[cat].color);
          const img = new Image(48, 48);
          img.onload = () => {
            if (!this.map.hasImage(id)) {
              this.map.addImage(id, img, { pixelRatio: 2 });
            }
          };
          img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
        }
      }
    });

    this.map.on('load', async () => {
      await registerCategoryImages(this.map);
      this.isLoaded = true;
      if (this.region) {
        this.renderIsochrones(this.region);
      }
      if (this.poiData) {
        this.renderPOIs(this.poiData);
      }
      if (this.activeFilter) {
        this.applyFilter(this.activeFilter);
      }
    });

    this.setupInteractions();
  }

  /**
   * Set callback event listeners for POI selection and hover.
   */
  public setEvents(events: MapManagerEvents): void {
    this.events = events;
  }

  /**
   * Initializes isochrone polygon fills and outlines.
   */
  public renderIsochrones(region: RegionMetadata): void {
    this.region = region;
    if (!this.isLoaded) return;

    // Filter features for polygons
    const polygonFeatures = {
      type: 'FeatureCollection',
      features: (region.geojson?.features || []).filter((f: any) =>
        f.geometry && (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon')
      ),
    };

    if (this.map.getSource('isochrones-source')) {
      (this.map.getSource('isochrones-source') as maplibregl.GeoJSONSource).setData(polygonFeatures as any);
    } else {
      this.map.addSource('isochrones-source', {
        type: 'geojson',
        data: polygonFeatures as any,
      });

      // Insert beneath POI layers if POI layers exist, otherwise add to map top
      const beforeLayerId = this.map.getLayer('pois-favorites-halo')
        ? 'pois-favorites-halo'
        : (this.map.getLayer('pois-circle') ? 'pois-circle' : undefined);

      // Polygon fill layer with tiered high-contrast opacities (28% for 5 min, 22% for 10 min, 18% for 15 min)
      this.map.addLayer(
        {
          id: 'isochrones-fill',
          type: 'fill',
          source: 'isochrones-source',
          layout: {
            visibility: this.isochronesVisible ? 'visible' : 'none',
          },
          paint: {
            'fill-color': ['coalesce', ['get', 'fillColor'], ['get', 'color'], '#2b83ba'],
            'fill-opacity': [
              'match',
              ['get', 'value'],
              300, 0.28,
              600, 0.22,
              900, 0.18,
              ['coalesce', ['get', 'fillOpacity'], 0.24],
            ],
          },
        },
        beforeLayerId
      );

      // Polygon outline layer with crisp perimeter strokes
      this.map.addLayer(
        {
          id: 'isochrones-line',
          type: 'line',
          source: 'isochrones-source',
          layout: {
            visibility: this.isochronesVisible ? 'visible' : 'none',
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': ['coalesce', ['get', 'color'], '#2b83ba'],
            'line-width': 2.5,
            'line-opacity': 0.85,
          },
        },
        beforeLayerId
      );

      // Isochrone label layer with explicit Noto Sans Regular vector fontstack
      this.map.addLayer(
        {
          id: 'isochrones-labels',
          type: 'symbol',
          source: 'isochrones-source',
          layout: {
            'text-field': ['get', 'label'],
            'text-font': ['Noto Sans Regular'],
            'text-size': 12,
            'text-anchor': 'center',
            'visibility': this.isochronesVisible ? 'visible' : 'none',
          },
          paint: {
            'text-color': '#1e293b',
            'text-halo-color': '#ffffff',
            'text-halo-width': 2,
          },
        },
        beforeLayerId
      );
    }

    // Apply visibility configuration to isochrone layers
    this.updateIsochronesLayerVisibility();

    // Add or update conference center pin
    this.renderConferenceMarker(region.center, region.name);
  }

  /**
   * Toggles visibility of walking distance isochrone layers on the map.
   */
  public setIsochronesVisible(visible: boolean): void {
    this.isochronesVisible = visible;
    this.updateIsochronesLayerVisibility();
  }

  /**
   * Returns whether isochrone layers are currently configured as visible.
   */
  public getIsochronesVisible(): boolean {
    return this.isochronesVisible;
  }

  /**
   * Applies the current isochrone visibility state to all MapLibre isochrone layers.
   */
  private updateIsochronesLayerVisibility(): void {
    if (!this.isLoaded) return;
    const visibility = this.isochronesVisible ? 'visible' : 'none';
    const isochroneLayers = ['isochrones-fill', 'isochrones-line', 'isochrones-labels'];
    for (const layerId of isochroneLayers) {
      if (this.map.getLayer(layerId)) {
        this.map.setLayoutProperty(layerId, 'visibility', visibility);
      }
    }
  }

  /**
   * Adds or updates the conference center location marker on the map.
   */
  private renderConferenceMarker(center: [number, number], name: string): void {
    if (this.conferenceMarker) {
      this.conferenceMarker.remove();
    }

    const title = APP_CONFIG.conferencePinTitle || `Conference Center: ${name}`;
    const label = APP_CONFIG.conferencePinLabel || name.split(',')[0];

    const markerEl = document.createElement('div');
    markerEl.className = 'conference-center-pin';
    markerEl.setAttribute('role', 'button');
    markerEl.setAttribute('title', title);
    markerEl.innerHTML = `
      <div class="pin-halo"></div>
      <div class="pin-core">📍</div>
      <div class="pin-label">${label}</div>
    `;

    this.conferenceMarker = new maplibregl.Marker({ element: markerEl, anchor: 'bottom' })
      .setLngLat(center)
      .addTo(this.map);
  }

  /**
   * Renders the POI GeoJSON source and circle visualization layers.
   */
  public renderPOIs(poiGeoJSON: POIFeatureCollection): void {
    this.poiData = poiGeoJSON;
    if (!this.isLoaded) return;

    if (this.map.getSource('pois-source')) {
      (this.map.getSource('pois-source') as maplibregl.GeoJSONSource).setData(poiGeoJSON as any);
      return;
    }

    this.map.addSource('pois-source', {
      type: 'geojson',
      data: poiGeoJSON as any,
    });

    const categoryColor = buildCategoryColorExpression();
    const mult = this.getIconSizeMultiplier(this.currentIconSize);

    // 1. Favorites highlight halo
    this.map.addLayer({
      id: 'pois-favorites-halo',
      type: 'circle',
      source: 'pois-source',
      filter: ['in', ['get', 'id'], ['literal', Array.from(this.favoriteIds)]],
      paint: {
        'circle-radius': this.buildHaloRadiusExpression(mult),
        'circle-color': '#f59e0b',
        'circle-opacity': 0.38,
        'circle-stroke-width': 2.5,
        'circle-stroke-color': '#d97706',
      },
    });

    // 2. Base POI circle backing
    this.map.addLayer({
      id: 'pois-circle',
      type: 'circle',
      source: 'pois-source',
      paint: {
        'circle-radius': this.buildCircleRadiusExpression(mult),
        'circle-color': categoryColor as any,
        'circle-stroke-width': 1.5,
        'circle-stroke-color': '#ffffff',
        'circle-opacity': 0.95,
      },
    });

    // 3. Primary POI vector icon badge and name label layer
    this.map.addLayer({
      id: 'pois-symbol',
      type: 'symbol',
      source: 'pois-source',
      layout: {
        // Vector category icon
        'icon-image': ['concat', CATEGORY_ICON_PREFIX, ['get', 'category']],
        'icon-size': this.buildIconSizeExpression(mult),
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'icon-anchor': 'center',

        // On-map POI venue name label
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Regular'],
        'text-size': [
          'interpolate', ['linear'], ['zoom'],
          12, 9.5,
          14, 11,
          16, 12.5,
          18, 14,
        ],
        'text-anchor': 'top',
        'text-offset': [0, 1.25],
        'text-max-width': 8.5,
        'text-optional': true,
        'symbol-sort-key': [
          'coalesce',
          ['get', 'walk_time_minutes'],
          99,
        ],
      },
      paint: {
        'text-color': '#0f172a',
        'text-halo-color': 'rgba(255, 255, 255, 0.95)',
        'text-halo-width': 1.75,
      },
    });

    // 4. Selection outline ring
    this.map.addLayer({
      id: 'pois-selection-ring',
      type: 'circle',
      source: 'pois-source',
      filter: ['==', ['get', 'id'], this.selectedPoiId || ''],
      paint: {
        'circle-radius': this.buildHaloRadiusExpression(mult),
        'circle-color': 'rgba(0, 0, 0, 0)',
        'circle-stroke-width': 3.5,
        'circle-stroke-color': '#0f172a',
      },
    });

    // Re-apply active filters and favorites halo filter if already configured
    if (this.activeFilter) {
      this.applyFilter(this.activeFilter);
    }
    if (this.favoriteIds.size > 0) {
      this.updateFavorites(this.favoriteIds);
    }
  }

  /**
   * Updates map layers to highlight saved favorite POIs.
   */
  public updateFavorites(favoriteIds: Set<string>): void {
    this.favoriteIds = favoriteIds;
    if (!this.isLoaded || !this.map.getLayer('pois-favorites-halo')) return;

    this.map.setFilter('pois-favorites-halo', [
      'in',
      ['get', 'id'],
      ['literal', Array.from(favoriteIds)],
    ]);
  }

  /**
   * Sets the currently active selected POI and highlights its marker.
   */
  public setSelectedPOI(poiId: string | null): void {
    this.selectedPoiId = poiId;
    if (!this.isLoaded || !this.map.getLayer('pois-selection-ring')) return;

    this.map.setFilter('pois-selection-ring', ['==', ['get', 'id'], poiId || '']);
  }

  /**
   * Applies an active filter expression to POI layers.
   */
  public applyFilter(filterExpression: any[] | null): void {
    this.activeFilter = filterExpression;
    const expr: any = filterExpression || ['all'];

    if (this.isLoaded && this.map.getLayer('pois-symbol')) {
      this.map.setFilter('pois-symbol', expr);
    }

    if (this.isLoaded && this.map.getLayer('pois-circle')) {
      this.map.setFilter('pois-circle', expr);
    }

    // Also filter the favorites halo so filtered-out items don't float without circle
    if (this.isLoaded && this.map.getLayer('pois-favorites-halo')) {
      const favFilter: any = ['all', expr, ['in', ['get', 'id'], ['literal', Array.from(this.favoriteIds)]]];
      this.map.setFilter('pois-favorites-halo', favFilter);
    }
  }

  /**
   * Retrieves current active basemap style key.
   */
  public getBasemapStyle(): BasemapStyleKey {
    return this.currentStyleKey;
  }

  /**
   * Returns numeric multiplier for given icon size preset or raw numeric value.
   */
  private getIconSizeMultiplier(size: POIIconSize | number): number {
    if (typeof size === 'number') {
      return size > 0 ? size : 1.0;
    }
    return ICON_SIZE_MULTIPLIERS[size] || 1.0;
  }

  /**
   * Builds zoom-interpolated expression for MapLibre symbol layer icon sizing.
   */
  private buildIconSizeExpression(mult: number): any {
    return [
      'interpolate', ['linear'], ['zoom'],
      12, +(0.42 * mult).toFixed(3),
      14, +(0.55 * mult).toFixed(3),
      16, +(0.70 * mult).toFixed(3),
      18, +(0.88 * mult).toFixed(3),
    ];
  }

  /**
   * Builds zoom-interpolated expression for POI circle layer radius.
   */
  private buildCircleRadiusExpression(mult: number): any {
    return [
      'interpolate', ['linear'], ['zoom'],
      12, +(4 * mult).toFixed(2),
      15, +(6 * mult).toFixed(2),
      18, +(8 * mult).toFixed(2),
    ];
  }

  /**
   * Builds zoom-interpolated expression for favorites halo and selection ring radius.
   */
  private buildHaloRadiusExpression(mult: number): any {
    return [
      'interpolate', ['linear'], ['zoom'],
      12, +(11 * mult).toFixed(2),
      15, +(16 * mult).toFixed(2),
      18, +(22 * mult).toFixed(2),
    ];
  }

  /**
   * Updates map POI icon size dynamically across symbol, circle, halo, and selection layers.
   */
  public setIconSize(size: POIIconSize | number): void {
    if (typeof size === 'string' && (size === 'small' || size === 'medium' || size === 'large' || size === 'extra-large')) {
      this.currentIconSize = size;
    }
    const mult = this.getIconSizeMultiplier(size);

    if (!this.isLoaded) return;

    if (this.map.getLayer('pois-symbol')) {
      this.map.setLayoutProperty('pois-symbol', 'icon-size', this.buildIconSizeExpression(mult));
    }
    if (this.map.getLayer('pois-circle')) {
      this.map.setPaintProperty('pois-circle', 'circle-radius', this.buildCircleRadiusExpression(mult));
    }
    if (this.map.getLayer('pois-favorites-halo')) {
      this.map.setPaintProperty('pois-favorites-halo', 'circle-radius', this.buildHaloRadiusExpression(mult));
    }
    if (this.map.getLayer('pois-selection-ring')) {
      this.map.setPaintProperty('pois-selection-ring', 'circle-radius', this.buildHaloRadiusExpression(mult));
    }
  }

  /**
   * Retrieves the currently active POI icon size preset.
   */
  public getIconSize(): POIIconSize {
    return this.currentIconSize;
  }

  /**
   * Switches the active OpenFreeMap vector basemap style while preserving isochrone layers,
   * POI markers, and active filters.
   */
  public async setBasemapStyle(styleKey: BasemapStyleKey): Promise<void> {
    if (!BASEMAP_STYLES[styleKey]) return;
    this.currentStyleKey = styleKey;
    const styleUrl = BASEMAP_STYLES[styleKey].url;

    return new Promise<void>((resolve) => {
      this.map.once('style.load', async () => {
        await registerCategoryImages(this.map);
        if (this.region) {
          this.renderIsochrones(this.region);
        }
        if (this.poiData) {
          this.renderPOIs(this.poiData);
        }
        if (this.activeFilter) {
          this.applyFilter(this.activeFilter);
        }
        if (this.selectedPoiId) {
          this.setSelectedPOI(this.selectedPoiId);
        }
        if (this.favoriteIds.size > 0) {
          this.updateFavorites(this.favoriteIds);
        }
        resolve();
      });

      this.map.setStyle(styleUrl);
    });
  }

  /**
   * Centers the map view on specified coordinates.
   */
  public flyTo(coords: [number, number], zoom = 16): void {
    this.map.flyTo({
      center: coords,
      zoom,
      essential: true,
      duration: 1000,
    });
  }

  /**
   * Adjusts the map canvas size when container dimensions change.
   */
  public resize(): void {
    this.map.resize();
  }

  /**
   * Configures map event listeners for hover tooltips and selection clicks.
   */
  private setupInteractions(): void {
    let lastHandledEvent: any = null;
    let lastClickTime = 0;
    let lastClickId: string | null = null;

    const onEnter = (e: any) => {
      this.map.getCanvas().style.cursor = 'pointer';

      if (!e.features || e.features.length === 0) return;
      const feat = e.features[0] as unknown as POIFeature;
      const coords = (feat.geometry.coordinates as [number, number]).slice() as [number, number];
      const props = feat.properties;

      const walkText = props.walk_time_minutes ? `${props.walk_time_minutes} min walk` : '>15 min walk';
      const resBadge = props.reservation_url ? '<span class="hover-badge">📅 Reserve</span>' : '';
      const ordBadge = props.order_url ? '<span class="hover-badge">🛍️ Order</span>' : '';
      const serviceBadges = (resBadge || ordBadge) ? `<div class="hover-badges">${resBadge}${ordBadge}</div>` : '';

      if (!this.hoverPopup) {
        this.hoverPopup = new maplibregl.Popup({
          closeButton: false,
          closeOnClick: false,
          offset: 14,
          className: 'poi-hover-popup',
        });
      }

      this.hoverPopup
        .setLngLat(coords)
        .setHTML(`
          <div class="hover-tooltip">
            <strong>${props.name}</strong>
            <div class="hover-subtext">${walkText}</div>
            ${serviceBadges}
          </div>
        `)
        .addTo(this.map);

      if (this.events.onPOIHover) {
        this.events.onPOIHover(props.id, feat);
      }
    };

    const onLeave = () => {
      this.map.getCanvas().style.cursor = '';
      if (this.hoverPopup) {
        this.hoverPopup.remove();
        this.hoverPopup = null;
      }
      if (this.events.onPOIHover) {
        this.events.onPOIHover(null, null);
      }
    };

    const handleFeatureClick = (feat: POIFeature) => {
      const poiId = feat.properties?.id;
      if (!poiId) return;

      const now = Date.now();
      if (lastClickId === poiId && now - lastClickTime < 300) {
        return; // Debounce duplicate event triggers
      }
      lastClickTime = now;
      lastClickId = poiId;

      this.setSelectedPOI(poiId);

      if (this.events.onPOIClick) {
        this.events.onPOIClick(poiId, feat);
      }
    };

    this.map.on('mouseenter', 'pois-symbol', onEnter);
    this.map.on('mouseleave', 'pois-symbol', onLeave);
    this.map.on('click', 'pois-symbol', (e) => {
      if (!e.features || e.features.length === 0) return;
      handleFeatureClick(e.features[0] as unknown as POIFeature);
    });

    this.map.on('mouseenter', 'pois-circle', onEnter);
    this.map.on('mouseleave', 'pois-circle', onLeave);
    this.map.on('click', 'pois-circle', (e) => {
      if (!e.features || e.features.length === 0) return;
      handleFeatureClick(e.features[0] as unknown as POIFeature);
    });

    // Canvas click handler with 16px buffer around click point for touchscreens & slight off-center clicks
    this.map.on('click', (e) => {
      if (e.originalEvent && e.originalEvent === lastHandledEvent) return;
      lastHandledEvent = e.originalEvent;

      const buffer = 16;
      const bbox: [maplibregl.PointLike, maplibregl.PointLike] = [
        [e.point.x - buffer, e.point.y - buffer],
        [e.point.x + buffer, e.point.y + buffer],
      ];

      const queryLayers = ['pois-symbol', 'pois-circle'].filter((id) => this.map.getLayer(id));
      if (queryLayers.length === 0) return;

      const features = this.map.queryRenderedFeatures(bbox, { layers: queryLayers });
      if (features && features.length > 0) {
        handleFeatureClick(features[0] as unknown as POIFeature);
      }
    });
  }

  public getMapInstance(): MapLibreMap {
    return this.map;
  }
}
