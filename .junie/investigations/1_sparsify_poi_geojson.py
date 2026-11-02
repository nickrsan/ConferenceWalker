#!/usr/bin/env python3
"""Remove null-valued POI properties from the shipped GeoJSON using the pipeline helper."""

import json
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_ROOT))

from pipeline.preprocess import strip_none_values


def sparsify_poi_geojson() -> None:
    data_path = PROJECT_ROOT / 'public' / 'data' / 'sacramento_pois.geojson'
    size_before = data_path.stat().st_size

    with data_path.open('r', encoding='utf-8') as source_file:
        feature_collection = json.load(source_file)

    features = feature_collection.get('features')
    if not isinstance(features, list):
        raise ValueError(f'Expected a GeoJSON feature list in {data_path}')

    for feature in features:
        properties = feature.get('properties')
        if isinstance(properties, dict):
            feature['properties'] = strip_none_values(properties)

    with data_path.open('w', encoding='utf-8') as output_file:
        json.dump(feature_collection, output_file, indent=2)
        output_file.write('\n')

    size_after = data_path.stat().st_size
    size_saved = size_before - size_after
    print(f'POI GeoJSON size: {size_before:,} -> {size_after:,} bytes ({size_saved:,} bytes saved)')


if __name__ == '__main__':
    sparsify_poi_geojson()