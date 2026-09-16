# Feature Registry - ConferenceWalker

This document tracks all implemented features, capabilities, and data contracts to prevent regressions and maintain backward compatibility.

## Core Feature List

### 1. Data Preprocessing Pipeline (Python & DuckDB)
- **Multi-source Data Ingestion**: Ingestion of POIs from OpenStreetMap PBF files and Overture Maps GeoParquet on AWS S3 via DuckDB spatial and httpfs extensions.
- **10 Standardized Categories**:
  1. `convenience_pharmacy`: Convenience stores and pharmacies
  2. `restaurant`: Restaurants and eateries
  3. `parking`: Parking lots, garages, and designated spaces
  4. `transit`: Light rail, bus stations/stops, train stations, transit centers
  5. `coffee_tea`: Coffee shops, cafes, and tea houses
  6. `bar`: Bars, pubs, breweries, lounges, and nightlife
  7. `hotel`: Hotels, motels, inns, and guest accommodations
  8. `attraction_art`: Museums, galleries, theaters, public art, and points of interest
  9. `park_outdoors`: Parks, plazas, public gardens, and open outdoor spaces
  10. `grocery`: Supermarkets, grocery stores, bakeries, and markets
- **Spatial Isochrone Walkshed Tagging**: Point-in-polygon containment evaluation assigning POIs to their minimal walk time threshold (e.g., 5 min, 10 min, 15 min, or outside).
- **Spatial & Fuzzy Name Deduplication**: Proximity clustering within 25 meters combined with normalized name fuzzy matching (>= 80% similarity threshold) merging attributes across OSM and Overture without losing data.
- **OpenStreetMap Data Precedence Merging**: Strict precedence of OpenStreetMap information over Overture data during duplicate merging across coordinates (preventing positional degradation from noisy Overture coordinates), categories, venue names, formatted addresses, phone numbers, websites, and opening hours, while retaining Overture enrichment for missing fields and populating `overture_id`.
- **Genuine OpenStreetMap ID Extraction**: Extraction and reporting of canonical OpenStreetMap node/way IDs from OSM `@id` metadata (e.g. `90498377` in `osm_id` and `osm_90498377` in `id`) using `osmium export -a type,id`, replacing internal sequential numbering (`node_{idx}`).
- **Configurable Overture Confidence Threshold**: `--overture-min-confidence` CLI parameter (default: 0.6) filtering noisy or unverified remote Overture records.
- **Overture GERS Blocklist Support**: `--blocklist-gers` CLI option supporting inline IDs or file-based blocklists to exclude specific Overture GERS identifiers during preprocessing.
- **Rich Attribute Preservation**: Normalized output preserving names, addresses, phone numbers, websites, opening hours, cuisines, source references, and geographic coordinates in standardized GeoJSON.

### 2. Frontend Core Architecture & Dataset Integration
- **Zero-Framework TypeScript & Vite**: Minimal runtime footprint with fast startup, built for embedding in iframes or third-party conference websites.
- **Strongly Typed POI Schema & Contracts**: Formal TypeScript interfaces for POI attributes, 10 categories, isochrones, opening status, and multi-dimensional filter state.
- **Configurable Default Categories**: Application configuration (`src/config.ts`) permitting conference organizers to specify which categories are active by default on launch.
- **Debug Mode & Entity ID Inspection**: Debug state store toggleable via UI or browser console (`window.toggleDebug()`, `window.ConferenceWalkerDebug`) displaying OSM and GERS entity identifiers.
- **Data Loader & Schema Validator**: Runtime parsing and schema validation of region metadata (`public/data/region.json`) and POI FeatureCollections (`public/data/sacramento_pois.geojson`) with fault tolerance for missing or malformed attributes.
- **Dynamic Cuisine Extraction**: Automated extraction of distinct cuisines present in the restaurant records.

### 3. Interactive Map Engine & Marker Visualization (MapLibre GL JS)
- **Embedded & Responsive Map**: MapLibre GL JS map centered on conference coordinates (`1230 J Street, Sacramento`), responsive across desktop viewports and mobile iframe embeds.
- **OpenFreeMap Positron Basemap**: Open-source, high-contrast vector basemap (`https://tiles.openfreemap.org/styles/positron`) eliminating API keys, rate limits, and external tracking while maximizing contrast for walkshed overlays.
- **Walkshed Isochrone Layers**: Semi-transparent colored fills (`5 min`, `10 min`, `15 min`) and border outlines rendering concentric walking areas.
- **Categorized Vector Icons**: Distinct vector icon badges for all 10 POI categories rendered with category theme colors, crisp white glyphs, and high-DPI scaling.
- **Dynamic POI Name Labels**: On-map venue name labels using Noto Sans Regular glyphs, halo outlines for readability against light backgrounds, zoom-proportional scaling, and collision-aware layout.
- **High-Performance POI Vector Layers**: Hardware-accelerated symbol and circle layers color-coded by the 10 categories, supporting real-time filter expressions at 60 FPS without DOM overhead.
- **Dynamic Selection & Favorites Highlights**: Outer glow rings around saved favorites and dark selection rings around currently active venues.
- **Interactive Map Clicks & Tooltips**: Generous hit targets (16px buffer) for reliable POI click registration, hover tooltips, and bidirectional map-sidebar selection synchronization.

### 4. Multi-Dimensional Live Filtering & Opening Hours
- **Full-Length Default Filter Panel**: Filter panel displayed by default in full length with no results showing on initial launch, eliminating visual clutter and letting attendees curate options before viewing.
- **Collapse-to-View Action**: Dedicated "View Results" collapse action button transitioning seamlessly between filter configuration and distance-sorted venue cards.
- **Approximate Distance Sorting**: Venue listing sorted with closer items appearing first based on Haversine distance from the conference center, complete with metric distance badges.
- **Category Filter**: Real-time category buttons with counts for all 10 POI types, with single-click "All" and "None" shortcuts.
- **Walkshed Distance Selector**: Multi-select and preset walking tolerance toggles (`5 min`, `10 min`, `15 min`, and `> 15 min`).
- **Dynamic Restaurant Cuisine Filter**: Searchable multi-select of cuisines extracted live from the active dataset with removable tag chips.
- **OSM Opening Hours Evaluation & Weekly Schedule**: Real-time evaluator with `opening_hours.js` evaluating standard weekday hours, split shifts, 24/7 schedules, and late-night overnight shifts against client local time. Displays a user-friendly 7-day schedule (one day per line, localized weekday names) with the current weekday highlighted in bold.
- **Online Reservations & Food Ordering**: Automated extraction and UI display of online reservation links (`📅 Reservations`, e.g. OpenTable, Resy, Tock) and online food ordering links (`🛍️ Order Online`, e.g. Toast, DoorDash, ChowNow, Slice) across map tooltips, venue detail sheets, and sidebar listings.
- **Strict Layout Containment & Isolated Scrolling**: Strict CSS and JS layout containment (`contain: strict;`, `min-height: 0;`, `overscroll-behavior: contain;`) and container-isolated scrolling that prevents browser scroll-chaining, infinite body height reflows, and map canvas resize loops.
- **Open Now & Include Unknown Toggles**: Attendee options to restrict results to currently open venues, with an option to include venues with unlisted hours.
- **Overture-Only Data Exclusion Filter**: Option to filter out venues only sourced from Overture Maps (`sources: ['overture']`) to reduce noise and eliminate lower positional accuracy records, preserving all OpenStreetMap and merged places.

### 5. Detail View, Favorites, Settings, Directions & Documentation
- **Dedicated Settings Panel**: Clean configuration drawer accessible via `⚙️ Settings` in the sidebar header housing the Overture-only exclusion toggle and developer inspection tools with seamless view coordination.
- **Rich POI Detail Sheet**: Modal drawer displaying formatted address, operating hours, clickable external website links, and tappable `tel:` phone links.
- **Persistent Favorites System**: Client-side starring mechanism stored in `window.localStorage` with defensive sandboxing support, persistent map glow highlights, and a dedicated Saved tab.
- **Walking Directions Launcher**: Dynamic URL generator for **GraphHopper Maps** walking routing (`https://graphhopper.com/maps/?point=...&vehicle=foot`).
- **Mobile Navigation Hand-Off**: `geo:` URI intent generation for native device navigation on Android and iOS devices.
- **Responsive Mobile & Embed Design**: Touch targets >= 48px, mobile expandable bottom drawer, and seamless embedding inside `<iframe>` event portals without layout shifts.
- **Comprehensive Guides & Documentation**: Detailed `documentation/user_guide.md` and `documentation/developer_guide.md`.
