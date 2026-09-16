# ConferenceWalker

ConferenceWalker is an interactive, statically built
walking POI (Points of Interest) explorer designed for conference
attendees and event organizers. Centered around a conference venue,
the application visualizes concentric walking isochrones
(e.g., 5, 10, and 15-minute walksheds) and includes category filtering
relevant to people visiting a place for a short time with a common
"home base" of a conference venue. It includes live opening hours
evaluation, links to online table reservations, 
mobile ordering links, offline favorites, and walking directions.

The project combines an automated, reproducible **Python & DuckDB** spatial data pipeline with a responsive **Vanilla TypeScript + Vite + MapLibre GL JS** frontend, preconfigured with the **OpenFreeMap Positron** vector basemap.

---

## Key Features

- **10 Core POI Categories**:
  1. Convenience Stores / Pharmacies
  2. Restaurants (with multi-select cuisine filtering)
  3. Parking
  4. Transit Locations
  5. Coffee / Tea
  6. Bars
  7. Hotels
  8. Local Attractions and Art
  9. Parks and Outdoor Spaces
  10. Grocery Stores
- **OpenFreeMap Positron Vector Basemap**: Muted, high-contrast vector cartography rendered via MapLibre GL JS with zero API keys or rate limits.
- **Categorized Vector Icons & On-Map Labels**: Retina 2x marker badges color-coded by category with haloed text labels displaying venue names directly on the map.
- **Multi-Source Spatial Preprocessing Pipeline**:
  - Ingests OpenStreetMap data from PBF exports using `osmium`.
  - Queries Overture Maps places directly from remote AWS S3 GeoParquet with DuckDB spatial predicate pushdown.
  - Merges duplicate records within 25 meters having >= 80% fuzzy name similarity without losing rich attributes (phones, websites, cuisines, hours, and source IDs).
  - Tags every venue with an approximate walking distance tier (e.g. 5 min, 10 min, 15 min, >15 min) via point-in-polygon containment against concentric walking isochrones.
  - Supports configurable Overture confidence filtering (`--overture-min-confidence`) and GERS ID blocklisting (`--blocklist-gers`).
- **User-Friendly Weekly Schedule Breakdowns**:
  - Evaluates standard OSM `opening_hours` syntax via `opening_hours.js`.
  - Displays localized daily schedules (one line per weekday) with the current weekday highlighted in bold.
  - Evaluates current venue status as **Open Now**, **Closed**, or **Hours Unknown**.
- **Online Reservations & Food Ordering**:
  - Detects reservation links (OpenTable, Resy, Tock, SevenRooms, etc.) and online ordering platforms (Toast, ChowNow, DoorDash, Uber Eats, Slice, etc.).
  - Displays distinctive `📅 Reservations` and `🛍️ Order Online` icons, buttons, and badges in the detail sheet, sidebar listing, and map tooltips.
- **Distance-Sorted Sidebar & Full-Length Filter Drawer**:
  - Automatically sorts venues by distance from the conference center so closest options appear first.
  - Displays a clean, full-length filter panel on initial launch, collapsable to view results without screen crowding.
  - Configurable default categories (`src/config.ts`).
  - Strict layout containment prevents page reflow loops and scroll jumping.
- **Walking Directions & Native Mobile Navigation**:
  - Launches turnkey walking routes via [GraphHopper Maps](https://graphhopper.com/maps/).
  - Supports mobile navigation intents (`geo:`) for native map apps (Apple Maps, Google Maps).
- **Client-Side Favorites**:
  - Star venues to highlight them on the map with gold glowing halos and view them in a dedicated Favorites tab, persisted in `localStorage`.
- **Developer Debug Mode**:
  - Toggle display of raw OpenStreetMap IDs and Overture GERS IDs via the sidebar checkbox or `window.toggleDebug()` in the browser console.

---

## Generating Isochrone Walkshed Files

ConferenceWalker utilizes walking isochrone GeoJSON polygons to compute walking distance buckets from a central conference point.

You can easily generate custom isochrone GeoJSON files for any event venue worldwide using **OpenRouteService's online GUI**:

1. Open the [OpenRouteService Maps GUI](https://maps.openrouteservice.org/).
2. In the left control panel, select the **Reachability (Isochrones)** tab.
3. Choose the **Foot / Walking** routing profile (`foot-walking`).
4. Set the calculation mode to **Time** (in minutes) and enter desired intervals:
   - For example: `5, 10, 15` minutes.
5. Click on the map to set your conference center or venue address as the start point.
6. Click **Download** and choose **GeoJSON** format.
7. Save the downloaded file into the `regions/` directory (e.g., `regions/Walksheds of Sacramento FOSS4GNA 2026.json`).

The pipeline will automatically parse the conference center point and concentric isochrone boundaries from this file.

---

## Installation & Setup

### Prerequisites

- **Node.js**: Version 18.0 or newer
- **Python**: Version 3.10 or newer
- **System Utilities**: `osmium-tool` (for OSM PBF parsing) and `gdal` / `ogr2ogr` (optional)
  - Ubuntu/Debian: `sudo apt-get install -y osmium-tool gdal-bin`
  - macOS: `brew install osmium-tool gdal`

### 1. Install Node Dependencies

```bash
npm install
```

### 2. Set Up Python Environment

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r pipeline/requirements.txt
```

*(Or install core dependencies directly: `pip install duckdb rapidfuzz pytest`)*

---

## Running the Data Pipeline

To process OpenStreetMap and Overture Maps data for a region:

```bash
# Activate Python virtual environment
source .venv/bin/activate

# Execute the preprocessing pipeline
python3 -m pipeline.preprocess \
  --region "regions/Walksheds of Sacramento FOSS4GNA 2026.json" \
  --osm-pbf "regions/SacramentoCore.osm.pbf" \
  --output "public/data/sacramento_pois.geojson" \
  --overture-min-confidence 0.6 \
  --blocklist-gers "08f2e9a, 08f2e9b"
```

### Pipeline Options

| Option | Description | Default |
|---|---|---|
| `--region` | Path to the region isochrone GeoJSON file | Required |
| `--osm-pbf` | Path to the regional OSM PBF extract | Optional |
| `--output` | Destination path for the processed POI GeoJSON | `public/data/sacramento_pois.geojson` |
| `--overture-min-confidence` | Minimum Overture Maps confidence threshold (0.0 – 1.0) | `0.5` |
| `--blocklist-gers` | Comma-separated list or path to a text file of GERS IDs to exclude | None |
| `--max-distance` | Maximum proximity radius in meters for deduplication merging | `25.0` |
| `--min-similarity` | Minimum fuzzy string similarity percentage for name matching | `80.0` |

---

## Building and Running the Web Application

### Development Server

Start the local development server with instant Hot Module Replacement (HMR):

```bash
npm run dev
```

Visit `http://localhost:5173` in your browser.

### Production Build

Compile and bundle the production-ready static assets:

```bash
npm run build
```

The compiled output is generated in the `dist/` directory, ready to be deployed to any static web host, CDN, or embedded inside an `<iframe>` on a host conference portal.

### Local Preview

Preview the production build locally:

```bash
npm run preview
```

---

## Running Automated Tests

ConferenceWalker includes a comprehensive test suite across both TypeScript frontend modules and the Python data pipeline:

```bash
# Run all TypeScript unit and integration tests (Vitest)
npm test

# Run TypeScript typecheck
npx tsc --noEmit

# Run Python pipeline tests (Pytest)
.venv/bin/pytest
```

---

## Project Structure

```
ConferenceWalker/
├── documentation/
│   ├── developer_guide.md       # Technical architecture and API documentation
│   └── user_guide.md            # Interactive attendee user guide
├── pipeline/
│   ├── categories.py            # OSM tag and Overture taxonomy classification
│   ├── dedupe.py                # Spatial proximity and fuzzy name deduplication
│   ├── isochrones.py            # Point-in-polygon containment & walkshed tagging
│   └── preprocess.py            # CLI pipeline script (DuckDB S3 & OSM)
├── public/
│   └── data/
│       ├── region.json          # Conference center point and isochrone metadata
│       └── sacramento_pois.geojson # Enriched, tagged, and deduplicated POIs
├── regions/
│   └── Walksheds of Sacramento FOSS4GNA 2026.json # Sample walking isochrones
├── src/
│   ├── map/
│   │   ├── mapManager.ts        # MapLibre GL JS engine, layers, labels, and hit testing
│   │   └── mapStyles.ts         # OpenFreeMap Positron config & 2x SVG icon badges
│   ├── services/
│   │   └── dataLoader.ts        # GeoJSON validation and loader
│   ├── state/
│   │   ├── debugState.ts        # Developer debug mode store & console hook
│   │   ├── favorites.ts         # LocalStorage favorites persistence
│   │   └── filterState.ts       # Multi-dimensional reactive filter store
│   ├── types/
│   │   └── poi.ts               # Domain models, category metadata, and interfaces
│   ├── ui/
│   │   ├── categoryFilter.ts    # Category grid selector
│   │   ├── cuisineFilter.ts     # Restaurant cuisine multi-select
│   │   ├── poiDetail.ts         # POI detail card, weekly hours, and actions
│   │   ├── sidebar.ts           # Collapsible sidebar, distance sorting, search
│   │   └── walkDistanceFilter.ts# Walkshed selector (5, 10, 15 min)
│   ├── utils/
│   │   ├── directions.ts        # GraphHopper and mobile intent URL builders
│   │   └── openingHours.ts      # OSM opening hours evaluation & weekly parser
│   ├── config.ts                # Application configuration & default categories
│   ├── main.ts                  # Application bootstrap and orchestrator
│   └── style.css                # Responsive stylesheet and touch-friendly controls
├── tests/                       # TypeScript and Python test suites
├── FEATURES.md                  # Running feature registry
├── package.json                 # Node dependencies and npm scripts
├── tsconfig.json                # TypeScript configuration
└── vite.config.ts               # Vite bundler configuration
```

---

## Disclaimer & License

This project was generated by **Junie**, an autonomous LLM development agent from JetBrains. Nick Santos guided development.

ConferenceWalker is released as open-source software under the [MIT License](LICENSE).

Pull requests, feature suggestions, and conference region contributions are very welcome! Feel free to open an issue or submit a pull request.
