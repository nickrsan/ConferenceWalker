import { describe, expect, it } from 'vitest';
import { FilterStore } from '../src/state/filterState';
import { POIFeature } from '../src/types/poi';
import { WalkDistanceFilterComponent } from '../src/ui/walkDistanceFilter';

describe('WalkDistanceFilterComponent', () => {
  it('counts a missing walk-time key as outside the configured isochrones', () => {
    const container = document.createElement('div');
    const sparsePoi = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-121.49, 38.58] },
      properties: { id: 'sparse', name: 'Sparse Venue', category: 'restaurant' },
    } as unknown as POIFeature;
    const outsidePoi = {
      ...sparsePoi,
      properties: { ...sparsePoi.properties, id: 'outside', walk_time_minutes: null },
    };
    const zeroMinutePoi = {
      ...sparsePoi,
      properties: { ...sparsePoi.properties, id: 'zero', walk_time_minutes: 0 },
    } as unknown as POIFeature;
    const component = new WalkDistanceFilterComponent(container, new FilterStore());

    component.setData([sparsePoi, outsidePoi, zeroMinutePoi], new Set());

    expect(container.querySelector('[data-tier="outside"] .walk-tier-subtext')?.textContent).toContain('(2)');
  });
});