/**
 * POI detail card and drawer view for ConferenceWalker.
 * Displays formatted venue attributes, opening hours badge, clickable phone/website
 * links, favorite toggle, and walking directions launchers.
 */

import { POIFeature, CATEGORY_META } from '../types/poi';
import { evaluateOpeningHours, getOpeningBadge, parseWeeklySchedule } from '../utils/openingHours';
import { buildGraphHopperWalkingUrl, buildMobileDirectionsIntent, buildUniversalMapsUrl, buildCartesAppUrl } from '../utils/directions';
import { FavoritesStore } from '../state/favorites';
import { DebugStore } from '../state/debugState';
import { escapeHtml } from '../utils/escapeHtml';

export interface POIDetailEvents {
  onClose?: () => void;
  onFavoriteChange?: (poiId: string, isFav: boolean) => void;
}

export class POIDetailComponent {
  private container: HTMLElement;
  private favoritesStore: FavoritesStore;
  private debugStore: DebugStore;
  private conferenceCoords: [number, number];
  private currentPOI: POIFeature | null = null;
  private events: POIDetailEvents = {};
  private keydownListener: ((e: KeyboardEvent) => void) | null = null;

  constructor(
    container: HTMLElement,
    favoritesStore: FavoritesStore,
    conferenceCoords: [number, number],
    events?: POIDetailEvents,
    debugStore?: DebugStore
  ) {
    this.container = container;
    this.favoritesStore = favoritesStore;
    this.conferenceCoords = conferenceCoords;
    this.events = events || {};
    this.debugStore = debugStore || new DebugStore();
  }

  public setDebugStore(debugStore: DebugStore): void {
    this.debugStore = debugStore;
    if (this.currentPOI) {
      this.render();
    }
  }

  public setConferenceCoords(coords: [number, number]): void {
    this.conferenceCoords = coords;
  }

  public show(poi: POIFeature): void {
    this.currentPOI = poi;
    this.render();
    this.container.classList.add('visible');
    this.container.classList.remove('hidden');
    this.container.setAttribute('aria-label', `Venue details for ${poi.properties.name}`);

    // Manage keyboard accessibility (Escape to close, Tab trapping)
    this.detachKeyboardListener();
    this.keydownListener = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        this.hide();
      }
    };
    window.addEventListener('keydown', this.keydownListener);

    // Focus close button for screen reader context
    const closeBtn = this.container.querySelector('.btn-close-detail') as HTMLButtonElement | null;
    closeBtn?.focus();
  }

  public hide(): void {
    this.currentPOI = null;
    this.container.classList.remove('visible');
    this.container.classList.add('hidden');
    this.detachKeyboardListener();
    if (this.events.onClose) {
      this.events.onClose();
    }
  }

  private detachKeyboardListener(): void {
    if (this.keydownListener) {
      window.removeEventListener('keydown', this.keydownListener);
      this.keydownListener = null;
    }
  }

  public render(): void {
    if (!this.currentPOI) {
      this.container.innerHTML = '';
      return;
    }

    const props = this.currentPOI.properties;
    const coords = this.currentPOI.geometry.coordinates;
    const catMeta = CATEGORY_META[props.category];
    const isFav = this.favoritesStore.isFavorite(props.id);
    const address = props.address ?? null;
    const phone = props.phone ?? null;
    const website = props.website ?? null;
    const openingHours = props.opening_hours ?? null;
    const walkTime = props.walk_time_minutes ?? null;
    const description = props.description ?? null;
    const reservationUrl = props.reservation_url ?? null;
    const orderUrl = props.order_url ?? null;
    const osmId = props.osm_id ?? null;
    const overtureId = props.overture_id ?? null;
    const escapedDescription = description ? escapeHtml(description) : null;
    const openingStatus = evaluateOpeningHours(openingHours);
    const badge = getOpeningBadge(openingStatus);

    const graphHopperUrl = buildGraphHopperWalkingUrl(this.conferenceCoords, coords);
    const mobileIntentUrl = buildMobileDirectionsIntent(coords, props.name);
    const universalMapsUrl = buildUniversalMapsUrl(coords, props.name);
    const cartesAppUrl = buildCartesAppUrl(coords);

    const walkText = walkTime !== null ? `${walkTime} min walk` : '>15 min walk';
    const weeklySchedule = openingHours ? parseWeeklySchedule(openingHours) : null;

    const rawCuisines = props.cuisines ?? [];
    const cuisines: string[] = Array.isArray(rawCuisines)
      ? rawCuisines
      : typeof rawCuisines === 'string'
      ? (rawCuisines as string).split(',').map((s) => s.trim()).filter(Boolean)
      : [];

    const rawSources = props.sources ?? [];
    const sources: string[] = Array.isArray(rawSources)
      ? rawSources
      : typeof rawSources === 'string'
      ? (rawSources as string).split(',').map((s) => s.trim()).filter(Boolean)
      : ['osm'];

    this.container.innerHTML = `
      <div class="poi-detail-header" style="--cat-accent: ${catMeta.color}">
        <div class="poi-title-row">
          <div class="poi-category-badge" style="background-color: ${catMeta.color}">
            <span class="badge-icon">${catMeta.icon}</span>
            <span class="badge-label">${catMeta.label}</span>
          </div>
          <button type="button" class="btn-close-detail" aria-label="Close details">✕</button>
        </div>
        <h2 class="poi-name">${props.name}</h2>
        <div class="poi-status-row">
          <span class="status-badge ${badge.className}">${badge.text}</span>
          <span class="walk-badge">🚶 ${walkText}</span>
          ${
            reservationUrl
              ? `<a href="${reservationUrl}" target="_blank" rel="noopener noreferrer" class="service-badge reservation-badge" title="Online Reservations Available">📅 Reservations</a>`
              : ''
          }
          ${
            orderUrl
              ? `<a href="${orderUrl}" target="_blank" rel="noopener noreferrer" class="service-badge order-badge" title="Online Ordering Available">🛍️ Order Online</a>`
              : ''
          }
        </div>
      </div>

      <div class="poi-detail-body">
        ${
          address
            ? `
          <div class="detail-row">
            <span class="row-icon">📍</span>
            <span class="row-text">${address}</span>
          </div>
        `
            : ''
        }

        ${
          phone
            ? `
          <div class="detail-row">
            <span class="row-icon">📞</span>
            <a href="tel:${phone.replace(/[^0-9+]/g, '')}" class="row-link tap-target">
              ${phone}
            </a>
          </div>
        `
            : ''
        }

        ${
          website
            ? `
          <div class="detail-row">
            <span class="row-icon">🌐</span>
            <a href="${website}" target="_blank" rel="noopener noreferrer" class="row-link tap-target">
              ${website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
              <span class="external-icon" aria-hidden="true">↗</span>
            </a>
          </div>
        `
            : ''
        }

        ${
          escapedDescription
            ? `
          <div class="detail-row description-row">
            <span class="row-icon">📝</span>
            <div class="description-content">
              <p class="poi-description-text">${escapedDescription}</p>
            </div>
          </div>
        `
            : ''
        }

        ${
          reservationUrl
            ? `
          <div class="detail-row reservation-row">
            <span class="row-icon">📅</span>
            <a href="${reservationUrl}" target="_blank" rel="noopener noreferrer" class="row-link tap-target reservation-link">
              <span>Reserve Table Online</span>
              <span class="external-icon" aria-hidden="true">↗</span>
            </a>
          </div>
        `
            : ''
        }

        ${
          orderUrl
            ? `
          <div class="detail-row order-row">
            <span class="row-icon">🛍️</span>
            <a href="${orderUrl}" target="_blank" rel="noopener noreferrer" class="row-link tap-target order-link">
              <span>Order Food Online</span>
              <span class="external-icon" aria-hidden="true">↗</span>
            </a>
          </div>
        `
            : ''
        }

        ${
          weeklySchedule
            ? `
          <div class="detail-row hours-row">
            <span class="row-icon">🕒</span>
            <div class="hours-content">
              <div class="hours-title-row">
                <strong>Opening Hours</strong>
              </div>
              <ul class="weekly-schedule-list" aria-label="Weekly opening hours schedule">
                ${weeklySchedule.days
                  .map(
                    (day) => `
                  <li class="weekly-schedule-row ${day.isToday ? 'is-today' : ''}">
                    <span class="weekday-name">${day.isToday ? `<strong>${day.dayName}</strong>` : day.dayName}</span>
                    <span class="weekday-hours">${day.isToday ? `<strong>${day.hoursText}</strong>` : day.hoursText}</span>
                  </li>
                `
                  )
                  .join('')}
              </ul>
            </div>
          </div>
        `
            : openingHours
            ? `
          <div class="detail-row hours-row">
            <span class="row-icon">🕒</span>
            <div class="hours-content">
              <strong>Hours</strong>
              <div class="hours-schedule">${openingHours}</div>
            </div>
          </div>
        `
            : ''
        }

        ${
          cuisines.length > 0
            ? `
          <div class="detail-row cuisines-row">
            <span class="row-icon">🍴</span>
            <div class="cuisines-list">
              ${cuisines.map((c) => `<span class="cuisine-pill">${c.replace(/_/g, ' ')}</span>`).join('')}
            </div>
          </div>
        `
            : ''
        }

        <div class="detail-row source-row">
          <span class="source-tag">Sources: ${sources.join(', ').toUpperCase()}</span>
        </div>

        ${
          this.debugStore.isDebugMode()
            ? `
          <div class="detail-row debug-row">
            <span class="row-icon">🛠️</span>
            <div class="debug-ids-content">
              <div class="debug-id-item"><span class="debug-id-label">OSM ID:</span> <code class="debug-id-val">${osmId ?? 'None'}</code></div>
              <div class="debug-id-item"><span class="debug-id-label">GERS ID:</span> <code class="debug-id-val">${overtureId ?? 'None'}</code></div>
            </div>
          </div>
        `
            : ''
        }
      </div>

      <div class="poi-detail-actions">
        <button
          type="button"
          class="btn-favorite-toggle ${isFav ? 'active' : ''} tap-target"
          id="btn-fav-toggle"
          aria-pressed="${isFav}"
        >
          <span class="fav-icon">${isFav ? '★' : '☆'}</span>
          <span class="fav-label">${isFav ? 'Saved' : 'Save'}</span>
        </button>

        ${
          reservationUrl
            ? `
          <a
            href="${reservationUrl}"
            target="_blank"
            rel="noopener noreferrer"
            class="btn-action-directions btn-reservation tap-target"
          >
            📅 Reserve Table Online ↗
          </a>
        `
            : ''
        }

        ${
          orderUrl
            ? `
          <a
            href="${orderUrl}"
            target="_blank"
            rel="noopener noreferrer"
            class="btn-action-directions btn-order tap-target"
          >
            🛍️ Order Online ↗
          </a>
        `
            : ''
        }

        <a
          href="${graphHopperUrl}"
          target="_blank"
          rel="noopener noreferrer"
          class="btn-action-directions btn-walking tap-target"
        >
          🚶 Walking Directions
        </a>

        <a
          href="${cartesAppUrl}"
          target="_blank"
          rel="noopener noreferrer"
          class="btn-action-directions btn-cartes tap-target"
          title="Open location on Cartes.app"
        >
          🗺️ Open in Cartes.app ↗
        </a>

        <a
          href="${mobileIntentUrl}"
          class="btn-action-directions btn-mobile-maps tap-target"
          title="Open in native mapping app"
        >
          📱 Device Maps
        </a>
      </div>
    `;

    // Close button
    this.container.querySelector('.btn-close-detail')?.addEventListener('click', () => {
      this.hide();
    });

    // Favorite button
    this.container.querySelector('#btn-fav-toggle')?.addEventListener('click', () => {
      if (!this.currentPOI) return;
      const id = this.currentPOI.properties.id;
      const isNowFav = this.favoritesStore.toggleFavorite(id);
      this.render();
      if (this.events.onFavoriteChange) {
        this.events.onFavoriteChange(id, isNowFav);
      }
    });

    // Handle mobile maps fallback on desktop browsers
    const mobileLink = this.container.querySelector('.btn-mobile-maps') as HTMLAnchorElement | null;
    if (mobileLink) {
      mobileLink.addEventListener('click', (e) => {
        // If on desktop (not mobile user agent), fallback to Google Maps URL
        const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        if (!isMobile) {
          e.preventDefault();
          window.open(universalMapsUrl, '_blank', 'noopener,noreferrer');
        }
      });
    }
  }
}
