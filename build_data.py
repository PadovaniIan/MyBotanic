#!/usr/bin/env python3
"""Validate plants_source.txt and emit plants.json, plants.csv and data.js.

    python3 build_reference_data.py     # writes regions/templates/sources.json
    python3 build_data.py               # validates plants and bundles everything

The site loads data.js, which defines window.BB_DATA, so it works when opened straight from
the filesystem as well as over HTTP. Refuses to write if anything fails validation.
"""
import csv, json, os, re, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC  = os.path.join(ROOT, "plants_source.txt")

INT_FIELDS  = ["zmin","zmax","hmin","hmax","spread","spacing","bloom_start","bloom_end","lep"]
LIST_FIELDS = {"regions":",", "light":",", "moist":",", "hosts":";", "wildlife":";", "colors":"-"}
VALID_REGION = {"NE","SE","FL","MW","GP","TX","SW","MTN","PNW","CA"}
VALID_LIGHT  = {"S","P","H"}
VALID_MOIST  = {"D","M","W"}
VALID_LAYER  = {"STRUCT","SEASONAL","MATRIX","FILLER","GRASS","FERN","SHRUB"}
VALID_WILD   = {"hummingbird","birdseed","deer_resistant","evergreen","winter_seedhead",
                "winter_structure","nfix","nest_stems","nest_cover","fall_color"}
GROUND = {"MATRIX","GRASS","FERN"}

def parse():
    rows, header, errors = [], None, []
    with open(SRC, encoding="utf-8") as fh:
        for ln, line in enumerate(fh, 1):
            line = line.rstrip("\n")
            if not line.strip() or line.lstrip().startswith("#"):
                continue
            parts = line.split("|")
            if header is None:
                header = parts; continue
            if len(parts) != len(header):
                errors.append("line %d: %d fields, expected %d (%s)"
                              % (ln, len(parts), len(header), parts[0])); continue
            rows.append((ln, dict(zip(header, parts))))
    return header, rows, errors

def build():
    header, rows, errors = parse()
    if header is None:
        print("ERROR: no header row found in plants_source.txt", file=sys.stderr); return 1
    plants, seen = [], set()

    for ln, r in rows:
        p, pid = {}, r["id"].strip()
        if not re.fullmatch(r"[a-z0-9_]+", pid): errors.append("line %d: bad id %r" % (ln, pid))
        if pid in seen: errors.append("line %d: duplicate id %r" % (ln, pid))
        seen.add(pid); p["id"] = pid

        for k in ("sci","common","family","layer","form","notes"): p[k] = r[k].strip()
        for k in INT_FIELDS:
            v = r[k].strip()
            try: p[k] = int(v) if v else None
            except ValueError: errors.append("%s: %s is not an integer (%r)" % (pid,k,v)); p[k]=None
        for k, sep in LIST_FIELDS.items():
            v = r[k].strip()
            p[k] = [x.strip() for x in v.split(sep) if x.strip()] if v else []
        p["sb"] = r["sb"].strip().upper() == "Y"

        # ---- validation ----
        if p["layer"] not in VALID_LAYER: errors.append("%s: bad layer %r" % (pid, p["layer"]))
        if not p["regions"]: errors.append("%s: no regions" % pid)
        bad = set(p["regions"]) - VALID_REGION
        if bad: errors.append("%s: unknown region(s) %s" % (pid, sorted(bad)))
        bad = set(p["light"]) - VALID_LIGHT
        if bad or not p["light"]: errors.append("%s: bad light %r" % (pid, r["light"]))
        bad = set(p["moist"]) - VALID_MOIST
        if bad or not p["moist"]: errors.append("%s: bad moisture %r" % (pid, r["moist"]))
        bad = set(p["wildlife"]) - VALID_WILD
        if bad: errors.append("%s: unknown wildlife tag(s) %s" % (pid, sorted(bad)))
        if p["zmin"] is None or p["zmax"] is None or p["zmin"] > p["zmax"]:
            errors.append("%s: bad hardiness range" % pid)
        elif not (1 <= p["zmin"] <= 13 and 1 <= p["zmax"] <= 13):
            errors.append("%s: hardiness zone out of range 1-13" % pid)
        if p["hmin"] is None or p["hmax"] is None or p["hmin"] > p["hmax"]:
            errors.append("%s: bad height range" % pid)
        if not p["spacing"]: errors.append("%s: missing spacing" % pid)
        for k in ("bloom_start","bloom_end"):
            if p[k] is None or not (0 <= p[k] <= 12): errors.append("%s: bad %s" % (pid, k))
        if p["bloom_start"] and p["bloom_end"] and p["bloom_end"] < p["bloom_start"]:
            errors.append("%s: bloom_end before bloom_start" % pid)
        if len(p["notes"]) < 20: errors.append("%s: notes too short to be useful" % pid)
        if not p["sci"] or " " not in p["sci"]: errors.append("%s: sci name looks wrong" % pid)

        # ---- derived ----
        p["bloom_months"] = [] if not p["bloom_start"] else list(range(p["bloom_start"], p["bloom_end"]+1))
        p["height_ft"] = round(p["hmax"]/12.0, 1) if p["hmax"] is not None else None
        sp = max(4, p["spacing"] or 12)
        p["density_per_10sqft"] = round(10.0 / max(0.25, (sp*sp*0.866)/144.0), 1)
        eco  = min(40, (p["lep"] or 0)*0.35)
        eco += 12 if p["sb"] else 0
        eco += 4*len(p["hosts"])
        eco += 3*len([w for w in p["wildlife"] if w in
                      ("hummingbird","birdseed","nest_stems","nest_cover",
                       "winter_seedhead","winter_structure","nfix")])
        eco += min(8, len(p["bloom_months"]))
        p["eco_score"] = round(min(100, eco))
        plants.append(p)

    if errors:
        print("VALIDATION FAILED (%d problems):\n  %s" % (len(errors), "\n  ".join(errors)),
              file=sys.stderr)
        return 1

    with open(os.path.join(ROOT,"plants.json"), "w", encoding="utf-8") as fh:
        json.dump(plants, fh, indent=1, ensure_ascii=False)

    cols = ["id","sci","common","family","regions","zmin","zmax","light","moist","hmin","hmax",
            "spread","spacing","bloom_start","bloom_end","colors","layer","form","lep","sb",
            "hosts","wildlife","eco_score","density_per_10sqft","notes"]
    with open(os.path.join(ROOT,"plants.csv"), "w", encoding="utf-8", newline="") as fh:
        w = csv.writer(fh); w.writerow(cols)
        for p in plants:
            w.writerow(["; ".join(p[c]) if isinstance(p[c], list) else p[c] for c in cols])

    bundle = {"plants": plants}
    for name in ("regions","templates","sources"):
        with open(os.path.join(ROOT, name+".json"), encoding="utf-8") as fh:
            bundle[name] = json.load(fh)
    with open(os.path.join(ROOT,"data.js"), "w", encoding="utf-8") as fh:
        fh.write("/* Generated by build_data.py - do not edit by hand. */\nwindow.BB_DATA = ")
        json.dump(bundle, fh, separators=(",",":"), ensure_ascii=False)
        fh.write(";\n")

    # ---- coverage report: this is how you find gaps in the database ----
    print("OK  %d species validated" % len(plants))
    print("    %-4s %5s   %s" % ("reg","total","sun / part / shade   by layer"))
    for reg in sorted(VALID_REGION):
        sub = [p for p in plants if reg in p["regions"]]
        s = len([p for p in sub if "S" in p["light"]])
        pp = len([p for p in sub if "P" in p["light"]])
        h = len([p for p in sub if "H" in p["light"]])
        g = len([p for p in sub if p["layer"] in GROUND])
        print("    %-4s %5d   %3d / %4d / %5d      groundcover+grass+fern %d"
              % (reg, len(sub), s, pp, h, g))
        if h < 5:  print("       ^ warning: only %d shade-tolerant species for %s" % (h, reg))
        if g < 6:  print("       ^ warning: thin groundcover palette for %s" % reg)
    lay = {}
    for p in plants: lay[p["layer"]] = lay.get(p["layer"],0)+1
    print("    layers: " + ", ".join("%s %d" % kv for kv in sorted(lay.items())))
    print("    specialist-bee hosts %d | named larval hosts %d | keystone genera (lep>=80) %d"
          % (len([p for p in plants if p["sb"]]),
             len([p for p in plants if p["hosts"]]),
             len(set(p["sci"].split()[0] for p in plants if (p["lep"] or 0) >= 80))))
    print("    wrote plants.json, plants.csv, data.js (%.0f KB)"
          % (os.path.getsize(os.path.join(ROOT,"data.js"))/1024))
    return 0

if __name__ == "__main__":
    sys.exit(build())
