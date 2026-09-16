#!/usr/bin/env python3
"""
ConferenceWalker Data Preprocessing Pipeline CLI.

Ingests points-of-interest from OpenStreetMap (PBF) and Overture Maps (S3 Geoparquet),
assigns walking isochrone walk times (e.g. 5 min, 10 min, 15 min), deduplicates
overlapping venues within 25m with fuzzy string matching, preserves rich attributes,
and outputs standardized GeoJSON.
"""

import argparse
import json
import logging
import os
import subprocess
import sys
import tempfile
from typing import List, Dict, Any, Optional

from pipeline.categories import (
    classify_osm_tags,
    classify_overture_place,
    CATEGORY_DISPLAY_NAMES,
    VALID_CATEGORIES,
)
from pipeline.isochrones import load_region, RegionMetadata
from pipeline.dedupe import deduplicate_pois

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger("ConferenceWalkerPipeline")

RESERVATION_DOMAINS = (
    "opentable.com",
    "resy.com",
    "exploretock.com",
    "sevenrooms.com",
    "yelp.com/reservations",
    "reserve.com",
    "tablecheck.com",
)

ORDER_DOMAINS = (
    "toasttab.com",
    "doordash.com",
    "ubereats.com",
    "grubhub.com",
    "chownow.com",
    "slicelife.com",
    "menufy.com",
    "clover.com",
    "order.",
    "ordering.",
    #"orderkinghalalfoods.com",
)

BLOCKLISTED_GERS = set(["cd5cc951-be17-493f-840e-787bfe6e0c8d",])


def extract_reservation_url(props: Dict[str, Any], websites: Optional[List[str]] = None) -> Optional[str]:
    """
    Extract online reservation URL from OSM tags or website lists.
    """
    candidate_tags = [
        "reservation:website",
        "contact:reservation",
        "website:reservation",
        "url:reservation",
        "reservation:url",
        "contact:website:reservation",
        "opentable",
        "resy",
    ]
    for tag in candidate_tags:
        val = props.get(tag)
        if val and isinstance(val, str) and str(val).strip().startswith(("http://", "https://")):
            return str(val).strip()

    res_val = props.get("reservation")
    if res_val and isinstance(res_val, str) and str(res_val).strip().startswith(("http://", "https://")):
        return str(res_val).strip()

    all_urls: List[str] = []
    if props.get("website"):
        all_urls.append(str(props["website"]).strip())
    if websites:
        for w in websites:
            if w:
                all_urls.append(str(w).strip())

    for url in all_urls:
        url_lower = url.lower()
        if any(dom in url_lower for dom in RESERVATION_DOMAINS) or "/reservation" in url_lower:
            return url

    return None


def extract_order_url(props: Dict[str, Any], websites: Optional[List[str]] = None) -> Optional[str]:
    """
    Extract online ordering URL from OSM tags or website lists.
    """
    candidate_tags = [
        "order:website",
        "contact:order",
        "website:order",
        "url:order",
        "takeaway:website",
        "delivery:website",
        "contact:website:order",
        "ubereats",
        "doordash",
        "grubhub",
        "toast",
    ]
    for tag in candidate_tags:
        val = props.get(tag)
        if val and isinstance(val, str) and str(val).strip().startswith(("http://", "https://")):
            return str(val).strip()

    ord_val = props.get("order")
    if ord_val and isinstance(ord_val, str) and str(ord_val).strip().startswith(("http://", "https://")):
        return str(ord_val).strip()

    all_urls: List[str] = []
    if props.get("website"):
        all_urls.append(str(props["website"]).strip())
    if websites:
        for w in websites:
            if w:
                all_urls.append(str(w).strip())

    for url in all_urls:
        url_lower = url.lower()
        if any(dom in url_lower for dom in ORDER_DOMAINS) or "/order" in url_lower:
            return url

    return None


def extract_osm_pois(
    osm_pbf_path: str,
    region: RegionMetadata
) -> List[Dict[str, Any]]:
    """
    Parse an OpenStreetMap PBF file using osmium export, filter POIs into the 10
    categories, assign walking times, and normalize attributes.
    """
    if not os.path.exists(osm_pbf_path):
        logger.warning(f"OSM PBF file not found at: {osm_pbf_path}")
        return []

    logger.info(f"Exporting OpenStreetMap features from {osm_pbf_path}...")
    with tempfile.NamedTemporaryFile(suffix=".geojson", delete=False) as tmp_file:
        tmp_geojson_path = tmp_file.name

    try:
        # Use osmium export to generate GeoJSON features with genuine OSM IDs and entity types
        cmd = [
            "osmium", "export",
            osm_pbf_path,
            "--geometry-types=point,polygon",
            "-a", "type,id",
            "-f", "geojson",
            "--overwrite",
            "-o", tmp_geojson_path
        ]
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        if res.returncode != 0:
            logger.error(f"osmium export failed: {res.stderr}")
            return []

        logger.info("Reading exported OSM GeoJSON...")
        with open(tmp_geojson_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        features = data.get("features", [])
        logger.info(f"Parsed {len(features)} total raw features from OSM export.")

        osm_pois: List[Dict[str, Any]] = []
        for idx, feat in enumerate(features):
            props = feat.get("properties", {})
            geom = feat.get("geometry", {})
            geom_type = geom.get("type", "")
            coords = geom.get("coordinates", [])

            # Compute representative point
            lon: Optional[float] = None
            lat: Optional[float] = None

            if geom_type == "Point" and len(coords) >= 2:
                lon, lat = float(coords[0]), float(coords[1])
            elif geom_type == "Polygon" and coords and coords[0]:
                # Centroid of polygon exterior ring
                ring = coords[0]
                lon = sum(pt[0] for pt in ring) / float(len(ring))
                lat = sum(pt[1] for pt in ring) / float(len(ring))

            if lon is None or lat is None:
                continue

            # Classify into 10 target categories
            cat, cuisines = classify_osm_tags(props)
            if not cat:
                continue

            # Venue name
            name = (
                props.get("name")
                or props.get("name:en")
                or props.get("operator")
                or props.get("brand")
            )
            # If no name is provided, use generic category display name
            if not name or not str(name).strip():
                name = CATEGORY_DISPLAY_NAMES.get(cat, cat.replace("_", " ").title())
            else:
                name = str(name).strip()

            # Phone
            phone = props.get("phone") or props.get("contact:phone")

            # Website
            website = props.get("website") or props.get("contact:website") or props.get("url")

            # Opening hours
            opening_hours = props.get("opening_hours")

            # Formatted address
            addr_parts = []
            if props.get("addr:housenumber"):
                addr_parts.append(str(props["addr:housenumber"]).strip())
            if props.get("addr:street"):
                addr_parts.append(str(props["addr:street"]).strip())
            if props.get("addr:city"):
                addr_parts.append(str(props["addr:city"]).strip())
            address = " ".join(addr_parts) if addr_parts else None

            # Spatial walk time tagging
            walk_time = region.tag_walk_time(lon, lat)

            # Online reservation and ordering links
            res_url = extract_reservation_url(props)
            ord_url = extract_order_url(props)

            # OpenStreetMap ID: Extract genuine OSM ID (node ID or way ID) rather than internal numbering
            raw_osm_id = props.get("@id") or props.get("id") or feat.get("id")
            if raw_osm_id is not None:
                raw_str = str(raw_osm_id).strip()
                # Normalize any prefix osmium might emit (e.g. 'node/12345', 'way/12345', or 'n12345')
                if raw_str.startswith(("node/", "way/", "relation/")):
                    osm_id = raw_str.split("/", 1)[1]
                elif len(raw_str) > 1 and raw_str[0] in ("n", "w", "r") and raw_str[1:].isdigit():
                    osm_id = raw_str[1:]
                else:
                    osm_id = raw_str
            else:
                osm_id = str(idx)
            poi = {
                "id": f"osm_{osm_id}",
                "name": name,
                "category": cat,
                "coordinates": [round(lon, 7), round(lat, 7)],
                "walk_time_minutes": walk_time,
                "address": address,
                "phone": str(phone).strip() if phone else None,
                "website": str(website).strip() if website else None,
                "opening_hours": str(opening_hours).strip() if opening_hours else None,
                "cuisines": cuisines,
                "sources": ["osm"],
                "osm_id": osm_id,
                "overture_id": None,
                "reservation_url": res_url,
                "order_url": ord_url,
            }
            osm_pois.append(poi)

        logger.info(f"Retained {len(osm_pois)} categorized POIs from OpenStreetMap.")
        return osm_pois

    finally:
        if os.path.exists(tmp_geojson_path):
            os.remove(tmp_geojson_path)


def load_gers_blocklist(blocklist_arg: Optional[str]) -> set:
    """
    Load a set of blocklisted Overture GERS IDs from a file path or comma-separated string.
    """
    if not blocklist_arg:
        return set()

    blocklisted: set = set()
    if os.path.isfile(blocklist_arg):
        with open(blocklist_arg, "r", encoding="utf-8") as f:
            for line in f:
                item = line.strip()
                if item and not item.startswith("#"):
                    blocklisted.add(item)
    else:
        for token in blocklist_arg.replace(",", " ").split():
            token = token.strip()
            if token:
                blocklisted.add(token)

    return blocklisted


def extract_overture_pois(
    region: RegionMetadata,
    s3_region: str = "us-west-2",
    overture_release: str = "2026-08-19.0",
    min_confidence: Optional[float] = 0.95,
    blocklisted_gers_ids: Optional[set] = BLOCKLISTED_GERS
) -> List[Dict[str, Any]]:
    """
    Query Overture Maps places from S3 GeoParquet via DuckDB spatial and httpfs extensions,
    filtering with bounding-box pushdown, confidence threshold, and GERS blocklist,
    and classifying into target categories.
    """
    logger.info("Attempting to query Overture Maps places from S3 GeoParquet...")
    try:
        import duckdb
    except ImportError:
        logger.warning("duckdb package is not available; skipping Overture ingestion.")
        return []

    min_lon, min_lat, max_lon, max_lat = region.bbox
    con = duckdb.connect()

    try:
        con.install_extension("spatial")
        con.load_extension("spatial")
        con.install_extension("httpfs")
        con.load_extension("httpfs")
        con.execute(f"SET s3_region='{s3_region}';")

        parquet_url = f"s3://overturemaps-{s3_region}/release/{overture_release}/theme=places/type=place/*"
        query = f"""
            SELECT
                id,
                names.primary AS name,
                categories.primary AS cat_primary,
                categories.alternate AS cat_alts,
                websites,
                phones,
                addresses,
                confidence,
                ST_X(geometry) AS lon,
                ST_Y(geometry) AS lat
            FROM read_parquet('{parquet_url}', filename=true)
            WHERE bbox.xmin >= {min_lon} AND bbox.xmax <= {max_lon}
              AND bbox.ymin >= {min_lat} AND bbox.ymax <= {max_lat};
        """
        logger.info(f"Executing DuckDB spatial query for bbox: [{min_lon:.4f}, {min_lat:.4f}, {max_lon:.4f}, {max_lat:.4f}]")
        records = con.execute(query).fetchall()
        logger.info(f"Fetched {len(records)} candidate places from Overture Maps.")

        overture_pois: List[Dict[str, Any]] = []
        for row in records:
            place_id, name, cat_primary, cat_alts, websites, phones, addresses, confidence, lon, lat = row
            if lon is None or lat is None:
                continue

            # 1. Filter out blocklisted GERS IDs
            gers_id_str = str(place_id).strip()
            if blocklisted_gers_ids and (
                gers_id_str in blocklisted_gers_ids
                or f"overture_{gers_id_str}" in blocklisted_gers_ids
            ):
                logger.info(f"Skipping blocklisted GERS ID: {gers_id_str}")
                continue

            # 2. Filter by minimum confidence score
            if min_confidence is not None and confidence is not None:
                try:
                    if float(confidence) < float(min_confidence):
                        continue
                except (ValueError, TypeError):
                    pass

            cat, cuisines = classify_overture_place(cat_primary, cat_alts or [])
            if not cat:
                continue

            if not name or not str(name).strip():
                name = CATEGORY_DISPLAY_NAMES.get(cat, cat.replace("_", " ").title())
            else:
                name = str(name).strip()

            phone_str = None
            if phones and len(phones) > 0 and phones[0]:
                phone_str = str(phones[0]).strip()

            website_str = None
            if websites and len(websites) > 0 and websites[0]:
                website_str = str(websites[0]).strip()

            addr_str = None
            if addresses and len(addresses) > 0 and addresses[0]:
                addr_obj = addresses[0]
                if isinstance(addr_obj, dict):
                    addr_str = addr_obj.get("freeform") or (
                        f"{addr_obj.get('locality', '')} {addr_obj.get('postcode', '')}".strip()
                    )

            walk_time = region.tag_walk_time(float(lon), float(lat))

            # Online reservation and ordering links
            res_url = extract_reservation_url({}, websites)
            ord_url = extract_order_url({}, websites)

            poi = {
                "id": f"overture_{place_id}",
                "name": name,
                "category": cat,
                "coordinates": [round(float(lon), 7), round(float(lat), 7)],
                "walk_time_minutes": walk_time,
                "address": addr_str,
                "phone": phone_str,
                "website": website_str,
                "opening_hours": None,
                "cuisines": cuisines,
                "sources": ["overture"],
                "osm_id": None,
                "overture_id": str(place_id),
                "confidence": float(confidence) if confidence is not None else None,
                "reservation_url": res_url,
                "order_url": ord_url,
            }
            overture_pois.append(poi)

        logger.info(f"Retained {len(overture_pois)} categorized POIs from Overture Maps.")
        return overture_pois

    except Exception as exc:
        logger.warning(f"Unable to fetch Overture Maps data remotely: {exc}. Proceeding with available sources.")
        return []
    finally:
        con.close()


def export_region_summary(region: RegionMetadata, output_path: str) -> None:
    """
    Export active conference region metadata and isochrone geometry for frontend consumption.
    """
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    summary_data = {
        "name": region.name,
        "center": list(region.center),
        "isochrones": [
            {
                "minutes": iso.minutes,
                "color": iso.color,
                "fillColor": iso.fill_color,
                "label": iso.label,
                "area": iso.area
            }
            for iso in region.isochrones
        ],
        "geojson": region.raw_geojson
    }
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(summary_data, f, indent=2)
    logger.info(f"Saved active region metadata to {output_path}")


def convert_pois_to_geojson(pois: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Format a list of POI dictionaries into standard GeoJSON FeatureCollection.
    """
    features = []
    for poi in pois:
        coords = poi.get("coordinates", [0.0, 0.0])
        props = {
            "id": poi.get("id"),
            "name": poi.get("name"),
            "category": poi.get("category"),
            "walk_time_minutes": poi.get("walk_time_minutes"),
            "address": poi.get("address"),
            "phone": poi.get("phone"),
            "website": poi.get("website"),
            "opening_hours": poi.get("opening_hours"),
            "cuisines": poi.get("cuisines", []),
            "sources": poi.get("sources", []),
            "osm_id": poi.get("osm_id"),
            "overture_id": poi.get("overture_id"),
            "reservation_url": poi.get("reservation_url"),
            "order_url": poi.get("order_url"),
        }
        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": coords
            },
            "properties": props
        })

    return {
        "type": "FeatureCollection",
        "features": features
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="ConferenceWalker POI Preprocessing Pipeline"
    )
    parser.add_argument(
        "--region",
        default="regions/Walksheds of Sacramento FOSS4GNA 2026.json",
        help="Path to region walksheds GeoJSON"
    )
    parser.add_argument(
        "--osm-pbf",
        default="regions/SacramentoCore.osm.pbf",
        help="Path to OpenStreetMap PBF export"
    )
    parser.add_argument(
        "--output",
        default="public/data/sacramento_pois.geojson",
        help="Path for output POI GeoJSON"
    )
    parser.add_argument(
        "--output-region",
        default="public/data/region.json",
        help="Path for output active region metadata"
    )
    parser.add_argument(
        "--skip-overture",
        action="store_true",
        help="Skip querying Overture S3 Geoparquet"
    )
    parser.add_argument(
        "--skip-osm",
        action="store_true",
        help="Skip parsing OSM PBF"
    )
    parser.add_argument(
        "--s3-region",
        default="us-west-2",
        help="AWS S3 Region for Overture"
    )
    parser.add_argument(
        "--overture-release",
        default="2026-08-19.0",
        help="Overture release version tag"
    )
    parser.add_argument(
        "--overture-min-confidence",
        type=float,
        default=0.6,
        help="Minimum confidence score for Overture POIs (default: 0.6)"
    )
    parser.add_argument(
        "--blocklist-gers",
        "--gers-blocklist",
        dest="gers_blocklist",
        default=None,
        help="File path or comma-separated list of Overture GERS IDs to exclude"
    )
    parser.add_argument(
        "--dedupe-dist",
        type=float,
        default=25.0,
        help="Maximum distance in meters for duplicate pairing (default: 25.0)"
    )
    parser.add_argument(
        "--dedupe-sim",
        type=float,
        default=80.0,
        help="Minimum fuzzy name similarity threshold (default: 80.0)"
    )

    args = parser.parse_args()

    gers_blocklist_set = load_gers_blocklist(args.gers_blocklist)
    if gers_blocklist_set:
        logger.info(f"Loaded {len(gers_blocklist_set)} blocklisted GERS IDs.")

    logger.info(f"Loading region from: {args.region}")
    region = load_region(args.region)
    logger.info(
        f"Loaded region '{region.name}' centered at {region.center} "
        f"with {len(region.isochrones)} walkshed tiers."
    )

    # Export region summary for frontend
    export_region_summary(region, args.output_region)

    all_pois: List[Dict[str, Any]] = []

    # 1. Ingest OSM PBF
    if not args.skip_osm and args.osm_pbf:
        osm_pois = extract_osm_pois(args.osm_pbf, region)
        all_pois.extend(osm_pois)

    # 2. Ingest Overture Maps
    if not args.skip_overture:
        overture_pois = extract_overture_pois(
            region=region,
            s3_region=args.s3_region,
            overture_release=args.overture_release,
            min_confidence=args.overture_min_confidence,
            blocklisted_gers_ids=gers_blocklist_set
        )
        all_pois.extend(overture_pois)

    logger.info(f"Total raw POIs collected across sources: {len(all_pois)}")

    # 3. Deduplicate overlapping POIs
    logger.info(
        f"Deduplicating POIs (proximity <= {args.dedupe_dist}m, "
        f"name similarity >= {args.dedupe_sim}%)..."
    )
    deduped_pois = deduplicate_pois(
        all_pois,
        max_distance_meters=args.dedupe_dist,
        min_similarity=args.dedupe_sim
    )
    logger.info(f"Deduplication complete: {len(deduped_pois)} unique POIs retained.")

    # 4. Generate statistics
    cat_counts: Dict[str, int] = {}
    walk_counts: Dict[Any, int] = {}
    source_counts: Dict[str, int] = {"osm_only": 0, "overture_only": 0, "both": 0}

    for p in deduped_pois:
        c = p.get("category", "unknown")
        cat_counts[c] = cat_counts.get(c, 0) + 1

        w = p.get("walk_time_minutes")
        w_key = f"{w} min" if w is not None else ">15 min"
        walk_counts[w_key] = walk_counts.get(w_key, 0) + 1

        srcs = p.get("sources", [])
        if "osm" in srcs and "overture" in srcs:
            source_counts["both"] += 1
        elif "osm" in srcs:
            source_counts["osm_only"] += 1
        elif "overture" in srcs:
            source_counts["overture_only"] += 1

    logger.info(f"Category breakdown: {cat_counts}")
    logger.info(f"Walk-shed breakdown: {walk_counts}")
    logger.info(f"Source breakdown: {source_counts}")

    # 5. Output GeoJSON
    os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
    geojson_data = convert_pois_to_geojson(deduped_pois)
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(geojson_data, f, indent=2)

    logger.info(f"Successfully generated {args.output} with {len(deduped_pois)} POIs.")


if __name__ == "__main__":
    main()
