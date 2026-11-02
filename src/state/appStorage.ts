/**
 * Versioned reset support for browser settings that can be safely regenerated.
 */

import { APP_CONFIG } from '../config';
import { FAVORITES_STORAGE_KEY, SEEN_DEFAULTS_STORAGE_KEY } from './favorites';

export const SETTINGS_RESET_VERSION_KEY = 'cw_settings_reset_version';

/** User preferences that an organizer may intentionally reset with a config version bump. */
export const RESETTABLE_SETTINGS_KEYS: readonly string[] = [
  'cw_show_isochrones',
  'cw_icon_size',
  'cw_sidebar_width',
  'cw_welcome_dismissed',
  'conference_walker_exclude_overture',
  'conference_walker_debug',
];

/** User-owned data that a settings reset must never remove. */
export const PROTECTED_STORAGE_KEYS: readonly string[] = [
  FAVORITES_STORAGE_KEY,
  SEEN_DEFAULTS_STORAGE_KEY,
];

/** Reads a preference without allowing blocked browser storage to interrupt startup. */
export function readStoredSetting(key: string, storage?: Storage | null): string | null {
  let resolvedStorage = storage;
  if (resolvedStorage === undefined) {
    try {
      resolvedStorage = typeof window === 'undefined' ? null : window.localStorage;
    } catch {
      return null;
    }
  }
  if (!resolvedStorage) return null;

  try {
    return resolvedStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Clears only allowlisted preferences when the deployed reset version increases. */
export function applySettingsReset(
  targetVersion: number = APP_CONFIG.settingsResetVersion ?? 0,
  storage?: Storage | null
): boolean {
  let resolvedStorage = storage;
  if (resolvedStorage === undefined) {
    try {
      resolvedStorage = typeof window === 'undefined' ? null : window.localStorage;
    } catch {
      return false;
    }
  }
  if (!resolvedStorage) return false;

  const nextVersion = Number.isFinite(targetVersion) ? Math.max(0, Math.floor(targetVersion)) : 0;

  try {
    const storedVersionValue = resolvedStorage.getItem(SETTINGS_RESET_VERSION_KEY);
    const parsedStoredVersion = storedVersionValue === null ? 0 : Number(storedVersionValue);
    const currentVersion = Number.isFinite(parsedStoredVersion) && parsedStoredVersion >= 0
      ? parsedStoredVersion
      : 0;

    if (nextVersion <= currentVersion) return false;

    for (const key of RESETTABLE_SETTINGS_KEYS) {
      resolvedStorage.removeItem(key);
    }
    resolvedStorage.setItem(SETTINGS_RESET_VERSION_KEY, String(nextVersion));
    return true;
  } catch {
    // A blocked or quota-limited storage area must not prevent application startup.
    return false;
  }
}