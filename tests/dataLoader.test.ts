import { describe, it, expect } from 'vitest';
import {
  isValidCategory,
  parseAndValidatePOIs,
  extractAvailableCuisines,
} from '../src/services/dataLoader';
import { POIFeature, ALL_CATEGORIES } from '../src/types/poi';
import fs from 'fs';
import path from 'path';

describe('dataLoader service', () => {
  describe('isValidCategory', () => {
    it('returns true for all 10 valid categories', () => {
      for (const cat of ALL_CATEGORIES) {
        expect(isValidCategory(cat)).toBe(true);
      }
    });

    it('returns false for unrecognized categories or non-strings', () => {
      expect(isValidCategory('spaceship_rental')).toBe(false);
      expect(isValidCategory('')).toBe(false);
      expect(isValidCategory(null)).toBe(false);
      expect(isValidCategory(123)).toBe(false);
      expect(isValidCategory(undefined)).toBe(false);
    });
  });

  describe('parseAndValidatePOIs', () => {
    it('throws error for non-FeatureCollection input', () => {
      expect(() => parseAndValidatePOIs(null)).toThrow();
      expect(() => parseAndValidatePOIs({})).toThrow();
      expect(() => parseAndValidatePOIs({ type: 'Point' })).toThrow();
    });

    it('parses valid features and sanitizes properties', () => {
      const rawGeoJSON = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [-121.490, 38.579],
            },
            properties: {
              id: 'test_1',
              name: '  Temple Coffee  ',
              category: 'coffee_tea',
              walk_time_minutes: '5',
              address: ' 2829 S St ',
              phone: ' 916-555-0100 ',
              website: ' https://templecoffee.com ',
              opening_hours: ' Mo-Su 06:00-20:00 ',
              cuisines: ['coffee', 'bakery'],
              sources: ['osm', 'overture'],
              osm_id: '12345',
              overture_id: 'ov_67890',
            },
          },
        ],
      };

      const result = parseAndValidatePOIs(rawGeoJSON);
      expect(result.type).toBe('FeatureCollection');
      expect(result.features.length).toBe(1);

      const feat = result.features[0];
      expect(feat.geometry.coordinates).toEqual([-121.49, 38.579]);
      expect(feat.properties.id).toBe('test_1');
      expect(feat.properties.name).toBe('Temple Coffee');
      expect(feat.properties.category).toBe('coffee_tea');
      expect(feat.properties.walk_time_minutes).toBe(5);
      expect(feat.properties.address).toBe('2829 S St');
      expect(feat.properties.phone).toBe('916-555-0100');
      expect(feat.properties.website).toBe('https://templecoffee.com');
      expect(feat.properties.opening_hours).toBe('Mo-Su 06:00-20:00');
      expect(feat.properties.cuisines).toEqual(['coffee', 'bakery']);
      expect(feat.properties.sources).toEqual(['osm', 'overture']);
      expect(feat.properties.osm_id).toBe('12345');
      expect(feat.properties.overture_id).toBe('ov_67890');
    });

    it('skips features with invalid coordinates or non-point geometry', () => {
      const rawGeoJSON = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: ['not_a_number', 38.579],
            },
            properties: { id: 'bad_coord' },
          },
          {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: [[0, 0], [1, 1]],
            },
            properties: { id: 'bad_geom' },
          },
        ],
      };

      const result = parseAndValidatePOIs(rawGeoJSON);
      expect(result.features.length).toBe(0);
    });

    it('defaults unknown category to restaurant', () => {
      const rawGeoJSON = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [-121.49, 38.58],
            },
            properties: {
              id: 'unknown_cat',
              name: 'Mystery Diner',
              category: 'unknown_alien_food',
            },
          },
        ],
      };

      const result = parseAndValidatePOIs(rawGeoJSON);
      expect(result.features[0].properties.category).toBe('restaurant');
    });
  });

  describe('extractAvailableCuisines', () => {
    it('extracts unique, sorted cuisines across features', () => {
      const features: POIFeature[] = [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [0, 0] },
          properties: {
            id: '1',
            name: 'Pizzeria',
            category: 'restaurant',
            walk_time_minutes: 5,
            address: null,
            phone: null,
            website: null,
            opening_hours: null,
            cuisines: ['pizza', 'italian'],
            sources: ['osm'],
            osm_id: null,
            overture_id: null,
          },
        },
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [0, 0] },
          properties: {
            id: '2',
            name: 'Trattoria',
            category: 'restaurant',
            walk_time_minutes: 10,
            address: null,
            phone: null,
            website: null,
            opening_hours: null,
            cuisines: ['italian', 'pasta'],
            sources: ['overture'],
            osm_id: null,
            overture_id: null,
          },
        },
      ];

      const cuisines = extractAvailableCuisines(features);
      expect(cuisines).toEqual(['italian', 'pasta', 'pizza']);
    });
  });

  describe('Actual dataset validation', () => {
    it('successfully parses public/data/sacramento_pois.geojson', () => {
      const dataFilePath = path.resolve(__dirname, '../public/data/sacramento_pois.geojson');
      expect(fs.existsSync(dataFilePath)).toBe(true);

      const raw = JSON.parse(fs.readFileSync(dataFilePath, 'utf-8'));
      const parsed = parseAndValidatePOIs(raw);

      expect(parsed.features.length).toBeGreaterThan(1000);
      const cuisines = extractAvailableCuisines(parsed.features);
      expect(cuisines.length).toBeGreaterThan(5);
    });

    it('validates public/data/region.json contains active conference metadata', () => {
      const regionFilePath = path.resolve(__dirname, '../public/data/region.json');
      expect(fs.existsSync(regionFilePath)).toBe(true);

      const region = JSON.parse(fs.readFileSync(regionFilePath, 'utf-8'));
      expect(region.name).toBeTruthy();
      expect(Array.isArray(region.center)).toBe(true);
      expect(region.center.length).toBe(2);
      expect(region.isochrones.length).toBe(3);
    });
  });
});
