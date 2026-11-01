---
sessionId: session-261101-114818-2ttx
---

# Requirements

### Overview & Goals
The walking-time labels (`5 min`, `10 min`, `15 min`) currently show up in seemingly random spots inside the isochrone polygons. MapLibre gives polygon features *point* placement, so it drops one label at an interior point of every tile fragment of each ring. The goal is to place the labels **on each ring's outline**, following the curve like contour labels, so it's clear which boundary each label belongs to.

### Scope
**In scope**
- Move the `isochrones-labels` layer in `src/map/mapManager.ts` from point placement to line placement along the outline.
- Repeat labels at a regular spacing along each outline, centered on the stroke with a halo (your choices).
- Trim the padded label text (`"  15 min "` in `public/data/region.json`), and fall back to a label built from `value` when one is missing.
- Update the tests, `FEATURES.md`, `documentation/` and the `.junie/reports` summary.

**Out of scope**
- Changes to the fill and outline styling, opacities or colors.
- Pipeline (`pipeline/isochrones.py`) or region data changes.
- Adding a separate legend.

### User Stories
- As an attendee, I want each walking-time label to sit on its ring's boundary so I can tell at a glance which line marks 5, 10 or 15 minutes.
- As an attendee on a phone, I want at least one label per ring visible wherever I pan or zoom, so I don't need to zoom out to find it.

### Functional Requirements
- **FR-1:** Each isochrone label is drawn along its polygon outline, follows the line's curvature and stays upright (never upside down).
- **FR-2:** Labels repeat along the outline at a fixed screen-pixel spacing (about 300px), so they're spread evenly at any zoom level.
- **FR-3:** Labels are centered on the stroke with a white halo wide enough to cover the 2.5px stroke underneath. Text is dark (`#1e293b`) for contrast.
- **FR-4:** Labels skip sharp corners (`text-max-angle`) and don't overlap POI labels or each other (collision detection stays on).
- **FR-5:** Label text has no leading or trailing whitespace. When `label` is missing, it falls back to `${value/60} min`.
- **FR-6:** Existing behavior is kept:
  - the "Show walking distance zones" toggle and URL sync (`isochrones-labels` visibility);
  - the `Noto Sans Regular` fontstack;
  - layers inserted beneath the POI markers;
  - layers restored after a basemap switch (Positron, Bright, Liberty).

### Non-Functional Requirements
- **Accessibility:** Text and halo contrast meets WCAG AA (dark text on a white halo). The map labels are visual only; walking-time information is still available through the walk-distance filter and the POI cards, as today.
- **Responsive:** The spacing is in screen pixels, so phones, tablets and desktops get a similar label density, and it adapts on resize or rotation without extra code.
- **Performance:** No runtime geometry processing, only MapLibre's native line placement.

# Technical Design

### Current Implementation
- `MapManager.renderIsochrones()` in `src/map/mapManager.ts` (lines 116–213) filters `region.geojson` down to Polygon and MultiPolygon features and feeds them into `isochrones-source`. It then adds three layers before the POI layers:
  - `isochrones-fill`
  - `isochrones-line`
  - `isochrones-labels`, a `symbol` layer with `text-field: ['get','label']`, `text-anchor: 'center'`, size 12, and a dark text color with a 2px white halo.
- No `symbol-placement` is set, so it defaults to `point`. For polygons that means one label per tile-clipped fragment, at an interior point. That's the "random" placement.
- After a basemap change, `setBasemapStyle()` calls `renderIsochrones` again, so any layer change made there carries over to every basemap.
- The labels in `public/data/region.json` are padded with spaces (`"  5 min "`).

### Key Decisions
1. **Native `symbol-placement: 'line'` on the existing polygon source.** MapLibre treats polygon rings as lines for line placement, so no derived source or geometry conversion is needed. This was your choice of repeated labels along the outline.
2. **Labels centered on the stroke.** There's no `text-offset`, and the halo is widened to about 3px so the text stays readable over the 2.5px line. This was your choice.
3. **Normalize labels in TypeScript, not in a MapLibre expression.** MapLibre expressions have no `trim`, so a small pure helper cleans up the label properties before `setData`/`addSource`. It's unit-testable and leaves the data files untouched.
4. **Keep dark text (`#1e293b`) instead of the ring color.** `#9dd3a7` (the 15 min color) on a white halo would fail WCAG AA.

### Proposed Changes
- **`src/map/mapManager.ts`**
  - Export a pure helper, `normalizeIsochroneFeatures(features)`. It keeps only Polygon and MultiPolygon features and returns shallow copies whose `properties.label` is trimmed. Blank labels fall back to `${Math.round(value/60)} min`. `renderIsochrones` calls it instead of the inline filter.
  - Export an `ISOCHRONE_LABEL_LAYOUT` constant (with a comment explaining each setting) and use it for the `isochrones-labels` layout, plus the current `visibility`:
    ```ts
    'symbol-placement': 'line',     // follow the polygon outline
    'symbol-spacing': 300,          // px between repeats along a ring
    'text-field': ['get', 'label'],
    'text-font': ['Noto Sans Regular'],
    'text-size': 13,
    'text-max-angle': 30,           // avoid sharp corners
    'text-keep-upright': true,
    'text-rotation-alignment': 'map',
    'text-padding': 4,
    ```
    `text-anchor: 'center'` is removed because it's the default, and line placement already centers text on the line.
  - Change the paint `text-halo-width` from 2 to 3. Keep `text-color: '#1e293b'` and `text-halo-color: '#ffffff'`.
  - No changes to the layer order, the layer IDs or `updateIsochronesLayerVisibility()`.

### Risks
- **Short or jagged rings:** If an outline is too short or too angular for the text, MapLibre skips the label there. `text-max-angle: 30` and the 300px spacing keep labels showing on these smooth walksheds. This gets checked visually in the dev server.
- **Overlap where rings run close together:** Collision detection hides any label that overlaps another, so labels can't stack on each other.
- **Older region files without `label`:** The `value`-based fallback covers them.

# Testing

### Validation Approach
- Unit tests in `tests/mapManager.test.ts`, using the existing mocked-`maplibre-gl` pattern that collects layers in `addedLayers`.
- Run the full Vitest suite (`npm test`) and the Python suite (`pytest`) to check for regressions.
- A manual visual check in the Vite dev server at a phone width and a desktop width, if you'd like one.

### Key Scenarios
- **Placement:** The `isochrones-labels` layout has `symbol-placement: 'line'`, `symbol-spacing: 300` and `text-max-angle: 30`, still uses `text-font: ['Noto Sans Regular']`, and has no `text-offset`. This extends the existing "renders isochrones" test around lines 312–318.
- **Halo:** `text-halo-width` is 3 and `text-color` is `#1e293b`.
- **Normalized labels:** The data passed to `addSource('isochrones-source', …)` has trimmed labels (`'15 min'`, not `'  15 min '`).
- **Layer order kept:** All three isochrone layers still get the `pois-circle` before-ID.
- **Basemap switch:** The existing basemap test still passes, and the label layer is re-added with line placement.

### Edge Cases
- `normalizeIsochroneFeatures` unit tests:
  - drops Point features and features without geometry;
  - trims whitespace;
  - uses the `value` fallback (`600` → `'10 min'`) for a missing or blank label;
  - doesn't mutate the input objects;
  - handles an empty or undefined feature list.
- The visibility toggle test (`safely updates visibility…`) passes unchanged.

### Test Changes
- **Update:** the isochrone render test in `tests/mapManager.test.ts`.
- **Add:** a `describe('normalizeIsochroneFeatures')` block and an `ISOCHRONE_LABEL_LAYOUT` assertion test.

# Delivery Steps

### ✓ Step 1: Normalize isochrone features for labeling
`renderIsochrones` feeds MapLibre polygon features with trimmed labels, or labels built from `value` when missing.

- Add an exported, commented `normalizeIsochroneFeatures(features)` helper to `src/map/mapManager.ts`:
  - keeps only Polygon and MultiPolygon features;
  - returns shallow copies with the label trimmed;
  - falls back to `${Math.round(value/60)} min` when the label is blank.
- Replace the inline polygon filter in `renderIsochrones()` with the helper, for both the `setData` and `addSource` paths.
- Add `normalizeIsochroneFeatures` unit tests in `tests/mapManager.test.ts`: trimming, fallback, dropping Point and missing geometry, no input mutation, empty input.
- Extend the existing render test to check that `addSource` gets trimmed labels.

### ! Step 2: Place isochrone labels along the outlines
The `isochrones-labels` layer draws repeated, upright labels centered on each ring's stroke instead of at interior points.

- Add an exported `ISOCHRONE_LABEL_LAYOUT` constant to `src/map/mapManager.ts`, with a comment for each setting:
  - `symbol-placement: 'line'`
  - `symbol-spacing: 300`
  - `text-max-angle: 30`
  - `text-keep-upright: true`
  - `text-rotation-alignment: 'map'`
  - `text-padding: 4`
  - `text-size: 13`
  - the Noto Sans fontstack
- Use the constant in the `isochrones-labels` layer, keep the visibility handling, and remove `text-anchor: 'center'`.
- Raise `text-halo-width` to 3 so the label covers the 2.5px stroke. Keep the `#1e293b` text and white halo for WCAG AA contrast.
- Update and extend the tests in `tests/mapManager.test.ts`:
  - line placement, spacing, max angle and halo width;
  - the fontstack is unchanged;
  - the `pois-circle` before-IDs are kept;
  - the basemap-switch and visibility toggle tests still pass.
- Run the full Vitest and pytest suites and confirm everything passes.

### ✓ Step 3: Update feature registry, docs and summary report
`FEATURES.md`, the documentation and the reports folder describe the new outline labels.

- Compare `FEATURES.md` §7, §9 and §10 with the code to confirm the toggle, fontstack, stacking and basemap persistence still behave as described.
- Add a line to `FEATURES.md` on contour-style isochrone labels along the outline.
- Update the isochrone sections of `documentation/developer_guide.md` (the layer config and the `normalizeIsochroneFeatures` contract) and `documentation/user_guide.md` (how to read the outline labels).
- Write `.junie/reports/summary_<date>_<time>.md` with the prompt, how I understood it, the decisions, the code changes and the test results.