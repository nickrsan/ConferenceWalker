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
- **Dedicated Settings Panel**: Clean configuration drawer accessible via `⚙️ Settings` in the sidebar header housing the Overture-only exclusion toggle, basemap switcher, organizer export tool, and developer inspection tools with seamless view coordination.
- **Rich POI Detail Sheet**: Modal drawer displaying formatted address, operating hours, clickable external website links, and tappable `tel:` phone links.
- **Persistent Favorites System**: Client-side starring mechanism stored in `window.localStorage` with defensive sandboxing support, persistent map glow highlights, and a dedicated Saved tab.
- **Walking Directions Launcher**: Dynamic URL generator for **GraphHopper Maps** walking routing (`https://graphhopper.com/maps/?point=...&vehicle=foot`).
- **Mobile Navigation Hand-Off**: `geo:` URI intent generation for native device navigation on Android and iOS devices.
- **Responsive Mobile & Embed Design**: Touch targets >= 48px, mobile expandable bottom drawer, and seamless embedding inside `<iframe>` event portals without layout shifts.
- **Comprehensive Guides & Documentation**: Detailed `documentation/user_guide.md` and `documentation/developer_guide.md`.

### 6. Advanced Features, Deep Linking & Accessibility
- **URL-Triggered Saved POI Export Mode**: Administrative URL mode (`?export_saved=true` / `?export_mode=true`) providing dedicated export buttons in the header and settings drawer to export starred POIs as `default_saved_pois.json`.
- **Configurable Default Saved POIs & Startup Saved Mode**: `defaultSavedPois` and `startWithSavedOnlyByDefault` settings in `src/config.ts` allowing conference organizers to seed recommended venues and launch directly into Saved mode while letting attendees switch to full Explore view.
- **Overture Exclusion Default Lifecycle Fix**: Accurate parsing of query parameters, localStorage, and config defaults (`APP_CONFIG.excludeOvertureOnlyByDefault`) with MapLibre layer lifecycle retention ensuring map layers apply exclusions immediately upon loading.
- **Bidirectional URL Deep Linking & State Synchronization**: URL synchronization via `history.replaceState` preserving active filters (categories, walk times, cuisines, open now, nearest mode, overture exclusion), search query, active tab, basemap theme, and selected POI across page reloads and shared links.
- **OSM Mural & Public Art Classification**: Taxonomy classification in `pipeline/categories.py` mapping `artwork_type=mural`, `artwork_type=wall_painting`, `wall=mural`, `man_made=artwork`, `amenity=public_art`, and `artwork_type=street_art` to `attraction_art`.
- **Nearest POI per Enabled Category Mode**: Quick toggle (`📍 Nearest Only`) and linkable URL parameter (`?nearest=true`) filtering candidate venues to only the single closest venue to the conference center for each enabled category.
- **OpenFreeMap Vector Basemap Switcher**: Basemap style selector in Settings supporting OpenFreeMap `Positron` (Light), `Bright`, and `Liberty` vector styles without losing isochrones, POI markers, or active filter expressions.
- **Accessibility (a11y) & Automated Testing**: Full WCAG 2.1 AA compliance with semantic ARIA landmark roles (`role="dialog"`, `role="tablist"`, `role="tab"`), keyboard POI card navigation (`Enter`/`Space`), focus management and `Escape` key handlers for modal drawers, high-contrast `:focus-visible` styling, reduced-motion media query support, and automated test suites.

### 7. Resizable Sidebar, Filter Navigation, Isochrone Sync & Branding Configuration
- **Fully Resizable Left Sidebar**: Draggable vertical resize handle (`#sidebar-resizer`) on desktop viewports supporting pointer/mouse dragging and keyboard arrow navigation (`ArrowLeft`, `ArrowRight`, `Home`, `End`), with width clamping between 300px and 700px (and up to 70vw), `localStorage` persistence (`cw_sidebar_width`), and MapLibre canvas synchronization (`mapManager.resize()`).
- **Prominent Filter Navigation & Active Filter Summary**: An active filter summary bar displayed below Explore/Saved tabs when filters are collapsed, featuring a prominent "🎛️ Edit Filters" CTA button, category badges, walk distance indicators, and quick-filter chips that open the filter drawer upon interaction.
- **Isochrone Walking Distance Toggle & URL/State Sync**: Interactive toggle in Settings ("Show walking distance zones") controlling visibility of MapLibre isochrone fill, outline, and label layers (`isochrones-fill`, `isochrones-line`, `isochrones-labels`), with defaults configured in `APP_CONFIG.showIsochronesByDefault`, `localStorage` persistence (`cw_show_isochrones`), and bidirectional URL query parameter synchronization (`isochrones=true/false`).
- **Configurable Conference Subtitle & Address Pin Text**: Configuration options `conferenceSubtitle`, `conferencePinLabel`, and `conferencePinTitle` in `ConferenceWalkerConfig` allowing event organizers to customize the sidebar header subtitle and the on-map center pin marker.
- **Configurable Welcome Message / Banner**: Configuration option `welcomeHtml` in `ConferenceWalkerConfig` rendering custom rich HTML/text announcements at the top of the sidebar with a dismiss button persisting dismissal to `localStorage` (`cw_welcome_dismissed`).

### 8. Configurable Icon Sizes, Sticky Desktop Filter Action & Tab Switch Polish
- **Configurable Map Icon Sizes**: Option in Settings ("Map Icon Size") and configuration parameter (`APP_CONFIG.iconSize`) allowing users and organizers to choose between Small (Compact, 0.75x), Medium (Default, 1.0x), Large (1.3x), and Extra Large (1.65x) scaling across vector icons, background circles, favorites halos, and selection rings, with `localStorage` (`cw_icon_size`) persistence and URL synchronization (`icon_size=small|medium|large|extra-large`).
- **Sticky Desktop Results Button & Scrollable Filter Pane**: Refactored filter editing layout (`.filters-collapsible`) where the big "View X Results" button is pinned in a sticky footer action bar (`.filter-footer-actions`) at the bottom of the pane on desktop viewports, while all filter options scroll independently above it within `.filters-scroll-body`.
- **Seamless Settings Closure on Tab Switching**: Switching tabs to Explore or Saved immediately closes the Settings drawer and displays the respective POI venue listing.

### 9. High-Contrast Walking Isochrone Zones & Layer Stacking Pipeline
- **Prominent Multi-Tier Isochrone Fills**: Shaded polygon fills with high-contrast opacities (28% for 5 min, 22% for 10 min, 18% for 15 min) ensuring clear visibility on all vector basemaps (Positron, Bright, Liberty).
- **Crisp Isochrone Perimeter Outlines**: High-contrast boundary strokes (`line-width: 2.5px`, `line-opacity: 0.85`) providing clear delineation between walking time thresholds.
- **Safe Vector Fontstack & Layer Stacking**: Symbol layers configured with explicit `Noto Sans Regular` vector fontstack to eliminate glyph lookup failures on OpenFreeMap tiles, with isochrones inserted beneath POI markers and hover tooltips for crisp map legibility.

### 10. Basemap Layer Persistence, Accessible Contrast Palette, Scaled Icons, POI Descriptions & Cartes.app Integration
- **Basemap Style Switch Layer Persistence**: Fixed MapLibre style reload lifecycle in `src/map/mapManager.ts` by coordinating `styledata` and `style.load` events to reliably re-register category SVG images and restore all POI sources, circle layers, symbol markers, isochrones, selection rings, and active filter expressions when switching basemaps.
- **WCAG AA Compliant POI Category Badges**: Audited and upgraded all 10 category marker colors and SVGs (`convenience_pharmacy: #be185d`, `restaurant: #b91c1c`, `parking: #475569`, `transit: #1d4ed8`, `coffee_tea: #78350f`, `bar: #6b21a8`, `hotel: #c2410c`, `attraction_art: #854d0e`, `park_outdoors: #15803d`, `grocery: #0f766e`) to guarantee contrast ratios >= 4.5:1 against white icon glyphs and map backgrounds.
- **Scaled-Up POI Marker Dimensions**: Scaled up POI marker and circle dimensions across all presets (`small: 0.9x`, `medium: 1.2x`, `large: 1.55x`, `extra-large: 1.95x`) with increased base radius expressions for enhanced touch usability and visibility on mobile, tablet, and desktop displays.
- **OpenStreetMap POI Description Support**: Extracted `description`, `description:en`, `note`, and `comment` OSM tags during preprocessing, preserved descriptions through spatial deduplication, included descriptions in exported JSON payloads (`generateSavedPoisJson`), supported merging imported descriptions into active POIs (`mergeExportedVenues`), and rendered venue descriptions with semantic markup in the POI detail sheet.
- **Configurable Default Basemap**: Added `defaultBasemap?: BasemapStyleKey` to `ConferenceWalkerConfig` in `src/config.ts` allowing event organizers to configure initial vector basemap styles (`positron`, `bright`, `liberty`).
- **Cartes.app Navigation Integration**: Added `buildCartesAppUrl` helper in `src/utils/directions.ts` and rendered a direct "🗺️ Open in Cartes.app ↗" button in the POI detail view alongside existing walking directions and native device maps launchers.
