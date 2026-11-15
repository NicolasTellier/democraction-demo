#!/usr/bin/env /usr/bin/python3
"""Extract a geographic subset of the official Insee Filosofi 2021 PMTiles.

Input tiles are downloaded from https://tiles.insee.fr/filosofi_2021_carreaux.pmtiles
at zoom 10 (1km) and zoom 11 (200m), following the PMTiles v3 specification.
The whole national dataset is never bundled. Requires GDAL Python bindings.
"""
import argparse
import json
import re
import gzip
from pathlib import Path
from collections import defaultdict, Counter
from osgeo import ogr, osr

SOURCE = 'https://www.insee.fr/fr/statistiques/8735243'
TILE_SOURCE = 'https://tiles.insee.fr/filosofi_2021_carreaux.pmtiles'
PATTERN = re.compile(r'^CRS3035RES(200m|1000m)N(\d+)E(\d+)$')


def square(id, transform):
    match = PATTERN.fullmatch(id)
    if not match:
        raise ValueError('Unrecognised cell identifier: ' + id)
    resolution = 200 if match[1] == '200m' else 1000
    north, east = int(match[2]), int(match[3])
    vertices = [(east, north), (east + resolution, north),
                (east + resolution, north + resolution),
                (east, north + resolution), (east, north)]
    return [[round(lon, 6), round(lat, 6)] for x, y in vertices
            for lon, lat, *_ in [transform.TransformPoint(x, y)]]


def extract(tiles, territory_codes):
    source = osr.SpatialReference(); source.ImportFromEPSG(3035)
    target = osr.SpatialReference(); target.ImportFromEPSG(4326)
    source.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    target.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    transform = osr.CoordinateTransformation(source, target)
    dedup = {200: {}, 1000: {}}
    inconsistent = 0
    for filename in sorted(tiles.glob('*/*/*.pbf')):
        dataset = ogr.Open(str(filename))
        if dataset is None:
            raise RuntimeError('Cannot read vector tile: ' + str(filename))
        for feature in dataset.GetLayer(0):
            identity = feature.GetField('GEO')
            match = PATTERN.fullmatch(identity or '')
            if not match:
                continue
            resolution = 200 if match[1] == '200m' else 1000
            expected_zoom = 11 if resolution == 200 else 10
            if int(filename.parent.parent.name) != expected_zoom:
                continue
            codes = sorted(set((feature.GetField('lcog_geo') or '').split(',')) & territory_codes)
            if not codes:
                continue
            status = feature.GetField('OBS_STATUS') or ''
            values = [feature.GetField(field) for field in ('ind', 'men', 'men_pauv', 'ind_0_17', 'ind_65p')]
            props = {'id': identity, 'codes': codes, 'status': status,
                     'ind': values[0], 'men': values[1], 'menPauv': values[2],
                     'ind0_17': values[3], 'ind65p': values[4]}
            prior = dedup[resolution].get(identity)
            if prior and any(prior['properties'][key] != props[key] for key in ('ind', 'status')):
                inconsistent += 1
            elif not prior:
                dedup[resolution][identity] = {
                    'type': 'Feature', 'properties': props,
                    'geometry': {'type': 'Polygon', 'coordinates': [square(identity, transform)]}}
        dataset = None
    if inconsistent:
        raise ValueError(f'{inconsistent} inconsistent duplicate cells')
    return dedup


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('tiles', type=Path)
    parser.add_argument('territory', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    territory = json.loads(args.territory.read_text())
    codes = {str(c['codeInsee']) for c in territory['communes']}
    cells = extract(args.tiles, codes)
    args.output.mkdir(parents=True, exist_ok=True)
    counts = {}
    combined = defaultdict(dict)
    for resolution in (1000, 200):
        by_code = defaultdict(list)
        statuses = Counter()
        for feature in cells[resolution].values():
            statuses[feature['properties']['status']] += 1
            for code in feature['properties']['codes']:
                by_code[code].append(feature)
        for code, features in by_code.items():
            combined[code][str(resolution)] = sorted(features, key=lambda f: f['properties']['id'])
        counts[resolution] = {'uniqueCells': len(cells[resolution]),
                              'communesWithData': len(by_code),
                              'status': dict(statuses)}
    for code, grids in combined.items():
        file = args.output / f'{code}.json.gz'
        payload = json.dumps({'millesime': 2021, 'source': SOURCE,
            'tileSource': TILE_SOURCE, 'grids': grids},
            separators=(',', ':'), ensure_ascii=False).encode('utf-8')
        file.write_bytes(gzip.compress(payload, compresslevel=9, mtime=0))
    (args.output / 'manifest.json').write_text(json.dumps({
        'source': SOURCE, 'tileSource': TILE_SOURCE, 'license': 'Licence Ouverte 2.0',
        'millesime': 2021, 'territoryCommunes': len(codes),
        'counts': counts}, ensure_ascii=False, indent=2))
    print(json.dumps(counts, indent=2))


if __name__ == '__main__':
    main()
