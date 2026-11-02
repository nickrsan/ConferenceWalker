import { describe, expect, it } from 'vitest';
import {
  applySettingsReset,
  PROTECTED_STORAGE_KEYS,
  RESETTABLE_SETTINGS_KEYS,
  SETTINGS_RESET_VERSION_KEY,
  readStoredSetting,
} from '../src/state/appStorage';

function createMemoryStorage(initialValues: Record<string, string> = {}): Storage {
  const values = new Map(Object.entries(initialValues));

  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(String(key)) ?? null,
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    removeItem: (key: string) => values.delete(String(key)),
    setItem: (key: string, value: string) => values.set(String(key), String(value)),
  } as Storage;
}

describe('applySettingsReset', () => {
  it('clears only allowlisted settings once and preserves protected user data', () => {
    const storedValues: Record<string, string> = {
      [SETTINGS_RESET_VERSION_KEY]: '2',
      conference_walker_favorites_v1: '["user-star"]',
      cw_seen_default_saved_pois: '["deployed-star"]',
    };
    for (const key of RESETTABLE_SETTINGS_KEYS) {
      storedValues[key] = 'user-setting';
    }
    const storage = createMemoryStorage(storedValues);

    expect(RESETTABLE_SETTINGS_KEYS.some((key) => PROTECTED_STORAGE_KEYS.includes(key))).toBe(false);
    expect(applySettingsReset(3, storage)).toBe(true);
    for (const key of RESETTABLE_SETTINGS_KEYS) {
      expect(storage.getItem(key)).toBeNull();
    }
    expect(storage.getItem(SETTINGS_RESET_VERSION_KEY)).toBe('3');
    expect(storage.getItem('conference_walker_favorites_v1')).toBe('["user-star"]');
    expect(storage.getItem('cw_seen_default_saved_pois')).toBe('["deployed-star"]');

    storage.setItem(RESETTABLE_SETTINGS_KEYS[0], 'new-user-setting');
    expect(applySettingsReset(3, storage)).toBe(false);
    expect(storage.getItem(RESETTABLE_SETTINGS_KEYS[0])).toBe('new-user-setting');
  });

  it('treats a missing version as zero and does not reset for the same version', () => {
    const storage = createMemoryStorage({ cw_icon_size: 'large' });

    expect(applySettingsReset(0, storage)).toBe(false);
    expect(storage.getItem('cw_icon_size')).toBe('large');

    expect(applySettingsReset(1, storage)).toBe(true);
    expect(storage.getItem('cw_icon_size')).toBeNull();
    expect(storage.getItem(SETTINGS_RESET_VERSION_KEY)).toBe('1');
  });

  it('gracefully ignores unavailable or throwing storage', () => {
    const throwingStorage = {
      getItem: () => { throw new Error('Storage is blocked'); },
      removeItem: () => { throw new Error('Storage is blocked'); },
      setItem: () => { throw new Error('Storage is blocked'); },
    } as unknown as Storage;

    expect(applySettingsReset(1, null)).toBe(false);
    expect(applySettingsReset(1, throwingStorage)).toBe(false);
    expect(readStoredSetting('cw_icon_size', throwingStorage)).toBeNull();
  });
});