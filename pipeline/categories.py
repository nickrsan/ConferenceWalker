"""
Category taxonomy and classification rules for ConferenceWalker.

This module provides mapping logic to classify OpenStreetMap tags and Overture Maps
places into 10 standardized point-of-interest (POI) categories:
  1. convenience_pharmacy: Convenience stores and pharmacies
  2. restaurant: Restaurants and eateries
  3. parking: Parking lots, garages, and designated spaces
  4. transit: Light rail, bus stations/stops, train stations, transit centers
  5. coffee_tea: Coffee shops, cafes, and tea houses
  6. bar: Bars, pubs, breweries, lounges, and nightlife
  7. hotel: Hotels, motels, inns, and guest accommodations
  8. attraction_art: Museums, galleries, theaters, public art, and points of interest
  9. park_outdoors: Parks, plazas, public gardens, and open outdoor spaces
  10. grocery: Supermarkets, grocery stores, bakeries, and markets
"""

from typing import Optional, Tuple, List, Set
import re

# 10 core standardized categories
CATEGORY_CONVENIENCE_PHARMACY = "convenience_pharmacy"
CATEGORY_RESTAURANT = "restaurant"
CATEGORY_PARKING = "parking"
CATEGORY_TRANSIT = "transit"
CATEGORY_COFFEE_TEA = "coffee_tea"
CATEGORY_BAR = "bar"
CATEGORY_HOTEL = "hotel"
CATEGORY_ATTRACTION_ART = "attraction_art"
CATEGORY_PARK_OUTDOORS = "park_outdoors"
CATEGORY_GROCERY = "grocery"

VALID_CATEGORIES: Set[str] = {
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
}

CATEGORY_DISPLAY_NAMES = {
    CATEGORY_CONVENIENCE_PHARMACY: "Convenience & Pharmacy",
    CATEGORY_RESTAURANT: "Restaurants",
    CATEGORY_PARKING: "Parking",
    CATEGORY_TRANSIT: "Transit Locations",
    CATEGORY_COFFEE_TEA: "Coffee & Tea",
    CATEGORY_BAR: "Bars & Pubs",
    CATEGORY_HOTEL: "Hotels & Lodging",
    CATEGORY_ATTRACTION_ART: "Local Attractions & Art",
    CATEGORY_PARK_OUTDOORS: "Parks & Outdoors",
    CATEGORY_GROCERY: "Grocery Stores",
}

# Known cuisines for extraction and normalization
KNOWN_CUISINES: Set[str] = {
    "american", "asian", "bakery", "barbecue", "bbq", "bistro", "breakfast",
    "burger", "burgers", "burrito", "cafe", "cajun", "caribbean", "chinese",
    "crepe", "deli", "dessert", "dim_sum", "diner", "donuts", "ethiopian",
    "fast_food", "filipino", "fish_and_chips", "french", "german", "greek",
    "grill", "hawaiian", "ice_cream", "indian", "indonesian", "irish",
    "italian", "japanese", "korean", "latin_american", "lebanese",
    "mediterranean", "mexican", "middle_eastern", "moroccan", "noodles",
    "pakistani", "pan-asian", "pasta", "persian", "peruvian", "pizza",
    "pub_food", "ramen", "russian", "salad", "sandwich", "sandwiches",
    "seafood", "soup", "south_american", "southern", "spanish", "steak",
    "steakhouse", "sushi", "tapas", "tex-mex", "thai", "tibetan", "turkish",
    "vegan", "vegetarian", "vietnamese", "wings"
}


def clean_cuisine_string(cuisine_str: Optional[str]) -> List[str]:
    """
    Parse a raw cuisine tag (e.g. from OSM 'italian;pizza' or 'mexican')
    into a sorted list of clean, normalized cuisine tokens.
    """
    if not cuisine_str:
        return []

    tokens: Set[str] = set()
    # Split by semicolon, comma, slash, or pipe
    raw_parts = re.split(r"[;,/|]", str(cuisine_str).lower())
    for part in raw_parts:
        part = part.strip().replace(" ", "_")
        if part:
            tokens.add(part)
    return sorted(list(tokens))


def classify_osm_tags(tags: dict) -> Tuple[Optional[str], List[str]]:
    """
    Classify an OpenStreetMap feature based on its tags into one of the 10
    categories, and extract any associated cuisine tags.

    Returns:
        (category_id, list_of_cuisines)
        If not in any of the 10 target categories, category_id is None.
    """
    amenity = tags.get("amenity", "").strip().lower()
    shop = tags.get("shop", "").strip().lower()
    tourism = tags.get("tourism", "").strip().lower()
    leisure = tags.get("leisure", "").strip().lower()
    highway = tags.get("highway", "").strip().lower()
    railway = tags.get("railway", "").strip().lower()
    public_transport = tags.get("public_transport", "").strip().lower()
    historic = tags.get("historic", "").strip().lower()
    landuse = tags.get("landuse", "").strip().lower()

    cuisines: List[str] = clean_cuisine_string(tags.get("cuisine"))

    # 1. Coffee / Tea
    if amenity in {"cafe", "coffee_shop"} or shop in {"coffee", "tea"}:
        return CATEGORY_COFFEE_TEA, cuisines

    # 2. Bars & Nightlife
    if amenity in {"bar", "pub", "nightclub", "biergarten", "lounge"}:
        return CATEGORY_BAR, cuisines

    # 3. Restaurants & Dining
    if amenity in {"restaurant", "fast_food", "food_court"}:
        return CATEGORY_RESTAURANT, cuisines

    # 4. Convenience Stores & Pharmacies
    if amenity in {"pharmacy", "convenience"} or shop in {"convenience", "chemist", "pharmacy", "drugstore"}:
        return CATEGORY_CONVENIENCE_PHARMACY, cuisines

    # 5. Parking
    if amenity in {"parking", "parking_space", "parking_entrance", "bicycle_parking"}:
        return CATEGORY_PARKING, []

    # 6. Transit Locations
    if (
        amenity in {"bus_station", "ferry_terminal"}
        or highway in {"bus_stop", "platform"}
        or railway in {"station", "tram_stop", "subway_entrance", "halt", "platform", "stop"}
        or public_transport in {"station", "stop_position", "platform"}
    ):
        return CATEGORY_TRANSIT, []

    # 7. Hotels & Lodging
    if tourism in {"hotel", "motel", "hostel", "guest_house", "bed_and_breakfast", "chalet", "apartment"}:
        return CATEGORY_HOTEL, []

    # 8. Local Attractions & Art
    if (
        tourism in {"museum", "gallery", "artwork", "attraction", "viewpoint", "theme_park", "zoo", "aquarium"}
        or amenity in {"arts_centre", "theatre", "cinema", "planetarium", "gallery"}
        or historic in {"monument", "memorial", "castle", "ruins", "archaeological_site"}
    ):
        return CATEGORY_ATTRACTION_ART, []

    # 9. Parks & Outdoor Spaces
    if (
        leisure in {"park", "garden", "nature_reserve", "playground", "dog_park", "pitch", "recreation_ground"}
        or landuse in {"village_green", "recreation_ground"}
    ):
        return CATEGORY_PARK_OUTDOORS, []

    # 10. Grocery Stores & Markets
    if shop in {
        "supermarket", "grocery", "greengrocer", "bakery", "deli",
        "butcher", "seafood", "farm", "general", "cheese", "spices"
    }:
        return CATEGORY_GROCERY, cuisines

    return None, []


def classify_overture_place(primary_category: Optional[str], alternate_categories: Optional[List[str]] = None) -> Tuple[Optional[str], List[str]]:
    """
    Classify an Overture Maps place based on its primary category (and alternate categories)
    into one of the 10 categories, and extract cuisine information if applicable.

    Returns:
        (category_id, list_of_cuisines)
        If not in any of the 10 target categories, category_id is None.
    """
    if not primary_category:
        return None, []

    cat = primary_category.strip().lower()
    alts = [c.strip().lower() for c in (alternate_categories or [])]
    all_cats = [cat] + alts

    cuisines: Set[str] = set()

    # Extract cuisine hints from restaurant categories (e.g. "mexican_restaurant" -> "mexican")
    for c in all_cats:
        if c.endswith("_restaurant"):
            prefix = c[:-11].strip("_")
            if prefix and prefix not in {"fast_food", "family", "buffet", "drive_thru"}:
                cuisines.add(prefix)
        elif c in KNOWN_CUISINES:
            cuisines.add(c)

    # 1. Coffee / Tea
    if any(k in cat for k in ["coffee_shop", "tea_house", "bubble_tea"]) or cat == "cafe":
        return CATEGORY_COFFEE_TEA, sorted(list(cuisines))

    # 2. Bars & Nightlife
    if any(k in cat for k in [
        "bar", "pub", "brewery", "distillery", "winery", "wine_bar",
        "cocktail_bar", "nightclub", "lounge", "beer_bar", "speakeasy",
        "tasting_room", "sports_bar", "dive_bar"
    ]):
        return CATEGORY_BAR, sorted(list(cuisines))

    # 3. Convenience Stores & Pharmacies
    if any(k in cat for k in ["pharmacy", "drugstore", "convenience_store"]):
        return CATEGORY_CONVENIENCE_PHARMACY, []

    # 4. Restaurants & Dining
    if (
        any(k in cat for k in [
            "restaurant", "diner", "bistro", "fast_food", "pizzeria",
            "steakhouse", "sandwich_shop", "noodle_shop", "food_court",
            "taco_truck", "food_truck", "eatery", "creperie", "ramen_restaurant",
            "sushi_restaurant", "taqueria"
        ])
        or any(k in cat for k in KNOWN_CUISINES)
    ):
        return CATEGORY_RESTAURANT, sorted(list(cuisines))

    # 5. Parking
    if any(k in cat for k in ["parking", "parking_lot", "parking_garage", "parking_structure"]):
        return CATEGORY_PARKING, []

    # 6. Transit Locations
    if any(k in cat for k in [
        "bus_station", "bus_stop", "train_station", "subway_station",
        "light_rail_station", "transit_station", "transit_stop",
        "ferry_terminal", "public_transportation"
    ]):
        return CATEGORY_TRANSIT, []

    # 7. Hotels & Lodging
    if any(k in cat for k in [
        "hotel", "motel", "inn", "hostel", "bed_and_breakfast",
        "lodging", "resort", "extended_stay_hotel"
    ]):
        return CATEGORY_HOTEL, []

    # 8. Local Attractions & Art
    if any(k in cat for k in [
        "museum", "art_gallery", "art_center", "performing_arts_theater",
        "historic_site", "tourist_attraction", "monument_and_memorial",
        "sculpture", "cultural_center", "movie_theater", "cinema",
        "botanical_garden", "aquarium", "planetarium",
        #"landmark_and_historical_building"
    ]):
        return CATEGORY_ATTRACTION_ART, []

    # 9. Parks & Outdoor Spaces
    if any(k in cat for k in [
        "park", "dog_park", "playground", "nature_reserve",
        "state_park", "urban_park", "plaza", "public_garden"
    ]):
        return CATEGORY_PARK_OUTDOORS, []

    # 10. Grocery Stores & Markets
    if any(k in cat for k in [
        "grocery", "supermarket", "food_market", "produce_market",
        "bakery", "butcher_shop", "greengrocer", "deli",
        "fish_and_seafood_market"
    ]):
        return CATEGORY_GROCERY, sorted(list(cuisines))

    return None, []
