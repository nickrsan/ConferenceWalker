import { describe, it, expect } from 'vitest';
import {
  buildCategoryColorExpression,
  buildCategoryIconExpression,
  DEFAULT_MAP_STYLE,
  OPENFREEMAP_POSITRON_STYLE_URL,
  CARTO_POSITRON_RASTER_STYLE,
  SACRAMENTO_FALLBACK_CENTER,
  DEFAULT_ZOOM,
  CATEGORY_ICON_PREFIX,
  CATEGORY_ICON_PATHS,
  getCategoryMarkerSvg,
  registerCategoryImages,
} from '../src/map/mapStyles';
import { ALL_CATEGORIES, CATEGORY_META, POICategory } from '../src/types/poi';

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
});
