#!/usr/bin/env python3
"""Build an exact per-ZIP ecoregion and hardiness lookup from primary sources.

The shipped site resolves a ZIP code using published USPS state ranges plus a table of 880
three-digit prefix overrides. That is accurate to "which part of which state", which is usually
enough. This script replaces that estimate with a real geospatial answer:

    Census ZCTA Gazetteer   -> latitude/longitude centroid for every ZIP Code Tabulation Area
    EPA Level III/IV        -> point-in-polygon gives the Omernik ecoregion at that point
    USDA PHZM 2023 raster   -> sampled at that point gives the cold-hardiness zone

Output: zip_regions.json, which index.html picks up automatically on the next page load and
reports as "exact ZIP lookup".

    python3 -m pip install -r requirements.txt
    python3 fetch_authoritative.py                 # download, build, write
    python3 fetch_authoritative.py --cache-only    # reuse ./cache, no network
    python3 fetch_authoritative.py --skip-hardiness

Needs network access on the first run. Downloads are cached in ./cache (roughly 250 MB). If
rasterio or the hardiness raster is unavailable the script still emits ecoregions and falls back
to the prefix-based zone estimate, flagging each affected record with "zone_estimated".
"""
import argparse, io, json, os, ssl, sys, zipfile
import urllib.request

ROOT  = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(ROOT, "cache")

# Landing pages are the citation; direct asset URLs occasionally move.
SOURCES = {
 "zcta": {"landing":"https://www.census.gov/geographies/reference-files/time-series/geo/gazetteer-files.html",
          "url":"https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2023_Gazetteer/2023_Gaz_zcta_national.zip",
          "file":"zcta_gazetteer.zip"},
 "eco3": {"landing":"https://www.epa.gov/eco-research/level-iii-and-iv-ecoregions-continental-united-states",
          "url":"https://gaftp.epa.gov/EPADataCommons/ORD/Ecoregions/us/us_eco_l3.zip",
          "file":"us_eco_l3.zip"},
 "phzm": {"landing":"https://prism.oregonstate.edu/projects/plant_hardiness_zones.php",
          "url":"https://prism.oregonstate.edu/projects/public/phm/2023/phzm_us_grid_2023.zip",
          "file":"phzm_us_grid_2023.zip"},
}

# --------------------------------------------------------------------------------------------
# EPA ecoregion -> the ten design regions. Keyed on NA_L2CODE (Omernik Level II), with Level III
# refinements where Level II is too coarse for planting decisions. This mapping IS the definition
# of the ten regions; keep it in step with regions.json.
L2_TO_REGION = {
 "5.2":["NE"],  "5.3":["NE"],                                   # Northern Forests
 "6.2":["MTN"],                                                  # Western Cordillera
 "7.1":["PNW"],                                                  # Marine West Coast Forest
 "8.1":["NE","MW"], "8.2":["MW"], "8.3":["SE"],
 "8.4":["NE","SE"], "8.5":["SE"],                                # Eastern Temperate Forests
 "9.2":["MW","GP"], "9.3":["GP"], "9.4":["GP","TX"],
 "9.5":["TX","SE"], "9.6":["TX"],                                # Great Plains
 "10.1":["MTN"], "10.2":["SW"],                                  # North American Deserts
 "11.1":["CA"],                                                  # Mediterranean California
 "12.1":["SW","MTN"],                                            # Southern Semi-Arid Highlands
 "13.1":["SW","MTN"],                                            # Temperate Sierras
 "15.4":["FL"],                                                  # Tropical Wet Forests
}
L3_TO_REGION = {
 "75":["SE","FL"],  "76":["FL"],       "65":["SE"],      "63":["SE"],      "45":["SE"],
 "64":["NE","SE"],  "84":["NE"],       "59":["NE"],      "29":["TX","GP"], "30":["TX"],
 "32":["TX"],       "33":["TX","SE"],  "34":["TX","SE"], "31":["TX"],      "24":["SW"],
 "81":["SW"],       "14":["SW"],       "23":["SW","MTN"],"22":["SW","MTN"],"20":["MTN"],
 "21":["MTN"],      "17":["MTN"],      "13":["MTN"],     "80":["MTN"],     "18":["MTN"],
 "19":["MTN"],      "16":["MTN"],      "12":["SW"],      "79":["MTN"],
 "10":["MTN","PNW"],"11":["PNW"],      "1":["PNW"],      "2":["PNW"],      "3":["PNW"],
 "4":["PNW","MTN"], "77":["PNW","MTN"],"78":["PNW","MTN"],
 "6":["CA"],        "7":["CA"],        "8":["CA"],       "85":["CA"],      "5":["CA","PNW"],
 "27":["GP"],       "25":["GP"],       "26":["GP"],      "28":["MW","GP"],
 "42":["GP","MW"],  "43":["GP","MW"],  "44":["GP","MW"], "46":["GP","MW"],
 "47":["MW"],       "54":["MW"],       "55":["MW"],      "56":["MW"],      "57":["MW"],
 "72":["MW"],       "73":["SE","MW"],  "38":["SE","MW"], "39":["SE","MW"], "40":["MW","GP"],
 "51":["MW"],       "50":["NE","MW"],  "48":["MW"],      "49":["NE","MW"], "52":["MW"],
 "53":["MW"],       "83":["NE"],       "60":["NE"],      "58":["NE"],      "82":["NE"],
 "61":["NE"],       "62":["NE"],       "67":["NE","SE"], "66":["NE","SE"], "69":["NE","SE"],
 "70":["SE","NE"],  "68":["SE"],       "71":["MW","SE"], "74":["SE"],      "35":["SE"],
 "36":["SE"],       "37":["SE","MW"],
}

def log(*a): print(*a, file=sys.stderr, flush=True)

def download(key, force=False):
    src = SOURCES[key]
    os.makedirs(CACHE, exist_ok=True)
    dest = os.path.join(CACHE, src["file"])
    if os.path.exists(dest) and not force:
        log("cached  %-26s %.0f MB" % (src["file"], os.path.getsize(dest)/1e6)); return dest
    log("fetch   %-26s %s" % (src["file"], src["url"]))
    ctx = ssl.create_default_context()
    ctx.check_hostname = False        # the EPA gaftp host presents a mismatched certificate
    ctx.verify_mode = ssl.CERT_NONE
    req = urllib.request.Request(src["url"],
                                headers={"User-Agent":"botanical-bed-builder/1.0"})
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=300) as r, open(dest,"wb") as fh:
            while True:
                chunk = r.read(1 << 20)
                if not chunk: break
                fh.write(chunk)
    except Exception as e:
        if os.path.exists(dest): os.remove(dest)
        log("  FAILED: %s\n  Download it by hand from %s and save it as %s"
            % (e, src["landing"], dest))
        return None
    return dest

def read_zctas(path):
    """-> {zip: (lat, lon)} from the Census Gazetteer ZCTA file."""
    out = {}
    with zipfile.ZipFile(path) as z:
        name = [n for n in z.namelist() if n.lower().endswith((".txt",".csv"))][0]
        with z.open(name) as fh:
            text = io.TextIOWrapper(fh, encoding="latin-1")
            header = [h.strip().upper() for h in next(text).split("\t")]
            gi = header.index("GEOID")
            la = header.index("INTPTLAT")
            lo = [i for i,h in enumerate(header) if h.startswith("INTPTLONG")][0]
            for line in text:
                f = line.rstrip("\n").split("\t")
                if len(f) <= lo: continue
                try: out[f[gi].strip().zfill(5)] = (float(f[la]), float(f[lo]))
                except ValueError: pass
    return out

def decode_zone(raw):
    """PHZM rasters ship in several encodings; handle whole zones, half zones and degrees F."""
    if raw <= 0 or raw > 200: return None
    if raw <= 15:  return int(round(raw))                       # zone number
    if raw <= 30:  return int((raw + 1) // 2)                   # half-zone index
    return max(1, min(13, int((raw + 60) // 10) + 1))           # degrees F of extreme minimum

def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--cache-only", action="store_true", help="never touch the network")
    ap.add_argument("--force", action="store_true", help="re-download even if cached")
    ap.add_argument("--skip-hardiness", action="store_true", help="ecoregions only")
    args = ap.parse_args()

    try:
        import geopandas as gpd
        from shapely.geometry import Point
    except ImportError:
        log("ERROR: geopandas and shapely are required.\n"
            "       python3 -m pip install -r requirements.txt")
        return 1

    paths = {}
    for key in ("zcta","eco3"):
        p = os.path.join(CACHE, SOURCES[key]["file"])
        if args.cache_only:
            if not os.path.exists(p):
                log("ERROR: --cache-only but %s is missing" % p); return 1
        else:
            p = download(key, args.force)
            if not p: return 1
        paths[key] = p

    log("reading ZCTA centroids ...")
    zctas = read_zctas(paths["zcta"])
    log("  %d ZIP Code Tabulation Areas" % len(zctas))

    log("reading EPA Level III ecoregions ...")
    eco = gpd.read_file("zip://" + paths["eco3"])
    cols = {c.upper(): c for c in eco.columns}
    c_l3  = cols.get("US_L3CODE") or cols.get("NA_L3CODE")
    c_l3n = cols.get("US_L3NAME") or cols.get("NA_L3NAME")
    c_l2  = cols.get("NA_L2CODE"); c_l2n = cols.get("NA_L2NAME")
    c_l1n = cols.get("NA_L1NAME")
    log("  %d polygons, CRS %s" % (len(eco), eco.crs))

    pts = gpd.GeoDataFrame({"zip": list(zctas.keys())},
        geometry=[Point(lon, lat) for (lat, lon) in zctas.values()],
        crs="EPSG:4326").to_crs(eco.crs)
    log("intersecting %d points with ecoregion polygons ..." % len(pts))
    joined = gpd.sjoin(pts, eco, how="left", predicate="within")
    joined = joined[~joined.index.duplicated(keep="first")]

    zone_at = {}
    if not args.skip_hardiness:
        grid = None
        try:
            import rasterio
            from rasterio.warp import transform as warp_transform
            p = os.path.join(CACHE, SOURCES["phzm"]["file"])
            if not args.cache_only and not os.path.exists(p):
                p = download("phzm", args.force)
            if p and os.path.exists(p):
                with zipfile.ZipFile(p) as z:
                    tif = [n for n in z.namelist() if n.lower().endswith((".tif",".tiff"))]
                    if tif:
                        z.extract(tif[0], CACHE)
                        grid = os.path.join(CACHE, tif[0])
                        log("hardiness raster: %s" % tif[0])
                    else:
                        log("  no GeoTIFF inside the PHZM archive; skipping hardiness")
            if grid:
                with rasterio.open(grid) as ds:
                    keys = list(zctas.keys())
                    xs = [zctas[k][1] for k in keys]; ys = [zctas[k][0] for k in keys]
                    tx, ty = warp_transform("EPSG:4326", ds.crs, xs, ys)
                    for k, v in zip(keys, ds.sample(list(zip(tx, ty)))):
                        z = decode_zone(float(v[0]))
                        if z: zone_at[k] = z
                log("  sampled hardiness for %d ZIPs" % len(zone_at))
        except ImportError:
            log("  rasterio not installed; hardiness zones will fall back to the estimate")

    ref  = json.load(open(os.path.join(ROOT, "regions.json")))
    zip3 = ref["zip3_overrides"]; valid = set(ref["regions"].keys())
    st_zips = ref["state_zips"]
    def state_of(zipc):
        n = int(zipc)
        for s, rr in st_zips.items():
            for lo, hi in rr:
                if lo <= n <= hi: return s
        return ""

    out, unmapped, dropped = {}, {}, 0
    for _, row in joined.iterrows():
        zipc = row["zip"]
        l3 = str(row[c_l3]).strip() if c_l3 and row.get(c_l3) is not None else ""
        l2 = str(row[c_l2]).strip() if c_l2 and row.get(c_l2) is not None else ""
        l3 = l3.split(".")[0] if l3 and l3.lower() != "nan" else ""
        regions = L3_TO_REGION.get(l3) or L2_TO_REGION.get(l2)
        if not regions:
            if l3 or l2:
                key = (l2, l3, str(row.get(c_l3n)))
                unmapped[key] = unmapped.get(key, 0) + 1
            regions = (zip3.get(zipc[:3]) or {}).get("regions") or []
        regions = [r for r in regions if r in valid]
        if not regions:
            dropped += 1; continue
        rec = {"regions": regions, "state": state_of(zipc),
               "lat": round(zctas[zipc][0], 4), "lon": round(zctas[zipc][1], 4)}
        for col, key in ((c_l3n,"epa_l3"), (c_l2n,"epa_l2"), (c_l1n,"epa_l1")):
            if col and row.get(col) is not None and str(row[col]).lower() != "nan":
                rec[key] = str(row[col])
        if zipc in zone_at:
            rec["zone"] = rec["zone_min"] = rec["zone_max"] = zone_at[zipc]
        else:
            zr = (zip3.get(zipc[:3]) or {}).get("zones")
            if zr: rec["zone_min"], rec["zone_max"] = zr[0], zr[1]
            rec["zone_estimated"] = True
        if rec.get("epa_l3"): rec["place"] = rec["epa_l3"]
        out[zipc] = rec

    payload = {"generated_by":"fetch_authoritative.py",
               "sources":{k: SOURCES[k]["landing"] for k in SOURCES},
               "count":len(out), "zips":out}
    dest = os.path.join(ROOT, "zip_regions.json")
    with open(dest, "w") as fh:
        json.dump(payload, fh, separators=(",",":"))
    log("\nwrote %s  (%d ZIPs, %.1f MB)" % (dest, len(out), os.path.getsize(dest)/1e6))
    if dropped: log("  %d ZIPs had no usable ecoregion and were dropped" % dropped)
    if unmapped:
        log("  ecoregions with no crosswalk entry (add them to L3_TO_REGION):")
        for (l2, l3, name), n in sorted(unmapped.items(), key=lambda x: -x[1])[:15]:
            log("    L2 %-5s L3 %-4s %-44s %d ZIPs" % (l2, l3, str(name)[:44], n))
    log("\nThe site will use the exact lookup on the next load. Commit zip_regions.json to publish.")
    return 0

if __name__ == "__main__":
    sys.exit(main())
