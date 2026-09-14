/**
 * Cuisine multi-select filter component for ConferenceWalker.
 * Allows filtering restaurants by cuisines dynamically extracted from the dataset.
 */

import { FilterStore } from '../state/filterState';
import { POIFeature } from '../types/poi';

export class CuisineFilterComponent {
  private container: HTMLElement;
  private filterStore: FilterStore;
  private availableCuisines: string[] = [];
  private allFeatures: POIFeature[] = [];
  private favoriteIds: Set<string> = new Set();
  private searchQuery = '';

  constructor(container: HTMLElement, filterStore: FilterStore) {
    this.container = container;
    this.filterStore = filterStore;
  }

  public setData(
    cuisines: string[],
    allFeatures: POIFeature[],
    favoriteIds: Set<string>
  ): void {
    this.availableCuisines = cuisines;
    this.allFeatures = allFeatures;
    this.favoriteIds = favoriteIds;
    this.render();
  }

  public render(): void {
    const state = this.filterStore.getState();
    const selectedList = Array.from(state.selectedCuisines);

    const filteredCuisines = this.availableCuisines.filter((c) =>
      c.toLowerCase().includes(this.searchQuery.toLowerCase())
    );

    this.container.innerHTML = `
      <div class="filter-section-header">
        <span class="filter-title">Cuisines (${this.availableCuisines.length})</span>
        ${
          selectedList.length > 0
            ? `<button type="button" class="btn-text-action" id="btn-clear-cuisines">Clear (${selectedList.length})</button>`
            : ''
        }
      </div>

      ${
        selectedList.length > 0
          ? `
        <div class="active-cuisines-list">
          ${selectedList
            .map(
              (c) => `
            <span class="cuisine-tag active">
              ${c.replace(/_/g, ' ')}
              <button type="button" class="tag-remove" data-cuisine="${c}" aria-label="Remove ${c}">✕</button>
            </span>
          `
            )
            .join('')}
        </div>
      `
          : ''
      }

      <div class="cuisine-search-box">
        <input
          type="search"
          class="cuisine-search-input"
          placeholder="Search cuisines..."
          value="${this.searchQuery}"
          aria-label="Search cuisines"
        />
      </div>

      <div class="cuisine-scroll-list">
        ${
          filteredCuisines.length > 0
            ? filteredCuisines
                .map((c) => {
                  const isChecked = state.selectedCuisines.has(c);
                  return `
              <label class="cuisine-checkbox-label">
                <input
                  type="checkbox"
                  class="cuisine-checkbox"
                  data-cuisine="${c}"
                  ${isChecked ? 'checked' : ''}
                />
                <span class="cuisine-name">${c.replace(/_/g, ' ')}</span>
              </label>
            `;
                })
                .join('')
            : `<div class="cuisine-empty">No cuisines matching "${this.searchQuery}"</div>`
        }
      </div>
    `;

    // Listeners
    const searchInput = this.container.querySelector('.cuisine-search-input') as HTMLInputElement | null;
    searchInput?.addEventListener('input', (e) => {
      this.searchQuery = (e.target as HTMLInputElement).value;
      this.render();
      // Keep focus on search input
      const nextInput = this.container.querySelector('.cuisine-search-input') as HTMLInputElement | null;
      nextInput?.focus();
      nextInput?.setSelectionRange(this.searchQuery.length, this.searchQuery.length);
    });

    this.container.querySelectorAll('.cuisine-checkbox').forEach((cb) => {
      cb.addEventListener('change', (e) => {
        const c = (e.target as HTMLElement).getAttribute('data-cuisine');
        if (c) {
          this.filterStore.toggleCuisine(c, this.allFeatures, this.favoriteIds);
          this.render();
        }
      });
    });

    this.container.querySelectorAll('.tag-remove').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const c = (e.currentTarget as HTMLElement).getAttribute('data-cuisine');
        if (c) {
          this.filterStore.toggleCuisine(c, this.allFeatures, this.favoriteIds);
          this.render();
        }
      });
    });

    this.container.querySelector('#btn-clear-cuisines')?.addEventListener('click', () => {
      this.filterStore.clearCuisines(this.allFeatures, this.favoriteIds);
      this.render();
    });
  }
}
