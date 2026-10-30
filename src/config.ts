/**
 * Global application configuration for ConferenceWalker.
 * Allows organizers and developers to specify default category selections,
 * startup display options, and region defaults.
 */

import { POICategory, ALL_CATEGORIES, DEFAULT_CATEGORIES, POIIconSize } from './types/poi';
import { BasemapStyleKey } from './map/mapStyles';

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

  /**
   * Whether to exclude places only sourced from Overture Maps by default.
   * Can be overridden by the user via the Settings panel or URL query parameter.
   */
  excludeOvertureOnlyByDefault: boolean;

  /**
   * Predefined list of saved/starred POI IDs to populate on initial launch.
   */
  defaultSavedPois?: string[];

  /**
   * Whether the application launches directly into Saved mode (showing only default saved POIs)
   * while allowing users to switch back to the full Explore view.
   */
  startWithSavedOnlyByDefault?: boolean;

  /**
   * Optional custom subtitle displayed below the application title in the sidebar header.
   * Defaults to region name if not specified.
   */
  conferenceSubtitle?: string;

  /**
   * Optional custom label displayed on the conference center map marker pin.
   * Defaults to region name if not specified.
   */
  conferencePinLabel?: string;

  /**
   * Optional custom tooltip title attribute for the conference center map marker.
   */
  conferencePinTitle?: string;

  /**
   * Optional HTML or text content rendered in a dismissible welcome banner card at the top of the sidebar.
   */
  welcomeHtml?: string;

  /**
   * Whether walking distance isochrone layers (5, 10, 15 min walksheds) are visible by default on initial load.
   * Defaults to true.
   */
  showIsochronesByDefault?: boolean;

  /**
   * Default POI map icon sizing ('small', 'medium', 'large', 'extra-large').
   * Can be overridden by the user in Settings or via URL query parameter.
   * Defaults to 'medium'.
   */
  iconSize?: POIIconSize;

  /**
   * Default vector basemap style on startup ('positron', 'bright', 'liberty').
   * Can be overridden by the user in Settings or via URL query parameter (?basemap=...).
   * Defaults to 'positron'.
   */
  defaultBasemap?: BasemapStyleKey;
}

/**
 * Active application configuration instance.
 * Organizers can customize defaultCategories to curate the initial view
 * (e.g. ['restaurant', 'coffee_tea', 'bar'] or all 10 categories).
 */
export const APP_CONFIG: ConferenceWalkerConfig = {
  // Config option: set which categories show up by default
  defaultCategories: DEFAULT_CATEGORIES,
  filtersExpandedByDefault: true,
  overtureMinConfidence: 0.98,
  excludeOvertureOnlyByDefault: true,
  defaultSavedPois: [],
  startWithSavedOnlyByDefault: false,
  showIsochronesByDefault: true,
  iconSize: 'extra-large',
  defaultBasemap: 'positron',
  conferencePinLabel: "Sheraton Grand - Conference Venue",
  conferenceSubtitle: "FOSS4GNA 2026 Sacramento",
  welcomeHtml: "<p>Looking for coffee? A nice park to wander? A place to meet a friend? Find all of it in walking distance with the map and filters</p>",
};
