import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DebugStore } from '../src/state/debugState';

describe('DebugStore', () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete (window as any).ConferenceWalkerDebug;
    delete (window as any).toggleDebug;
    delete (window as any).setDebug;
  });

  it('initializes with debug mode false by default', () => {
    const store = new DebugStore();
    expect(store.isDebugMode()).toBe(false);
  });

  it('updates state, persists to localStorage, and notifies subscribers', () => {
    const store = new DebugStore();
    const listener = vi.fn();
    store.subscribe(listener);

    store.setDebugMode(true);
    expect(store.isDebugMode()).toBe(true);
    expect(window.localStorage.getItem('conference_walker_debug')).toBe('true');
    expect(listener).toHaveBeenCalledWith(true);

    store.setDebugMode(false);
    expect(store.isDebugMode()).toBe(false);
    expect(window.localStorage.getItem('conference_walker_debug')).toBe('false');
    expect(listener).toHaveBeenCalledWith(false);
  });

  it('toggles debug mode cleanly', () => {
    const store = new DebugStore();
    expect(store.toggleDebugMode()).toBe(true);
    expect(store.isDebugMode()).toBe(true);
    expect(store.toggleDebugMode()).toBe(false);
    expect(store.isDebugMode()).toBe(false);
  });

  it('exposes global console API on window', () => {
    const store = new DebugStore();
    expect((window as any).ConferenceWalkerDebug).toBeDefined();
    expect(typeof (window as any).toggleDebug).toBe('function');
    expect(typeof (window as any).setDebug).toBe('function');

    (window as any).setDebug(true);
    expect(store.isDebugMode()).toBe(true);

    (window as any).toggleDebug();
    expect(store.isDebugMode()).toBe(false);
  });
});
