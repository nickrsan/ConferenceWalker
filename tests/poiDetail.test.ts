import { describe, it, expect, beforeEach } from 'vitest';
import { POIDetailComponent } from '../src/ui/poiDetail';
import { FavoritesStore } from '../src/state/favorites';
import { DebugStore } from '../src/state/debugState';
import { POIFeature } from '../src/types/poi';

describe('POIDetailComponent', () => {
  let container: HTMLDivElement;
  let favoritesStore: FavoritesStore;
  let debugStore: DebugStore;
  let component: POIDetailComponent;
  const confCoords: [number, number] = [-121.489857, 38.579250];

  beforeEach(() => {
    localStorage.clear();
    container = document.createElement('div');
    favoritesStore = new FavoritesStore();
    debugStore = new DebugStore();
    component = new POIDetailComponent(container, favoritesStore, confCoords, {}, debugStore);
  });

  const baseFeature: POIFeature = {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [-121.49, 38.58],
    },
    properties: {
      id: 'poi_test_1',
      name: 'Midtown Grill & Lounge',
      category: 'restaurant',
      walk_time_minutes: 5,
      address: '1020 K Street, Sacramento',
      phone: '916-555-4321',
      website: 'https://midtowngrill.example.com',
      opening_hours: 'Mo-Fr 08:00-17:00; Sa 10:00-14:00; Su off',
      cuisines: ['american', 'burgers'],
      sources: ['osm', 'overture'],
      osm_id: 'node_123',
      overture_id: 'gers_456',
      reservation_url: 'https://resy.com/cities/sac/midtown-grill',
      order_url: 'https://toasttab.com/midtown-grill/order',
    },
  };

  it('renders weekly schedule line-by-line with bold current weekday', () => {
    component.show(baseFeature);

    const scheduleList = container.querySelector('.weekly-schedule-list');
    expect(scheduleList).not.toBeNull();

    const rows = container.querySelectorAll('.weekly-schedule-row');
    expect(rows.length).toBe(7);

    // Current day row should have .is-today class and strong bold elements
    const todayRow = container.querySelector('.weekly-schedule-row.is-today');
    expect(todayRow).not.toBeNull();
    expect(todayRow!.querySelector('strong')).not.toBeNull();

    // Verify day names are listed
    const textContent = scheduleList!.textContent || '';
    expect(textContent).toContain('Monday');
    expect(textContent).toContain('08:00 – 17:00');
    expect(textContent).toContain('Saturday');
    expect(textContent).toContain('10:00 – 14:00');
    expect(textContent).toContain('Sunday');
    expect(textContent).toContain('Closed');
  });

  it('renders online reservation icons, links, and action buttons when reservation_url is present', () => {
    component.show(baseFeature);

    // Header badge
    const resBadge = container.querySelector('.reservation-badge');
    expect(resBadge).not.toBeNull();
    expect(resBadge!.textContent).toContain('📅');
    expect(resBadge!.textContent).toContain('Reservations');
    expect(resBadge!.getAttribute('href')).toBe('https://resy.com/cities/sac/midtown-grill');

    // Body row link
    const resRow = container.querySelector('.reservation-row');
    expect(resRow).not.toBeNull();
    const resLink = resRow!.querySelector('a');
    expect(resLink!.getAttribute('href')).toBe('https://resy.com/cities/sac/midtown-grill');

    // Action button
    const resActionBtn = container.querySelector('.btn-reservation');
    expect(resActionBtn).not.toBeNull();
    expect(resActionBtn!.textContent).toContain('📅');
    expect(resActionBtn!.getAttribute('href')).toBe('https://resy.com/cities/sac/midtown-grill');
  });

  it('renders online ordering icons, links, and action buttons when order_url is present', () => {
    component.show(baseFeature);

    // Header badge
    const ordBadge = container.querySelector('.order-badge');
    expect(ordBadge).not.toBeNull();
    expect(ordBadge!.textContent).toContain('🛍️');
    expect(ordBadge!.textContent).toContain('Order Online');
    expect(ordBadge!.getAttribute('href')).toBe('https://toasttab.com/midtown-grill/order');

    // Body row link
    const ordRow = container.querySelector('.order-row');
    expect(ordRow).not.toBeNull();
    const ordLink = ordRow!.querySelector('a');
    expect(ordLink!.getAttribute('href')).toBe('https://toasttab.com/midtown-grill/order');

    // Action button
    const ordActionBtn = container.querySelector('.btn-order');
    expect(ordActionBtn).not.toBeNull();
    expect(ordActionBtn!.textContent).toContain('🛍️');
    expect(ordActionBtn!.getAttribute('href')).toBe('https://toasttab.com/midtown-grill/order');
  });

  it('omits reservation and order sections when URLs are not provided in source data', () => {
    const featureWithoutLinks: POIFeature = {
      ...baseFeature,
      properties: {
        ...baseFeature.properties,
        reservation_url: null,
        order_url: null,
      },
    };

    component.show(featureWithoutLinks);

    expect(container.querySelector('.reservation-badge')).toBeNull();
    expect(container.querySelector('.order-badge')).toBeNull();
    expect(container.querySelector('.reservation-row')).toBeNull();
    expect(container.querySelector('.order-row')).toBeNull();
    expect(container.querySelector('.btn-reservation')).toBeNull();
    expect(container.querySelector('.btn-order')).toBeNull();
  });
});
