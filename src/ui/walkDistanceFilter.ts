/**
 * Walk distance filter UI component for ConferenceWalker.
 * Controls attendee walking tolerance tiers (5 min, 10 min, 15 min, >15 min).
 */

import { FilterStore } from '../state/filterState';
import { POIFeature } from '../types/poi';

interface WalkTierConfig {
  key: number | 'outside';
  label: string;
  icon: string;
  sublabel: string;
}

const WALK_TIERS: WalkTierConfig[] = [
  { key: 5, label: '5 min', icon: '⚡', sublabel: '~400m' },
  { key: 10, label: '10 min', icon: '🚶', sublabel: '~800m' },
  { key: 15, label: '15 min', icon: '🚶‍♂️', sublabel: '~1.2km' },
  { key: 'outside', label: '> 15 min', icon: '🚴', sublabel: 'Farther' },
];

export class WalkDistanceFilterComponent {
  private container: HTMLElement;
  private filterStore: FilterStore;
  private allFeatures: POIFeature[] = [];
  private favoriteIds: Set<string> = new Set();

  constructor(container: HTMLElement, filterStore: FilterStore) {
    this.container = container;
    this.filterStore = filterStore;
  }

  public setData(allFeatures: POIFeature[], favoriteIds: Set<string>): void {
    this.allFeatures = allFeatures;
    this.favoriteIds = favoriteIds;
    this.render();
  }

  public render(): void {
    const state = this.filterStore.getState();

    // Calculate count per walk tier
    const counts: Record<string, number> = {
      '5': 0,
      '10': 0,
      '15': 0,
      'outside': 0,
    };

    for (const f of this.allFeatures) {
      const w = f.properties.walk_time_minutes;
      const keyStr = w !== null ? String(w) : 'outside';
      if (keyStr in counts) {
        counts[keyStr]++;
      }
    }

    this.container.innerHTML = `
      <div class="filter-section-header">
        <span class="filter-title">Walking Distance</span>
        <div class="filter-actions">
          <button type="button" class="btn-text-action" id="btn-walk-quick">≤ 10m</button>
          <span class="action-divider">|</span>
          <button type="button" class="btn-text-action" id="btn-walk-any">Any</button>
        </div>
      </div>
      <div class="walk-tier-selector" role="group" aria-label="Walk Distance Filter">
        ${WALK_TIERS.map((tier) => {
          const isSelected = state.allowedWalkTimes.has(tier.key);
          const count = counts[String(tier.key)] || 0;
          return `
            <button
              type="button"
              class="walk-tier-btn ${isSelected ? 'active' : 'inactive'}"
              data-tier="${tier.key}"
              aria-pressed="${isSelected}"
            >
              <span class="walk-tier-icon" aria-hidden="true">${tier.icon}</span>
              <span class="walk-tier-label">${tier.label}</span>
              <span class="walk-tier-subtext">${tier.sublabel} (${count})</span>
            </button>
          `;
        }).join('')}
      </div>
    `;

    // Click events for individual walk buttons
    this.container.querySelectorAll('.walk-tier-btn').forEach((button) => {
      button.addEventListener('click', (e) => {
        const rawTier = (e.currentTarget as HTMLElement).getAttribute('data-tier');
        const tierKey = rawTier === 'outside' ? 'outside' : parseInt(rawTier || '5', 10);
        this.filterStore.toggleWalkTime(tierKey, this.allFeatures, this.favoriteIds);
        this.render();
      });
    });

    // Preset: Quick walk (<= 10 min)
    this.container.querySelector('#btn-walk-quick')?.addEventListener('click', () => {
      this.filterStore.setAllowedWalkTimes([5, 10], this.allFeatures, this.favoriteIds);
      this.render();
    });

    // Preset: Any distance
    this.container.querySelector('#btn-walk-any')?.addEventListener('click', () => {
      this.filterStore.setAllowedWalkTimes([5, 10, 15, 'outside'], this.allFeatures, this.favoriteIds);
      this.render();
    });
  }
}
