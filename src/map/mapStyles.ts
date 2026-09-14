/**
 * MapLibre GL styles, color palettes, vector icons, and layer configurations for ConferenceWalker.
 */

import { StyleSpecification } from 'maplibre-gl';
import { POICategory, CATEGORY_META } from '../types/poi';

/**
 * OpenFreeMap Positron basemap style URL.
 * Free, open-source vector tile service providing high contrast, clean typography,
 * and zero API keys or rate limits, ideal for walkshed and POI visualization.
 */
export const OPENFREEMAP_POSITRON_STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';

/**
 * Default active basemap style for ConferenceWalker (OpenFreeMap Positron).
 */
export const DEFAULT_MAP_STYLE: string = OPENFREEMAP_POSITRON_STYLE_URL;

/**
 * Muted, high-contrast Carto Positron raster basemap fallback.
 */
export const CARTO_POSITRON_RASTER_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    'carto-positron': {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
        'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
        'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="https://carto.com/attributions">CARTO</a>',
    },
  },
  layers: [
    {
      id: 'carto-positron-layer',
      type: 'raster',
      source: 'carto-positron',
      minzoom: 0,
      maxzoom: 20,
    },
  ],
};

/**
 * Prefix for registered category vector icon image keys in MapLibre.
 */
export const CATEGORY_ICON_PREFIX = 'marker-';

/**
 * Crisp SVG vector icon paths for each of the 10 POI categories.
 * Each glyph is designed for a 48x48 viewport centered at (24, 24).
 */
export const CATEGORY_ICON_PATHS: Record<POICategory, string> = {
  restaurant:
    '<path d="M16 13v9c0 1.5 1 2.7 2.5 3v9h2v-9c1.5-.3 2.5-1.5 2.5-3v-9h-1.5v6h-1.2v-6h-1.6v6H17.5v-6H16zm12 0c-1 0-2 .8-2 2v6h2v13h2V13h-2z" fill="#ffffff"/>',
  coffee_tea:
    '<path d="M15 17h14v10c0 3.3-2.7 6-6 6h-2c-3.3 0-6-2.7-6-6V17zm14 3h2c1.7 0 3 1.3 3 3s-1.3 3-3 3h-2v-6zM13 35h18v2H13z" fill="#ffffff"/><path d="M18 11c1 1 1 2 0 3m4-3c1 1 1 2 0 3m4-3c1 1 1 2 0 3" stroke="#ffffff" stroke-width="1.5" fill="none" stroke-linecap="round"/>',
  bar:
    '<path d="M14 14l10 11v7h-4v2h16v-2h-4v-7l10-11H14zm5.5 3h17l-2.7 3h-11.6l-2.7-3z" fill="#ffffff"/>',
  convenience_pharmacy:
    '<path d="M20 13h8v7h7v8h-7v7h-8v-7h-7v-8h7z" fill="#ffffff"/>',
  parking:
    '<path d="M18 13h8c3.9 0 7 2.7 7 6s-3.1 6-7 6h-4v10h-4V13zm4 4v4h4c1.7 0 3-.9 3-2s-1.3-2-3-2h-4z" fill="#ffffff"/>',
  transit:
    '<path d="M16 13c-1.7 0-3 1.3-3 3v13c0 2 1.3 3.6 3 3.9V35c0 .6.4 1 1 1h1c.6 0 1-.4 1-1v-2h10v2c0 .6.4 1 1 1h1c.6 0 1-.4 1-1v-2.1c1.7-.3 3-1.9 3-3.9V16c0-1.7-1.3-3-3-3H16zm0 4h14v7H16v-7zm2 10c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm10 0c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2z" fill="#ffffff"/>',
  hotel:
    '<path d="M14 16v19h3v-4h14v4h3V23c0-3.9-3.1-7-7-7h-6v-2h-7zm3 5a3 3 0 110 6 3 3 0 010-6zm7 2h7c1.7 0 3 1.3 3 3v1H24v-4z" fill="#ffffff"/>',
  attraction_art:
    '<path d="M24 13c-6.6 0-12 5.1-12 11.4 0 4.2 3.2 6.6 5.5 6.6 1.4 0 2.2-.7 2.2-1.9 0-.8-.3-1.5-.3-2.3 0-1.7 1.4-3.1 3.1-3.1h2.5c4.7 0 8.5-3.8 8.5-8.5C33.5 14.6 29.2 13 24 13zm-6 7.5a1.8 1.8 0 110-3.6 1.8 1.8 0 010 3.6zm4.5-2a1.8 1.8 0 110-3.6 1.8 1.8 0 010 3.6zm5 1a1.8 1.8 0 110-3.6 1.8 1.8 0 010 3.6zm3 4.5a1.8 1.8 0 110-3.6 1.8 1.8 0 010 3.6z" fill="#ffffff"/>',
  park_outdoors:
    '<path d="M24 12l-7 10h4l-5 8h6v5h4v-5h6l-5-8h4z" fill="#ffffff"/>',
  grocery:
    '<path d="M13 14h3l3.6 13h11.8l3.1-9H18.5v-2h16.2c.7 0 1.3.5 1.5 1.1l3.5 10.4c.2.6-.2 1.3-.9 1.5h-16l-.8 2h14v2H19c-.8 0-1.5-.5-1.8-1.2L13.5 16H13v-2zm7 20a2.5 2.5 0 110 5 2.5 2.5 0 010-5zm10 0a2.5 2.5 0 110 5 2.5 2.5 0 010-5z" fill="#ffffff"/>',
};

/**
 * Generates an SVG string of a vector marker badge with the category's theme color,
 * crisp white perimeter outline, and white interior glyph icon.
 *
 * @param category The POI category
 * @param color Optional override for the badge background color
 * @returns Complete, well-formed SVG string
 */
export function getCategoryMarkerSvg(category: POICategory, color?: string): string {
  const badgeColor = color || CATEGORY_META[category]?.color || '#64748b';
  const iconPath = CATEGORY_ICON_PATHS[category] || '';

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">` +
    `<circle cx="24" cy="24" r="22" fill="none" stroke="rgba(15,23,42,0.22)" stroke-width="2"/>` +
    `<circle cx="24" cy="24" r="21" fill="${badgeColor}" stroke="#ffffff" stroke-width="2.5"/>` +
    `${iconPath}` +
    `</svg>`
  );
}

/**
 * Builds a MapLibre match expression mapping category strings to their designated hex color.
 */
export function buildCategoryColorExpression(): any[] {
  const expression: any[] = ['match', ['get', 'category']];
  const categories = Object.keys(CATEGORY_META) as POICategory[];

  for (const cat of categories) {
    expression.push(cat, CATEGORY_META[cat].color);
  }
  // Default fallback color
  expression.push('#64748b');

  return expression;
}

/**
 * Builds a MapLibre string expression resolving each POI's marker icon key in the sprite atlas.
 */
export function buildCategoryIconExpression(): any[] {
  return ['concat', CATEGORY_ICON_PREFIX, ['get', 'category']];
}

/**
 * Registers SVG vector marker icons for all 10 categories into the MapLibre map instance.
 * Ensures icons are rasterized into the GPU texture atlas with 2x pixel ratio for retina sharpness.
 */
export async function registerCategoryImages(map: any): Promise<void> {
  if (typeof window === 'undefined' || typeof Image === 'undefined') {
    return;
  }

  const categories = Object.keys(CATEGORY_META) as POICategory[];
  const promises = categories.map((cat) => {
    const iconId = `${CATEGORY_ICON_PREFIX}${cat}`;
    if (map.hasImage && map.hasImage(iconId)) {
      return Promise.resolve();
    }

    const svg = getCategoryMarkerSvg(cat, CATEGORY_META[cat].color);
    return new Promise<void>((resolve) => {
      let settled = false;
      const done = () => {
        if (!settled) {
          settled = true;
          resolve();
        }
      };

      const img = new Image(48, 48);
      img.onload = () => {
        try {
          if (map.hasImage && !map.hasImage(iconId)) {
            map.addImage(iconId, img, { pixelRatio: 2 });
          }
        } catch {
          // Gracefully ignore duplicate registration race conditions
        }
        done();
      };
      img.onerror = () => {
        done();
      };

      // In JSDOM or headless environments where data URL image loading is not simulated,
      // resolve promptly so execution and test suites are never hung.
      setTimeout(done, 50);

      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    });
  });

  await Promise.all(promises);
}

/**
 * Default initial map coordinates and zoom for Sacramento Convention Center.
 */
export const SACRAMENTO_FALLBACK_CENTER: [number, number] = [-121.489857, 38.579250];
export const DEFAULT_ZOOM = 14.5;
