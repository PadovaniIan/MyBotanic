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
