import { expect, Page, test } from '@playwright/test';

const APP_LAYER_IDS = [
  'pois-favorites-halo',
  'pois-circle',
  'pois-symbol',
  'pois-selection-ring',
  'isochrones-fill',
  'isochrones-line',
  'isochrones-labels',
];

async function waitForAppLayers(page: Page, expectedBasemap: string | null = null): Promise<void> {
  await page.waitForFunction(
    ({ layerIds, styleKey }) => {
      const manager = (window as any).__conferenceWalkerMap;
      const map = manager?.map;
      return Boolean(
        manager &&
        map?.isStyleLoaded() &&
        (!styleKey || manager.getBasemapStyle() === styleKey) &&
        layerIds.every((layerId: string) => map.getLayer(layerId)) &&
        map.getSource('pois-source')
      );
    },
    { layerIds: APP_LAYER_IDS, styleKey: expectedBasemap },
    { timeout: 60_000 }
  );
}

async function readAppMapState(page: Page): Promise<{
  layerIds: string[];
  poiSourceFeatureCount: number;
  poiFilter: unknown;
  favoritesFilter: unknown;
  selectionFilter: unknown;
}> {
  return page.evaluate((layerIds: string[]) => {
    const manager = (window as any).__conferenceWalkerMap;
    const map = manager.map;
    const poiSource = map.getSource('pois-source');
    const sourceData = poiSource?._data ?? poiSource?.serialize?.().data;
    const sourceFeatures = Array.isArray(sourceData?.features)
      ? sourceData.features
      : manager.poiData?.features ?? [];

    return {
      layerIds: layerIds.filter((layerId) => Boolean(map.getLayer(layerId))),
      poiSourceFeatureCount: sourceFeatures.length,
      poiFilter: map.getFilter('pois-circle'),
      favoritesFilter: map.getFilter('pois-favorites-halo'),
      selectionFilter: map.getFilter('pois-selection-ring'),
    };
  }, APP_LAYER_IDS);
}

test('POIs, isochrones, filters, favorites, and selection survive basemap switches', async ({ page }) => {
  await page.goto('/?categories=restaurant');

  try {
    await waitForAppLayers(page);
  } catch (error) {
    throw new Error(`The initial OpenFreeMap style or POI data did not load: ${String(error)}`);
  }

  // Seed active highlight state through the dev-only map handle so each layer can be verified after restoration.
  await page.evaluate(() => {
    const manager = (window as any).__conferenceWalkerMap;
    const selectedPoiId = manager.poiData.features[0]?.properties.id;
    if (selectedPoiId) {
      manager.setSelectedPOI(selectedPoiId);
      manager.updateFavorites(new Set([selectedPoiId]));
    }
  });

  const baselineState = await readAppMapState(page);
  expect(baselineState.poiSourceFeatureCount).toBeGreaterThan(0);
  expect(baselineState.selectionFilter).not.toBeNull();
  expect(baselineState.favoritesFilter).not.toBeNull();

  await page.getByRole('button', { name: 'Settings' }).click();
  const basemapSelector = page.locator('#select-basemap-style');
  await expect(basemapSelector).toBeVisible();

  for (const style of ['bright', 'liberty']) {
    await basemapSelector.selectOption(style);
    await waitForAppLayers(page, style);

    const restoredState = await readAppMapState(page);
    expect(restoredState.layerIds).toEqual(APP_LAYER_IDS);
    expect(restoredState.poiSourceFeatureCount).toBeGreaterThan(0);
    expect(restoredState.poiFilter).toEqual(baselineState.poiFilter);
    expect(restoredState.favoritesFilter).toEqual(baselineState.favoritesFilter);
    expect(restoredState.selectionFilter).toEqual(baselineState.selectionFilter);
  }
});