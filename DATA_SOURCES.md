# Data provenance, field by field

Every value in `plants_source.txt` traces to one of the sources below. Where sources disagree the
more conservative value is used and the discrepancy is noted in the `notes` column.

## Field to authority

| Field | Primary authority | Notes |
|---|---|---|
| `sci`, `family` | [USDA PLANTS](https://plants.usda.gov/) accepted names, cross-checked against [Plants of the World Online](https://powo.science.kew.org/) | POWO settles recent genus transfers: *Aster* to *Symphyotrichum* / *Eurybia*, *Eupatorium* to *Eutrochium* / *Conoclinium*, *Mahonia* to *Berberis*, *Mimulus* to *Diplacus* / *Erythranthe*, *Nassella* to *Stipa*, *Solidago rigida* to *Oligoneuron rigidum*, *Blechnum spicant* to *Struthiopteris spicant*, *Gaura lindheimeri* to *Oenothera lindheimeri*, *Cheilanthes lindheimeri* to *Myriopteris lindheimeri*, *Rivinia* to *Rivina* |
| `common` | Lady Bird Johnson Wildflower Center and USDA PLANTS | The regionally dominant common name is preferred over the most literal one |
| `regions` | [BONAP North American Plant Atlas](http://bonap.net/napa) county maps, generalised to the ten design regions; state nativity from USDA PLANTS | The generalisation is lossy by design — see the county-level caveat below |
| `zmin`, `zmax` | [USDA PHZM 2023](https://planthardiness.ars.usda.gov/) ranges as reported by the Wildflower Center, Missouri Botanical Garden Plant Finder and the Xerces regional guides | `zmax` is a heat-tolerance proxy rather than a measurement, so the generator treats it as a soft limit |
| `light`, `moist`, `hmin`, `hmax`, `spread`, `spacing` | [Lady Bird Johnson Wildflower Center Native Plant Database](https://www.wildflower.org/plants/) | Spacing reflects nursery and restoration practice for a bed that closes in two seasons, which is tighter than typical retail guidance |
| `bloom_start`, `bloom_end`, `colors` | Wildflower Center, cross-checked against [Pollinator Partnership ecoregional guide](https://www.pollinator.org/guides) bloom charts | Months are for the middle of each species' range; shift roughly two weeks per three degrees of latitude |
| `layer`, `form` | Assigned using the layered plant-community framework in Rainer & West, *Planting in a Post-Wild World* (Timber Press, 2015) | Methodology referenced; no text reproduced |
| `lep` | [NWF Native Plant Finder](https://nativeplantfinder.nwf.org/), from Douglas Tallamy's host records at the University of Delaware | **Genus level and approximate.** Counts vary by county. Summed per genus in the scorecard so congeners are never double-counted |
| `sb` | [Fowler & Droege, *Pollen Specialist Bees of the Eastern / Central / Western United States*](https://jarrodfowler.com/specialist_bees.html) | Flags genera with documented oligolectic bee associations |
| `hosts` | Tallamy host records, Xerces Society guides, state lepidopterist society checklists | Named butterflies and moths of conservation or garden interest only |
| `wildlife` | [Xerces Society](https://www.xerces.org/pollinator-conservation/pollinator-friendly-plant-lists), [Audubon Native Plants](https://www.audubon.org/native-plants), Wildflower Center | `nfix` covers rhizobial Fabaceae plus the actinorhizal *Morella* and *Ceanothus* |
| `notes` | Wildflower Center, regional native plant society guidance, Missouri Botanical Garden Plant Finder | Written to be actionable: the failure mode, the cultivar that is genuinely better, the thing nobody tells you |

## Region framework

The ten design regions are a gardening-usable generalisation of **EPA Level I and Level II
ecoregions** (the Omernik framework), not of state lines. `fetch_authoritative.py` contains the full
crosswalk from EPA Level II codes and roughly 80 Level III codes to these ten regions, and that
crosswalk is the authoritative definition.

| Code | Region | EPA Level II |
|---|---|---|
| NE | Northeast & Mid-Atlantic | Mixed Wood Plains, Atlantic Highlands, Northeastern Coastal Zone |
| SE | Southeast | Southeastern USA Plains, Mississippi Alluvial & SE Coastal Plains, Ozark/Ouachita |
| FL | Florida & subtropical Gulf | Everglades, Southern Florida Coastal Plain |
| MW | Midwest & Great Lakes | Central USA Plains, Temperate Prairies, Mixed Wood Plains |
| GP | Great Plains | West-Central and South Central Semi-Arid Prairies |
| TX | Texas & South-Central | Edwards Plateau, Cross Timbers, Blackland Prairies, Tamaulipan Plains |
| SW | Southwest deserts | Warm Deserts, Southern Semi-Arid Highlands, Temperate Sierras |
| MTN | Rockies & Intermountain West | Cold Deserts, Western Cordillera |
| PNW | Pacific Northwest | Marine West Coast Forest |
| CA | California Floristic Province | Mediterranean California |

## ZIP code resolution

**Shipped, no network required.** Published USPS state ZIP ranges resolve the state. 880 three-digit
prefix overrides in `regions.json` then refine the ecoregion and hardiness span for states that
straddle real ecological boundaries — the Cascade crest, the Colorado Front Range, the Trans-Pecos,
the Florida peninsula, the Sierra Nevada, the Appalachian highlands — and for major metros whose zone
differs from their state's span. Both values are presented for confirmation, never silently assumed.

**Exact, one command.** `fetch_authoritative.py` downloads the
[Census ZCTA Gazetteer](https://www.census.gov/geographies/reference-files/time-series/geo/gazetteer-files.html),
the [EPA Level III/IV ecoregion shapefile](https://www.epa.gov/eco-research/level-iii-and-iv-ecoregions-continental-united-states)
and the [PRISM/USDA 2023 hardiness raster](https://prism.oregonstate.edu/projects/plant_hardiness_zones.php),
intersects every ZCTA centroid with the ecoregion polygons, samples the raster at that point, and
writes `zip_regions.json`. The site detects that file on load, switches to it automatically, and
reports "exact ZIP lookup" in the interface. Records whose zone had to fall back to the estimate are
flagged `zone_estimated`.

## Derived maintenance classes

`build_data.py` assigns every species a maintenance class and a set of care flags. These are
**derived**, not entered by hand, from the layer, family, genus, bloom span, evergreen status and the
notes text. They exist so the generated schedule can be correct per plant rather than generic:

| Class | Applied to | Instruction given |
|---|---|---|
| `rosette` | *Agave, Yucca, Hesperaloe, Nolina, Dasylirion* | never cut back; remove dry lower leaves and the spent stalk only |
| `palm` | *Serenoa, Sabal, Zamia* (Arecaceae, Zamiaceae) | remove fully dead fronds only; never cut into the crown |
| `shrub_spring` | shrubs flowering early on old wood | prune within weeks of flowering, or not at all |
| `shrub_summer` | later bloomers and long-blooming subshrubs on new wood | shape in late winter before growth |
| `subshrub` | *Eriogonum, Chrysactinia, Monardella, Melampodium, Tetraneuris, Zinnia,* plus *Penstemon pinifolius/baccharifolius, Dalea greggii, Phlox subulata, Glandularia gooddingii* | shorten by a third, never cut into old wood |
| `fern_evergreen` / `fern_deciduous` | ferns, split on evergreen status | remove only dead fronds / cut to the base before the fiddleheads unroll |
| `sedge` | Cyperaceae | leave alone; shear to 3 inches every second or third year at most |
| `grass_warm` / `grass_cool` | Poaceae, split by genus | cut to 4–6 inches in early spring / comb out, never shear hard |
| `evergreen_perennial` | evergreen-tagged perennials | tidy dead leaves only, do not cut to the ground |
| `perennial` | herbaceous perennials 24 inches and over | cut to 8–12 inches in spring, leaving stubs for stem-nesting bees |
| `perennial_low` | herbaceous perennials under 24 inches | light shear to 2–3 inches; no tall stems to leave |
| `ephemeral` | species whose notes record summer or seasonal dormancy | mark the position and leave undisturbed |
| `selfsower` | the dynamic filler layer | shake seed where wanted, then cut; thin seedlings |

Care flags (`chelsea`, `pinch`, `deadhead`, `shear`, `coppice`, `taproot`, `late_emerger`,
`cut_after_flower`, `no_summer_water`, `acid_soil`, `aggressive`, `reseeds`) are matched out of the
notes text and surfaced as named, species-specific jobs.

The frost dates and cut-back windows in the per-zone calendar are broad regional averages used only
to give a starting month. The interface always links the user to
[frost dates by ZIP code](https://www.almanac.com/gardening/frostdates),
[NOAA climate normals](https://www.ncei.noaa.gov/products/land-based-station/us-climate-normals)
and their state Cooperative Extension, and states that the Extension calendar is the most locally
accurate of the three.

## Photograph sources

No images are stored or hot-linked by this project, to keep the page weight down. Each species links
out to two libraries, chosen to be complementary:

| Source | Why |
|---|---|
| [Lady Bird Johnson Wildflower Center](https://www.wildflower.org/plants/) | Curated horticultural photographs alongside the full profile already used as this project's source for cultural requirements. Best for judging garden appearance. |
| [iNaturalist](https://www.inaturalist.org/) | Large volumes of research-grade observation photographs of the plant growing wild, across its whole range. Best for an honest view of habit and of how the plant actually looks outside a nursery. |

Both are hit as search URLs built from the accepted scientific name, so they keep working as those
sites reorganise their internal identifiers. The generated appearance description is derived from the
`form`, `colors`, `hmin`/`hmax` and bloom fields in `plants_source.txt`.

## Planting-season guidance

Derived from the per-zone frost calendar plus the ecoregion, not from a single national rule:

| Situation | Recommended window | Reason |
|---|---|---|
| Most regions, zones 5 and warmer | Autumn, about six weeks before first hard frost | Soil is still warm while air cools, so roots grow after the top stops; the plant meets its first summer anchored |
| Zones 2&ndash;4 | Spring, after the last hard frost | Autumn plantings have not rooted enough to resist frost heave, which physically lifts crowns out of the soil |
| California and Pacific Northwest | Autumn, with the first steady rains | The flora grows in the wet winter and sleeps in the dry summer; spring planting commits the gardener to summer irrigation, which rots drought-adapted natives |
| Southwest deserts | Autumn, or into the summer monsoon | Gives roots a full cool season before the first extreme summer; April to June planting cannot keep up with transpiration |

## Watering guidance

Quantities are arithmetic, not estimates: one inch of water over one square foot is 0.623 US gallons,
so the figure quoted for a bed is its area multiplied by 0.623. The step-down schedule across three
years, the deep-and-infrequent principle, and the emphasis that overwatering kills more native plants
than drought does all follow the Xerces Society habitat guidelines and the establishment guidance in
the Lady Bird Johnson Wildflower Center's how-to articles. Per-species exceptions come from the
`no_summer_water` and `sharp_drainage` flags derived from the notes.

## What is deliberately excluded

- Double-flowered and sterile cultivars, which offer little or no accessible pollen and nectar. This
  is why the notes specify lacecap *Hydrangea arborescens* over 'Annabelle', and the straight species
  of *Echinacea purpurea*.
- Dark-foliage nativars where anthocyanin load is associated with reduced caterpillar survival.
- Any taxon listed as invasive anywhere within the range it is recommended for, checked against the
  [Invasive Plant Atlas](https://www.invasiveplantatlas.org/).
- Near-identical lookalikes that cause real harm when confused. *Ruellia caroliniensis* is included
  with an explicit warning not to substitute the invasive Mexican petunia, *Ruellia simplex*.
- Species too aggressive for a designed bed are retained but carry an explicit warning in `notes`
  and are excluded automatically when the user selects "avoid spreading plants". *Asclepias syriaca*,
  *Anemone canadensis*, *Physostegia virginiana* and *Onoclea sensibilis* are the clearest cases.

## Known gaps

- Alaska, Hawaii and the territories are out of scope and are reported as such.
- The arid Southwest has genuinely few full-shade species. The database carries ten and the tool
  returns fewer designs there, which is a real horticultural constraint rather than a data defect.
- Soil pH, summer rainfall pattern and fire regime are not modelled, though they matter as much as
  hardiness for several groups, notably the Ericaceae and the California chaparral flora.
- Trees are out of scope. The keystone woody genera that matter most for caterpillar production
  — *Quercus*, *Prunus*, *Salix*, *Betula*, *Populus* — are canopy decisions rather than bed
  decisions, so the Keystone Host Nursery template works with the shrub-scale members of that group.

---

## Diagnostic sources (Help My Plant Keeps Dying)

The 43 diagnostic tests draw their procedures, thresholds and interpretations from the following. Where sources disagree, the more conservative reading is used. No test is included that a gardener cannot carry out with ordinary tools, other than the laboratory soil test and the diagnostic-clinic referral, both of which are identified as paid services.

Each test in `diagnostics.json` carries a `src` list naming the sources it rests on; `build_data.py` refuses to build if any of those names does not resolve.

### Extension literature on juglone and black walnut allelopathy

<https://extension.psu.edu/black-walnut-toxicity>

Which plants are sensitive to juglone, how far the effect reaches, and how long it persists after a tree is removed.

### Cornell Comprehensive Assessment of Soil Health

<https://soilhealth.cals.cornell.edu/>

The standard protocols for measuring compaction, aggregate stability and infiltration, including the field tests you can do with a spade and a tin can.

### Your state Cooperative Extension Service

<https://www.nifa.usda.gov/about-nifa/how-we-work/extension/cooperative-extension-system>

The single most useful resource for diagnosis, because the advice is written for your climate and soils. Most run a free or low-cost plant diagnostic clinic and will look at a sample in person.

### Missouri Botanical Garden Plant Finder

<https://www.missouribotanicalgarden.org/plantfinder/plantfindersearch.aspx>

Per-species culture notes with an explicit 'Problems' section. Strong on the difference between a plant that is unhappy and a plant that is in the wrong place.

### The Morton Arboretum plant health care resources

<https://mortonarb.org/plant-and-protect/tree-plant-care/plant-care-resources/>

Excellent on planting depth, girdling roots, mulch practice and construction damage, which are the installation faults that kill the most woody plants.

### NC State Extension Plant Toolbox

<https://plants.ces.ncsu.edu/>

Detailed per-species culture and problem notes for several thousand plants, with a usefully blunt list of what commonly goes wrong.

### National Pesticide Information Center

<http://npic.orst.edu/>

Independent, federally funded help on pesticide drift, residues and persistence, including a telephone service staffed by specialists.

### USDA Plant Hardiness Zone Map

<https://planthardiness.ars.usda.gov/>

Cold hardiness by ZIP code. Note that it describes average annual extreme minimum temperature only, and says nothing about heat, humidity or drainage.

### Purdue Plant and Pest Diagnostic Laboratory

<https://ag.purdue.edu/department/btny/ppdl/index.html>

Clear guidance on abiotic versus biotic injury, and on how to collect and submit a sample so that a laboratory can actually work with it.

### Land-grant university soil testing laboratory

<https://www.nrcs.usda.gov/resources/education-and-teaching-materials/soil-testing>

A lab test through your Extension office costs roughly 15 to 30 US dollars and reports pH, organic matter, texture and nutrients. Vastly more reliable than a hardware-store probe, and the only way to settle a pH question.

### UC Statewide Integrated Pest Management Program

<https://ipm.ucanr.edu/>

The most rigorous free pest, disease and abiotic-disorder diagnostic material in the United States, with photographic keys. Written for California but the biology and the diagnostic logic apply nationally.

### USDA NRCS Web Soil Survey

<https://websoilsurvey.nrcs.usda.gov/>

Free mapped soil data for almost every address in the United States, including depth to a restrictive layer, drainage class, texture and pH range. Tells you what is under your garden before you dig.

### Washington State University: bioassay for herbicide residue in compost

<https://s3.wp.wsu.edu/uploads/sites/2073/2015/03/persistent-herbicides.pdf>

The published protocol for the pea or bean bioassay that detects clopyralid, aminopyralid and picloram carryover in compost, manure or straw.

### Xerces Society: neonicotinoids in nursery plants

<https://www.xerces.org/pesticides/neonicotinoids-and-bees>

Why systemic insecticides applied during production persist in plant tissue, and what to ask a nursery before buying.
