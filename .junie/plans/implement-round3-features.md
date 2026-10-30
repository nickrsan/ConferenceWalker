---
sessionId: session-261029-200846-q9p7
---

# Requirements

### Overview & Goals
This plan addresses all requested features specified in `DESIRED_FEATURES_ROUND3.md`:
1. **Fix POIs Disappearing on Style Change**: Ensure that when switching between OpenFreeMap basemap styles (Positron, Bright, Liberty), all POIs, isochrones, active filters, selection highlights, and favorite halos are reliably re-rendered.
2. **POI Icon Contrast**: Audit and enhance category icon colors and marker badge SVGs across all 10 categories to ensure high contrast against icons and map backgrounds meeting WCAG AA standards.
3. **Larger POI Size Options**: Scale up POI marker and circle dimensions across all presets (`small`, `medium`, `large`, `extra-large`) for enhanced visibility and touch usability.
4. **POI Description Support**: Extract `description` tags in the OpenStreetMap Python pipeline, preserve them through deduplication, include them in JSON export of saved items, merge descriptions upon importing saved items, and render them in the POI detail view.
5. **Configurable Default Basemap**: Enable a configuration option in `APP_CONFIG` allowing organizers to choose the initial default basemap style (e.g., positron, bright, liberty).
6. **Open in Cartes.app Button**: Add a button to open POIs on https://cartes.app in addition to existing directions/maps buttons in the POI detail view.

### Scope
- **In Scope**:
  - `src/map/mapManager.ts`: Map style switching layer re-creation fix and POI icon size multiplier adjustments.
  - `src/map/mapStyles.ts`: Category color palette contrast fixes and SVG marker generator updates.
  - `pipeline/preprocess.py` & `pipeline/dedupe.py`: OSM description extraction and deduplication merging.
  - `src/types/poi.ts` & `src/services/dataLoader.ts`: Description property support and validation.
  - `src/utils/exportSaved.ts` & `src/state/favorites.ts`: Description export and import merge logic.
  - `src/config.ts` & `src/main.ts`: Configurable default basemap option.
  - `src/utils/directions.ts` & `src/ui/poiDetail.ts`: Cartes.app deep link button and description rendering.
  - Test suites (`vitest` and `pytest`), `FEATURES.md`, user and developer documentation in `documentation/`, and summary report in `.junie/reports/`.
- **Out of Scope**:
  - Google Maps or Apple Maps directions links (explicitly excluded by user).
  - Modifying third-party map tile server APIs.

### User Stories
- **As a user**, I want POIs to stay visible when I switch map styles so that I can explore different map themes without losing my place.
- **As a visually impaired user**, I want high-contrast category icons so I can clearly identify venues across different map styles.
- **As an attendee on mobile or desktop**, I want larger POI marker options for easier tapping and map legibility.
- **As an attendee and organizer**, I want venue descriptions preserved and displayed in POI details and saved exports.
- **As an organizer**, I want to configure the default basemap style for my conference instance.
- **As an open map enthusiast**, I want a button to view venues directly on Cartes.app.

### Functional Requirements
- **FR-1 (Style Change Persistence)**: When `setBasemapStyle()` is called, all POI sources, layers, isochrones, filters, and favorite halos must re-bind upon style completion.
- **FR-2 (Category Contrast)**: All 10 POI category colors and marker SVGs must achieve at least 4.5:1 contrast ratio against icon glyphs and map backgrounds.
- **FR-3 (POI Icon Sizing)**: Scale up `small`, `medium`, `large`, and `extra-large` icon sizing multipliers and base radius expressions.
- **FR-4 (OSM Description Field)**: Ingest `description`, `description:en`, `note`, `comment` from OSM; preserve through deduplication; include in saved POI JSON exports; merge descriptions on import; render in POI detail view.
- **FR-5 (Configurable Default Basemap)**: Add `defaultBasemap?: BasemapStyleKey` to `ConferenceWalkerConfig` in `src/config.ts` and initialize map with configured basemap.
- **FR-6 (Cartes.app Link)**: Provide a button in POI detail view linking to `https://cartes.app/#17/<lat>/<lon>`.

# Delivery Steps

### ✓ Step 1: Fix POIs disappearing on map style changes
Ensure POI layers, isochrones, active filters, selection rings, and favorite halos reliably re-render after changing basemap styles.

- Investigate and fix MapLibre style event handling in `src/map/mapManager.ts` during `setBasemapStyle()`.
- Ensure category SVG icon images are registered on the new style and layer references are cleanly restored.
- Verify with unit and integration tests simulating basemap style switches.

### ✓ Step 2: Category icon contrast improvements & POI sizing updates
Ensure category icons meet WCAG AA contrast standards and POI marker sizes are scaled up across all presets.

- Audit and adjust category colors in `src/map/mapStyles.ts`, `src/ui/sidebar.ts`, and `src/ui/poiDetail.ts` so all badges achieve ≥ 4.5:1 contrast.
- Update `ICON_SIZE_MULTIPLIERS` and circle radius / icon size expressions in `src/map/mapManager.ts`.
- Add contrast ratio tests and verify size preset updates.

### ✓ Step 3: POI description extraction, JSON export/import merging, and detail view display
Extract descriptions from OpenStreetMap, support export/import merging, and render in venue details.

- Update `pipeline/preprocess.py` and `pipeline/dedupe.py` to extract and merge `description` OSM tags.
- Update `src/types/poi.ts` and `src/services/dataLoader.ts` to support `description?: string | null`.
- Update `src/utils/exportSaved.ts` and `src/state/favorites.ts` to include descriptions in JSON exports and merge descriptions on import.
- Update `src/ui/poiDetail.ts` to display the description in POI details view.

### ✓ Step 4: Default basemap configuration option and Cartes.app button in POI detail view
Support default basemap configuration and Cartes.app integration.

- Add `defaultBasemap?: BasemapStyleKey` to `ConferenceWalkerConfig` in `src/config.ts` and use it in `src/main.ts` and `src/map/mapManager.ts`.
- Add `buildCartesAppUrl(coords, zoom?)` helper in `src/utils/directions.ts`.
- Add "Open in Cartes.app" button in `src/ui/poiDetail.ts` alongside existing directions buttons.

### ✓ Step 5: Comprehensive testing, FEATURES.md updates, documentation, and completion report
Ensure all tests pass and documentation is complete.

- Fix existing subtitle test in `tests/sidebar.test.ts` and write comprehensive tests for all new features.
- Run `npm test` and `pytest` across all test suites to confirm full passing status.
- Update `FEATURES.md`, write user and developer documentation in `documentation/`, and generate completion report in `.junie/reports/`.
