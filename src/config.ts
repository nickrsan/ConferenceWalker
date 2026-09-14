/**
 * Global application configuration for ConferenceWalker.
 * Allows organizers and developers to specify default category selections,
 * startup display options, and region defaults.
 */

import { POICategory, ALL_CATEGORIES } from './types/poi';

export interface ConferenceWalkerConfig {
  /**
   * List of POI categories selected and visible by default on initial application load.
   * Defaults to ALL_CATEGORIES if not explicitly constrained.
   */
  defaultCategories: POICategory[];

  /**
   * Whether the filter panel is displayed in full length by default on startup with no results showing,
   * allowing attendees to curate their search before viewing results.
   */
  filtersExpandedByDefault: boolean;

  /**
   * Minimum confidence threshold for remote Overture places (0.0 to 1.0).
   */
  overtureMinConfidence: number;
}

/**
 * Active application configuration instance.
 * Organizers can customize defaultCategories to curate the initial view
 * (e.g. ['restaurant', 'coffee_tea', 'bar'] or all 10 categories).
 */
export const APP_CONFIG: ConferenceWalkerConfig = {
  // Config option: set which categories show up by default
  defaultCategories: ALL_CATEGORIES,
  filtersExpandedByDefault: true,
  overtureMinConfidence: 0.98,
};
