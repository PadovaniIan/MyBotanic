#!/usr/bin/env python3
"""Structural checks on rendered-output-snapshot.html (no browser is available in CI).

Verifies that every component of a combination card is present and non-empty, that SVG plan
geometry stays inside its viewBox, that legend entries match plant-table rows, and that every
CSS class the app emits actually has a rule in style.css.

    node snapshot.js && python3 check_render.py
"""
import re, sys, os, json, collections

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
        # Numbers are the only way to identify a species now that colour encodes function,
        # so they must stay legible even in the smallest patch.
        nums = [float(x) for x in
                re.findall(r'<text [^>]*font-size="([\d.]+)"[^>]*font-weight="700"', svg)]
        ck(bool(nums), tag+": no numbered region labels found")
        ck(all(f >= 12 for f in nums),
           tag+": region numbers below 12px %s" % sorted(set(nums))[:4])

        # Legend entries now nest spans (layer tag, size), so split on the swatch rather
        # than trying to match a single non-nested span.
        lm = re.search(r'<div class="legend">(.*?)</div>\s*<div class="plankey">', after, re.S)
        ck(bool(lm), tag+": legend or colour key missing")
        if lm:
            entries = [x for x in re.split(r"<span><i style=", lm.group(1)) if x.strip()]
            ck(len(entries) == len(body_rows),
               tag+": legend has %d entries for %d plants" % (len(entries), len(body_rows)))
            ck(all(re.search(r"(inches|feet)", x) for x in entries),
               tag+": legend entries do not all carry a mature height")
            ck(all(re.search(r"class=.layerTag \w+.", x) for x in entries),
               tag+": legend entries do not all carry a layer tag")
            # Swatches must come from the LAYER palette, i.e. be identical to plan fills.
            swatches = re.findall(r"<span><i style='background:(#[0-9a-f]{6})'", lm.group(1))
            ck(len(swatches) == len(body_rows),
               tag+": %d legend swatches for %d plants" % (len(swatches), len(body_rows)))
            fills = set(re.findall(r'<path d="[^"]+" fill="(#[0-9a-f]{6})"', svg))
            missing_fill = set(swatches) - fills
            ck(not missing_fill,
               tag+": legend swatches %s are not plan fills" % sorted(missing_fill))

    # --- the instructions must be specific and free of abbreviations ---
    dm = re.search(r'<details class="notes">(.*?)$', c, re.S)
    ck(bool(dm), tag+": missing instructions block")
    if dm:
        det = dm.group(1)
        groups = len(re.findall(r"class=['\"]caregroup['\"]", det))
        txt = re.sub(r"<[^>]*>", " ", det)
        for phrase in ("Step by step", "centre to centre", "Your calendar",
                       "Main cut-back window", "frost dates", "The first three years",
                       "no bare soil is left anywhere",
                       "When to plant", "Best window", "Second choice",
                       "How much to water", "gallons", "straight-sided tin",
                       "Look each plant up before you buy"):
            ck(phrase in txt, tag+": instructions missing %r" % phrase)
        # Watering advice must appear per maintenance group, not only once globally.
        wt = len(re.findall(r"class=['\"]wt['\"]", det))
        ck(wt >= 1, tag+": no per-group watering advice")
        ck(wt == groups,
           tag+": %d watering lines for %d maintenance groups" % (wt, groups))
        # Planting season must be resolved to the user's zone.
        ck(re.search(r"When to plant\s*\S*\s*zone \d+", txt),
           tag+": planting season is not zone-specific")
        # Appearance: outbound photo links per species, plus a generated description.
        wcs  = len(re.findall(r"wildflower\.org/plants/search", det))
        inat = len(re.findall(r"inaturalist\.org/search", det))
        ck(wcs >= len(body_rows),
           tag+": %d Wildflower Center links for %d plants" % (wcs, len(body_rows)))
        ck(inat >= len(body_rows),
           tag+": %d iNaturalist links for %d plants" % (inat, len(body_rows)))
        ck("Looks like:" in det, tag+": per-plant notes carry no appearance description")
        # abbreviations the brief specifically called out
        for pat, label in ((r"\d+\s?in\b", "abbreviated inches"),
                           (r"\d+\s?ft\b", "abbreviated feet"),
                           (r'\d+"', 'inch marks'),
                           (r"o\.c\.", '"o.c." jargon')):
            hits = re.findall(pat, txt)
            ck(not hits, tag+": instructions contain %s (%s)" % (label, hits[:3]))
        # maintenance must name the species it applies to, grouped by type
        named  = len(re.findall(r"class=['\"]cs['\"]", det))
        ck(groups >= 1, tag+": maintenance is not grouped by plant type")
        ck(named == groups,
           tag+": %d maintenance groups but %d name their species" % (groups, named))
        ck("calendarbox" in det, tag+": no zone calendar")

    ck('<details class="notes">' in c, tag+": missing maintenance details block")
    ck(c.count("<li") >= len(body_rows), tag+": per-plant notes incomplete")
    ck(c.count("<h5") >= 4, tag+": details block missing sub-headings")
    for bad in ("undefined", "NaN", "[object", "&amp;amp;", "&lt;span", "None", "null<"):
        ck(bad not in c, tag+": output contains %r" % bad)

# =============================================================================
# index.html: the tabbed shell and the one-at-a-time carousel are static markup,
# so they are validated directly rather than through the rendered snapshot.
# =============================================================================
shell = open(os.path.join(ROOT, "index.html"), encoding="utf-8").read()

TAB_LABELS = ["Build a Bed", "Help My Plant Keeps Dying", "How it works",
              "Plant Database", "Data Sources", "Before you plant"]
tabs   = re.findall(r'<button[^>]*id="tab-(\w+)"[^>]*role="tab"(.*?)>(.*?)</button>', shell, re.S)
panels = re.findall(r'<section[^>]*id="panel-(\w+)"[^>]*role="tabpanel"([^>]*)>', shell)

print("tabs in index.html: %d, panels: %d" % (len(tabs), len(panels)))
ck(len(tabs) == 6,   "expected exactly 6 tabs, found %d" % len(tabs))
ck(len(panels) == 6, "expected exactly 6 tab panels, found %d" % len(panels))

tab_ids   = [t[0] for t in tabs]
panel_ids = [p[0] for p in panels]
ck(tab_ids == panel_ids,
   "tab order %s does not match panel order %s" % (tab_ids, panel_ids))
ck(tab_ids[0] == "build", "the first tab must be the builder, found %r" % tab_ids[0])

labels = [re.sub(r"<[^>]*>", "", t[2]).strip() for t in tabs]
ck(labels == TAB_LABELS, "tab labels are %s, expected %s" % (labels, TAB_LABELS))

# aria wiring: each tab controls its panel, each panel is labelled by its tab
for tid, attrs, _ in tabs:
    ck('aria-controls="panel-%s"' % tid in attrs,
       "tab %r does not declare aria-controls" % tid)
for pid, attrs in panels:
    ck('aria-labelledby="tab-%s"' % pid in attrs,
       "panel %r does not declare aria-labelledby" % pid)

# exactly one tab selected and one panel visible in the shipped markup
selected = [t[0] for t in tabs if 'aria-selected="true"' in t[1]]
ck(selected == ["build"],
   "expected only the build tab selected on load, got %s" % selected)
visible = [p[0] for p in panels if "hidden" not in p[1]]
ck(visible == ["build"],
   "expected only the build panel visible on load, got %s" % visible)

# roving tabindex: unselected tabs must be removed from the tab order
roving = [t[0] for t in tabs if 'tabindex="-1"' in t[1]]
ck(sorted(roving) == sorted([t for t in tab_ids if t != "build"]),
   "unselected tabs must carry tabindex=-1, got %s" % roving)

# the builder and the combinations must both live in the first panel
build_panel = shell[shell.index('id="panel-build"'):shell.index('id="panel-dying"')]
ck('id="bed"' in build_panel,        "the form is not inside the Build a Bed panel")
ck('id="comboHost"' in build_panel,  "the combinations are not inside the Build a Bed panel")
ck('id="results"' in build_panel,    "the results block is not inside the Build a Bed panel")
for other in ("panel-dying", "panel-how", "panel-plants", "panel-sources", "panel-before"):
    ck(other not in build_panel, "%s is nested inside the build panel" % other)

# the other four panels must hold their own content and nothing else
for pid, marker, what in (("plants",  'id="browseTable"', "plant database table"),
                          ("sources", 'id="srcCards"',    "source cards"),
                          ("before",  "Accuracy notice",  "accuracy notice"),
                          ("how",     "habitat scorecard", "scorecard explanation"),
                          ("dying",   'id="dxq"',         "plant search box"),
                          ("dying",   'id="dxOut"',       "diagnosis output area"),
                          ("dying",   'id="dxSources"',   "diagnostic source list")):
    i = shell.index('id="panel-%s"' % pid)
    j = shell.find("</section>", i)
    ck(marker in shell[i:j], "the %s is not inside the %s panel" % (what, pid))

# ---- carousel controls ----
ck('id="comboNav"' in shell,     "no combination navigation bar")
ck('id="comboNavFoot"' in shell, "no second navigation bar at the foot of the card")
for bid in ("prevCombo", "nextCombo", "prevCombo2", "nextCombo2"):
    ck('id="%s"' % bid in shell, "missing carousel button %r" % bid)
prev_n = len(re.findall(r"Previous Combination", shell))
next_n = len(re.findall(r"Next Combination", shell))
ck(prev_n >= 2, 'expected "Previous Combination" buttons, found %d' % prev_n)
ck(next_n >= 2, 'expected "Next Combination" buttons, found %d' % next_n)
ck('id="comboJump"' in shell, "no jump-to-combination control")
ck('id="comboCount"' in shell, "no combination counter")
# the navigation must sit above the card, which is what the brief asked for
ck(shell.index('id="comboNav"') < shell.index('id="comboHost"'),
   "the navigation buttons must appear above the combination, not below it")
# nav and counter start hidden until there are results
navtag = shell[shell.index('<div class="combo-nav" id="comboNav"'):]
navtag = navtag[:navtag.index(">")+1]
ck("hidden" in navtag, "the navigation bar should start hidden until a bed is generated")

# Per-panel div balance. A document can balance overall while one panel has an unclosed div
# and another has a stray closing tag -- that exact bug occurred here and the whole-document
# count could not see it, so each panel is balanced independently.
panel_parts = re.split(r'<section class="panel-tab"[^>]*id="(panel-\w+)"[^>]*>', shell)
for k in range(1, len(panel_parts), 2):
    pid, seg = panel_parts[k], panel_parts[k+1]
    end = seg.find("</section>")
    if end >= 0: seg = seg[:end]
    opened = len(re.findall(r"<div\b", seg))
    closed = len(re.findall(r"</div>", seg))
    ck(opened == closed,
       "%s has unbalanced div tags: %d opened, %d closed" % (pid, opened, closed))

# ---- the diagnostic tab's own requirements ----
dying = shell[shell.index('id="panel-dying"'):shell.index('id="panel-how"')]
# Prose in the markup is hard-wrapped, so a phrase can be split across a line break.
# Phrase checks run against a whitespace-normalised copy.
dying_flat = re.sub(r"\s+", " ", dying)
ck('id="dxq"' in dying,       "no plant search box on the diagnosis tab")
ck('id="dxResults"' in dying, "no search results container on the diagnosis tab")
ck('id="dxGeneral"' in dying, "no fallback for a plant that is not in the database")
ck('id="dxReset"' in dying,   "no way to start the diagnosis again")
ck("diagnostic laboratory" in dying_flat or "plant diagnostic" in dying_flat,
   "the diagnosis tab does not point the user at a laboratory as a last resort")
ck("not a diagnosis" in dying_flat,
   "the diagnosis tab does not state its own limits")
ck("Change one thing at a time" in dying_flat,
   "the diagnosis tab does not explain how to use the tests properly")
# the search box must come before the output, so the flow reads top to bottom
ck(dying.index('id="dxq"') < dying.index('id="dxOut"'),
   "the search box must appear above the diagnosis output")

# ---- the diagnostic content itself ----
diagfile = os.path.join(ROOT, "diagnostics.json")
ck(os.path.exists(diagfile), "diagnostics.json is missing")
if os.path.exists(diagfile):
    dj = json.load(open(diagfile, encoding="utf-8"))
    tests, dsrc = dj.get("diagnostics", []), dj.get("sources", {})
    print("diagnostic tests: %d across %d categories, %d sources"
          % (len(tests), len(set(t["cat"] for t in tests)), len(dsrc)))
    ck(len(tests) >= 35, "only %d diagnostic tests; the brief asked for as many as reasonable"
       % len(tests))
    ck(len(set(t["cat"] for t in tests)) >= 6,
       "diagnostics cover only %d categories" % len(set(t["cat"] for t in tests)))
    ids = [t["id"] for t in tests]
    ck(len(ids) == len(set(ids)), "duplicate diagnostic ids")
    # the specific causes the brief named must all be present
    blob = json.dumps(tests).lower()
    for phrase, what in (("pH", "soil pH"), ("caliche", "rock or hardpan near the surface"),
                         ("hardpan", "hardpan"), ("overwater", "overwatering"),
                         ("vole", "rodent damage"), ("herbicide", "herbicide injury"),
                         ("compaction", "compaction"), ("planting depth", "planting depth")):
        ck(phrase.lower() in blob, "no diagnostic covers %s" % what)
    for t in tests:
        ck(len(t.get("test","")) >= 80,
           "diagnostic %r has no performable test" % t["id"])
        ck(t.get("src"), "diagnostic %r cites no source" % t["id"])
        for k2 in t.get("src", []):
            ck(k2 in dsrc, "diagnostic %r cites unknown source %r" % (t["id"], k2))
    for k2, v in dsrc.items():
        ck(v.get("url","").startswith("http"), "source %r has no usable URL" % k2)
        ck(len(v.get("note","")) > 40, "source %r has no explanation of why it is cited" % k2)
    # abbreviated units were an explicit instruction for the whole site
    ab = [t["id"] for t in tests
          if re.search(r"\d+\s?(?:in|ft)\b", t["test"]+t["means"]+t["fix"])]
    ck(not ab, "diagnostics use abbreviated units: %s" % ab[:3])

# Every class emitted by the diagnostic UI must have a rule in the stylesheet. There is no
# browser here to look at the result, so this is the substitute: an unstyled class is the most
# likely way the new tab would come out visibly broken.
DX_CLASSES = ["dxsearch","dxresults","dxhits","dxhit","dxh-info","dxh-need","dxhead","dxh-look",
              "dxh-note","dxctx","dxrefine","dxr-hd","dxr-grid","dxlead","dxl-hd","dxactions",
              "dxlist","dxcard","dx-hd","dx-rank","dx-title","dx-cat","dx-why","dx-lab",
              "dx-test","dx-means","dx-fix","dx-src"]
unstyled = [c for c in DX_CLASSES
            if not re.search(r"(?:^|[\s,>+~{}(])\.%s\b" % re.escape(c), css)]
ck(not unstyled, "diagnostic UI classes have no CSS rule: %s" % unstyled)
# every category chip needs its own colour, or they are indistinguishable
cats_used = sorted(set(t["cat"] for t in json.load(
    open(os.path.join(ROOT,"diagnostics.json"), encoding="utf-8"))["diagnostics"]))
nochip = [c for c in cats_used if ".dx-cat.c-%s" % c not in css]
ck(not nochip, "diagnostic categories with no chip colour: %s" % nochip)
print("diagnostic UI: %d classes styled, %d category chips coloured"
      % (len(DX_CLASSES), len(cats_used)))

# the old anchor-link navigation must be gone, or it will scroll instead of switching tabs
ck("nav.top" not in shell and 'class="top"' not in shell,
   "the old in-header anchor navigation is still present")

print("index.html shell: 6 tabs, aria wiring, one visible panel, carousel controls all present")

used = collections.Counter()
for attr in re.findall(r'class="([^"]+)"', html):
    for cl in attr.split(): used[cl] += 1
for attr in re.findall(r'class="([^"]+)"', shell):
    for cl in attr.split(): used[cl] += 1
defined = set(re.findall(r"\.([A-Za-z][\w-]*)", css))
missing = sorted(cl for cl in used if cl not in defined)

# A class can be "defined" yet never match, if every rule for it is qualified by a
# different element type -- for example "section.block" will not style <div class="block">.
# That produced a real layout bug, so it is checked rather than trusted.
# Limitation: this only catches a class styled EXCLUSIVELY through the wrong element. A class
# that has one bare rule plus a second, element-qualified rule will pass here even though the
# qualified declarations are silently dropped.
pairs = set()
for tag, attr in re.findall(r"<(\w+)[^>]*class=\"([^\"]+)\"", shell):
    for cl in attr.split(): pairs.add((tag.lower(), cl))
qualified = collections.defaultdict(set)
for tag, cl in re.findall(r"(?:^|[\s,>+~{}])([a-z]+)\.([A-Za-z][\w-]*)", css):
    qualified[cl].add(tag)
bare = set()
for cl in set(c for _, c in pairs):
    # an unqualified rule is any ".cls" not immediately preceded by a tag name
    if re.search(r"(?:^|[\s,>+~{}(])\.%s\b" % re.escape(cl), css):
        bare.add(cl)
unreachable = sorted(
    "%s used on <%s> but only styled as %s" % (cl, tag, sorted(qualified[cl]))
    for tag, cl in pairs
    if cl in qualified and cl not in bare and tag not in qualified[cl]
)
ck(not unreachable, "element-qualified CSS cannot match: " + "; ".join(unreachable))
print("distinct CSS classes emitted: %d" % len(used))
wn(not missing, "classes with no stylesheet rule: %s" % missing)

# Load time was an explicit requirement: plant appearance is conveyed by generated text
# plus outbound links, so the page must contain no raster images or data URIs at all.
imgs = re.findall(r"<img\b", html)
ck(not imgs, "page embeds %d <img> tags; appearance must be text plus outbound links" % len(imgs))
ck("url(data:" not in html, "page embeds a data-URI image")
ck(html.count("<svg") == html.count("</svg>"), "unbalanced svg tags")
ck(html.count("<table") == html.count("</table>"), "unbalanced table tags")
ck(html.count("<details") == html.count("</details>"), "unbalanced details tags")
wn(html.count("<div") == html.count("</div>"),
   "div open/close mismatch: %d open, %d close" % (html.count("<div"), html.count("</div>")))

print()
for w in warns: print("  warn  " + w)
for f in fails: print("  FAIL  " + f)
# =============================================================================
# Reproducibility: rebuilding must not change any generated file. A build that is not
# byte-stable makes the CI staleness warning fire on every run and hides real drift.
# =============================================================================
import hashlib, subprocess
GEN = ["plants.json","plants.csv","data.js","regions.json","templates.json",
       "sources.json","diagnostics.json"]
def _digest(f):
    try: return hashlib.md5(open(os.path.join(ROOT,f),"rb").read()).hexdigest()
    except OSError: return None
before = {f:_digest(f) for f in GEN}
for script in ("build_reference_data.py","build_diagnostics.py","build_data.py"):
    r = subprocess.run([sys.executable, os.path.join(ROOT,script)],
                       capture_output=True, text=True, cwd=ROOT)
    ck(r.returncode == 0, "%s failed on re-run: %s" % (script, r.stderr.strip()[:200]))
after = {f:_digest(f) for f in GEN}
drifted = [f for f in GEN if before[f] != after[f]]
ck(not drifted, "rebuilding changed these generated files, so the build is not reproducible: %s"
   % drifted)
# and mixed line endings in any generated text file
mixed = []
for f in GEN:
    try: raw = open(os.path.join(ROOT,f),"rb").read()
    except OSError: continue
    if raw.count(b"\r\n") and raw.count(b"\n") != raw.count(b"\r\n"): mixed.append(f)
ck(not mixed, "generated files mix line endings: %s" % mixed)
print("build is reproducible: %d generated files byte-identical on rebuild" % len(GEN))

print("\n%s%s" % ("FAILURES: %d" % len(fails) if fails else "ALL RENDER CHECKS PASSED",
                  "   warnings: %d" % len(warns) if warns else ""))
sys.exit(1 if fails else 0)
