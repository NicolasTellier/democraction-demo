#!/usr/bin/env python3
"""Compare a road geometry package with public BAN names, without exporting addresses.

The two department-level BAN archives are downloaded once per run. Only distinct
road/place names and aggregate counts are retained; raw archives live in a
temporary directory and are removed even if the audit fails.
"""

from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import json
import re
import tempfile
import unicodedata
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BASE = "https://adresse.data.gouv.fr/data/ban/adresses/latest/csv"
SOURCES = {
    "adresses": f"{BASE}/adresses-33.csv.gz",
    "lieux_dits": f"{BASE}/lieux-dits-33-beta.csv.gz",
}


def key(value: str) -> str:
    plain = unicodedata.normalize("NFKD", value or "")
    plain = "".join(c for c in plain if not unicodedata.combining(c))
    return " ".join(re.findall(r"[a-z0-9]+", plain.casefold()))


def download_once(url: str, destination: Path) -> dict:
    digest = hashlib.sha256()
    size = 0
    request = urllib.request.Request(url, headers={"User-Agent": "DemocrAction/0.15 (+public-data-audit)"})
    with urllib.request.urlopen(request, timeout=90) as response, destination.open("wb") as target:
        if response.status != 200:
            raise ValueError(f"Téléchargement BAN HTTP {response.status}: {url}")
        modified = response.headers.get("Last-Modified")
        while chunk := response.read(1024 * 1024):
            target.write(chunk)
            digest.update(chunk)
            size += len(chunk)
    return {"url": url, "sha256": digest.hexdigest(), "bytes": size, "lastModified": modified}


def rows(path: Path):
    with gzip.open(path, "rt", encoding="utf-8-sig", newline="") as stream:
        reader = csv.DictReader(stream, delimiter=";")
        if not reader.fieldnames:
            raise ValueError(f"CSV BAN vide: {path.name}")
        for row in reader:
            yield row


def field(row: dict, *names: str) -> str:
    return next((str(row[n]).strip() for n in names if n in row and row[n] is not None), "")


def audit(root: Path, source_dir: Path) -> dict:
    territory = json.loads((root / "data/territoire-33-11-2026.json").read_text(encoding="utf-8"))
    codes = {str(c["codeInsee"]): c["nom"] for c in territory["communes"]}
    if len(codes) != 87:
        raise ValueError(f"Le territoire attendu compte 87 communes, reçu {len(codes)}")

    manifest = json.loads((root / "data/voies-manifest.json").read_text(encoding="utf-8"))
    geometries = {}
    manifest_rows = {entry["code"]: entry for entry in manifest["communes"] if entry.get("status") == "ok"}
    for code in codes:
        entry = manifest_rows.get(code)
        if not entry:
            continue
        path = root / "data" / Path(entry["file"]).name
        if not path.is_file():
            raise FileNotFoundError(f"Fichier de voies annoncé absent: {path}")
        if path.suffix == ".gz":
            with gzip.open(path, "rt", encoding="utf-8") as stream:
                collection = json.load(stream)
        else:
            collection = json.loads(path.read_text(encoding="utf-8"))
        features = collection.get("features", [])
        if len(features) != entry["count"]:
            raise ValueError(f"{code}: nombre de voies différent du manifeste")
        ids = set()
        names = set()
        for feature in features:
            props = feature.get("properties") or {}
            if str(props.get("code")) != code:
                raise ValueError(f"{code}: géométrie d'une autre commune")
            identifier = key(str(props.get("id", "")))
            name = key(str(props.get("name", "")))
            if identifier:
                ids.add(identifier)
            if name:
                names.add(name)
        geometries[code] = {"ids": ids, "names": names}

    ban = defaultdict(dict)
    address_counts = defaultdict(int)
    places = defaultdict(set)
    for row in rows(source_dir / "adresses.csv.gz"):
        code = field(row, "code_insee")
        if code not in codes:
            continue
        name = field(row, "nom_voie")
        normalized = key(name)
        if not normalized:
            continue
        address_counts[code] += 1
        identifier = key(field(row, "id_fantoir"))
        item = ban[code].setdefault(normalized, {"name": name, "ids": set()})
        if identifier:
            item["ids"].add(identifier)
        place = key(field(row, "nom_ld"))
        if place:
            places[code].add(place)

    # This extra file includes lieux-dits without numbered addresses. The BAN
    # labels some rows beta; they remain a separate audit, not fictitious roads.
    standalone = defaultdict(set)
    place_headers = None
    for row in rows(source_dir / "lieux_dits.csv.gz"):
        if place_headers is None:
            place_headers = sorted(row)
        code = field(row, "code_insee", "code_commune", "insee_com")
        if code not in codes:
            continue
        place = key(field(row, "nom_ld", "nom_voie", "nom_lieu_dit", "nom", "libelle"))
        if place:
            standalone[code].add(place)
    if not place_headers:
        raise ValueError("Le fichier BAN des lieux-dits est vide")
    if not any(c in place_headers for c in ("code_insee", "code_commune", "insee_com")):
        raise ValueError(f"Code commune introuvable dans les lieux-dits: {place_headers}")

    results = []
    for code, name in sorted(codes.items()):
        geometry = geometries.get(code)
        roads = ban[code]
        matched_id = matched_name = 0
        unmatched = []
        for item in roads.values():
            if geometry and item["ids"] & geometry["ids"]:
                matched_id += 1
            elif geometry and key(item["name"]) in geometry["names"]:
                matched_name += 1
            else:
                unmatched.append(item["name"])
        all_places = places[code] | standalone[code]
        results.append({
            "code": code, "commune": name, "geometriesIGN": manifest_rows.get(code, {}).get("count", 0),
            "voiesBAN": len(roads), "adressesBAN": address_counts[code],
            "voiesRapprocheesParId": matched_id, "voiesRapprocheesParNom": matched_name,
            "voiesBANsansTrace": len(unmatched), "exemplesVoiesSansTrace": sorted(unmatched, key=key)[:12],
            "lieuxDitsBANdistincts": len(all_places),
            "lieuxDitsSansTraceDeMemeNom": len(all_places - (geometry["names"] if geometry else set())),
            "etatGeometrie": "chargée" if geometry else "absente",
        })
    return {"meta": {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "territory": "11e circonscription de la Gironde", "communes": len(codes),
        "sources": SOURCES, "placeCsvColumns": place_headers,
        "method": "Rapprochement exact id_fantoir puis libellé normalisé ; pas d'appariement approximatif. Lieu-dit compté séparément.",
        "limitations": "Les adresses ne sont jamais exportées. Les noms BAN sans ligne IGN ne prouvent ni absence de voie physique, ni exhaustivité BAL.",
    }, "totals": {
        "communesAvecGeometrie": len(geometries),
        "geometriesIGN": sum(r["geometriesIGN"] for r in results),
        "voiesBAN": sum(r["voiesBAN"] for r in results),
        "adressesBAN": sum(r["adressesBAN"] for r in results),
        "voiesBANsansTrace": sum(r["voiesBANsansTrace"] for r in results),
        "lieuxDitsBANdistincts": sum(r["lieuxDitsBANdistincts"] for r in results),
    }, "communes": results}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--output", type=Path, default=ROOT / "data/voies-ecarts.json")
    args = parser.parse_args()
    with tempfile.TemporaryDirectory(prefix="ban-audit-") as tmp:
        source_dir = Path(tmp)
        metadata = {}
        for label, url in SOURCES.items():
            filename = source_dir / f"{label}.csv.gz"
            metadata[label] = download_once(url, filename)
        report = audit(args.root, source_dir)
        report["meta"]["downloads"] = metadata
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(json.dumps(report["totals"], ensure_ascii=False))


if __name__ == "__main__":
    main()
