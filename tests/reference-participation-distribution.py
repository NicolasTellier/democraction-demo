"""Vérifie les références figées sans importer le modèle JavaScript."""
import collections
import gzip
import hashlib
import json
from fractions import Fraction
from pathlib import Path

root = Path(__file__).resolve().parent
raw = (root / "../data/elections-2008-2026.json.gz").read_bytes()
data = json.loads(gzip.decompress(raw))
reference = json.loads((root / "fixtures/participation-real.json").read_text())
digest = hashlib.sha1(b"blob " + str(len(raw)).encode() + b"\0" + raw).hexdigest()
assert digest == reference["dataBlob"]
assert data["meta"]["source"] == reference["source"]
assert data["meta"]["miseAJour"] == reference["updated"]
for case in reference["scenarios"]:
    rows = [row for row in data["elections"] if row["type"] == case["type"]
            and row["tour"] == case["tour"] and row["annee"] == case["year"]
            and (not case["scope"] or row["commune"] == case["scope"])]
    identities = collections.Counter(row["codeInsee"] for row in rows)
    bins = [0] * 10
    excluded = 0
    for row in rows:
        registered, voters = row.get("inscrits"), row.get("votants")
        if (identities[row["codeInsee"]] != 1 or type(registered) is not int
                or type(voters) is not int or registered <= 0
                or not 0 <= voters <= registered):
            excluded += 1
            continue
        percentage = Fraction(voters, registered) * 100
        bins[min(9, int(percentage // 10))] += 1
    assert bins == case["bins"], case
    assert sum(bins) == case["eligible"]
    assert excluded == case["excluded"]
    assert sum(count > 1 for count in identities.values()) == case["duplicates"]
    print(case["type"], case["year"], case["tour"], case["scope"] or "périmètre complet", bins)
