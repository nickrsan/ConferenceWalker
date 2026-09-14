/**
 * Debug state management for ConferenceWalker.
 * Controls display of OpenStreetMap and Overture GERS entity IDs.
 * Toggleable via application UI or directly through the browser console.
 */

export class DebugStore {
  private debugMode = false;
  private listeners: Set<(enabled: boolean) => void> = new Set();
  private readonly STORAGE_KEY = 'conference_walker_debug';

  constructor() {
    this.debugMode = this.detectInitialDebugState();
    this.exposeGlobalConsoleApi();
  }

  private detectInitialDebugState(): boolean {
    if (typeof window === 'undefined') return false;

    // 1. Check URL parameters (?debug=true or ?debug=1)
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('debug') === 'true' || params.get('debug') === '1') {
        return true;
      }
    } catch {
      // Ignore URL parsing errors
    }

    // 2. Check localStorage persistence
    try {
      return window.localStorage.getItem(this.STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  }

  public isDebugMode(): boolean {
    return this.debugMode;
  }

  public setDebugMode(enabled: boolean): void {
    if (this.debugMode === enabled) return;
    this.debugMode = enabled;

    try {
      window.localStorage.setItem(this.STORAGE_KEY, String(enabled));
    } catch {
      // Defensive fallback if localStorage is sandboxed
    }

    this.notify();
    console.info(
      `%c[ConferenceWalker] Debug mode ${enabled ? 'ENABLED' : 'DISABLED'}. OSM & GERS IDs are now ${enabled ? 'visible' : 'hidden'}.`,
      'color: #2563eb; font-weight: bold;'
    );
  }

  public toggleDebugMode(): boolean {
    this.setDebugMode(!this.debugMode);
    return this.debugMode;
  }

  public subscribe(listener: (enabled: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.debugMode);
    }
  }

  /**
   * Exposes intuitive global console shortcuts for conference organizers and developers.
   */
  private exposeGlobalConsoleApi(): void {
    if (typeof window === 'undefined') return;

    const api = {
      get enabled() {
        return this.isDebugMode();
      },
      set enabled(val: boolean) {
        this.setDebugMode(Boolean(val));
      },
      toggle: () => this.toggleDebugMode(),
      enable: () => this.setDebugMode(true),
      disable: () => this.setDebugMode(false),
      isDebugMode: () => this.isDebugMode(),
      setDebugMode: (val: boolean) => this.setDebugMode(val),
    };

    (window as any).ConferenceWalkerDebug = api;
    (window as any).toggleDebug = () => this.toggleDebugMode();
    (window as any).setDebug = (val: boolean) => this.setDebugMode(Boolean(val));
  }
}
