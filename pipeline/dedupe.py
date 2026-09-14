"""
Spatial proximity and fuzzy string deduplication module for ConferenceWalker.

This module clusters points-of-interest from OpenStreetMap and Overture Maps
that fall within a spatial distance threshold (default 25 meters) and possess
normalized name similarity above a matching threshold (default 80%), merging
their attributes into unified, enriched POI records.
"""

from typing import List, Dict, Any, Optional, Set, Tuple
import math
import re
import unicodedata

try:
    from rapidfuzz import fuzz
    HAS_RAPIDFUZZ = True
except ImportError:
    import difflib
    HAS_RAPIDFUZZ = False


def haversine_distance_meters(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    """
    Calculate the great-circle distance between two points on the Earth's surface
    using the Haversine formula, returning the distance in meters.
    """
    # Earth mean radius in meters
    earth_radius_m = 6371000.0

    phi_1 = math.radians(lat1)
    phi_2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    sin_half_phi = math.sin(delta_phi / 2.0)
    sin_half_lambda = math.sin(delta_lambda / 2.0)

    haversine_term = (
        sin_half_phi * sin_half_phi
        + math.cos(phi_1) * math.cos(phi_2) * sin_half_lambda * sin_half_lambda
    )

    angular_distance = 2.0 * math.atan2(
        math.sqrt(haversine_term),
        math.sqrt(max(0.0, 1.0 - haversine_term))
    )

    return earth_radius_m * angular_distance


def normalize_name(name: Optional[str]) -> str:
    """
    Normalize a venue name for robust fuzzy matching by removing punctuation,
    accents, common noise words, and extraneous whitespace.
    """
    if not name:
        return ""

    # Normalize unicode accents (e.g. café -> cafe)
    normalized = unicodedata.normalize("NFKD", str(name))
    ascii_text = normalized.encode("ascii", "ignore").decode("utf-8").lower()

    # Remove apostrophes without adding space (e.g. McDonald's -> mcdonalds)
    ascii_text = ascii_text.replace("'", "").replace("’", "")

    # Replace punctuation and special symbols with spaces
    cleaned = re.sub(r"[^\w\s]", " ", ascii_text)

    # Remove common corporate/legal suffixes
    cleaned = re.sub(r"\b(llc|inc|incorporated|corp|corporation|ltd|limited|co|company)\b", " ", cleaned)

    # Remove leading 'the '
    cleaned = re.sub(r"^the\s+", "", cleaned.strip())

    # Collapse multiple whitespaces
    tokens = [t for t in cleaned.split() if t]
    return " ".join(tokens)


def compute_name_similarity(name1: str, name2: str) -> float:
    """
    Compute fuzzy string similarity score between 0.0 and 100.0.
    Considers full string ratio, token sort, and token set ratio.
    """
    norm1 = normalize_name(name1)
    norm2 = normalize_name(name2)

    if not norm1 or not norm2:
        return 0.0

    if norm1 == norm2:
        return 100.0

    if HAS_RAPIDFUZZ:
        ratio_score = fuzz.ratio(norm1, norm2)
        token_sort = fuzz.token_sort_ratio(norm1, norm2)
        token_set = fuzz.token_set_ratio(norm1, norm2)
        return float(max(ratio_score, token_sort, token_set))
    else:
        # Fallback to difflib
        matcher = difflib.SequenceMatcher(None, norm1, norm2)
        return float(matcher.ratio() * 100.0)


def are_categories_compatible(cat1: str, cat2: str) -> bool:
    """
    Verify whether two categories are compatible for merging.
    Allows closely related food/drink categories to merge when names & location match.
    """
    if cat1 == cat2:
        return True

    food_drink_group = {"restaurant", "bar", "coffee_tea", "grocery"}
    if cat1 in food_drink_group and cat2 in food_drink_group:
        return True

    return False


def is_poi_match(
    poi_a: Dict[str, Any],
    poi_b: Dict[str, Any],
    max_distance_meters: float = 25.0,
    min_similarity: float = 80.0
) -> bool:
    """
    Determine if two POI records represent the same physical venue based on
    spatial proximity (<= max_distance_meters) and fuzzy name similarity (>= min_similarity).
    """
    coords_a = poi_a.get("coordinates")
    coords_b = poi_b.get("coordinates")
    if not coords_a or not coords_b:
        return False

    cat_a = poi_a.get("category", "")
    cat_b = poi_b.get("category", "")
    if not are_categories_compatible(cat_a, cat_b):
        return False

    distance_m = haversine_distance_meters(
        coords_a[0], coords_a[1],
        coords_b[0], coords_b[1]
    )
    if distance_m > max_distance_meters:
        return False

    similarity = compute_name_similarity(
        poi_a.get("name", ""),
        poi_b.get("name", "")
    )
    return similarity >= min_similarity


def merge_two_pois(primary: Dict[str, Any], secondary: Dict[str, Any]) -> Dict[str, Any]:
    """
    Merge two matching POIs, combining their attributes and preserving rich metadata.
    """
    merged = dict(primary)

    # Name: pick the longer or more complete name
    name_prim = str(primary.get("name", "")).strip()
    name_sec = str(secondary.get("name", "")).strip()
    if len(name_sec) > len(name_prim):
        merged["name"] = name_sec
    else:
        merged["name"] = name_prim

    # Coordinates: average them or keep primary
    coords_prim = primary.get("coordinates", [0.0, 0.0])
    coords_sec = secondary.get("coordinates", [0.0, 0.0])
    avg_lon = (coords_prim[0] + coords_sec[0]) / 2.0
    avg_lat = (coords_prim[1] + coords_sec[1]) / 2.0
    merged["coordinates"] = [avg_lon, avg_lat]

    # Walk time: minimum of the two walk times
    walk_a = primary.get("walk_time_minutes")
    walk_b = secondary.get("walk_time_minutes")
    if walk_a is not None and walk_b is not None:
        merged["walk_time_minutes"] = min(walk_a, walk_b)
    elif walk_a is not None:
        merged["walk_time_minutes"] = walk_a
    elif walk_b is not None:
        merged["walk_time_minutes"] = walk_b

    # Address
    if not merged.get("address") and secondary.get("address"):
        merged["address"] = secondary["address"]

    # Phone
    if not merged.get("phone") and secondary.get("phone"):
        merged["phone"] = secondary["phone"]

    # Website
    if not merged.get("website") and secondary.get("website"):
        merged["website"] = secondary["website"]

    # Opening hours (OSM usually provides structured syntax)
    if not merged.get("opening_hours") and secondary.get("opening_hours"):
        merged["opening_hours"] = secondary["opening_hours"]

    # Cuisines: union of both lists
    cuisines_set: Set[str] = set(primary.get("cuisines", []))
    for c in secondary.get("cuisines", []):
        if c:
            cuisines_set.add(c)
    merged["cuisines"] = sorted(list(cuisines_set))

    # Sources: combine sources
    sources_set: Set[str] = set(primary.get("sources", []))
    for s in secondary.get("sources", []):
        if s:
            sources_set.add(s)
    merged["sources"] = sorted(list(sources_set))

    # Identifiers
    if not merged.get("osm_id") and secondary.get("osm_id"):
        merged["osm_id"] = secondary["osm_id"]
    if not merged.get("overture_id") and secondary.get("overture_id"):
        merged["overture_id"] = secondary["overture_id"]

    # Online reservation and ordering URLs
    if not merged.get("reservation_url") and secondary.get("reservation_url"):
        merged["reservation_url"] = secondary["reservation_url"]
    if not merged.get("order_url") and secondary.get("order_url"):
        merged["order_url"] = secondary["order_url"]

    return merged


class DisjointSetUnion:
    """
    Union-Find data structure to find connected components of matching POIs.
    """
    def __init__(self, size: int):
        self.parent = list(range(size))
        self.rank = [0] * size

    def find(self, i: int) -> int:
        if self.parent[i] == i:
            return i
        self.parent[i] = self.find(self.parent[i])
        return self.parent[i]

    def union(self, i: int, j: int) -> None:
        root_i = self.find(i)
        root_j = self.find(j)
        if root_i != root_j:
            if self.rank[root_i] < self.rank[root_j]:
                self.parent[root_i] = root_j
            elif self.rank[root_i] > self.rank[root_j]:
                self.parent[root_j] = root_i
            else:
                self.parent[root_j] = root_i
                self.rank[root_i] += 1


def deduplicate_pois(
    pois: List[Dict[str, Any]],
    max_distance_meters: float = 25.0,
    min_similarity: float = 80.0
) -> List[Dict[str, Any]]:
    """
    Deduplicate a list of POI dictionaries using spatial partitioning and fuzzy name matching.
    POI clusters within 25m with >= 80% similarity are merged into unified records.
    """
    num_pois = len(pois)
    if num_pois <= 1:
        return pois

    # Cell size in degrees (~55 meters at 38 deg latitude)
    # 1 deg lat ~ 111,000m -> 0.0005 deg ~ 55m
    grid_size = 0.0005
    grid: Dict[Tuple[int, int], List[int]] = {}

    for idx, poi in enumerate(pois):
        coords = poi.get("coordinates")
        if not coords:
            continue
        cell_x = int(math.floor(coords[0] / grid_size))
        cell_y = int(math.floor(coords[1] / grid_size))
        grid.setdefault((cell_x, cell_y), []).append(idx)

    dsu = DisjointSetUnion(num_pois)

    # Check candidate pairs in current cell and adjacent 8 neighbors
    checked_pairs: Set[Tuple[int, int]] = set()
    neighbor_offsets = [
        (-1, -1), (-1, 0), (-1, 1),
        (0, -1),  (0, 0),  (0, 1),
        (1, -1),  (1, 0),  (1, 1),
    ]

    for (cell_x, cell_y), indices in grid.items():
        for dx, dy in neighbor_offsets:
            neighbor_cell = (cell_x + dx, cell_y + dy)
            if neighbor_cell in grid:
                for idx_a in indices:
                    for idx_b in grid[neighbor_cell]:
                        if idx_a >= idx_b:
                            continue
                        pair = (idx_a, idx_b)
                        if pair in checked_pairs:
                            continue
                        checked_pairs.add(pair)

                        if is_poi_match(pois[idx_a], pois[idx_b], max_distance_meters, min_similarity):
                            dsu.union(idx_a, idx_b)

    # Group POIs by cluster root
    clusters: Dict[int, List[int]] = {}
    for idx in range(num_pois):
        root = dsu.find(idx)
        clusters.setdefault(root, []).append(idx)

    deduplicated_results: List[Dict[str, Any]] = []
    for cluster_indices in clusters.values():
        if len(cluster_indices) == 1:
            deduplicated_results.append(pois[cluster_indices[0]])
        else:
            merged = pois[cluster_indices[0]]
            for next_idx in cluster_indices[1:]:
                merged = merge_two_pois(merged, pois[next_idx])
            deduplicated_results.append(merged)

    return deduplicated_results
