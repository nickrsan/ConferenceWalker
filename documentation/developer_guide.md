# ConferenceWalker - Developer Guide

This document describes the technical architecture, data processing pipeline, API contracts, and development workflows for the **ConferenceWalker** project.

---

## 1. System Architecture

ConferenceWalker is divided into two primary subsystems:
1. **Data Preprocessing Pipeline (`pipeline/`)**: A Python and DuckDB spatial pipeline that ingests, classifies, spatially intersects, deduplicates, and enriches POI records from OpenStreetMap and Overture Maps into standardized GeoJSON.
2. **Frontend Web Application (`src/`)**: A responsive, zero-framework Vanilla TypeScript web application built with Vite and MapLibre GL JS that provides interactive map visualization, real-time multi-dimensional filtering, opening hours detection, favorites management in `localStorage`, and GraphHopper walking route integration.

```
+-----------------------------------------------------------------------------------+
|                            DATA PIPELINE (Python / DuckDB)                        |
|                                                                                   |
|  +--------------------+        +---------------------+      +------------------+  |
|  | Region Isochrones  |        | OpenStreetMap PBF   |      | Overture Maps S3 |  |
|  | (regions/*.json)   |        | (osmium export)     |      | (DuckDB httpfs)  |  |
|  +---------+----------+        +----------+----------+      +--------+---------+  |
|            |                              |                          |            |
|            +------------------------------+--------------------------+            |
|                                           |                                       |
|                                           v                                       |
|                    +----------------------------------------------+               |
|                    | pipeline/preprocess.py                       |               |
|                    | - Spatial walkshed tagging (5, 10, 15 min)   |               |
|                    | - Taxonomy mapping (10 categories + cuisines)|               |
|                    | - Fuzzy deduplication (25m proximity, >=80%) |               |
|                    +----------------------+-----------------------+               |
|                                           |                                       |
|                                           v                                       |
|                         public/data/sacramento_pois.geojson                       |
|                         public/data/region.json                                   |
+-------------------------------------------+---------------------------------------+
                                            |
                                            v
+-----------------------------------------------------------------------------------+
|                         WEB APPLICATION (TypeScript / Vite)                       |
|                                                                                   |
|  +-----------------------+     +------------------------+                         |
|  | src/services/         |     | src/state/             |                         |
|  | - dataLoader.ts       | --> | - filterState.ts       |                         |
|  |                       |     | - favorites.ts         |                         |
|  +-----------------------+     +-----------+------------+                         |
|                                            |                                      |
|            +-------------------------------+------------------------------+       |
|            |                                                              |       |
|            v                                                              v       |
|  +-----------------------+                                      +-----------------+
|  | src/map/              |                                      | src/ui/         |
|  | - mapManager.ts       |                                      | - sidebar.ts    |
|  | - mapStyles.ts        |                                      | - poiDetail.ts  |
|  | (MapLibre GL layers)  |                                      | - categoryFilter|
|  +-----------------------+                                      +-----------------+
+-----------------------------------------------------------------------------------+
```

---

## 2. Prerequisites & Environment

- **Node.js**: `v18.19.1` or newer
- **npm**: `v9.2.0` or newer
- **Python**: `3.12` or newer
- **osmium**: `osmium-tool` installed (`/usr/bin/osmium`)
- **DuckDB**: Python package `duckdb` (`^1.1.0` or newer with `spatial` and `httpfs` extensions)
- **rapidfuzz**: `rapidfuzz` (`^3.0.0` or standard library `difflib` fallback)

---

## 3. Data Preprocessing Pipeline (`pipeline/`)

### 3.1 Overview
The pipeline ingests POIs from OpenStreetMap PBF exports and Overture Maps GeoParquet on AWS S3 (`s3://overturemaps-us-west-2/release/.../theme=places/type=place/*`), assigns each venue a walking travel time bucket (e.g. 5 min, 10 min, 15 min) based on walkshed isochrones, deduplicates records within 25 meters having normalized name similarity >= 80%, and outputs standardized GeoJSON.

### 3.2 Modules
- `pipeline/categories.py`:
  - Maps OSM tags (`amenity`, `shop`, `tourism`, `leisure`, `highway`, `railway`, `public_transport`, `historic`, `landuse`) and Overture `categories.primary` strings into 10 standardized categories:
    `convenience_pharmacy`, `restaurant`, `parking`, `transit`, `coffee_tea`, `bar`, `hotel`, `attraction_art`, `park_outdoors`, `grocery`.
  - Normalizes and extracts cuisines from tags and category strings.
- `pipeline/isochrones.py`:
  - `load_region(geojson_path)`: Parses conference center point coordinates, bounding box with query padding, and sorted isochrone polygons.
  - `point_in_polygon_geometry(lon, lat, geom)`: Ray-casting point-in-polygon containment supporting both `Polygon` and `MultiPolygon` with hole exclusion.
  - `tag_walk_time(lon, lat)`: Returns minimum walk-time threshold in minutes (e.g., 5, 10, 15) or `None` if outside all polygons.
- `pipeline/dedupe.py`:
  - `haversine_distance_meters(lon1, lat1, lon2, lat2)`: Computes geodesic distance in meters.
  - `normalize_name(name)`: Strips punctuation, accents, corporate suffixes (LLC, Inc, Corp), leading articles, and whitespace.
  - `compute_name_similarity(name1, name2)`: Fuzzy token set and string ratio using RapidFuzz.
  - `merge_two_pois(poi_a, poi_b)`: Combines attributes between matching records. **OpenStreetMap precedence guarantee**: OpenStreetMap data strictly takes precedence over Overture data for coordinates (retaining OSM's exact coordinates to avoid positional degradation from noisy Overture coordinates), categories, venue names, formatted addresses, phone numbers, websites, and opening hours. Overture data provides enrichment for fields missing in OSM and populates `overture_id`.
  - `deduplicate_pois(pois, max_distance_meters=25.0, min_similarity=80.0)`: Spatial grid indexing and Disjoint Set Union (Union-Find) clustering merging matching venue attributes without losing data.
- `pipeline/preprocess.py`:
  - Command-line interface orchestrating the end-to-end pipeline.
  - **Genuine OpenStreetMap IDs**: Invokes `osmium export` with `-a type,id` to export canonical OpenStreetMap node and way IDs directly into `@id` properties, ensuring genuine OSM node IDs (e.g. `90498377`) are reported in `osm_id` and `id` (`osm_90498377`) rather than internal sequential numbering (`node_{idx}`).

### 3.3 CLI Usage
```bash
python3 -m pipeline.preprocess \
  --region "regions/Walksheds of Sacramento FOSS4GNA 2026.json" \
  --osm-pbf "regions/SacramentoCore.osm.pbf" \
  --output "public/data/sacramento_pois.geojson" \
  --output-region "public/data/region.json" \
  --s3-region "us-west-2" \
  --overture-release "2026-08-19.0" \
  --dedupe-dist 25.0 \
  --dedupe-sim 80.0
```

#### CLI Flags:
| Flag | Default | Description |
|---|---|---|
| `--region` | `regions/Walksheds...json` | Path to walkshed isochrones GeoJSON |
| `--osm-pbf` | `regions/SacramentoCore.osm.pbf` | Path to OSM PBF export |
| `--output` | `public/data/sacramento_pois.geojson` | Path for processed POI GeoJSON |
| `--output-region` | `public/data/region.json` | Path for active conference metadata JSON |
| `--s3-region` | `us-west-2` | AWS S3 region for Overture Geoparquet |
| `--overture-release` | `2026-08-19.0` | Overture Maps release catalog tag |
| `--overture-min-confidence` | `0.6` | Minimum confidence score threshold for Overture records (0.0 to 1.0) |
| `--blocklist-gers` | `None` | Comma-separated list or file path containing Overture GERS IDs to blocklist |
| `--skip-overture` | `False` | Skip remote Overture S3 query (offline mode) |
| `--skip-osm` | `False` | Skip OSM PBF parsing |
| `--dedupe-dist` | `25.0` | Spatial distance threshold in meters |
| `--dedupe-sim` | `80.0` | Fuzzy name similarity threshold percentage |

---

## 4. Frontend Web Application (`src/`)

### 4.1 Application Configuration (`src/config.ts`)
```typescript
export interface ConferenceWalkerConfig {
  defaultCategories: POICategory[];
  filtersExpandedByDefault: boolean;
  overtureMinConfidence: number;
  excludeOvertureOnlyByDefault: boolean;
}

export const APP_CONFIG: ConferenceWalkerConfig = {
  // Config option: set which categories show up by default
  defaultCategories: ALL_CATEGORIES,
  filtersExpandedByDefault: true,
  overtureMinConfidence: 0.98,
  excludeOvertureOnlyByDefault: false,
};
```
Organizers can customize `APP_CONFIG.defaultCategories` to curate which categories are enabled by default on initial application load, and `excludeOvertureOnlyByDefault` to determine if Overture-only places are excluded on initial launch.

### 4.2 Data Contracts (`src/types/poi.ts`)
```typescript
export type POICategory =
  | 'convenience_pharmacy'
  | 'restaurant'
  | 'parking'
  | 'transit'
  | 'coffee_tea'
  | 'bar'
  | 'hotel'
  | 'attraction_art'
  | 'park_outdoors'
  | 'grocery';

export interface POIProperties {
  id: string;
  name: string;
  category: POICategory;
  walk_time_minutes: number | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  opening_hours: string | null;
  cuisines: string[];
  sources: ('osm' | 'overture')[];
  osm_id: string | null;
  overture_id: string | null;
  reservation_url?: string | null;
  order_url?: string | null;
}

export interface FilterState {
  categories: Set<POICategory>;
  allowedWalkTimes: Set<number | 'outside'>;
  openNowOnly: boolean;
  includeUnknownHours: boolean;
  selectedCuisines: Set<string>;
  searchQuery: string;
  favoritesOnly: boolean;
  excludeOvertureOnly: boolean;
}
```

### 4.3 State Management
- **`FilterStore` (`src/state/filterState.ts`)**:
  - Centralized reactive store managing multi-dimensional filtering across categories, walk distances, opening hours status, cuisines, text search, favorites, and source exclusion.
  - **Overture Exclusion Filter**: `setExcludeOvertureOnly(enabled: boolean, allFeatures, favorites)` allows excluding noisy POIs that only originate from Overture Maps (`sources: ['overture']`) while retaining OpenStreetMap places and verified merged records. State persists to `localStorage` under `conference_walker_exclude_overture` and initializes from URL parameter `?exclude_overture=true`.
  - Configurable Defaults: accepts a customized default category array via constructor, respected on initialization and filter resets.
  - Subscriptions: `store.subscribe((state, matchingIds) => void)` notifying UI and Map components when criteria change.
  - MapLibre Filter Generation: `store.buildMapLibreFilter(allFeatures, favorites)` generates hardware-accelerated filter expressions applied directly to MapLibre GL JS layers.
- **`FavoritesStore` (`src/state/favorites.ts`)**:
  - Manages starred venues persisted in `window.localStorage` under key `conference_walker_favorites_v1`.
  - Wrapped with defensive `try/catch` fallbacks to support private browsing modes and sandboxed iframes.
- **`DebugStore` (`src/state/debugState.ts`)**:
  - Manages application-wide debug mode displaying OpenStreetMap and Overture GERS entity IDs on cards and in the detail sheet.
  - Exposes global developer shortcuts on the window object: `window.toggleDebug()`, `window.setDebug(boolean)`, and `window.ConferenceWalkerDebug`.

### 4.4 UI Components & Settings Panel (`src/ui/sidebar.ts`, `src/ui/poiDetail.ts`)
- **Settings Panel**: Dedicated settings drawer accessed via `#btn-toggle-settings` (`⚙️ Settings`) in the sidebar header. Contains:
  - `#chk-disable-overture`: Disables Overture-only data to reduce positional noise.
  - `#chk-debug-mode`: Toggles OSM & GERS ID pills on POI cards and detail sheets.
  - Modal view switching: Opening Settings automatically collapses the Filters panel, and vice versa. Closing Settings returns seamlessly to the distance-sorted venue list.

### 4.5 Map Engine & Vector Layers (`src/map/mapManager.ts`, `src/map/mapStyles.ts`)
- **Basemap Engine**: Uses OpenFreeMap Positron (`https://tiles.openfreemap.org/styles/positron`), an open-source, API-key-free vector tile service.
- **Vector Icon Badges**: Pre-rasterizes crisp category SVG badges at 2x pixel ratio for high-DPI displays.
- **POI Name Labels**: Renders on-map venue names directly beneath category symbols with text halos and automatic collision-avoidance layout.
- **Bidirectional Selection**: Synchronizes map marker selections with sidebar card highlights and viewport camera centering.

### 4.6 Distance Calculation & Navigation (`src/utils/directions.ts`)
- **Haversine Distance**:
  ```typescript
  calculateDistanceMeters(coord1, coord2): number
  formatDistance(meters): string // e.g. "250 m" or "1.2 km"
  ```
  Calculates walking distance from conference coordinates to sort venue cards with closer items first.
- **GraphHopper Walking Route URL**:
  ```typescript
  buildGraphHopperWalkingUrl(conferenceCoords, poiCoords)
  ```
  Generates URLs: `https://graphhopper.com/maps/?point=LAT%2CLON&point=LAT%2CLON&vehicle=foot`
- **Native Device Intent**:
  ```typescript
  buildMobileDirectionsIntent(poiCoords, venueName)
  ```
  Generates `geo:LAT,LON?q=LAT,LON(Name)` for iOS and Android native map handoff.

### 4.7 Opening Hours Evaluator & Weekly Schedule Parser (`src/utils/openingHours.ts`)
Evaluates standard OpenStreetMap opening hours syntax against client local time and parses weekly schedules using `opening_hours.js`:
```typescript
evaluateOpeningHours(openingHoursStr: string | null | undefined, now?: Date): 'open' | 'closed' | 'unknown'

parseWeeklySchedule(
  openingHoursStr: string | null | undefined,
  now?: Date,
  locale?: string
): WeeklySchedule | null
```
`WeeklySchedule` interface:
```typescript
export interface DayScheduleItem {
  dayName: string;       // Localized full weekday name (e.g. "Monday", "lundi")
  shortDayName: string;  // Localized abbreviated weekday (e.g. "Mon")
  hoursText: string;     // Formatted operating hours ("08:00 – 17:00", "Closed", or "Open 24 hours")
  isToday: boolean;      // Highlighted in bold in the UI
  dayIndex: number;      // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
}

export interface WeeklySchedule {
  days: DayScheduleItem[];
  rawText: string;
}
```
Supported syntax patterns:
- `24/7` / `open 24/7`
- Weekday day ranges: `Mo-Fr 08:00-17:00`
- Comma-separated split shifts: `Mo-Fr 11:30-14:30, 17:00-22:00`
- Overnight shifts spanning midnight: `Fr-Sa 18:00-02:00`
- Explicit day closures: `Su off; Mo-Sa 10:00-18:00`
- Non-standard / missing strings gracefully return `'unknown'` and fallback to raw hours display.

### 4.8 Layout Containment & Scroll Isolation
To prevent unwanted window scroll jumps and recursive container reflows:
- **`#app-container` & `#sidebar-container`**: Configured with `position: fixed`, strict bounding bounds, and CSS `contain: strict`.
- **`poi-list-container`**: Uses `flex: 1 1 0%`, `min-height: 0`, and `overscroll-behavior: contain` to prevent flex items from expanding document body dimensions.
- **`setSelectedPOI`**: Performs internal container offset calculations and invokes `listContainer.scrollTo(...)` rather than `element.scrollIntoView(...)`, keeping scrolling strictly confined to the sidebar listing.

---

## 5. Development & Testing Commands

### 5.1 Python Pipeline Tests
```bash
# Run Python pipeline unit tests
.venv/bin/pytest tests/test_pipeline.py -v
```

### 5.2 TypeScript & Frontend Tests
```bash
# Run all Vitest unit and integration test suites
npm test

# Run Vitest in watch mode
npm run test:watch
```

### 5.3 Type Checking & Production Build
```bash
# TypeScript compiler type check
npx tsc --noEmit

# Production Vite build
npm run build

# Preview production build locally
npm run preview
```
The compiled output is emitted to `dist/`, fully self-contained and ready for static CDN or server hosting.
