#!/usr/bin/env python3
"""Extrait uniquement les résultats législatifs 2024 des bureaux référencés.

Usage : python scripts/extract-official-bureaux.py --source-dir /chemin/des-xlsx
Les deux sources sont téléchargées manuellement depuis les URL ci-dessous. Leurs
empreintes SHA-256 sont contrôlées ; aucun CSV nominatif ni accès réseau dans ce script.
"""
import argparse
import hashlib
import json
from pathlib import Path

from openpyxl import load_workbook

ROOT = Path(__file__).resolve().parents[1]
REFERENCE = ROOT / "demo/data/bureaux-referentiel-23.json"
DEFAULT_OUTPUT = ROOT / "demo/data/resultats-bureaux-officiels-2024.json"

SOURCES = [
    dict(id="legislatives-2024-t1", kind="legi2024", round=1, date="2024-06-30",
         label="Législatives 2024 — 1er tour",
         filename="legislatives-2024-t1-bureaux.xlsx",
         sha256="b9e007644f0f060948f0d7215e95d4eec87e69d95f3027dd27067f376155a518",
         dataset="https://www.data.gouv.fr/datasets/elections-legislatives-des-30-juin-et-7-juillet-2024-resultats-definitifs-du-1er-tour",
         resource="https://static.data.gouv.fr/resources/elections-legislatives-des-30-juin-et-7-juillet-2024-resultats-definitifs-du-1er-tour/20240715-103624/resultats-definitifs-par-bureau-de-vote.xlsx",
         license="Licence Ouverte / Open Licence version 2.0"),
    dict(id="legislatives-2024-t2", kind="legi2024", round=2, date="2024-07-07",
         label="Législatives 2024 — 2nd tour",
         filename="legislatives-2024-t2-bureaux.xlsx",
         sha256="2c0c2a5abfdf96002f89dfe5388d79a614a5a4427be31cb40de4b3edf08bff75",
         dataset="https://www.data.gouv.fr/datasets/elections-legislatives-des-30-juin-et-7-juillet-2024-resultats-definitifs-du-2nd-tour",
         resource="https://static.data.gouv.fr/resources/elections-legislatives-des-30-juin-et-7-juillet-2024-resultats-definitifs-du-2nd-tour/20240710-170406/resultats-definitifs-par-bureau-de-vote.xlsx",
         license="Licence Ouverte / Open Licence version 2.0"),
]


def exact_int(value, label):
    if isinstance(value, bool) or value is None:
        raise ValueError(f"{label} absent ou non entier : {value!r}")
    text = str(value).strip()
    if not text.isdecimal():
        raise ValueError(f"{label} absent ou non entier : {value!r}")
    return int(text)


def get_key(row, kind):
    if str(row[0]).zfill(2) != "33":
        return None
    return str(row[2]).zfill(5), exact_int(row[4], "Code BV")


def extract_votes(row, kind, election_round):
    candidates = []
    for position in range(19, len(row), 9):
        if row[position] is None:
            continue
        candidates.append(dict(panel=exact_int(row[position], "Numéro de panneau"),
                               name=" ".join(x for x in (row[position + 3], row[position + 2]) if x),
                               nuance=row[position + 1] or None,
                               votes=exact_int(row[position + 5], "Voix")))
    if not candidates:
        raise ValueError(f"Aucun candidat pour {kind} tour {election_round}")
    if len({candidate["panel"] for candidate in candidates}) != len(candidates):
        raise ValueError("Panneau dupliqué")
    return candidates


def extract_record(row, key, source):
    kind = source["kind"]
    registered, voters, abstentions, expressed, blank, invalid = [
        exact_int(row[index], str(index)) for index in (5, 6, 8, 10, 13, 16)]
    name = row[3]
    candidates = extract_votes(row, kind, source["round"])
    if registered != voters + abstentions or voters != expressed + blank + invalid:
        raise ValueError(f"Totaux incompatibles pour {source['id']} {key}")
    if expressed != sum(candidate["votes"] for candidate in candidates):
        raise ValueError(f"Voix incompatibles pour {source['id']} {key}")
    return dict(bureauId=f"{key[0]}-{key[1]}", codeInsee=key[0], numero=key[1],
                commune=name, inscrits=registered, votants=voters, abstentions=abstentions,
                blancs=blank, nuls=invalid, exprimes=expressed, candidats=candidates)


def parse_source(source, path, stations):
    actual = hashlib.sha256(path.read_bytes()).hexdigest()
    if actual != source["sha256"]:
        raise ValueError(f"Empreinte source incorrecte pour {path.name} : {actual}")
    workbook = load_workbook(path, read_only=True, data_only=True)
    sheet = workbook.active
    header = next(sheet.values)
    expected = ("Code département", "Libellé département", "Code commune",
                "Libellé commune", "Code BV", "Inscrits", "Votants")
    if tuple(header[:len(expected)]) != expected:
        raise ValueError(f"Colonnes source inattendues : {path.name}")
    wanted = {(station["codeInsee"], station["numero"]): station for station in stations}
    commune_codes = {station["codeInsee"] for station in stations}
    records = {}
    gironde_rows = 0
    commune_rows = 0
    for row in sheet.iter_rows(min_row=2, values_only=True):
        key = get_key(row, source["kind"])
        if key is None:
            continue
        gironde_rows += 1
        if key[0] not in commune_codes:
            continue
        commune_rows += 1
        if key not in wanted:
            raise ValueError(f"Bureau inattendu dans une commune du référentiel : {key}")
        if key in records:
            raise ValueError(f"Bureau répété dans le fichier officiel : {key}")
        record = extract_record(row, key, source)
        if record["commune"] != wanted[key]["commune"]:
            raise ValueError(f"Libellé de commune divergent pour {key} : {record['commune']!r}")
        records[key] = record
    workbook.close()
    if not gironde_rows:
        raise ValueError(f"Aucun résultat girondin dans {path.name}")
    missing = [station["id"] for station in stations if (station["codeInsee"], station["numero"]) not in records]
    return dict(id=source["id"], label=source["label"], date=source["date"], tour=source["round"],
                source=dict(dataset=source["dataset"], resource=source["resource"],
                            sha256=source["sha256"], license=source["license"]),
                coverage=dict(expected=len(stations), matched=len(records), missing=missing,
                              sourceCommuneRows=commune_rows,
                              status="source_without_target_communes" if not commune_rows else "partial" if missing else "complete"),
                bureaux=[records[key] for key in sorted(records)])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    stations = json.loads(REFERENCE.read_text(encoding="utf-8"))["stations"]
    if len(stations) != 23 or len({station["id"] for station in stations}) != 23:
        raise ValueError("Référentiel de 23 bureaux absent ou dupliqué")
    result = dict(schemaVersion=1, producer="Ministère de l'intérieur",
                  reference="demo/data/bureaux-referentiel-23.json",
                  join="Code INSEE et numéro de bureau exacts ; le périmètre géographique de chaque bureau à la date du scrutin n'est pas vérifié",
                  warning="Une absence dans un fichier n'est pas une abstention ni un vote nul. Le bureau 33114-2 n'apparaît pas en 2024 ; le bureau 33114-1 peut avoir changé de périmètre.",
                  scrutins=[],scrutinsSansLigne=[])
    for source in SOURCES:
        path = args.source_dir / source["filename"]
        election = parse_source(source, path, stations)
        if source["round"] == 2:
            if election["coverage"]["sourceCommuneRows"]:
                raise ValueError("Des résultats T2 existent ; la mention de scrutin non tenu est invalide")
            result["scrutinsSansLigne"].append(dict(id=election["id"],label=election["label"],date=election["date"],
                status="scrutin_non_tenu_dans_les_communes_cibles",source=election["source"],coverage=election["coverage"],
                explanation="Aucune ligne pour les huit communes dans le fichier définitif du 2nd tour. Le ministère indique que les circonscriptions pourvues au 1er tour ne participent pas au 2nd tour."))
        else:
            result["scrutins"].append(election)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"Fichier : {args.output} ({args.output.stat().st_size} octets)")
    for election in result["scrutins"] + result["scrutinsSansLigne"]:
        print(f"{election['id']}: {election['coverage']['matched']}/23 ; absents {election['coverage']['missing']}")


if __name__ == "__main__":
    main()
