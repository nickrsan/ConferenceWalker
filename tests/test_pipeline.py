"""
Unit tests for the ConferenceWalker Python preprocessing pipeline.

Validates:
  1. Category classification for OpenStreetMap and Overture Maps data.
  2. Spatial point-in-polygon containment and walkshed walk-time assignment (5 min, 10 min, 15 min).
  3. Haversine spatial distance calculations.
  4. Fuzzy string normalization and similarity matching.
  5. Proximity and name deduplication merging without loss of rich attributes.
  6. Prevention of false merges for distinct branches (e.g. chains separated by >25m).
"""

import math
import pytest
from pipeline.categories import (
    classify_osm_tags,
    classify_overture_place,
    clean_cuisine_string,
    CATEGORY_CONVENIENCE_PHARMACY,
    CATEGORY_RESTAURANT,
    CATEGORY_PARKING,
    CATEGORY_TRANSIT,
    CATEGORY_COFFEE_TEA,
    CATEGORY_BAR,
    CATEGORY_HOTEL,
    CATEGORY_ATTRACTION_ART,
    CATEGORY_PARK_OUTDOORS,
    CATEGORY_GROCERY,
)
from pipeline.isochrones import (
    point_in_ring,
    point_in_polygon_geometry,
    Isochrone,
    RegionMetadata,
    load_region,
)
from pipeline.dedupe import (
    haversine_distance_meters,
    normalize_name,
    compute_name_similarity,
    is_poi_match,
    merge_two_pois,
    deduplicate_pois,
)


class TestCategoryClassification:
    """Tests for classifying OSM tags and Overture categories into 10 target categories."""

    def test_osm_category_mappings(self):
        # Coffee / Tea
        cat, _ = classify_osm_tags({"amenity": "cafe"})
        assert cat == CATEGORY_COFFEE_TEA

        # Bar
        cat, _ = classify_osm_tags({"amenity": "pub"})
        assert cat == CATEGORY_BAR

        # Restaurant
        cat, cuisines = classify_osm_tags({"amenity": "restaurant", "cuisine": "mexican;tacos"})
        assert cat == CATEGORY_RESTAURANT
        assert "mexican" in cuisines
        assert "tacos" in cuisines

        # Convenience / Pharmacy
        cat, _ = classify_osm_tags({"amenity": "pharmacy"})
        assert cat == CATEGORY_CONVENIENCE_PHARMACY
        cat, _ = classify_osm_tags({"shop": "convenience"})
        assert cat == CATEGORY_CONVENIENCE_PHARMACY

        # Parking
        cat, _ = classify_osm_tags({"amenity": "parking"})
        assert cat == CATEGORY_PARKING

        # Transit
        cat, _ = classify_osm_tags({"railway": "tram_stop"})
        assert cat == CATEGORY_TRANSIT
        cat, _ = classify_osm_tags({"highway": "bus_stop"})
        assert cat == CATEGORY_TRANSIT

        # Hotel
        cat, _ = classify_osm_tags({"tourism": "hotel"})
        assert cat == CATEGORY_HOTEL

        # Attraction & Art
        cat, _ = classify_osm_tags({"tourism": "museum"})
        assert cat == CATEGORY_ATTRACTION_ART
        cat, _ = classify_osm_tags({"amenity": "arts_centre"})
        assert cat == CATEGORY_ATTRACTION_ART

        # Parks & Outdoors
        cat, _ = classify_osm_tags({"leisure": "park"})
        assert cat == CATEGORY_PARK_OUTDOORS

        # Grocery
        cat, _ = classify_osm_tags({"shop": "supermarket"})
        assert cat == CATEGORY_GROCERY

    def test_overture_category_mappings(self):
        cat, cuisines = classify_overture_place("italian_restaurant")
        assert cat == CATEGORY_RESTAURANT
        assert "italian" in cuisines

        cat, _ = classify_overture_place("coffee_shop")
        assert cat == CATEGORY_COFFEE_TEA

        cat, _ = classify_overture_place("cocktail_bar")
        assert cat == CATEGORY_BAR

        cat, _ = classify_overture_place("convenience_store")
        assert cat == CATEGORY_CONVENIENCE_PHARMACY

        cat, _ = classify_overture_place("parking_garage")
        assert cat == CATEGORY_PARKING

        cat, _ = classify_overture_place("light_rail_station")
        assert cat == CATEGORY_TRANSIT

        cat, _ = classify_overture_place("hotel")
        assert cat == CATEGORY_HOTEL

        cat, _ = classify_overture_place("art_gallery")
        assert cat == CATEGORY_ATTRACTION_ART

        cat, _ = classify_overture_place("urban_park")
        assert cat == CATEGORY_PARK_OUTDOORS

        cat, _ = classify_overture_place("supermarket")
        assert cat == CATEGORY_GROCERY


class TestIsochroneSpatialTagging:
    """Tests for spatial containment and walk time tagging (Scenario 1)."""

    @pytest.fixture
    def test_region(self):
        # Create 3 concentric rectangular polygons centered at (0, 0)
        # 5 min box: [-1, -1] to [1, 1]
        ring_5 = [[-1.0, -1.0], [1.0, -1.0], [1.0, 1.0], [-1.0, 1.0], [-1.0, -1.0]]
        geom_5 = {"type": "Polygon", "coordinates": [ring_5]}
        iso_5 = Isochrone(5, geom_5, "#2b83ba", "#2b83ba", "5 min")

        # 10 min box: [-2, -2] to [2, 2]
        ring_10 = [[-2.0, -2.0], [2.0, -2.0], [2.0, 2.0], [-2.0, 2.0], [-2.0, -2.0]]
        geom_10 = {"type": "Polygon", "coordinates": [ring_10]}
        iso_10 = Isochrone(10, geom_10, "#64abb0", "#64abb0", "10 min")

        # 15 min box: [-3, -3] to [3, 3]
        ring_15 = [[-3.0, -3.0], [3.0, -3.0], [3.0, 3.0], [-3.0, 3.0], [-3.0, -3.0]]
        geom_15 = {"type": "Polygon", "coordinates": [ring_15]}
        iso_15 = Isochrone(15, geom_15, "#9dd3a7", "#9dd3a7", "15 min")

        return RegionMetadata(
            name="Test Venue",
            center=(0.0, 0.0),
            isochrones=[iso_5, iso_10, iso_15],
            bbox=(-3.5, -3.5, 3.5, 3.5),
            raw_geojson={}
        )

    def test_walk_time_concentric_assignment(self, test_region):
        # Inside 5 min walkshed
        assert test_region.tag_walk_time(0.5, 0.5) == 5

        # Inside 10 min walkshed, but outside 5 min
        assert test_region.tag_walk_time(1.5, 1.5) == 10

        # Inside 15 min walkshed, but outside 10 min
        assert test_region.tag_walk_time(2.5, 2.5) == 15

        # Outside all walksheds
        assert test_region.tag_walk_time(5.0, 5.0) is None

    def test_point_in_polygon_with_hole(self):
        # Exterior: [-2, -2] to [2, 2]
        exterior = [[-2.0, -2.0], [2.0, -2.0], [2.0, 2.0], [-2.0, 2.0], [-2.0, -2.0]]
        # Hole: [-0.5, -0.5] to [0.5, 0.5]
        hole = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5], [-0.5, -0.5]]
        geom = {"type": "Polygon", "coordinates": [exterior, hole]}

        # Point inside hole should return False
        assert point_in_polygon_geometry(0.0, 0.0, geom) is False
        # Point in solid polygon region should return True
        assert point_in_polygon_geometry(1.0, 1.0, geom) is True
        # Point outside exterior should return False
        assert point_in_polygon_geometry(3.0, 3.0, geom) is False


class TestSpatialDistanceAndSimilarity:
    """Tests for Haversine distance and fuzzy name matching."""

    def test_haversine_known_coordinates(self):
        # Distance between (0, 0) and (0, 1) latitude is roughly 111.19 km
        dist = haversine_distance_meters(0.0, 0.0, 0.0, 1.0)
        assert 111000 <= dist <= 112000

        # Zero distance
        assert haversine_distance_meters(-121.49, 38.57, -121.49, 38.57) == 0.0

    def test_name_normalization(self):
        assert normalize_name("The Temple Coffee Roasters, LLC") == "temple coffee roasters"
        assert normalize_name("McDonald's") == "mcdonalds"
        assert normalize_name("Peet's Coffee & Tea Inc.") == "peets coffee tea"

    def test_name_similarity_variations(self):
        # High similarity
        sim = compute_name_similarity("Temple Coffee Roasters", "Temple Coffee")
        assert sim >= 80.0

        # Completely different
        sim = compute_name_similarity("Starbucks", "Subway Sandwiches")
        assert sim < 40.0


class TestDeduplication:
    """Tests for merging overlapping venues (Scenario 2 and Edge Cases)."""

    def test_deduplication_and_attribute_merging(self):
        # Scenario 2 from Technical Design:
        # Given OSM POI: "Temple Coffee Roasters", coords: [-121.490, 38.579], phone: "916-555-0100"
        # and Overture POI: "Temple Coffee", coords: [-121.4901, 38.57905], website: "https://templecoffee.com"
        osm_poi = {
            "id": "osm_101",
            "name": "Temple Coffee Roasters",
            "category": "coffee_tea",
            "coordinates": [-121.490, 38.579],
            "walk_time_minutes": 5,
            "address": "2829 S St",
            "phone": "916-555-0100",
            "website": None,
            "opening_hours": "Mo-Su 06:00-20:00",
            "cuisines": ["coffee"],
            "sources": ["osm"],
            "osm_id": "node_101",
            "overture_id": None,
        }

        overture_poi = {
            "id": "overture_999",
            "name": "Temple Coffee",
            "category": "coffee_tea",
            "coordinates": [-121.4901, 38.57905],
            "walk_time_minutes": 5,
            "address": "2829 S St",
            "phone": None,
            "website": "https://templecoffee.com",
            "opening_hours": None,
            "cuisines": ["coffee_shop"],
            "sources": ["overture"],
            "osm_id": None,
            "overture_id": "overture_999",
        }

        # Distance is ~10m (< 25m) and name similarity is >= 80%
        merged_list = deduplicate_pois([osm_poi, overture_poi], max_distance_meters=25.0, min_similarity=80.0)

        assert len(merged_list) == 1
        merged = merged_list[0]
        assert "Temple Coffee" in merged["name"]
        assert merged["phone"] == "916-555-0100"
        assert merged["website"] == "https://templecoffee.com"
        assert merged["opening_hours"] == "Mo-Su 06:00-20:00"
        assert set(merged["sources"]) == {"osm", "overture"}
        assert merged["osm_id"] == "node_101"
        assert merged["overture_id"] == "overture_999"
        # OpenStreetMap coordinates take precedence over noisy Overture coordinates
        assert merged["coordinates"] == [-121.490, 38.579]

    def test_osm_takes_precedence_over_overture_when_merging(self):
        """
        Verify that OpenStreetMap data strictly takes precedence over Overture data
        for coordinates, name, category, address, phone, website, and opening hours.
        """
        osm_poi = {
            "id": "osm_90498377",
            "name": "Midtown Eatery",
            "category": "restaurant",
            "coordinates": [-121.4851234, 38.5756789],
            "walk_time_minutes": 5,
            "address": "1200 K St",
            "phone": "916-111-2222",
            "website": "https://midtown-eatery.com",
            "opening_hours": "Mo-Fr 08:00-22:00",
            "cuisines": ["american"],
            "sources": ["osm"],
            "osm_id": "90498377",
            "overture_id": None,
        }

        overture_poi = {
            "id": "overture_08f2e9",
            "name": "Midtown Eatery - Sacramento Branch",
            "category": "coffee_tea",  # Conflicting category
            "coordinates": [-121.4852500, 38.5757500],  # Noisy position ~15m away
            "walk_time_minutes": 10,
            "address": "1200 K Street Suite 100",
            "phone": "916-999-8888",
            "website": "https://overture-outdated-link.com",
            "opening_hours": "Mo-Su 09:00-21:00",
            "cuisines": ["diner"],
            "sources": ["overture"],
            "osm_id": None,
            "overture_id": "08f2e9",
        }

        # Case 1: OSM passed first
        merged_1 = merge_two_pois(osm_poi, overture_poi)
        assert merged_1["coordinates"] == [-121.4851234, 38.5756789], "OSM coordinates must take precedence"
        assert merged_1["name"] == "Midtown Eatery", "OSM name must take precedence"
        assert merged_1["category"] == "restaurant", "OSM category must take precedence"
        assert merged_1["address"] == "1200 K St", "OSM address must take precedence"
        assert merged_1["phone"] == "916-111-2222", "OSM phone must take precedence"
        assert merged_1["website"] == "https://midtown-eatery.com", "OSM website must take precedence"
        assert merged_1["opening_hours"] == "Mo-Fr 08:00-22:00", "OSM opening hours must take precedence"
        assert merged_1["walk_time_minutes"] == 5, "OSM walk time must take precedence"
        assert set(merged_1["sources"]) == {"osm", "overture"}
        assert merged_1["osm_id"] == "90498377"
        assert merged_1["overture_id"] == "08f2e9"

        # Case 2: Overture passed first (order independence)
        merged_2 = merge_two_pois(overture_poi, osm_poi)
        assert merged_2["coordinates"] == [-121.4851234, 38.5756789], "OSM coordinates must take precedence regardless of argument order"
        assert merged_2["name"] == "Midtown Eatery"
        assert merged_2["category"] == "restaurant"
        assert merged_2["address"] == "1200 K St"
        assert merged_2["phone"] == "916-111-2222"
        assert merged_2["website"] == "https://midtown-eatery.com"
        assert merged_2["opening_hours"] == "Mo-Fr 08:00-22:00"
        assert merged_2["walk_time_minutes"] == 5
        assert set(merged_2["sources"]) == {"osm", "overture"}
        assert merged_2["osm_id"] == "90498377"
        assert merged_2["overture_id"] == "08f2e9"

    def test_prevent_false_merge_of_chain_branches(self):
        # Two Starbucks separated by 200m should NOT merge
        branch1 = {
            "id": "osm_1",
            "name": "Starbucks",
            "category": "coffee_tea",
            "coordinates": [-121.490, 38.579],
            "walk_time_minutes": 5,
            "sources": ["osm"]
        }
        branch2 = {
            "id": "osm_2",
            "name": "Starbucks",
            "category": "coffee_tea",
            "coordinates": [-121.4925, 38.580],  # ~250m away
            "walk_time_minutes": 10,
            "sources": ["osm"]
        }

        results = deduplicate_pois([branch1, branch2], max_distance_meters=25.0, min_similarity=80.0)
        assert len(results) == 2


class TestPipelineIntegration:
    """End-to-end integration tests with region and output GeoJSON."""

    def test_load_gers_blocklist(self, tmp_path):
        from pipeline.preprocess import load_gers_blocklist

        # 1. Comma/space string input
        res1 = load_gers_blocklist("08f2e9a, 08f2e9b, 08f2e9c")
        assert res1 == {"08f2e9a", "08f2e9b", "08f2e9c"}

        # 2. File input with comments and whitespace
        block_file = tmp_path / "blocklist.txt"
        block_file.write_text("# Blocklist file\n08f2abc\n\n08f2def\n# comment\n08f2ghi\n")
        res2 = load_gers_blocklist(str(block_file))
        assert res2 == {"08f2abc", "08f2def", "08f2ghi"}

        # 3. None or empty string input
        assert load_gers_blocklist(None) == set()
        assert load_gers_blocklist("") == set()

    def test_load_real_sacramento_region(self):
        region = load_region("regions/Walksheds of Sacramento FOSS4GNA 2026.json")
        assert "Sacramento" in region.name or "1230 J Street" in region.name
        assert len(region.isochrones) == 3
        assert [iso.minutes for iso in region.isochrones] == [5, 10, 15]
        # Conference center coordinates
        lon, lat = region.center
        assert math.isclose(lon, -121.489857, abs_tol=1e-4)
        assert math.isclose(lat, 38.579250, abs_tol=1e-4)

    def test_geojson_conversion_and_schema(self):
        from pipeline.preprocess import convert_pois_to_geojson, extract_reservation_url, extract_order_url

        # Test extraction of reservation URLs from OSM tags
        osm_res_tags = {"reservation:website": "https://resy.com/cities/sac/venue", "amenity": "restaurant"}
        assert extract_reservation_url(osm_res_tags) == "https://resy.com/cities/sac/venue"

        # Test extraction of reservation URLs from website domain matching
        assert extract_reservation_url({"website": "https://www.opentable.com/r/sacramento-bistro"}) == "https://www.opentable.com/r/sacramento-bistro"
        assert extract_reservation_url({}, ["https://exploretock.com/venue"]) == "https://exploretock.com/venue"

        # Test extraction of ordering URLs from OSM tags
        osm_ord_tags = {"order:website": "https://direct.chownow.com/order/123", "amenity": "restaurant"}
        assert extract_order_url(osm_ord_tags) == "https://direct.chownow.com/order/123"

        # Test extraction of ordering URLs from domain matching
        assert extract_order_url({"website": "https://order.toasttab.com/online/sac-bakery"}) == "https://order.toasttab.com/online/sac-bakery"
        assert extract_order_url({}, ["https://www.doordash.com/store/sac-ramen"]) == "https://www.doordash.com/store/sac-ramen"

        sample_pois = [
            {
                "id": "osm_1",
                "name": "Sacramento Cafe",
                "category": "coffee_tea",
                "coordinates": [-121.49, 38.58],
                "walk_time_minutes": 5,
                "address": "1000 K St",
                "phone": "916-555-1234",
                "website": "https://example.com",
                "opening_hours": "Mo-Fr 07:00-17:00",
                "cuisines": ["coffee"],
                "sources": ["osm"],
                "osm_id": "1",
                "overture_id": None,
                "reservation_url": "https://resy.com/sac-cafe",
                "order_url": "https://toasttab.com/sac-cafe",
            }
        ]
        geojson = convert_pois_to_geojson(sample_pois)
        assert geojson["type"] == "FeatureCollection"
        assert len(geojson["features"]) == 1
        feat = geojson["features"][0]
        assert feat["geometry"]["type"] == "Point"
        assert feat["geometry"]["coordinates"] == [-121.49, 38.58]
        props = feat["properties"]
        assert props["id"] == "osm_1"
        assert props["name"] == "Sacramento Cafe"
        assert props["category"] == "coffee_tea"
        assert props["walk_time_minutes"] == 5
        assert props["cuisines"] == ["coffee"]
        assert props["reservation_url"] == "https://resy.com/sac-cafe"
        assert props["order_url"] == "https://toasttab.com/sac-cafe"

    def test_deduplication_preserves_reservation_and_order_urls(self):
        poi_a = {
            "id": "osm_10",
            "name": "Midtown Tavern",
            "category": "restaurant",
            "coordinates": [-121.48, 38.57],
            "walk_time_minutes": 5,
            "sources": ["osm"],
            "reservation_url": "https://opentable.com/r/midtown-tavern",
            "order_url": None,
        }
        poi_b = {
            "id": "overture_20",
            "name": "Midtown Tavern",
            "category": "restaurant",
            "coordinates": [-121.48005, 38.57002],
            "walk_time_minutes": 5,
            "sources": ["overture"],
            "reservation_url": None,
            "order_url": "https://toasttab.com/midtown-tavern",
        }
        merged_list = deduplicate_pois([poi_a, poi_b], max_distance_meters=25.0, min_similarity=80.0)
        assert len(merged_list) == 1
        m = merged_list[0]
        assert m["reservation_url"] == "https://opentable.com/r/midtown-tavern"
        assert m["order_url"] == "https://toasttab.com/midtown-tavern"

    def test_extract_osm_genuine_node_ids_from_pbf(self):
        """
        Verify that extract_osm_pois returns genuine OpenStreetMap node IDs
        (such as numeric IDs from @id) rather than sequential internal numbering ('node_0', 'node_1').
        """
        from pipeline.preprocess import extract_osm_pois
        region = load_region("regions/Walksheds of Sacramento FOSS4GNA 2026.json")
        pois = extract_osm_pois("regions/SacramentoCore.osm.pbf", region)

        assert len(pois) > 0, "Should extract POIs from SacramentoCore.osm.pbf"

        # Check first 50 POIs to ensure genuine numeric IDs are reported
        for poi in pois[:50]:
            osm_id = poi["osm_id"]
            # Genuine OSM IDs are numeric strings (node or way IDs)
            assert osm_id is not None
            assert not osm_id.startswith("node_"), f"OSM ID {osm_id} must not be internal 'node_{{idx}}' numbering"
            assert osm_id.isdigit(), f"Expected numeric OSM ID, got '{osm_id}'"
            assert poi["id"] == f"osm_{osm_id}"
