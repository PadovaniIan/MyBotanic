# Botanical Bed Builder

A dependency-free static website that recommends **layered native-plant bed combinations** for any
location in the continental United States. Enter a ZIP code and a shade level; get back a set of
complete planting designs — species list, quantities, spacing, a schematic plan, a bloom-succession
calendar and a habitat scorecard for each.

The point of difference is that it does not hand back an alphabetical plant list. It composes
**designed plant communities** using the structural / seasonal-theme / groundcover / filler layer
model, so the results read like a botanical garden bed rather than a collection of specimens, while
every species is chosen for documented ecological function in the user's own ecoregion.

- **295 species**, each native to at least one of ten US ecoregions
- **295 species classified into 15 maintenance groups**, so the advice fits the plant
- **20 design templates** — prairie matrix, gravel garden, rain garden, dry shade, fern-and-sedge
  carpet, monarch waystation, hummingbird corridor, four-season structural border, wet meadow,
  spring-ephemeral woodland, hellstrip, coastal, and more
- **Up to 12 distinct combinations** per query, deterministic and shareable by URL
- No build step, no framework, no runtime network calls, no tracking

---

## Quick start

```bash
python3 -m http.server 8000      # any static server will do
# open http://localhost:8000
```

The site also opens correctly straight from the filesystem (`file://`), because the data loads from
`data.js` as an ordinary script rather than by `fetch`.

## Deploying to GitHub Pages

See **`DEPLOY.md`** for step-by-step instructions, verification commands and a troubleshooting
table. The short version:

```bash
git init && git add -A && git commit -m "Botanical Bed Builder"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
git push -u origin main
```

Then set **Settings → Pages → Build and deployment → Source: GitHub Actions**.

`.nojekyll` and `.github/workflows/pages.yml` are already included. The workflow rebuilds the
reference data, validates the plant table, runs both test suites, regenerates the rendered-output
snapshot and structurally verifies it, then publishes the repository root. Publishing from a branch
instead of Actions also works — the root is already a valid static site and `data.js` is committed —
you just lose the automated checks.

The layout is deliberately **flat**: every file sits in the repository root, which GitHub Pages
serves without any configuration.

---

## Files

| File | Role |
|---|---|
| `index.html` | the whole application UI |
| `style.css` | styles, including a print stylesheet for taking designs into the garden |
| `app.js` | ZIP resolution, filtering, the design generator, rendering, CSV export |
| **`plants_source.txt`** | **edit this to change plants** — pipe-delimited, human-readable |
| `build_reference_data.py` | writes `regions.json`, `templates.json`, `sources.json` |
| `build_data.py` | validates the plant table, writes `plants.json`, `plants.csv`, `data.js` |
| `plants.json` / `plants.csv` | generated species database, for reuse in other projects |
| `regions.json` | ecoregions, USPS ZIP ranges, 880 prefix overrides, per-state zone spans |
| `templates.json` | the 20 design templates |
| `sources.json` | every cited data source, rendered into the page |
| `data.js` | generated bundle of all of the above (`window.BB_DATA`) |
| `fetch_authoritative.py` | downloads Census/EPA/USDA data to build the exact per-ZIP lookup |
| `zip_regions.json` | optional output of the above; the site detects and uses it automatically |
| `test_harness.js` | minimal DOM shim so `app.js` can run under Node |
| `run_tests.js` | the test suite |
| `geometry_check.js` | asserts plan coverage, height ordering and that every species is drawn |
| `ascii_plan.js` | prints a planting plan as an ASCII map, to eyeball layouts without a browser |
| `sample_output.js` | prints real generated beds as text |
| `diversity_check.js` | reports how many distinct species the design set uses |
| `snapshot.js` + `check_render.py` | serialise the rendered output and verify it structurally |
| `pages.yml` | GitHub Pages workflow (move to `.github/workflows/`) |
| `DATA_SOURCES.md` | field-by-field provenance |

---

## Adding or correcting plants

`plants_source.txt` is the single source of truth. One species per line, `|` delimited, `#` comments
allowed. Columns:

| column | meaning |
|---|---|
| `id` | lowercase slug, unique |
| `sci` / `common` / `family` | accepted name (USDA PLANTS, cross-checked against POWO), common name, family |
| `regions` | comma list of `NE SE FL MW GP TX SW MTN PNW CA` |
| `zmin` / `zmax` | USDA hardiness range |
| `light` | any of `S` full sun, `P` part shade, `H` shade |
| `moist` | any of `D` dry, `M` average, `W` moist or wet |
| `hmin` `hmax` `spread` `spacing` | inches |
| `bloom_start` / `bloom_end` | month numbers, `0` for foliage-only plants |
| `colors` | hyphen-separated flower colours |
| `layer` | `STRUCT SEASONAL MATRIX FILLER GRASS FERN SHRUB` |
| `form` | habit keyword |
| `lep` | approximate Lepidoptera species supported at **genus** level (NWF / Tallamy) |
| `sb` | `Y` if a documented pollen-specialist bee host (Fowler & Droege) |
| `hosts` | semicolon list of named larval hosts |
| `wildlife` | semicolon list from `hummingbird birdseed deer_resistant evergreen winter_seedhead winter_structure nfix nest_stems nest_cover fall_color` |
| `notes` | one or two sentences of real horticultural guidance — this is what the user actually reads, and the maintenance flags are extracted from it |

`build_data.py` also derives a **maintenance class** and a set of **care flags** per species; you do
not enter these. If you add a plant that needs different handling, extend `care_class()` and
`CARE_FLAG_PATTERNS` in `build_data.py` and add matching prose to `CARE_TEXT` / `FLAG_JOBS` in
`app.js`.

Then:

```bash
python3 build_data.py      # validates, computes derived fields, writes JSON/CSV/bundle
node run_tests.js          # 19 city scenarios, 5 stress cases, structural invariants
node snapshot.js && python3 check_render.py
```

`build_data.py` refuses to write if anything is wrong: unknown region codes or wildlife tags,
inverted hardiness or height ranges, bloom end before bloom start, duplicate ids, missing spacing,
or notes too short to be useful. It also prints a per-region coverage table and warns where the
palette is thin — that table is how the shade gaps in the arid West and the Great Plains were found
and filled.

### Derived fields

`build_data.py` computes `bloom_months`, `height_ft`, `density_per_10sqft` (from spacing, assuming
triangular spacing) and an `eco_score` blending the Lepidoptera figure, specialist-bee status, named
hosts, wildlife values and bloom duration. The generator uses `eco_score` to weight selection, so
raising it for a species makes it appear more often.

---

## How a combination is generated

1. **Resolve the ZIP.** USPS state ranges give the state; 880 three-digit prefix overrides split
   states that straddle real ecological boundaries and narrow the hardiness span. The user confirms
   both. Run `fetch_authoritative.py` to replace this with a true point-in-polygon result against
   the EPA ecoregion polygons and a sample of the USDA hardiness raster.
2. **Filter the pool.** Native to the region, hardiness covers the zone, tolerates the light level
   and the soil moisture, then optional height / deer / spreading filters.
3. **Choose fitting templates.** A template is skipped unless the pool can genuinely fill its
   minimum species count in every layer, its light and moisture match, and any hard requirement
   (two milkweed species, four hummingbird plants, three evergreens) can be met.
4. **Fill the layers.** A weighted draw favouring ecological value, never repeating a genus, with
   palette discipline per template and a greedy bloom-coverage pass for the seasonal layer so the
   flowering sequence has no gaps. A usage penalty across the result set stops the twelve designs
   converging on the same six plants.
5. **Compute quantities.** Each layer's share of the bed area, divided among its species (the first
   groundcover species is deliberately dominant), converted to counts by spacing, nudged to odd
   numbers because odd-numbered drifts read better. The number of species is capped by bed area
   (roughly one per 13 square feet) so a small bed is not reduced to a row of single specimens.
6. **Draw the plan.** See below.
7. **Write the instructions.** The step-by-step layout and the maintenance schedule are generated
   from the actual contents of the bed, not taken from the template. See below.
8. **Score.** Lepidoptera totals are summed **per genus, not per species**, so three asters do not
   count three times.

Results are deterministic: identical inputs always produce identical designs, and the permalink
encodes every input plus the shuffle seed.

### How the plan is drawn

The plan is the planting instruction, so it has to be literal. The bed is divided into a grid of
about 2,200 cells and **every cell is assigned to exactly one species**, which means there is no
unexplained empty space: the groundcover layer is drawn genuinely filling the gaps between the
taller drifts, which is how it must actually be planted.

Each species is given a whole-number quota of cells summing exactly to the grid, then grows outward
from a handful of seed points, cheapest cell first, until its quota is met (a priority-queue region
growing pass). Every species is granted a foothold cell before general growth begins. Both of those
details matter: an earlier implementation used a capacity-constrained weighted Voronoi diagram, and
it failed to converge — in testing it left up to six species per plan with *no area at all*, which
is precisely the bug where a plant appears in the legend with no zone on the drawing.

Placement is governed by mature height. Each species gets a preferred depth (tallest at the back
edge, shortest at the front) and a tolerance band that widens with the area it must cover; leaving
that band is so expensive that a large drift spreads sideways along the bed rather than bleeding
forward out of its tier. The front few inches are additionally reserved for plants under about 18
inches, so nothing short ends up hidden. Vertical distance is scaled up so drifts elongate along the
length of the bed. `geometry_check.js` asserts all of this: full coverage, one labelled region per
species, and height ordering with no inversions between species differing by 12 inches or more.

### How the instructions are generated

Neither the layout steps nor the maintenance schedule is template boilerplate — both are written from
the plants actually in the bed:

- **Layout** is an ordered sequence that names every species with its quantity, its spacing in
  inches (spelled out, and with the feet equivalent once it passes 24 inches), and whether it goes in
  as a drift, as individual plants or as a continuous carpet. Spacing is explicitly defined as
  centre-to-centre. The groundcover step states that no bare soil may be left anywhere, because
  skipping that is the single most common cause of failure.
- **Maintenance** groups the bed by *maintenance class*, a field `build_data.py` derives for every
  species from its layer, family, genus, bloom span, evergreen status and notes. There are fifteen
  classes, so the site tells you to cut warm-season grasses to 4–6 inches, shear evergreen ferns only
  once the fiddleheads appear, prune spring-flowering shrubs straight after they bloom, trim
  woody-based subshrubs by a third without cutting into old wood, and **never** cut back an agave or
  a palm. A short herbaceous perennial is separated from a tall one, because "cut the stems to 8–12
  inches" is nonsense advice for a plant that is 6 inches tall.
- **Timing** comes from a per-zone calendar giving the cut-back window and typical frost dates, with
  links to a ZIP-code frost-date lookup, NOAA climate normals and the user's Cooperative Extension.
- **Species-specific jobs** (the June cut-back, pinching, coppicing, "never move this taproot",
  "do not water this in summer") are extracted from the notes as flags and listed by plant name.

### A deliberate softness in the hardiness filter

Cold hardiness (`zmin`) is a hard limit. The warm end (`zmax`) is a **soft limit with one zone of
tolerance**, because published upper zones are a rough proxy for heat and humidity tolerance rather
than a measurement, and applying them strictly wrongly excluded large numbers of Pacific Northwest
natives from the mild zone 9 of the maritime lowlands. Any species recommended above its published
limit is flagged in that bed's plant-by-plant notes.

---

## Testing

There is no browser in CI and `jsdom` is not vendored, so `test_harness.js` implements a minimal DOM
shim and runs the real `app.js` inside it under Node.

```bash
node run_tests.js                        # assertions; exits non-zero on failure
node geometry_check.js                   # plan coverage + height ordering
node ascii_plan.js                       # see a plan as an ASCII map
node sample_output.js                    # print real generated beds
node diversity_check.js                  # distinct species used across the design set
node snapshot.js && python3 check_render.py   # verify the rendered markup
```

`run_tests.js` covers ZIP resolution for 18 locations (including the out-of-scope and malformed
cases), generates beds for 19 city / light / soil scenarios and 5 hard-filter stress cases, and
asserts structural invariants on the rendered cards: layer tags present, spacing present, scorecard
present, plan present, calendar present, quantities within range, determinism, shuffle actually
changing the result, and no `undefined` or `NaN` anywhere in the output.

`check_render.py` goes further and checks the generated markup geometrically — that SVG plan blobs
stay inside their viewBox, that plan labels are not smaller than 8.5 px, that legend entries match
plant-table rows one to one, that every bloom-calendar row has exactly 13 cells, that scorecard
progress bars stay within 0–100%, and that every CSS class the app emits actually has a rule in
`style.css`.

---

## Scope and honest limitations

- **Contiguous United States only.** Alaska, Hawaii and the territories need their own regional
  species lists and are reported as out of scope rather than answered badly.
- **Ecoregion resolution, not county resolution.** Always confirm a species against
  [BONAP](http://bonap.net/napa) for your own county before buying.
- **Lepidoptera counts are genus-level approximations** that vary substantially by county. They rank
  plants against each other; they are not measurements.
- **The database is curated, not exhaustive.** 295 species is enough to compose good beds across ten
  regions, not to represent regional floras. Contributions are the whole point of the plain-text
  source format.
- **Soil pH, summer rainfall pattern and fire regime are not modelled**, though they matter as much
  as hardiness for several groups — notably the Ericaceae and the California chaparral flora.
- **Full shade plus dry soil in the arid Southwest returns few designs.** That is a real
  horticultural constraint, not a bug; the tool says so rather than inventing options.

## Licence

Code: MIT. Data in `plants_source.txt`, `plants.json`, `plants.csv` and the reference JSON files:
CC0 1.0. The underlying government datasets are public domain; the third-party compilations cited in
`DATA_SOURCES.md` carry their own terms and are referenced, not redistributed. See `LICENSE.txt`.
