#!/usr/bin/env python3
"""Structural checks on rendered-output-snapshot.html (no browser is available in CI).

Verifies that every component of a combination card is present and non-empty, that SVG plan
geometry stays inside its viewBox, that legend entries match plant-table rows, and that every
CSS class the app emits actually has a rule in style.css.

    node snapshot.js && python3 check_render.py
"""
import re, sys, os, collections

ROOT = os.path.dirname(os.path.abspath(__file__))
html = open(os.path.join(ROOT, "rendered-output-snapshot.html"), encoding="utf-8").read()
css  = open(os.path.join(ROOT, "style.css"), encoding="utf-8").read()
fails, warns = [], []
def ck(cond, msg):
    if not cond: fails.append(msg)
def wn(cond, msg):
    if not cond: warns.append(msg)

cards = re.findall(r'<div class="combo">(.*?)(?=<div class="combo">|<section|</main>)', html, re.S)
print("cards in snapshot: %d" % len(cards))
ck(len(cards) >= 8, "expected at least 8 cards, got %d" % len(cards))

for i, c in enumerate(cards, 1):
    tag = "card %d" % i
    ck('<div class="head">' in c, tag+": missing head")
    ck('<div class="body">' in c, tag+": missing body")
    ck('<div class="foot">' in c, tag+": missing foot")

    m = re.search(r"<h3>(.*?)</h3>", c, re.S)
    ck(bool(m) and len(re.sub(r"<[^>]*>","",m.group(1)).strip()) > 8, tag+": empty title")
    m = re.search(r'<div class="tag">(.*?)</div>', c, re.S)
    ck(bool(m) and len(m.group(1).strip()) > 25, tag+": empty or very short tagline")

    chips = re.findall(r'<span class="chip[^"]*">(.*?)</span>', c, re.S)
    ck(len(chips) >= 7, tag+": only %d chips" % len(chips))
    ck(all(x.strip() for x in chips), tag+": blank chip")

    tm = re.search(r'<table class="plants">(.*?)</table>', c, re.S)
    ck(bool(tm), tag+": missing plant table")
    body_rows = re.findall(r"<tr>(.*?)</tr>", tm.group(1), re.S)[1:] if tm else []
    ck(len(body_rows) >= 5, tag+": only %d plant rows" % len(body_rows))
    for r in body_rows:
        cells = re.findall(r"<td[^>]*>(.*?)</td>", r, re.S)
        ck(len(cells) == 7, tag+": row has %d cells, expected 7" % len(cells))
        if len(cells) == 7:
            ck(bool(re.search(r"[A-Za-z]", cells[2])), tag+": row with no plant name")
            ck(bool(re.search(r"\d", cells[5])), tag+": row with no quantity")
            ck("inches" in cells[6], tag+": row missing spacing in inches")
            ck("<em" not in cells[3], tag+": stray markup in the bloom cell")
    ck(len(re.findall(r'''class=['"]layerTag \w+['"]''', tm.group(1) if tm else "")) == len(body_rows),
       tag+": layer-tag count does not match row count")

    sm = re.search(r'<div class="score">(.*?)(?=<div class="cal">)', c, re.S)
    ck(bool(sm), tag+": missing scorecard")
    if sm:
        vals = re.findall(r'<div class="v">(.*?)</div>', sm.group(1))
        ck(len(vals) == 6, tag+": scorecard has %d metrics, expected 6" % len(vals))
        ck(all(v.strip() and "undefined" not in v and "NaN" not in v for v in vals),
           tag+": bad scorecard value %r" % vals)
        widths = [float(x) for x in re.findall(r'width:([\d.]+)%', sm.group(1))]
        ck(all(0 <= w <= 100 for w in widths), tag+": scorecard bar outside 0-100%%: %s" % widths)

    cm = re.search(r'<div class="cal">(.*?)</div></div>', c, re.S) or \
         re.search(r'<div class="cal">(.*?)$', c, re.S)
    ck(bool(cm), tag+": missing bloom calendar")
    if cm:
        crows = re.findall(r"<tr[^>]*>(.*?)</tr>", cm.group(1), re.S)
        ck(len(crows) >= 3, tag+": calendar has only %d rows" % len(crows))
        for cr in crows:
            n = len(re.findall(r"<t[dh][^>]*>", cr))
            ck(n == 13, tag+": calendar row has %d cells, expected 13" % n)
        ck('class="cell on' in cm.group(1), tag+": calendar has no filled cells")
        ck('class="total"' in cm.group(1) or "total" in cm.group(1),
           tag+": calendar missing the summary row")

    pm = re.search(r'<div class="plan">.*?(<svg.*?</svg>)(.*?)$', c, re.S)
    ck(bool(pm), tag+": missing planting plan")
    if pm:
        svg, after = pm.group(1), pm.group(2)
        vb = re.search(r'viewBox="0 0 ([\d.]+) ([\d.]+)"', svg)
        ck(bool(vb), tag+": svg has no viewBox")

        # every species must own a tagged region: this is the check that would have
        # caught groundcover appearing in the legend with no area in the plan
        regions = re.findall(r'data-sp="(\d+)"[^>]*data-hmax="(\d+)"[^>]*data-cells="(\d+)"', svg)
        ck(len(regions) == len(body_rows),
           tag+": %d regions drawn for %d species in the table" % (len(regions), len(body_rows)))
        ck(all(int(cells) > 0 for _, _, cells in regions),
           tag+": a species was allocated zero area")
        nums = set(int(sp) for sp, _, _ in regions)
        ck(nums == set(range(1, len(body_rows)+1)),
           tag+": region numbers %s do not match rows 1-%d" % (sorted(nums), len(body_rows)))

        # the whole bed must be tiled: region cell counts sum to the grid
        total_cells = sum(int(cl) for _, _, cl in regions)
        ck(total_cells > 400, tag+": only %d cells allocated, plan is not fully tiled" % total_cells)

        # every species number must also be legible as a label in the drawing
        labels = set(int(t) for t in re.findall(r'>(\d+)</text>', svg))
        missing = sorted(set(range(1, len(body_rows)+1)) - labels)
        ck(not missing, tag+": species %s have a region but no number drawn" % missing)

        # geometry must stay inside the viewBox
        if vb:
            W, Hh = float(vb.group(1)), float(vb.group(2))
            ck(Hh >= 120 and W >= 200, tag+": plan viewBox too small (%gx%g)" % (W, Hh))
            oob = 0
            for d in re.findall(r'<path d="(M[^"]+)"', svg):
                for xs, ys in re.findall(r"M(-?[\d.]+),(-?[\d.]+)", d):
                    if float(xs) < -60 or float(xs) > W+60 or float(ys) < -60 or float(ys) > Hh+60:
                        oob += 1
            wn(oob == 0, tag+": %d plan vertices outside the viewBox" % oob)

        # seams, orientation cue and scale bar
        ck('stroke="#5f6b58"' in svg, tag+": no seams drawn between regions")
        ck("FRONT EDGE" in svg, tag+": plan does not say which edge is the front")
        ck(re.search(r'>(\d+) (?:foot|feet)</text>', svg) is not None, tag+": no scale bar")
        for band in ("BACK", "MIDDLE", "FRONT"):
            ck(band in svg, tag+": missing depth band label %r" % band)

        fs = [float(x) for x in re.findall(r'font-size="([\d.]+)"', svg)]
        wn(all(f >= 8.5 for f in fs), tag+": plan text under 8.5px %s" % sorted(set(fs))[:3])

        legend = re.findall(r"<span><i style='background:[^']+'></i>(.*?)</span>", after)
        ck(len(legend) == len(body_rows),
           tag+": legend has %d entries for %d plants" % (len(legend), len(body_rows)))
        ck(all(x.strip() for x in legend), tag+": blank legend entry")
        ck(all(re.search(r"(inches|feet)", x) for x in legend),
           tag+": legend entries do not all carry a mature height")

    # --- the instructions must be specific and free of abbreviations ---
    dm = re.search(r'<details class="notes">(.*?)$', c, re.S)
    ck(bool(dm), tag+": missing instructions block")
    if dm:
        det = dm.group(1)
        txt = re.sub(r"<[^>]*>", " ", det)
        for phrase in ("Step by step", "centre to centre", "Your calendar",
                       "Main cut-back window", "frost dates", "The first three years",
                       "no bare soil is left anywhere"):
            ck(phrase in txt, tag+": instructions missing %r" % phrase)
        # abbreviations the brief specifically called out
        for pat, label in ((r"\d+\s?in\b", "abbreviated inches"),
                           (r"\d+\s?ft\b", "abbreviated feet"),
                           (r'\d+"', 'inch marks'),
                           (r"o\.c\.", '"o.c." jargon')):
            hits = re.findall(pat, txt)
            ck(not hits, tag+": instructions contain %s (%s)" % (label, hits[:3]))
        # maintenance must name the species it applies to, grouped by type
        groups = len(re.findall(r'''class=['"]caregroup['"]''', det))
        named  = len(re.findall(r'''class=['"]cs['"]''', det))
        ck(groups >= 1, tag+": maintenance is not grouped by plant type")
        ck(named == groups,
           tag+": %d maintenance groups but %d name their species" % (groups, named))
        ck("calendarbox" in det, tag+": no zone calendar")

    ck('<details class="notes">' in c, tag+": missing maintenance details block")
    ck(c.count("<li") >= len(body_rows), tag+": per-plant notes incomplete")
    ck(c.count("<h5") >= 4, tag+": details block missing sub-headings")
    for bad in ("undefined", "NaN", "[object", "&amp;amp;", "&lt;span", "None", "null<"):
        ck(bad not in c, tag+": output contains %r" % bad)

used = collections.Counter()
for attr in re.findall(r'class="([^"]+)"', html):
    for cl in attr.split(): used[cl] += 1
defined = set(re.findall(r"\.([A-Za-z][\w-]*)", css))
missing = sorted(cl for cl in used if cl not in defined)
print("distinct CSS classes emitted: %d" % len(used))
wn(not missing, "classes with no stylesheet rule: %s" % missing)

ck(html.count("<svg") == html.count("</svg>"), "unbalanced svg tags")
ck(html.count("<table") == html.count("</table>"), "unbalanced table tags")
ck(html.count("<details") == html.count("</details>"), "unbalanced details tags")
wn(html.count("<div") == html.count("</div>"),
   "div open/close mismatch: %d open, %d close" % (html.count("<div"), html.count("</div>")))

print()
for w in warns: print("  warn  " + w)
for f in fails: print("  FAIL  " + f)
print("\n%s%s" % ("FAILURES: %d" % len(fails) if fails else "ALL RENDER CHECKS PASSED",
                  "   warnings: %d" % len(warns) if warns else ""))
sys.exit(1 if fails else 0)
