"""
Isochrone parsing and spatial walk-time tagging module for ConferenceWalker.

This module parses regional walkshed GeoJSON files, extracts conference center
coordinates and concentric walking isochrone polygons, and provides point-in-polygon
containment testing to tag POIs with minimum walk-time thresholds (e.g. 5, 10, 15 minutes).
"""

from typing import List, Dict, Any, Optional, Tuple
import json
import re


def point_in_ring(x: float, y: float, ring: List[List[float]]) -> bool:
    """
    Standard ray-casting algorithm to test if point (x, y) is inside a linear ring.
    
    Args:
        x: Longitude of point
        y: Latitude of point
        ring: List of [lon, lat] coordinates forming a closed ring
    
    Returns:
        True if the point lies inside the boundary, False otherwise.
    """
    inside = False
    num_points = len(ring)
    if num_points < 3:
        return False

    prev_idx = num_points - 1
    for curr_idx in range(num_points):
        x_curr, y_curr = ring[curr_idx][0], ring[curr_idx][1]
        x_prev, y_prev = ring[prev_idx][0], ring[prev_idx][1]

        # Check if the horizontal ray crosses the edge between prev and curr
        crosses = ((y_curr > y) != (y_prev > y))
        if crosses:
            # Calculate x-coordinate of intersection with edge
            intersect_x = (x_prev - x_curr) * (y - y_curr) / (y_prev - y_curr) + x_curr
            if x < intersect_x:
                inside = not inside

        prev_idx = curr_idx

    return inside


def point_in_polygon_geometry(lon: float, lat: float, geom: Dict[str, Any]) -> bool:
    """
    Check if a point (lon, lat) is inside a GeoJSON Polygon or MultiPolygon geometry.
    Properly handles exterior rings and interior holes.
    """
    geom_type = geom.get("type", "")
    coords = geom.get("coordinates", [])

    if geom_type == "Polygon":
        if not coords:
            return False
        # Exterior ring must contain point
        if not point_in_ring(lon, lat, coords[0]):
            return False
        # If point is in any hole (interior ring), it is outside the polygon
        for hole in coords[1:]:
            if point_in_ring(lon, lat, hole):
                return False
        return True

    elif geom_type == "MultiPolygon":
        for poly_coords in coords:
            if not poly_coords:
                continue
            if point_in_ring(lon, lat, poly_coords[0]):
                in_hole = False
                for hole in poly_coords[1:]:
                    if point_in_ring(lon, lat, hole):
                        in_hole = True
                        break
                if not in_hole:
                    return True
        return False

    return False


class Isochrone:
    """
    Represents a single walking walkshed polygon tier (e.g. 5 min, 10 min, 15 min).
    """
    def __init__(
        self,
        minutes: int,
        geometry: Dict[str, Any],
        color: str,
        fill_color: str,
        label: str,
        area: Optional[str] = None
    ):
        self.minutes = minutes
        self.geometry = geometry
        self.color = color
        self.fill_color = fill_color
        self.label = label
        self.area = area

    def contains(self, lon: float, lat: float) -> bool:
        """Check if coordinates fall inside this isochrone polygon."""
        return point_in_polygon_geometry(lon, lat, self.geometry)


class RegionMetadata:
    """
    Stores conference metadata, center location, and sorted isochrones.
    """
    def __init__(
        self,
        name: str,
        center: Tuple[float, float],
        isochrones: List[Isochrone],
        bbox: Tuple[float, float, float, float],
        raw_geojson: Dict[str, Any]
    ):
        self.name = name
        self.center = center  # (lon, lat)
        self.isochrones = isochrones  # Sorted ascending by minutes
        self.bbox = bbox  # (min_lon, min_lat, max_lon, max_lat)
        self.raw_geojson = raw_geojson

    def tag_walk_time(self, lon: float, lat: float) -> Optional[int]:
        """
        Assign minimum walk-time threshold in minutes (e.g., 5, 10, 15).
        Returns None if coordinates are outside all isochrones.
        """
        for iso in self.isochrones:
            if iso.contains(lon, lat):
                return iso.minutes
        return None


def parse_isochrone_minutes(properties: Dict[str, Any]) -> int:
    """
    Determine walk-time in minutes from feature properties.
    Checks 'value' (often in seconds or minutes) and 'label'.
    """
    # 1. Try value property
    if "value" in properties:
        val = properties["value"]
        try:
            num = float(val)
            if num >= 60:
                return round(num / 60)
            return int(num)
        except (ValueError, TypeError):
            pass

    # 2. Try parsing label (e.g. "5 min", "10 min", "15 min")
    label = str(properties.get("label", ""))
    match = re.search(r"(\d+)\s*min", label, re.IGNORECASE)
    if match:
        return int(match.group(1))

    # Default fallback
    return 15


def load_region(geojson_path: str) -> RegionMetadata:
    """
    Load and parse a region GeoJSON file containing the conference center point
    and concentric walkshed isochrones.
    """
    with open(geojson_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    features = data.get("features", [])
    center_coords: Optional[Tuple[float, float]] = None
    conference_name = "Conference Center"
    isochrones: List[Isochrone] = []

    min_lon, min_lat = float("inf"), float("inf")
    max_lon, max_lat = float("-inf"), float("-inf")

    def update_bounds(ring: List[List[float]]) -> None:
        nonlocal min_lon, min_lat, max_lon, max_lat
        for pt in ring:
            x, y = pt[0], pt[1]
            if x < min_lon:
                min_lon = x
            if x > max_lon:
                max_lon = x
            if y < min_lat:
                min_lat = y
            if y > max_lat:
                max_lat = y

    for feat in features:
        geom = feat.get("geometry", {})
        props = feat.get("properties", {})
        geom_type = geom.get("type", "")

        if geom_type == "Point":
            coords = geom.get("coordinates", [])
            if len(coords) >= 2:
                center_coords = (float(coords[0]), float(coords[1]))
                if "label" in props:
                    conference_name = str(props["label"]).strip()

        elif geom_type in {"Polygon", "MultiPolygon"}:
            minutes = parse_isochrone_minutes(props)
            color = props.get("color", "#2b83ba")
            fill_color = props.get("fillColor", color)
            label = str(props.get("label", f"{minutes} min")).strip()
            area = props.get("area")

            coords = geom.get("coordinates", [])
            if geom_type == "Polygon":
                for ring in coords:
                    update_bounds(ring)
            elif geom_type == "MultiPolygon":
                for poly in coords:
                    for ring in poly:
                        update_bounds(ring)

            isochrones.append(
                Isochrone(
                    minutes=minutes,
                    geometry=geom,
                    color=color,
                    fill_color=fill_color,
                    label=label,
                    area=area
                )
            )

    # Sort isochrones ascending by minutes (5 min -> 10 min -> 15 min)
    isochrones.sort(key=lambda iso: iso.minutes)

    if center_coords is None:
        # Fallback to bbox midpoint if no point feature was provided
        center_coords = ((min_lon + max_lon) / 2.0, (min_lat + max_lat) / 2.0)

    # Provide a slight buffer (0.005 degrees ~ 500m) around bbox for query coverage
    buffer_deg = 0.005
    buffered_bbox = (
        min_lon - buffer_deg,
        min_lat - buffer_deg,
        max_lon + buffer_deg,
        max_lat + buffer_deg
    )

    return RegionMetadata(
        name=conference_name,
        center=center_coords,
        isochrones=isochrones,
        bbox=buffered_bbox,
        raw_geojson=data
    )
