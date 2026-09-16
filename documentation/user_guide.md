# ConferenceWalker - User Guide

Welcome to **ConferenceWalker**, an interactive walking distance points-of-interest (POI) explorer designed specifically for conference attendees. ConferenceWalker helps you quickly discover food, coffee, transit, lodging, and local attractions within convenient walking distances around your conference venue.

---

## Getting Started

When you open ConferenceWalker, the interactive map automatically centers on the conference venue (e.g., the Sacramento Convention Center at 1230 J Street).

The map displays:
- **OpenFreeMap Positron Basemap**: A fast, vector basemap offering clean typography and high contrast for walkshed boundaries and venue pins.
- **Conference Center Pin (📍)**: The central location of the event.
- **Walking Isochrone Polygons**: Colored concentric boundary rings representing walking travel times from the conference venue:
  - **Dark Blue (5 min)**: ~400 meters — ideal for quick session breaks.
  - **Teal (10 min)**: ~800 meters — great for a relaxed lunch.
  - **Light Green (15 min)**: ~1.2 kilometers — perfect for dinner or evening exploration.
- **Categorized Vector Icon Badges**: Color-coded badges featuring distinctive icons for all 10 categories (fork & knife for restaurants, mug for coffee, cocktail for bars, etc.).
- **On-Map Venue Name Labels**: Venue names are clearly labeled on the map beneath each icon with clean halo outlines for instant recognition.

---

## Filter Panel & Distance-Sorted Results

To maximize clarity without cluttering your screen, ConferenceWalker displays the **Filter Panel in full length by default on startup**:
1. **Curate Your Choices**: Set your preferred categories, walking distance limits, or cuisine types in the full-length filter panel.
2. **View Results**: Click the prominent **View Results** button at the bottom of the filter panel (or tap **Close Filters**) to collapse the filter view and display the results.
3. **Closer Items First**: All places in the listing are automatically sorted by approximate walking distance from the conference center, with closer venues appearing first along with precise metric distance badges (e.g. `🚶 5 min (210 m)`).
4. **Reopen Filters Anytime**: Click the **Filters (🎛️)** button in the sidebar header whenever you want to adjust your category, walk time, or cuisine preferences.

---

## Settings Panel & Data Sources

ConferenceWalker includes a dedicated **Settings Panel** accessed via the **Settings (⚙️)** button in the sidebar header. The settings panel allows you to customize data sources and enable technical inspection tools:

1. **Accessing Settings**:
   - Click the **⚙️ Settings** button in the top right of the sidebar header.
   - The settings panel smoothly opens in place of the results listing so you can configure preferences without visual distractions.
   - Click **Done** or the **✕** close button (or tap **Settings** again) when finished to return immediately to your venue results.

2. **Data Sources — Disable Overture-Only Data**:
   - **What it does**: Allows you to exclude places that are only sourced from Overture Maps.
   - **Why use it**: Remote Overture data can sometimes be noisy or feature lower positional accuracy compared to community-verified OpenStreetMap nodes. Enabling this toggle cleans up the map by showing only venues that have verified OpenStreetMap data (both OSM-only venues and venues merged across both sources).
   - **Persistence**: Your preference is saved in your browser's local storage and remembered across sessions. You can also bookmark or launch with `?exclude_overture=true` in the URL.

3. **Developer & Inspection — Show OSM & GERS IDs**:
   - **What it does**: Displays the raw OpenStreetMap node/way ID (e.g. `OSM: 90498377`) and Overture Global Entity Reference System ID (e.g. `GERS: 08f2...`) on venue cards and in the detail sheet.
   - **Why use it**: Ideal for conference organizers, cartographers, and local contributors verifying venue data or contributing fixes back to OpenStreetMap.

---

## Interactive Map & Bidirectional Selection

- **Click Any Point on the Map**: Clicking any venue icon or name label on the map instantly opens the **Venue Detail Card** and highlights and scrolls to that venue in the list on the left.
- **Click Any Listing Card**: Clicking any venue card in the list automatically centers, zooms, and highlights that marker on the map.
- **Hover Previews**: Hovering over any map marker reveals a tooltip with the venue's name and approximate walk time.

---

## Exploring Points of Interest (POIs)

### 1. Categories
You can filter venues across 10 core categories by clicking their category buttons in the sidebar:
1. **🍽️ Restaurants**: Dining, eateries, and bistros
2. **☕ Coffee / Tea**: Cafes, espresso bars, and tea houses
3. **🍸 Bars & Pubs**: Breweries, cocktail lounges, and nightlife
4. **🛒 Grocery Stores**: Supermarkets, bakeries, and markets
5. **💊 Convenience / Pharmacy**: Pharmacies and convenience stores
6. **🚆 Transit Locations**: Light rail stations, bus stops, and train centers
7. **🅿️ Parking**: Garages, surface lots, and parking structures
8. **🏨 Hotels**: Hotels, motels, and lodging
9. **🎨 Attractions & Art**: Museums, galleries, theaters, and public art
10. **🌳 Parks & Outdoors**: Public plazas, gardens, and urban parks

- **Toggle**: Click any category button to show or hide its markers.
- **All / None Shortcuts**: Use the **All** or **None** buttons at the top of the category grid to quickly enable or clear all categories.

---

### 2. Walking Distance Filter
Want to make sure you won't be late for the next conference keynote? Use the walking distance filter:
- **5 min**: Show only venues within a 5-minute walk.
- **10 min**: Show only venues within a 10-minute walk.
- **15 min**: Show only venues within a 15-minute walk.
- **> 15 min**: Show venues located farther out.
- **Presets**:
  - **≤ 10m**: Instantly enables 5 and 10-minute venues.
  - **Any**: Shows all walking distances.

---

### 3. Open Now & Opening Hours
ConferenceWalker parses OpenStreetMap opening hours against your current local device time:
- **Open Now**: Toggle the **Open Now** checkbox to hide venues that are currently closed.
- **Include Unknown Hours**: Many small shops or food trucks may not have hours listed online. Check this box to ensure unlisted venues remain visible while still filtering out verified closed venues.

---

### 4. Restaurant Cuisine Filter
Looking for Mexican, Italian, Thai, or Burgers?
- Click the **Filters (🎛️)** button in the sidebar to open the cuisine selector.
- Use the search bar to find specific cuisines (e.g. *pizza*, *tacos*, *sushi*, *vegan*).
- Select one or more cuisines. Active cuisines appear as tags at the top with a quick **Clear** button.

---

### 5. Search Bar
Use the search bar at the top of the sidebar to search by venue name, address, or cuisine keyword. The map and sidebar list update in real time as you type.

---

## Viewing Venue Details & Directions

Click any venue marker on the map or its card in the sidebar list to open the **POI Detail Card**:

### What You'll See:
- **Category Badge & Venue Name**
- **Walk Distance Badge**: Approximate walking travel time from the conference center.
- **Open / Closed Badge**: Current real-time operating status.
- **Online Reservation & Ordering Badges**: If the venue supports online reservations (e.g. OpenTable, Resy) or food ordering (e.g. Toast, DoorDash, Slice), dedicated badges appear in the header.
- **Street Address**: Formatted physical location.
- **Tappable Phone Number**: Click on mobile to dial immediately.
- **Clickable Website Link**: Opens the venue's official website or menu in a new tab.
- **Weekly Operating Hours Schedule**: When parsed with standard schedules, displays a clean day-by-day breakdown (one day per line, localized weekday names) with the **current weekday highlighted in bold**.
- **Cuisine Tags**: Listed food specialties.

### Actions:
- **★ Save / Saved**: Star the item to add it to your personal favorites.
- **📅 Reserve Table Online**: Direct link to the venue's online reservation platform (if available in source data).
- **🛍️ Order Online**: Direct link to online takeaway or delivery ordering (if available in source data).
- **🚶 Walking Directions**: Opens **GraphHopper Maps** with a turnkey walking route directly from the conference venue to the POI.
- **📱 Device Maps**: On mobile phones, opens your device's native navigation app (Google Maps, Apple Maps, or default mapping application).

---

## Saved Favorites

ConferenceWalker keeps track of your favorite places throughout the conference:
1. Click the star icon (☆) on any card, on the map, or inside the detail view to star a venue.
2. Starred venues receive a **golden outer glow halo** on the map so they always stand out.
3. Switch to the **★ Saved** tab in the sidebar header to view a dedicated listing of only your saved places.
4. **Privacy & Offline Persistence**: Favorites are saved directly in your browser's `localStorage` — no login, tracking, or cloud account required!

---

## Mobile Navigation & Embedded Iframes

- **Touch Optimizations**: All buttons and interactive cards feature large touch targets (at least 44–48px) for effortless single-thumb navigation.
- **Expandable Bottom Drawer**: On mobile phones or when embedded inside an event portal via `<iframe>`, the sidebar smoothly transforms into an expandable bottom drawer. Drag the top handle or tap the header to expand or minimize the list while viewing the map.

---

## Developer & Organizer Debug Mode

For conference organizers, cartographers, and developers debugging spatial data:
- **UI Toggle**: In the Settings panel (⚙️), check **🛠️ Show OSM & GERS IDs** to display OpenStreetMap node/way IDs and Overture GERS entity IDs directly on venue cards and in the detail sheet.
- **Console Shortcut**: Open your browser developer console (F12) and run `toggleDebug()` or `setDebug(true)` to toggle ID display on the fly.
- **URL Parameter**: Append `?debug=true` to the URL to launch directly into debug mode.
