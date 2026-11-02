import { describe, it, expect, vi } from 'vitest';

vi.mock('maplibre-gl', () => {
  return {
    default: {
      Map: vi.fn().mockImplementation(() => ({
        on: vi.fn(),
        getLayer: vi.fn(),
        getSource: vi.fn(),
        setLayoutProperty: vi.fn(),
        setPaintProperty: vi.fn(),
        setFilter: vi.fn(),
        addSource: vi.fn(),
        addLayer: vi.fn(),
        addControl: vi.fn(),
        remove: vi.fn(),
        resize: vi.fn(),
        setStyle: vi.fn(),
        getStyle: vi.fn(() => ({})),
      })),
      NavigationControl: vi.fn().mockImplementation(() => ({})),
      Popup: vi.fn().mockImplementation(() => ({
        setLngLat: vi.fn().mockReturnThis(),
        setHTML: vi.fn().mockReturnThis(),
        addTo: vi.fn().mockReturnThis(),
        remove: vi.fn(),
      })),
      Marker: vi.fn().mockImplementation(() => ({
        setLngLat: vi.fn().mockReturnThis(),
        addTo: vi.fn().mockReturnThis(),
        remove: vi.fn(),
      })),
    },
  };
});

import {
  buildCategoryColorExpression,
  buildCategoryIconExpression,
  DEFAULT_MAP_STYLE,
  OPENFREEMAP_POSITRON_STYLE_URL,
  OPENFREEMAP_BRIGHT_STYLE_URL,
  OPENFREEMAP_LIBERTY_STYLE_URL,
  BASEMAP_STYLES,
  CARTO_POSITRON_RASTER_STYLE,
  SACRAMENTO_FALLBACK_CENTER,
  DEFAULT_ZOOM,
  CATEGORY_ICON_PREFIX,
  CATEGORY_ICON_PATHS,
  getCategoryMarkerSvg,
  registerCategoryImages,
} from '../src/map/mapStyles';
import { ALL_CATEGORIES, CATEGORY_META, POICategory } from '../src/types/poi';
import {
  MapManager,
  ICON_SIZE_MULTIPLIERS,
  ISOCHRONE_LABEL_LAYOUT,
  carryOverAppLayers,
  normalizeIsochroneFeatures,
} from '../src/map/mapManager';

describe('carryOverAppLayers', () => {
  it('copies application sources and layers in order while skipping style ID collisions', () => {
    const previousStyle: any = {
      version: 8,
      sources: {
        'base-source': { type: 'vector', url: 'https://example.com/base' },
        'isochrones-source': { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
        'pois-source': { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
      },
      layers: [
        { id: 'base-roads', type: 'line', source: 'base-source' },
        { id: 'isochrones-fill', type: 'fill', source: 'isochrones-source' },
        { id: 'pois-circle', type: 'circle', source: 'pois-source' },
        { id: 'pois-symbol', type: 'symbol', source: 'pois-source' },
      ],
    };
    const nextStyle: any = {
      version: 8,
      sources: { 'new-base-source': { type: 'vector', url: 'https://example.com/new-base' } },
      layers: [
        { id: 'new-roads', type: 'line', source: 'new-base-source' },
        { id: 'pois-circle', type: 'line', source: 'new-base-source' },
      ],
    };

    const transformedStyle = carryOverAppLayers(previousStyle, nextStyle) as any;

    expect(transformedStyle.sources).toHaveProperty('isochrones-source', previousStyle.sources['isochrones-source']);
    expect(transformedStyle.sources).toHaveProperty('pois-source', previousStyle.sources['pois-source']);
    expect(transformedStyle.layers.map((layer: any) => layer.id)).toEqual([
      'new-roads',
      'pois-circle',
      'isochrones-fill',
      'pois-symbol',
    ]);
    expect(nextStyle.sources).not.toHaveProperty('pois-source');
    expect(nextStyle.layers).toHaveLength(2);
  });

  it('returns the next style unchanged when there is no previous style', () => {
    const nextStyle: any = { version: 8, sources: {}, layers: [] };

    expect(carryOverAppLayers(undefined, nextStyle)).toBe(nextStyle);
  });
});

describe('normalizeIsochroneFeatures', () => {
  it('trims labels and retains polygon and multipolygon features', () => {
    const features = [
      {
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [] },
        properties: { label: '  5 min  ', value: 300 },
      },
      {
        type: 'Feature',
        geometry: { type: 'MultiPolygon', coordinates: [] },
        properties: { label: '  10 min ', value: 600 },
      },
    ];

    expect(normalizeIsochroneFeatures(features).map((feature) => feature.properties.label)).toEqual([
      '5 min',
      '10 min',
    ]);
  });

  it('builds a label from the value when the label is missing or blank', () => {
    const features = [
      {
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [] },
        properties: { value: 600 },
      },
      {
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [] },
        properties: { value: 900, label: '   ' },
      },
    ];

    expect(normalizeIsochroneFeatures(features).map((feature) => feature.properties.label)).toEqual([
      '10 min',
      '15 min',
    ]);
  });

  it('drops non-polygon features and features without geometry', () => {
    const features = [
      { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: {} },
      { type: 'Feature', properties: { value: 300 } },
      { type: 'Feature', geometry: null, properties: { value: 300 } },
    ];

    expect(normalizeIsochroneFeatures(features)).toEqual([]);
  });

  it('returns copied features and properties without mutating the input', () => {
    const feature = {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [] },
      properties: { label: '  5 min ', value: 300 },
    };
    const original = structuredClone(feature);
    const [normalizedFeature] = normalizeIsochroneFeatures([feature]);

    expect(feature).toEqual(original);
    expect(normalizedFeature).not.toBe(feature);
    expect(normalizedFeature.properties).not.toBe(feature.properties);
  });

  it('returns an empty list for missing or empty feature collections', () => {
    expect(normalizeIsochroneFeatures(undefined)).toEqual([]);
    expect(normalizeIsochroneFeatures([])).toEqual([]);
  });
});

describe('ISOCHRONE_LABEL_LAYOUT', () => {
  it('configures repeated, upright line labels with the existing fontstack', () => {
    expect(ISOCHRONE_LABEL_LAYOUT).toMatchObject({
      'symbol-placement': 'line',
      'symbol-spacing': 300,
      'text-font': ['Noto Sans Regular'],
      'text-size': 13,
      'text-max-angle': 30,
      'text-keep-upright': true,
      'text-rotation-alignment': 'map',
      'text-padding': 4,
    });
  });
});

describe('mapStyles', () => {
  it('buildCategoryColorExpression includes all 10 categories', () => {
    const expr = buildCategoryColorExpression();
    expect(expr[0]).toBe('match');
    expect(expr[1]).toEqual(['get', 'category']);

    for (const cat of ALL_CATEGORIES) {
      const idx = expr.indexOf(cat);
      expect(idx).toBeGreaterThan(0);
      expect(expr[idx + 1]).toBe(CATEGORY_META[cat].color);
    }

    // Default fallback color at the end
    const fallback = expr[expr.length - 1];
    expect(fallback).toBe('#64748b');
  });

  it('configures OpenFreeMap Positron as the primary default basemap style URL', () => {
    expect(OPENFREEMAP_POSITRON_STYLE_URL).toBe('https://tiles.openfreemap.org/styles/positron');
    expect(DEFAULT_MAP_STYLE).toBe(OPENFREEMAP_POSITRON_STYLE_URL);
  });

  it('defines all 3 OpenFreeMap vector styles (Positron, Bright, Liberty)', () => {
    expect(BASEMAP_STYLES.positron.url).toBe(OPENFREEMAP_POSITRON_STYLE_URL);
    expect(BASEMAP_STYLES.bright.url).toBe(OPENFREEMAP_BRIGHT_STYLE_URL);
    expect(BASEMAP_STYLES.liberty.url).toBe(OPENFREEMAP_LIBERTY_STYLE_URL);
    expect(BASEMAP_STYLES.bright.label).toBe('Bright');
    expect(BASEMAP_STYLES.liberty.label).toBe('Liberty');
  });

  it('provides a valid Carto Positron raster fallback style without API keys', () => {
    expect(CARTO_POSITRON_RASTER_STYLE.version).toBe(8);
    expect(CARTO_POSITRON_RASTER_STYLE.sources).toHaveProperty('carto-positron');
    const source = (CARTO_POSITRON_RASTER_STYLE.sources as any)['carto-positron'];
    expect(source.type).toBe('raster');
    expect(source.tiles.length).toBeGreaterThan(0);
    expect(CARTO_POSITRON_RASTER_STYLE.layers.length).toBeGreaterThan(0);
  });

  it('defines correct Sacramento conference center coordinates and default zoom', () => {
    expect(SACRAMENTO_FALLBACK_CENTER).toEqual([-121.489857, 38.579250]);
    expect(DEFAULT_ZOOM).toBe(14.5);
  });

  it('buildCategoryIconExpression generates icon name concatenations', () => {
    const iconExpr = buildCategoryIconExpression();
    expect(iconExpr).toEqual(['concat', CATEGORY_ICON_PREFIX, ['get', 'category']]);
  });

  it('provides vector SVG glyph paths for all 10 POI categories', () => {
    for (const cat of ALL_CATEGORIES) {
      expect(CATEGORY_ICON_PATHS).toHaveProperty(cat);
      const pathSnippet = CATEGORY_ICON_PATHS[cat];
      expect(pathSnippet.length).toBeGreaterThan(10);
      expect(pathSnippet).toContain('<path');
      expect(pathSnippet).toContain('fill="#ffffff"');
    }
  });

  it('generates well-formed SVG marker badges with category colors', () => {
    for (const cat of ALL_CATEGORIES) {
      const svg = getCategoryMarkerSvg(cat);
      expect(svg.startsWith('<svg')).toBe(true);
      expect(svg.endsWith('</svg>')).toBe(true);
      expect(svg).toContain(`viewBox="0 0 48 48"`);
      expect(svg).toContain(`fill="${CATEGORY_META[cat].color}"`);
      expect(svg).toContain(CATEGORY_ICON_PATHS[cat]);
    }
  });

  it('supports custom color overrides when generating marker SVGs', () => {
    const customSvg = getCategoryMarkerSvg('restaurant', '#10b981');
    expect(customSvg).toContain('fill="#10b981"');
    expect(customSvg).toContain(CATEGORY_ICON_PATHS.restaurant);
  });

  it('handles registerCategoryImages safely in mock/headless environment', async () => {
    const mockMap = {
      hasImage: () => false,
      addImage: () => {},
    };
    // Should resolve without throwing in Node/JSDOM test runner
    await expect(registerCategoryImages(mockMap)).resolves.not.toThrow();
  });

  it('defines valid icon size multipliers for all presets', () => {
    expect(ICON_SIZE_MULTIPLIERS.small).toBe(0.9);
    expect(ICON_SIZE_MULTIPLIERS.medium).toBe(1.2);
    expect(ICON_SIZE_MULTIPLIERS.large).toBe(1.55);
    expect(ICON_SIZE_MULTIPLIERS['extra-large']).toBe(1.95);
  });

  it('ensures all 10 category badge colors meet WCAG AA contrast against white glyphs (>= 4.5:1)', () => {
    function srgbToLin(c: number): number {
      const norm = c / 255;
      return norm <= 0.04045 ? norm / 12.92 : Math.pow((norm + 0.055) / 1.055, 2.4);
    }
    function luminance(hex: string): number {
      const clean = hex.replace('#', '');
      const r = parseInt(clean.substring(0, 2), 16);
      const g = parseInt(clean.substring(2, 4), 16);
      const b = parseInt(clean.substring(4, 6), 16);
      return 0.2126 * srgbToLin(r) + 0.7152 * srgbToLin(g) + 0.0722 * srgbToLin(b);
    }
    function contrastRatio(hex1: string, hex2: string): number {
      const l1 = luminance(hex1);
      const l2 = luminance(hex2);
      const lighter = Math.max(l1, l2);
      const darker = Math.min(l1, l2);
      return (lighter + 0.05) / (darker + 0.05);
    }

    for (const cat of ALL_CATEGORIES) {
      const color = CATEGORY_META[cat].color;
      const ratio = contrastRatio(color, '#ffffff');
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('supports MapManager icon size state updates and layer property configuration', () => {
    const container = document.createElement('div');
    const mockMapInstance: any = {
      on: vi.fn(),
      getLayer: vi.fn((id: string) => true),
      getSource: vi.fn(() => true),
      setLayoutProperty: vi.fn(),
      setPaintProperty: vi.fn(),
      setFilter: vi.fn(),
      addSource: vi.fn(),
      addLayer: vi.fn(),
    };

    const manager = new MapManager(container);
    // Directly inject mock map and mark loaded for headless unit testing
    (manager as any).map = mockMapInstance;
    (manager as any).isLoaded = true;

    expect(manager.getIconSize()).toBe('extra-large');

    manager.setIconSize('large');
    expect(manager.getIconSize()).toBe('large');
    expect(mockMapInstance.setLayoutProperty).toHaveBeenCalledWith(
      'pois-symbol',
      'icon-size',
      expect.arrayContaining(['interpolate', ['linear'], ['zoom']])
    );
    expect(mockMapInstance.setPaintProperty).toHaveBeenCalledWith(
      'pois-circle',
      'circle-radius',
      expect.arrayContaining(['interpolate', ['linear'], ['zoom']])
    );

    manager.setIconSize('small');
    expect(manager.getIconSize()).toBe('small');

    manager.setIconSize('extra-large');
    expect(manager.getIconSize()).toBe('extra-large');
  });

  it('renders isochrones with high-contrast paint opacities, boundary lines, and Noto Sans Regular fontstack', () => {
    const container = document.createElement('div');
    const addedLayers: any[] = [];
    const addedLayerBeforeIds: (string | undefined)[] = [];
    const mockMapInstance: any = {
      on: vi.fn(),
      getLayer: vi.fn((id: string) => (id === 'pois-circle' ? true : false)),
      getSource: vi.fn(() => false),
      setLayoutProperty: vi.fn(),
      setPaintProperty: vi.fn(),
      setFilter: vi.fn(),
      addSource: vi.fn(),
      addLayer: vi.fn((layer: any, beforeId?: string) => {
        addedLayers.push(layer);
        addedLayerBeforeIds.push(beforeId);
      }),
    };

    const manager = new MapManager(container);
    (manager as any).map = mockMapInstance;
    (manager as any).isLoaded = true;

    const mockRegion: any = {
      name: 'Sacramento Convention Center',
      center: [-121.489857, 38.579250],
      isochrones: [
        { minutes: 5, color: '#2b83ba', fillColor: '#2b83ba', label: '5 min' },
        { minutes: 10, color: '#64abb0', fillColor: '#64abb0', label: '10 min' },
        { minutes: 15, color: '#9dd3a7', fillColor: '#9dd3a7', label: '15 min' },
      ],
      geojson: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [-121.489857, 38.579250] },
            properties: { label: 'Center' },
          },
          {
            type: 'Feature',
            geometry: { type: 'Polygon', coordinates: [[[0, 0], [0, 1], [1, 1], [0, 0]]] },
            properties: { value: 300, color: '#2b83ba', fillColor: '#2b83ba', label: '  5 min ' },
          },
          {
            type: 'Feature',
            geometry: { type: 'Polygon', coordinates: [[[0, 0], [0, 2], [2, 2], [0, 0]]] },
            properties: { value: 600, color: '#64abb0', fillColor: '#64abb0', label: '  10 min ' },
          },
          {
            type: 'Feature',
            geometry: { type: 'Polygon', coordinates: [[[0, 0], [0, 3], [3, 3], [0, 0]]] },
            properties: { value: 900, color: '#9dd3a7', fillColor: '#9dd3a7', label: '  15 min ' },
          },
        ],
      },
    };

    manager.renderIsochrones(mockRegion);

    // Verify source was added
    expect(mockMapInstance.addSource).toHaveBeenCalledWith(
      'isochrones-source',
      expect.objectContaining({
        type: 'geojson',
        data: expect.objectContaining({
          type: 'FeatureCollection',
          features: expect.arrayContaining([
            expect.objectContaining({ properties: expect.objectContaining({ value: 300, label: '5 min' }) }),
            expect.objectContaining({ properties: expect.objectContaining({ value: 600, label: '10 min' }) }),
            expect.objectContaining({ properties: expect.objectContaining({ value: 900, label: '15 min' }) }),
          ]),
        }),
      })
    );

    // Check layer configurations
    const fillLayer = addedLayers.find((l) => l.id === 'isochrones-fill');
    expect(fillLayer).toBeDefined();
    expect(fillLayer.type).toBe('fill');
    expect(fillLayer.paint['fill-opacity']).toEqual([
      'match',
      ['get', 'value'],
      300,
      0.28,
      600,
      0.22,
      900,
      0.18,
      ['coalesce', ['get', 'fillOpacity'], 0.24],
    ]);

    const lineLayer = addedLayers.find((l) => l.id === 'isochrones-line');
    expect(lineLayer).toBeDefined();
    expect(lineLayer.type).toBe('line');
    expect(lineLayer.paint['line-width']).toBe(2.5);
    expect(lineLayer.paint['line-opacity']).toBe(0.85);

    const labelsLayer = addedLayers.find((l) => l.id === 'isochrones-labels');
    expect(labelsLayer).toBeDefined();
    expect(labelsLayer.type).toBe('symbol');
    expect(labelsLayer.layout['text-font']).toEqual(['Noto Sans Regular']);
    expect(labelsLayer.layout).toMatchObject({
      'symbol-placement': 'line',
      'symbol-spacing': 300,
      'text-max-angle': 30,
      'text-keep-upright': true,
      'text-rotation-alignment': 'map',
      'text-padding': 4,
      'text-size': 13,
    });
    expect(labelsLayer.layout).not.toHaveProperty('text-anchor');
    expect(labelsLayer.layout).not.toHaveProperty('text-offset');
    expect(labelsLayer.paint['text-color']).toBe('#1e293b');
    expect(labelsLayer.paint['text-halo-color']).toBe('#ffffff');
    expect(labelsLayer.paint['text-halo-width']).toBe(3);

    // Check layer insertion beneath POI markers
    expect(addedLayerBeforeIds).toEqual(['pois-circle', 'pois-circle', 'pois-circle']);
  });

  it('safely updates visibility of all isochrone layers on toggling', () => {
    const container = document.createElement('div');
    const mockMapInstance: any = {
      on: vi.fn(),
      getLayer: vi.fn((id: string) =>
        ['isochrones-fill', 'isochrones-line', 'isochrones-labels'].includes(id)
      ),
      getSource: vi.fn(() => true),
      setLayoutProperty: vi.fn(),
      setPaintProperty: vi.fn(),
      setFilter: vi.fn(),
      addSource: vi.fn(),
      addLayer: vi.fn(),
    };

    const manager = new MapManager(container);
    (manager as any).map = mockMapInstance;
    (manager as any).isLoaded = true;

    manager.setIsochronesVisible(false);
    expect(manager.getIsochronesVisible()).toBe(false);
    expect(mockMapInstance.setLayoutProperty).toHaveBeenCalledWith('isochrones-fill', 'visibility', 'none');
    expect(mockMapInstance.setLayoutProperty).toHaveBeenCalledWith('isochrones-line', 'visibility', 'none');
    expect(mockMapInstance.setLayoutProperty).toHaveBeenCalledWith('isochrones-labels', 'visibility', 'none');

    manager.setIsochronesVisible(true);
    expect(manager.getIsochronesVisible()).toBe(true);
    expect(mockMapInstance.setLayoutProperty).toHaveBeenCalledWith('isochrones-fill', 'visibility', 'visible');
    expect(mockMapInstance.setLayoutProperty).toHaveBeenCalledWith('isochrones-line', 'visibility', 'visible');
    expect(mockMapInstance.setLayoutProperty).toHaveBeenCalledWith('isochrones-labels', 'visibility', 'visible');
  });

  it('carries runtime style layers and reapplies map state after the new style becomes idle', async () => {
    const container = document.createElement('div');
    const eventHandlers = new Map<string, (event?: any) => Promise<void>>();
    const mockMapInstance: any = {
      on: vi.fn(),
      once: vi.fn((event: string, handler: (event?: any) => Promise<void>) => {
        eventHandlers.set(event, handler);
      }),
      off: vi.fn(),
      setStyle: vi.fn(),
      hasImage: vi.fn(() => true),
      addImage: vi.fn(),
      getLayer: vi.fn(() => true),
      getSource: vi.fn(() => null),
      addSource: vi.fn(),
      addLayer: vi.fn(),
      setFilter: vi.fn(),
      setPaintProperty: vi.fn(),
      setLayoutProperty: vi.fn(),
    };

    const manager = new MapManager(container);
    (manager as any).map = mockMapInstance;
    (manager as any).isLoaded = true;

    const samplePOIs: any = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [-121.49, 38.58] },
          properties: { id: 'poi-1', name: 'Test Coffee', category: 'coffee_tea' },
        },
      ],
    };
    const sampleRegion: any = {
      name: 'Sacramento',
      center: [-121.49, 38.58],
      geojson: { type: 'FeatureCollection', features: [] },
    };
    const filterExpression = ['==', ['get', 'category'], 'coffee_tea'];

    (manager as any).poiData = samplePOIs;
    (manager as any).region = sampleRegion;
    manager.applyFilter(filterExpression);
    manager.updateFavorites(new Set(['poi-1']));
    manager.setSelectedPOI('poi-1');

    const renderPOIsSpy = vi.spyOn(manager, 'renderPOIs');
    const renderIsochronesSpy = vi.spyOn(manager, 'renderIsochrones');
    const applyFilterSpy = vi.spyOn(manager, 'applyFilter');
    const updateFavoritesSpy = vi.spyOn(manager, 'updateFavorites');
    const setSelectedPoiSpy = vi.spyOn(manager, 'setSelectedPOI');

    const styleChange = manager.setBasemapStyle('bright');
    expect(mockMapInstance.setStyle).toHaveBeenCalledWith(
      BASEMAP_STYLES.bright.url,
      expect.objectContaining({ transformStyle: carryOverAppLayers })
    );

    const idleHandler = eventHandlers.get('idle');
    expect(idleHandler).toBeDefined();
    await idleHandler?.();
    await styleChange;

    expect(renderPOIsSpy).toHaveBeenCalledWith(samplePOIs);
    expect(renderIsochronesSpy).toHaveBeenCalledWith(sampleRegion);
    expect(applyFilterSpy).toHaveBeenCalledWith(filterExpression);
    expect(updateFavoritesSpy).toHaveBeenCalledWith(new Set(['poi-1']));
    expect(setSelectedPoiSpy).toHaveBeenCalledWith('poi-1');
  });

  it('ignores stale restore handlers after a more recent basemap switch', async () => {
    const container = document.createElement('div');
    const idleHandlers: Array<(event?: any) => Promise<void>> = [];
    const mockMapInstance: any = {
      on: vi.fn(),
      once: vi.fn((event: string, handler: (event?: any) => Promise<void>) => {
        if (event === 'idle') idleHandlers.push(handler);
      }),
      off: vi.fn(),
      setStyle: vi.fn(),
      hasImage: vi.fn(() => true),
      addImage: vi.fn(),
      getLayer: vi.fn(() => true),
      getSource: vi.fn(() => null),
      addSource: vi.fn(),
      addLayer: vi.fn(),
      setFilter: vi.fn(),
      setPaintProperty: vi.fn(),
      setLayoutProperty: vi.fn(),
    };
    const manager = new MapManager(container);
    (manager as any).map = mockMapInstance;
    (manager as any).isLoaded = true;
    (manager as any).poiData = { type: 'FeatureCollection', features: [] };
    const renderPOIsSpy = vi.spyOn(manager, 'renderPOIs');

    const firstSwitch = manager.setBasemapStyle('bright');
    const staleIdleHandler = idleHandlers[0];
    const latestSwitch = manager.setBasemapStyle('liberty');
    const latestIdleHandler = idleHandlers[1];

    await staleIdleHandler();
    expect(renderPOIsSpy).not.toHaveBeenCalled();
    await latestIdleHandler();
    await Promise.all([firstSwitch, latestSwitch]);

    expect(renderPOIsSpy).toHaveBeenCalledTimes(1);
  });

  it('uses the initial load handler when a basemap is selected before the map loads', () => {
    const container = document.createElement('div');
    const mockMapInstance: any = {
      on: vi.fn(),
      once: vi.fn(),
      off: vi.fn(),
      setStyle: vi.fn(),
    };
    const manager = new MapManager(container);
    (manager as any).map = mockMapInstance;
    (manager as any).isLoaded = false;

    manager.setBasemapStyle('bright');

    expect(mockMapInstance.setStyle).toHaveBeenCalledWith(BASEMAP_STYLES.bright.url);
    expect(mockMapInstance.once).not.toHaveBeenCalled();
  });

  it('adds only missing POI and isochrone layers when their sources already exist', () => {
    const container = document.createElement('div');
    const layerIds = new Set(['pois-favorites-halo', 'pois-circle']);
    const poiSource = { setData: vi.fn() };
    const isochroneSource = { setData: vi.fn() };
    const sources: Record<string, any> = {
      'pois-source': poiSource,
      'isochrones-source': isochroneSource,
    };
    const addedLayers: any[] = [];
    const mockMapInstance: any = {
      on: vi.fn(),
      getLayer: vi.fn((id: string) => layerIds.has(id)),
      getSource: vi.fn((id: string) => sources[id] || null),
      addSource: vi.fn((id: string, source: any) => { sources[id] = source; }),
      addLayer: vi.fn((layer: any) => {
        layerIds.add(layer.id);
        addedLayers.push(layer);
      }),
      setFilter: vi.fn(),
      setLayoutProperty: vi.fn(),
      setPaintProperty: vi.fn(),
    };
    const manager = new MapManager(container);
    (manager as any).map = mockMapInstance;
    (manager as any).isLoaded = true;
    const samplePOIs: any = { type: 'FeatureCollection', features: [] };
    const sampleRegion: any = {
      name: 'Sacramento',
      center: [-121.49, 38.58],
      geojson: { type: 'FeatureCollection', features: [] },
    };

    manager.renderPOIs(samplePOIs);
    manager.renderIsochrones(sampleRegion);
    manager.renderPOIs(samplePOIs);
    manager.renderIsochrones(sampleRegion);

    const addedLayerIds = addedLayers.map((layer) => layer.id);
    expect(addedLayerIds).toEqual([
      'pois-symbol',
      'pois-selection-ring',
      'isochrones-fill',
      'isochrones-line',
      'isochrones-labels',
    ]);
    expect(new Set(addedLayerIds).size).toBe(addedLayerIds.length);
    expect(poiSource.setData).toHaveBeenCalledTimes(2);
    expect(isochroneSource.setData).toHaveBeenCalledTimes(2);
  });

  it('initializes MapManager with defaultBasemap from APP_CONFIG', () => {
    const container = document.createElement('div');
    const manager = new MapManager(container);
    expect(manager.getBasemapStyle()).toBe('positron');
  });
});
