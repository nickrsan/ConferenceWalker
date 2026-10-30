import { describe, it, expect } from 'vitest';
import {
  generateSavedPoisJson,
  mergeExportedVenues,
  SavedPoisExportPayload,
} from '../src/utils/exportSaved';
import { POIFeature } from '../src/types/poi';

describe('exportSaved utility', () => {
  const samplePOIs: POIFeature[] = [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-121.49, 38.58] },
      properties: {
        id: 'poi_1',
        name: 'Historic Bakery',
        category: 'restaurant',
        walk_time_minutes: 5,
        address: '1010 J St',
        phone: null,
        website: null,
        opening_hours: null,
        cuisines: ['bakery'],
        sources: ['osm'],
        osm_id: '123',
        overture_id: null,
        description: 'Fresh sourdough breads and pastries baked daily.',
      },
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-121.48, 38.57] },
      properties: {
        id: 'poi_2',
        name: 'City Park',
        category: 'park_outdoors',
        walk_time_minutes: 10,
        address: '900 I St',
        phone: null,
        website: null,
        opening_hours: null,
        cuisines: [],
        sources: ['osm'],
        osm_id: '456',
        overture_id: null,
        description: null,
      },
    },
  ];

  it('generates export payload containing venue descriptions', () => {
    const favSet = new Set(['poi_1', 'poi_2']);
    const jsonString = generateSavedPoisJson(favSet, samplePOIs);
    const parsed: SavedPoisExportPayload = JSON.parse(jsonString);

    expect(parsed.count).toBe(2);
    expect(parsed.defaultSavedPois).toEqual(['poi_1', 'poi_2']);
    expect(parsed.venues).toBeDefined();
    expect(parsed.venues?.length).toBe(2);

    const venue1 = parsed.venues?.find((v) => v.id === 'poi_1');
    expect(venue1?.description).toBe('Fresh sourdough breads and pastries baked daily.');

    const venue2 = parsed.venues?.find((v) => v.id === 'poi_2');
    expect(venue2?.description).toBeNull();
  });

  it('merges descriptions from export payload into POI features without overwriting existing descriptions', () => {
    const payload: SavedPoisExportPayload = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      count: 2,
      defaultSavedPois: ['poi_1', 'poi_2'],
      venues: [
        {
          id: 'poi_1',
          name: 'Historic Bakery',
          category: 'restaurant',
          address: '1010 J St',
          walk_time_minutes: 5,
          description: 'Imported description for bakery',
        },
        {
          id: 'poi_2',
          name: 'City Park',
          category: 'park_outdoors',
          address: '900 I St',
          walk_time_minutes: 10,
          description: 'Lush green public park with shade trees and rose garden.',
        },
      ],
    };

    const targetPOIs: POIFeature[] = [
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [-121.49, 38.58] },
        properties: {
          id: 'poi_1',
          name: 'Historic Bakery',
          category: 'restaurant',
          walk_time_minutes: 5,
          address: '1010 J St',
          phone: null,
          website: null,
          opening_hours: null,
          cuisines: ['bakery'],
          sources: ['osm'],
          osm_id: '123',
          overture_id: null,
          description: 'Original bakery description',
        },
      },
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [-121.48, 38.57] },
        properties: {
          id: 'poi_2',
          name: 'City Park',
          category: 'park_outdoors',
          walk_time_minutes: 10,
          address: '900 I St',
          phone: null,
          website: null,
          opening_hours: null,
          cuisines: [],
          sources: ['osm'],
          osm_id: '456',
          overture_id: null,
          description: null,
        },
      },
    ];

    mergeExportedVenues(payload, targetPOIs);

    // Existing description should be preserved
    expect(targetPOIs[0].properties.description).toBe('Original bakery description');
    // Missing description should be merged from payload
    expect(targetPOIs[1].properties.description).toBe('Lush green public park with shade trees and rose garden.');
  });
});
