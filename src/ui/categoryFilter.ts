/**
 * Category filter UI component for ConferenceWalker.
 * Renders interactive category buttons with icons, colors, and live counts.
 */

import { POICategory, ALL_CATEGORIES, CATEGORY_META, POIFeature } from '../types/poi';
import { FilterStore } from '../state/filterState';

export class CategoryFilterComponent {
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

    // Calculate count per category
    const counts: Record<string, number> = {};
    for (const cat of ALL_CATEGORIES) {
      counts[cat] = 0;
    }
    for (const f of this.allFeatures) {
      const c = f.properties.category;
      if (c in counts) {
        counts[c]++;
      }
    }

    this.container.innerHTML = `
      <div class="filter-section-header">
        <span class="filter-title">Categories</span>
        <div class="filter-actions">
          <button type="button" class="btn-text-action" id="btn-select-all-cats">All</button>
          <span class="action-divider">|</span>
          <button type="button" class="btn-text-action" id="btn-clear-cats">None</button>
        </div>
      </div>
      <div class="category-grid" role="group" aria-label="POI Categories">
        ${ALL_CATEGORIES.map((cat) => {
          const meta = CATEGORY_META[cat];
          const isSelected = state.categories.has(cat);
          const count = counts[cat] || 0;
          return `
            <button
              type="button"
              class="category-chip ${isSelected ? 'selected' : 'unselected'}"
              data-category="${cat}"
              style="--cat-color: ${meta.color}"
              aria-pressed="${isSelected}"
            >
              <span class="cat-icon" aria-hidden="true">${meta.icon}</span>
              <span class="cat-label">${meta.label}</span>
              <span class="cat-count">${count}</span>
            </button>
          `;
        }).join('')}
      </div>
    `;

    // Attach listeners
    this.container.querySelectorAll('.category-chip').forEach((button) => {
      button.addEventListener('click', (e) => {
        const cat = (e.currentTarget as HTMLElement).getAttribute('data-category') as POICategory;
        if (cat) {
          this.filterStore.toggleCategory(cat, this.allFeatures, this.favoriteIds);
          this.render();
        }
      });
    });

    const selectAllBtn = this.container.querySelector('#btn-select-all-cats');
    selectAllBtn?.addEventListener('click', () => {
      this.filterStore.setAllCategories(this.allFeatures, this.favoriteIds);
      this.render();
    });

    const clearBtn = this.container.querySelector('#btn-clear-cats');
    clearBtn?.addEventListener('click', () => {
      this.filterStore.clearCategories(this.allFeatures, this.favoriteIds);
      this.render();
    });
  }
}
