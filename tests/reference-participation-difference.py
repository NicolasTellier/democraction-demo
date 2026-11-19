"""Références de taux et d’écarts : fractions exactes, sans modèle JavaScript."""
import collections
import gzip
import hashlib
import json
import sys
from fractions import Fraction
from pathlib import Path

root = Path(__file__).resolve().parent
def read_blob(path, compressed=False):
    raw = path.read_bytes()
    digest = hashlib.sha1(b"blob " + str(len(raw)).encode() + b"\0" + raw).hexdigest()
    return json.loads(gzip.decompress(raw) if compressed else raw), digest

data, digest = read_blob(root / "../data/elections-2008-2026.json.gz", True)
territory, territory_digest = read_blob(root / "../data/territoire-33-11-2026.json")
communes = sorted((c["codeInsee"], c["nom"]) for c in territory["communes"])
pairs = [
    ("2020_muni_t1", "2026_muni_t1"),
    ("2026_muni_t1", "2020_muni_t1"),
    ("2008_muni_t1", "2026_muni_t1"),
    ("2017_pres_t2", "2022_pres_t2"),
    ("2014_euro_t1", "2019_euro_t1"),
]
scenarios = []
for first, second in pairs:
    groups = collections.defaultdict(list)
    for row in data["elections"]:
        if row["id"] in (first, second):
            groups[(row["codeInsee"], row["id"])].append(row)
    def values(code, ballot):
        matches = groups[(code, ballot)]
        if len(matches) != 1:
            return None, None
        row = matches[0]
        registered, voters = row.get("inscrits"), row.get("votants")
        assert type(registered) is int and type(voters) is int
        assert registered > 0 and 0 <= voters <= registered
        return Fraction(voters * 100, registered), row["participation"]
    items = []
    signs = collections.Counter()
    for code, name in communes:
        a, stored_a = values(code, first)
        b, stored_b = values(code, second)
        delta = b - a if a is not None and b is not None else None
        signs["missing" if delta is None else "zero" if delta == 0 else "positive" if delta > 0 else "negative"] += 1
        items.append(dict(code=code, name=name, a=float(a) if a is not None else None,
                          b=float(b) if b is not None else None, delta=float(delta) if delta is not None else None,
                          storedA=stored_a, storedB=stored_b))
    scenarios.append(dict(first=first, second=second, paired=len(communes)-signs["missing"],
                          signs={key: signs[key] for key in ("negative", "zero", "positive", "missing")}, items=items))
result = dict(dataBlob=digest, territoryBlob=territory_digest,
              source=data["meta"]["source"], updated=data["meta"]["miseAJour"], scenarios=scenarios)
path = root / "fixtures/participation-difference-real.json"
if "--write" in sys.argv:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
else:
    assert json.loads(path.read_text()) == result, "Références différentes : examiner la source avant toute régénération"
for scenario in scenarios:
    print(scenario["first"], scenario["second"], scenario["paired"], scenario["signs"])
