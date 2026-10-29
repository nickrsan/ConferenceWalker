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
import { MapManager, ICON_SIZE_MULTIPLIERS } from '../src/map/mapManager';

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
    expect(ICON_SIZE_MULTIPLIERS.small).toBe(0.75);
    expect(ICON_SIZE_MULTIPLIERS.medium).toBe(1.0);
    expect(ICON_SIZE_MULTIPLIERS.large).toBe(1.3);
    expect(ICON_SIZE_MULTIPLIERS['extra-large']).toBe(1.65);
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
            properties: { value: 300, color: '#2b83ba', fillColor: '#2b83ba', label: '5 min' },
          },
          {
            type: 'Feature',
            geometry: { type: 'Polygon', coordinates: [[[0, 0], [0, 2], [2, 2], [0, 0]]] },
            properties: { value: 600, color: '#64abb0', fillColor: '#64abb0', label: '10 min' },
          },
          {
            type: 'Feature',
            geometry: { type: 'Polygon', coordinates: [[[0, 0], [0, 3], [3, 3], [0, 0]]] },
            properties: { value: 900, color: '#9dd3a7', fillColor: '#9dd3a7', label: '15 min' },
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
            expect.objectContaining({ properties: expect.objectContaining({ value: 300 }) }),
            expect.objectContaining({ properties: expect.objectContaining({ value: 600 }) }),
            expect.objectContaining({ properties: expect.objectContaining({ value: 900 }) }),
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
});
