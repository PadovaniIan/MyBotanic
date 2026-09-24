#!/usr/bin/env python3
"""Writes regions.json, templates.json and sources.json.

These three files are hand-authored reference data kept in Python so the repository is fully
reproducible and the tables stay reviewable in a diff. Run this, then run build_data.py.
"""
import json, os
OUT = os.path.dirname(os.path.abspath(__file__))

# =========================================================================== REGIONS
regions = {
 "NE": {"name":"Northeast & Mid-Atlantic","epa_l1":"Northern Forests / Eastern Temperate Forests",
        "epa_l2":"Mixed Wood Plains, Atlantic Highlands, Northeastern Coastal Zone",
        "blurb":"Oak-hickory and northern hardwood forest, coastal plain and Appalachian uplands. Quercus, Prunus, Salix, Betula and Vaccinium are the keystone woody genera; Solidago and Symphyotrichum carry the late season.",
        "zones":[3,8]},
 "SE": {"name":"Southeast (Piedmont, Coastal Plain, Gulf)","epa_l1":"Eastern Temperate Forests",
        "epa_l2":"Southeastern USA Plains, Mississippi Alluvial & SE Coastal Plains, Ozark/Ouachita",
        "blurb":"Longleaf pine savanna, oak-hickory-pine and bottomland hardwood. A fire-adapted grassland flora with exceptional late-summer and autumn bloom; heat and humidity tolerance is the limiting design factor.",
        "zones":[6,9]},
 "FL": {"name":"Florida & Subtropical Gulf","epa_l1":"Tropical Wet Forests / Eastern Temperate Forests",
        "epa_l2":"Everglades, Southern Florida Coastal Plain",
        "blurb":"Pine rockland, scrub, flatwoods and hardwood hammock. Bloom is nearly year-round, so designs emphasise evergreen structure and continuous nectar rather than one summer peak.",
        "zones":[8,11]},
 "MW": {"name":"Midwest & Great Lakes","epa_l1":"Eastern Temperate Forests / Great Plains",
        "epa_l2":"Central USA Plains, Temperate Prairies, Mixed Wood Plains",
        "blurb":"Tallgrass prairie, oak savanna and beech-maple forest. The richest palette in North America for sunny matrix planting: deep-rooted composites and warm-season bunchgrasses.",
        "zones":[3,7]},
 "GP": {"name":"Great Plains","epa_l1":"Great Plains",
        "epa_l2":"West-Central Semi-Arid Prairies, South Central Semi-Arid Prairies",
        "blurb":"Mixed-grass and shortgrass prairie. Wind, cold and drought select for low, fine-textured, deeply taprooted plants; blue grama and little bluestem form the matrix.",
        "zones":[3,7]},
 "TX": {"name":"Texas & South-Central","epa_l1":"Great Plains / Eastern Temperate Forests",
        "epa_l2":"Edwards Plateau, Cross Timbers, Texas Blackland Prairies, Tamaulipan Plains",
        "blurb":"Limestone Hill Country, blackland prairie and coastal prairie. Alkaline soils and violent summer heat favour salvias, penstemons, daleas and muhly grasses.",
        "zones":[6,10]},
 "SW": {"name":"Southwest Deserts","epa_l1":"North American Deserts",
        "epa_l2":"Warm Deserts (Sonoran, Chihuahuan, Mojave), Southern Semi-Arid Highlands",
        "blurb":"Sonoran, Chihuahuan and Mojave desert scrub. Design around evergreen structure, silver foliage and monsoon-timed bloom; irrigation beyond establishment usually kills these plants.",
        "zones":[5,11]},
 "MTN":{"name":"Rocky Mountains & Intermountain West","epa_l1":"North American Deserts / Northwestern Forested Mountains",
        "epa_l2":"Cold Deserts, Western Cordillera",
        "blurb":"Sagebrush steppe, pinyon-juniper woodland and montane meadow. Intense sun, cold winters and lean alkaline soils; gravel-garden technique outperforms conventional beds.",
        "zones":[2,8]},
 "PNW":{"name":"Pacific Northwest (west of the Cascades)","epa_l1":"Marine West Coast Forest",
        "epa_l2":"Marine West Coast Forest",
        "blurb":"Douglas-fir and western hemlock forest with Willamette and Puget prairie remnants. Wet winters and dry summers: evergreen shade layers plus summer-dry meadow species.",
        "zones":[4,9]},
 "CA": {"name":"California Floristic Province","epa_l1":"Mediterranean California",
        "epa_l2":"Mediterranean California",
        "blurb":"Chaparral, oak woodland, coastal sage scrub and valley grassland. A summer-dormant, winter-growing flora: the cardinal rule is no summer irrigation once established.",
        "zones":[5,11]},
}

# Published USPS state ZIP ranges, used to resolve ZIP -> state.
state_zips = {
 "AL":[[35000,36999]],"AK":[[99500,99999]],"AZ":[[85000,86599]],"AR":[[71600,72999]],
 "CA":[[90000,96199]],"CO":[[80000,81699]],"CT":[[6000,6999]],"DE":[[19700,19999]],
 "DC":[[20000,20099],[20200,20599]],"FL":[[32000,34999]],"GA":[[30000,31999],[39800,39999]],
 "HI":[[96700,96899]],"ID":[[83200,83899]],"IL":[[60000,62999]],"IN":[[46000,47999]],
 "IA":[[50000,52899]],"KS":[[66000,67999]],"KY":[[40000,42799]],"LA":[[70000,71499]],
 "ME":[[3900,4999]],"MD":[[20600,21999]],"MA":[[1000,2799]],"MI":[[48000,49999]],
 "MN":[[55000,56799]],"MS":[[38600,39799]],"MO":[[63000,65899]],"MT":[[59000,59999]],
 "NE":[[68000,69399]],"NV":[[88900,89899]],"NH":[[3000,3899]],"NJ":[[7000,8999]],
 "NM":[[87000,88499]],"NY":[[10000,14999],[6390,6390]],"NC":[[27000,28999]],
 "ND":[[58000,58899]],"OH":[[43000,45999]],"OK":[[73000,74999]],"OR":[[97000,97999]],
 "PA":[[15000,19699]],"RI":[[2800,2999]],"SC":[[29000,29999]],"SD":[[57000,57799]],
 "TN":[[37000,38599]],"TX":[[75000,79999],[88500,88599],[73301,73301]],"UT":[[84000,84799]],
 "VT":[[5000,5999]],"VA":[[20100,20199],[22000,24699]],"WA":[[98000,99499]],
 "WV":[[24700,26899]],"WI":[[53000,54999]],"WY":[[82000,83199]],
 "PR":[[600,799],[900,999]],"VI":[[800,899]],
}
state_regions = {
 "AL":["SE"],"AK":[],"AZ":["SW","MTN"],"AR":["SE","MW"],"CA":["CA","SW","MTN","PNW"],
 "CO":["MTN","GP"],"CT":["NE"],"DE":["NE"],"DC":["NE"],"FL":["FL","SE"],"GA":["SE"],
 "HI":[],"ID":["MTN","PNW"],"IL":["MW"],"IN":["MW"],"IA":["MW","GP"],"KS":["GP","MW"],
 "KY":["SE","MW","NE"],"LA":["SE"],"ME":["NE"],"MD":["NE","SE"],"MA":["NE"],"MI":["MW","NE"],
 "MN":["MW","GP"],"MS":["SE"],"MO":["MW","SE"],"MT":["MTN","GP"],"NE":["GP","MW"],
 "NV":["MTN","SW","CA"],"NH":["NE"],"NJ":["NE"],"NM":["SW","MTN","GP"],"NY":["NE","MW"],
 "NC":["SE","NE"],"ND":["GP","MW"],"OH":["MW","NE"],"OK":["GP","TX","MW"],
 "OR":["PNW","MTN","CA"],"PA":["NE","MW"],"RI":["NE"],"SC":["SE"],"SD":["GP","MW"],
 "TN":["SE","MW","NE"],"TX":["TX","SE","GP","SW"],"UT":["MTN","SW"],"VT":["NE"],
 "VA":["NE","SE"],"WA":["PNW","MTN"],"WV":["NE","SE"],"WI":["MW","NE"],"WY":["MTN","GP"],
 "PR":[],"VI":[],
}
state_zone_range = {
 "AL":[7,9],"AK":[1,8],"AZ":[5,10],"AR":[6,8],"CA":[5,11],"CO":[3,7],"CT":[5,7],"DE":[7,8],
 "DC":[7,8],"FL":[8,11],"GA":[6,9],"HI":[10,13],"ID":[3,7],"IL":[5,7],"IN":[5,7],"IA":[4,6],
 "KS":[5,7],"KY":[6,7],"LA":[8,10],"ME":[3,6],"MD":[6,8],"MA":[5,7],"MI":[4,6],"MN":[3,5],
 "MS":[7,9],"MO":[5,7],"MT":[3,6],"NE":[4,6],"NV":[4,10],"NH":[3,6],"NJ":[6,7],"NM":[4,9],
 "NY":[3,7],"NC":[6,8],"ND":[3,4],"OH":[5,7],"OK":[6,8],"OR":[4,9],"PA":[5,7],"RI":[6,7],
 "SC":[7,9],"SD":[3,5],"TN":[6,8],"TX":[6,10],"UT":[4,9],"VT":[3,5],"VA":[5,8],"WA":[4,9],
 "WV":[5,7],"WI":[3,6],"WY":[2,6],"PR":[12,13],"VI":[12,13],
}

# Three-digit ZIP prefix overrides: states that straddle real ecological boundaries, and metros
# whose hardiness zone differs sharply from the state-wide span.
zip3 = {}
def add(prefixes, regions_, zones, place):
    for p in prefixes:
        zip3[str(p).zfill(3)] = {"regions": list(regions_), "zones": list(zones), "place": place}

add(range(980,987),["PNW"],[7,9],"Western Washington")
add([988,989,990,991,992,993,994],["MTN","PNW"],[4,7],"Eastern Washington")
add(range(970,976),["PNW"],[8,9],"Willamette Valley & Oregon Coast")
add([976,977,978,979],["MTN","PNW"],[5,7],"Central & Eastern Oregon")
add([889,890,891],["SW","MTN"],[9,10],"Las Vegas & the Mojave")
add([893,894,895,897,898],["MTN","SW"],[5,7],"Great Basin Nevada")
add([850,851,852,853],["SW"],[9,10],"Phoenix & the Sonoran lowland")
add([856,857],["SW"],[8,9],"Tucson & the Sonoran Desert")
add([860,863,864,865],["MTN","SW"],[5,7],"Northern Arizona highlands")
add([870,871,872],["SW","MTN"],[7,8],"Albuquerque & the Rio Grande")
add([875,877],["MTN","SW"],[5,7],"Santa Fe & northern New Mexico")
add([879,880,881,882,883,884,885],["SW"],[7,9],"Southern New Mexico")
add([795,797,798,799],["SW","TX"],[7,8],"Trans-Pecos & El Paso")
add([790,791,792,793,794],["TX","GP"],[7,8],"Texas Panhandle & Llano Estacado")
add([760,761,780,781,782,786,787,788,789],["TX"],[8,9],"Central Texas & Edwards Plateau")
add([756,757,758,759,770,771,772,773,774,775,776,777,778,779,783,784,785],["TX","SE"],[8,9],"East Texas & the Gulf Coast")
add([750,751,752,753,754,755,762,763,764,765,766,767,768,769],["TX"],[8,8],"Dallas-Fort Worth & Blackland Prairie")
add(range(900,918),["CA"],[10,11],"Los Angeles basin & South Coast")
add([920,921,924],["CA","SW"],[9,10],"Inland Southern California")
add([922,923,925,932,933,935],["SW","CA"],[9,10],"Colorado & Mojave Desert California")
add([930,931,934,939],["CA"],[9,10],"Central Coast California")
add([940,941,942,943,944,945,946,947,948,949,950,951,954,955],["CA"],[9,10],"San Francisco Bay Area")
add([936,937,938,952,953,958],["CA"],[9,10],"Central Valley")
add([956,957,959,960,961],["MTN","CA"],[6,8],"Sierra Nevada & foothills")
add([320,321,322,323,324,325,326,327,344],["SE","FL"],[8,9],"North Florida")
add([328,329,335,336,337,338,342,346,347,349],["FL"],[9,10],"Central Florida")
add([330,331,332,333,334,339,341],["FL"],[10,11],"South Florida")
add([640,641,660,661,662,664,665,666],["MW","GP"],[5,6],"Kansas City metro")
add(range(667,680),["GP"],[5,7],"Western Kansas")
add([680,681,683,684,685],["MW","GP"],[5,6],"Omaha & eastern Nebraska")
add(range(686,694),["GP"],[4,5],"Western Nebraska")
add(range(800,810),["GP","MTN"],[5,6],"Colorado Front Range")
add(range(810,817),["MTN"],[3,5],"Colorado mountains & Western Slope")
add(range(300,305),["SE"],[7,8],"Atlanta & north Georgia")
add(range(305,313),["SE"],[8,8],"Middle Georgia")
add(list(range(313,320))+[398,399],["SE"],[8,9],"South Georgia & coast")
add(range(270,280),["SE","NE"],[7,8],"North Carolina Piedmont & coast")
add(range(280,290),["SE","NE"],[6,7],"Western North Carolina mountains")
add(range(370,377),["SE","MW"],[7,7],"Middle & East Tennessee")
add([377,378,379],["SE","NE"],[6,7],"East Tennessee highlands")
add(range(380,386),["SE"],[7,8],"West Tennessee & Memphis")
add(range(220,224),["NE"],[7,7],"Northern Virginia")
add(range(224,230),["NE","SE"],[6,7],"Shenandoah Valley")
add(range(230,239),["SE","NE"],[7,8],"Richmond & Tidewater")
add([244,245,246,247,248,249,258,259,267],["NE","SE"],[5,6],"Appalachian highlands")
add(range(100,105),["NE"],[7,7],"New York City")
add(range(105,120),["NE"],[6,7],"Hudson Valley & Long Island")
add(range(120,150),["NE","MW"],[5,6],"Upstate New York")
add(range(600,610),["MW"],[5,6],"Chicago & northern Illinois")
add(range(610,620),["MW"],[5,6],"Central Illinois")
add(range(620,630),["MW","SE"],[6,7],"Southern Illinois")
add(range(480,490),["MW","NE"],[5,6],"Southeast Michigan")
add(range(490,500),["MW"],[4,6],"Western & northern Michigan")
add(range(550,560),["MW"],[4,5],"Twin Cities")
add(range(560,568),["MW","GP"],[3,4],"Northern & western Minnesota")
add(range(530,550),["MW"],[4,5],"Wisconsin")
add(range(430,460),["MW","NE"],[6,6],"Ohio")
add(range(150,160),["NE"],[6,6],"Pittsburgh & western Pennsylvania")
add(range(160,169),["NE","MW"],[5,6],"Northwestern Pennsylvania")
add(range(169,197),["NE"],[6,7],"Eastern Pennsylvania & Philadelphia")
add([197,198,199],["NE"],[7,8],"Delaware")
add(range(350,353),["SE"],[7,8],"North Alabama")
add(range(354,363),["SE"],[8,8],"Central Alabama")
add(range(363,370),["SE"],[8,9],"South Alabama & the Gulf Coast")
add(range(716,730),["SE","MW"],[7,8],"Arkansas")
add(range(730,750),["GP","TX","MW"],[7,7],"Oklahoma")
add(range(840,843),["MTN"],[6,7],"Wasatch Front")
add(range(843,848),["MTN","SW"],[5,7],"Southern & eastern Utah")
add(range(630,640),["MW","SE"],[6,7],"St Louis region")
add(range(645,659),["MW","GP"],[5,6],"Central & southwest Missouri")
add([39,40],["NE"],[5,6],"Southern Maine")
add(range(41,50),["NE"],[4,5],"Central & northern Maine")
add(range(20,30),["NE"],[6,7],"Eastern Massachusetts & Rhode Island")
add(range(10,20),["NE"],[5,6],"Central & western Massachusetts")
add(range(500,530),["MW"],[5,5],"Iowa")
add(range(570,578),["GP","MW"],[4,5],"South Dakota")
add(range(580,589),["GP","MW"],[3,4],"North Dakota")
add(range(590,600),["MTN","GP"],[4,5],"Montana")
add(range(820,832),["MTN","GP"],[4,5],"Wyoming")
add(range(832,839),["MTN","PNW"],[5,6],"Idaho")
add(range(400,428),["SE","MW","NE"],[6,7],"Kentucky")
add(range(700,715),["SE"],[8,9],"Louisiana")
add(range(386,398),["SE"],[7,9],"Mississippi")
add(range(290,300),["SE"],[7,9],"South Carolina")
add(range(206,220),["NE","SE"],[7,8],"Maryland & the District of Columbia")
add(range(70,90),["NE"],[6,7],"New Jersey")
add(range(60,70),["NE"],[6,7],"Connecticut")
add(range(50,60),["NE"],[4,5],"Vermont")
add(range(30,39),["NE"],[4,6],"New Hampshire")
add(range(460,480),["MW"],[6,6],"Indiana")

json.dump({"regions":regions,"state_zips":state_zips,"state_regions":state_regions,
           "state_zone_range":state_zone_range,"zip3_overrides":zip3},
          open(os.path.join(OUT,"regions.json"),"w"), indent=1, sort_keys=True)
print("regions.json      %d regions, %d ZIP3 overrides" % (len(regions), len(zip3)))

# ========================================================================= TEMPLATES
def T(**k): return k
templates = [
T(id="prairie_tapestry", name="Sunlit Prairie Tapestry",
  tagline="A matrix of fine bunchgrass with drifts of composites rising through it \u2014 the look of a curated meadow, not a weed patch.",
  light=["S"], moist=["D","M"], regions=["NE","SE","MW","GP","TX","MTN"],
  area={"GRASS":0.45,"MATRIX":0.10,"SEASONAL":0.30,"STRUCT":0.12,"FILLER":0.03},
  counts={"GRASS":[2,2],"MATRIX":[1,2],"SEASONAL":[4,5],"STRUCT":[2,2],"FILLER":[1,1]},
  max_height=84, palette="warm",
  design="Plant one dominant grass as a continuous matrix 18 inches apart, then interrupt it with long tapering drifts of five to nine plants of each flowering species. Repeat two structural species at least three times each across the bed to create rhythm.",
  care="One cut a year, in early spring, after overwintering insects have emerged. No staking, no deadheading and no fertiliser: this planting is meant to hold itself up.",
  eco="Warm-season bunchgrasses give skipper larvae host material, overwintering stems for cavity-nesting bees, and winter seed for sparrows."),
T(id="pollinator_mosaic", name="Pollinator Meadow Mosaic",
  tagline="Engineered for unbroken bloom from April to hard frost, with a documented specialist-bee and larval-host backbone.",
  light=["S","P"], moist=["M","W"], regions=None,
  area={"GRASS":0.30,"MATRIX":0.20,"SEASONAL":0.35,"STRUCT":0.10,"FILLER":0.05},
  counts={"GRASS":[1,2],"MATRIX":[2,2],"SEASONAL":[5,6],"STRUCT":[1,2],"FILLER":[1,1]},
  max_height=72, palette="any", require_bloom_coverage=True,
  design="Sequence the seasonal layer so at least three species overlap in every month of the growing season. Group in odd-numbered drifts and let one colour repeat through the whole bed to hold it together.",
  care="Leave all stems standing through winter. Cut back in spring in two passes a fortnight apart, so late-emerging insects are not destroyed all at once.",
  eco="Prioritises plants documented as hosts for pollen-specialist native bees and as larval hosts for named butterflies and moths."),
T(id="gravel_jewels", name="Gravel Garden Jewels",
  tagline="Lean soil, sharp drainage and a 3-inch mineral mulch: low, jewel-like plants that never need irrigation once rooted.",
  light=["S"], moist=["D"], regions=None,
  area={"GRASS":0.25,"MATRIX":0.35,"SEASONAL":0.28,"STRUCT":0.10,"FILLER":0.02},
  counts={"GRASS":[1,2],"MATRIX":[3,4],"SEASONAL":[3,4],"STRUCT":[1,2],"FILLER":[1,1]},
  max_height=42, palette="cool",
  design="Excavate 4 inches and backfill with clean 3/8-inch crushed gravel, planting into the gravel with roots in the soil beneath. Keep everything low and let two or three spiky or rosette forms stand as punctuation.",
  care="Water only to establish, then stop entirely. Never mulch with compost or bark, which destroys the effect and rots the crowns.",
  eco="Bare mineral ground between plants is prime nesting habitat for the roughly 70 percent of native bee species that nest in the soil."),
T(id="rain_basin", name="Rain Garden Basin",
  tagline="A shallow depression that absorbs roof and driveway runoff, planted in three moisture bands.",
  light=["S","P"], moist=["W"], regions=None,
  area={"GRASS":0.30,"MATRIX":0.15,"SEASONAL":0.35,"STRUCT":0.15,"FILLER":0.05},
  counts={"GRASS":[1,2],"MATRIX":[1,2],"SEASONAL":[4,5],"STRUCT":[2,2],"FILLER":[1,1]},
  max_height=84, palette="any",
  design="Set the basin 6 to 9 inches below grade with a level bottom and a stone-armoured inlet. Put the wettest-tolerant species in the bottom, mid-moisture species on the side slopes, and drought-tolerant species on the rim.",
  care="The basin should drain within 24 to 48 hours. Pull silt and debris off the inlet each spring and cut the planting back in late winter.",
  eco="Intercepts the first flush of stormwater, cools and filters it, and supplies the moist-soil nectar plants that many wetland specialist bees and flies require."),
T(id="woodland_edge", name="Woodland Edge Layers",
  tagline="The richest habitat on any property: a tiered transition from shade into sun, built from shrubs, ferns, sedges and spring bloom.",
  light=["P"], moist=["M","D"], regions=None,
  area={"SHRUB":0.25,"FERN":0.15,"MATRIX":0.35,"SEASONAL":0.20,"FILLER":0.05},
  counts={"SHRUB":[2,2],"FERN":[1,2],"MATRIX":[3,4],"SEASONAL":[2,3],"FILLER":[1,2]},
  max_height=96, palette="any",
  design="Work in three tiers: a shrub backbone, a knee-high layer of ferns and broad-leaved perennials, and a continuous sedge or groundcover carpet underneath. Feather the edge irregularly rather than drawing a straight line.",
  care="Replace bark mulch with a living green mulch of sedge within two seasons. Leave leaf litter in place: it is where most moth pupae overwinter.",
  eco="Layered edges provide nesting cover, fruit, and the leaf-litter habitat that the majority of Lepidoptera need to complete their life cycle."),
T(id="fern_sedge_carpet", name="Fern & Sedge Shade Carpet",
  tagline="Deep shade solved without a single bag of mulch: a textural green floor with flashes of spring and autumn bloom.",
  light=["H","P"], moist=["M"], regions=None,
  area={"FERN":0.30,"MATRIX":0.50,"SEASONAL":0.15,"STRUCT":0.05},
  counts={"FERN":[2,3],"MATRIX":[3,4],"SEASONAL":[2,3],"STRUCT":[1,1]},
  max_height=60, palette="cool",
  design="Choose one sedge as a unifying carpet and plant it 10 inches apart across the whole bed, then set ferns in loose groups of three to seven and drop clumps of shade perennials into the gaps. Texture does the work that flower colour does in sun.",
  care="No mulch and no leaf removal. Cut deciduous ferns down in late winter; shear evergreen sedges to 3 inches in early spring every second or third year.",
  eco="Carex is among the most important larval host genera for skippers and satyrs, and a dense sedge carpet outcompetes garlic mustard and stiltgrass."),
T(id="dry_shade", name="Dry Shade Understory",
  tagline="For the hardest site in the garden \u2014 under mature trees, in root-filled soil that never gets watered.",
  light=["H","P"], moist=["D"], regions=None,
  area={"FERN":0.20,"MATRIX":0.55,"SEASONAL":0.15,"SHRUB":0.10},
  counts={"FERN":[1,2],"MATRIX":[4,5],"SEASONAL":[2,2],"SHRUB":[1,1]},
  max_height=48, palette="any",
  design="Never till under a tree. Plant small plugs into slits between roots, at higher density than usual, and accept two seasons of establishment. Let the drifts follow the gaps between major roots.",
  care="Water deeply once a week for the first full season only. Let the tree's own leaves stay as mulch every autumn.",
  eco="Restores the herbaceous layer beneath keystone trees such as oaks, which is where caterpillars that drop from the canopy complete pupation."),
T(id="monarch_waystation", name="Monarch Waystation",
  tagline="Milkweed host plants plus the high-octane autumn nectar that fuels the migration, assembled to Monarch Watch standards.",
  light=["S"], moist=["D","M","W"], regions=None,
  area={"GRASS":0.20,"MATRIX":0.15,"SEASONAL":0.50,"STRUCT":0.10,"FILLER":0.05},
  counts={"GRASS":[1,1],"MATRIX":[1,2],"SEASONAL":[5,6],"STRUCT":[1,2],"FILLER":[1,1]},
  max_height=72, palette="warm", require_host="Monarch", min_host_species=2,
  design="Include at least two milkweed species so host plants are available over a longer window, plus heavy late-season nectar. Site it in full sun out of the wind, with a shallow damp patch of bare mineral soil for puddling.",
  care="Do not spray anything, ever, including organic Bt or spinosad. Leave milkweed stalks standing over winter.",
  eco="Monarch Watch certifies waystations of 100 sq ft or larger carrying at least ten milkweed plants of two or more species plus continuous nectar."),
T(id="hummingbird_corridor", name="Hummingbird Corridor",
  tagline="Red and coral tubular flowers staged in sequence so there is nectar from the first arrival to the last departure.",
  light=["S","P"], moist=["D","M"], regions=None,
  area={"GRASS":0.20,"MATRIX":0.20,"SEASONAL":0.40,"STRUCT":0.10,"SHRUB":0.10},
  counts={"GRASS":[1,1],"MATRIX":[1,2],"SEASONAL":[4,5],"STRUCT":[1,1],"SHRUB":[1,2]},
  max_height=72, palette="hot", require_tag="hummingbird", min_tag_species=4,
  design="Plant in vertical layers with clear flight lines between clumps, and give the birds a perch: a bare twiggy branch or shrub top within 10 feet. Long narrow beds along a fence read as a corridor and get defended as territory.",
  care="Never use pesticides, which remove the small insects that make up most of a hummingbird's diet. Deadhead salvias to extend bloom.",
  eco="Bridges the nectar gap in late summer, when migrating hummingbirds need the most fuel and most garden flowers have finished."),
T(id="four_season_border", name="Four-Season Structural Border",
  tagline="The formal botanical-garden look: strong repeated forms, disciplined colour, and a silhouette that is best in February.",
  light=["S","P"], moist=["M","D"], regions=None,
  area={"STRUCT":0.25,"GRASS":0.30,"SEASONAL":0.30,"MATRIX":0.13,"FILLER":0.02},
  counts={"STRUCT":[3,3],"GRASS":[2,2],"SEASONAL":[3,4],"MATRIX":[1,2],"FILLER":[1,1]},
  max_height=96, palette="restrained", require_tag="winter_structure_or_seedhead",
  design="Limit yourself to seven or eight species and repeat each at least three times in a regular rhythm. Choose plants for the shape of their skeleton, not their flower. Edge the bed crisply with steel, stone or mown turf to signal intent.",
  care="Leave everything standing until early spring. Divide the grasses every four to five years to stop them going hollow in the centre.",
  eco="Standing dead stems are overwintering habitat for stem-nesting bees and many moth pupae, and seedheads feed finches and juncos all winter."),
T(id="keystone_nursery", name="Keystone Host Nursery",
  tagline="Built around the small number of plant genera that support the overwhelming majority of caterpillars \u2014 the base of the terrestrial food web.",
  light=["S","P"], moist=["D","M"], regions=None,
  area={"SHRUB":0.30,"SEASONAL":0.30,"MATRIX":0.25,"GRASS":0.15},
  counts={"SHRUB":[2,3],"SEASONAL":[4,4],"MATRIX":[2,3],"GRASS":[1,1]},
  max_height=120, palette="any", rank_by="lep",
  design="Allocate real space to the woody keystone genera, then fill around them with the top herbaceous hosts. This bed is designed to be eaten: place it where chewed leaves will not bother you.",
  care="Tolerate defoliation. Never treat for caterpillars. Keep the ground beneath in leaf litter or low groundcover so larvae can pupate.",
  eco="Follows the Tallamy and NWF finding that a small fraction of native plant genera support the large majority of Lepidoptera species in any given county."),
T(id="hellstrip", name="Hellstrip & Parking Verge",
  tagline="Reflected heat, road salt, compaction and no irrigation \u2014 planted with the species that actually enjoy it.",
  light=["S"], moist=["D"], regions=None,
  area={"MATRIX":0.45,"GRASS":0.25,"SEASONAL":0.25,"STRUCT":0.05},
  counts={"MATRIX":[3,4],"GRASS":[2,2],"SEASONAL":[3,3],"STRUCT":[1,1]},
  max_height=30, palette="any",
  design="Keep everything under 30 inches tall for sight lines and to survive being stepped on. Leave an 18-inch gravel or paved landing strip along the kerb where people get out of cars.",
  care="Establish in autumn if you can. Shear the whole strip once in early spring. Expect to replace a few plants along the kerb each year.",
  eco="Turns a sterile mown verge into connective habitat, and hot lean verges are exceptionally good ground-nesting bee habitat."),
T(id="coastal_exposed", name="Coastal & Exposed Site",
  tagline="Salt spray, wind and sand: tough, low, silver-leaved and surprisingly beautiful.",
  light=["S"], moist=["D","M"], regions=["NE","SE","FL","CA","PNW","TX"],
  area={"GRASS":0.35,"MATRIX":0.35,"SEASONAL":0.20,"SHRUB":0.10},
  counts={"GRASS":[2,2],"MATRIX":[3,4],"SEASONAL":[3,3],"SHRUB":[1,1]},
  max_height=48, palette="cool",
  design="Grade the planting so it rises away from the prevailing wind, with the shrub layer on the windward side acting as a filter. Low mats and grasses take the full exposure.",
  care="No overhead irrigation with hard or salty water. Rinse foliage after severe salt-spray events if you can.",
  eco="Coastal plantings support specialised sand-nesting bees and provide critical fuelling stops for migrating birds along the flyways."),
T(id="cottage_naturalistic", name="Naturalistic Cottage Border",
  tagline="Loose, romantic and full of colour, but built on native species with a real ecological structure underneath.",
  light=["S","P"], moist=["M","W"], regions=None,
  area={"SEASONAL":0.40,"MATRIX":0.25,"GRASS":0.20,"STRUCT":0.10,"FILLER":0.05},
  counts={"SEASONAL":[5,6],"MATRIX":[2,3],"GRASS":[1,2],"STRUCT":[1,2],"FILLER":[2,2]},
  max_height=72, palette="soft",
  design="Intermingle rather than block-plant: scatter individuals of the seasonal layer through a continuous groundcover so the bed reads as a single fabric. Allow self-sowing fillers to move around from year to year.",
  care="Edit rather than maintain: remove what has overstepped, move seedlings you like, and cut the whole bed back once in spring.",
  eco="High floral diversity across a long season supports the broadest possible range of generalist pollinators."),
T(id="shade_botanical_border", name="Shaded Botanical Border",
  tagline="Foliage does the work: bold leaves against fine ones, three shades of green, and flowers as a bonus.",
  light=["H","P"], moist=["M","D"], regions=None,
  area={"STRUCT":0.20,"FERN":0.20,"MATRIX":0.40,"SEASONAL":0.15,"SHRUB":0.05},
  counts={"STRUCT":[1,2],"FERN":[1,2],"MATRIX":[3,4],"SEASONAL":[2,3],"SHRUB":[1,1]},
  max_height=72, palette="cool",
  design="Build the composition from leaf shape, not flower colour: set one bold, broad-leaved or arching species against a fine-textured fern and a strappy sedge, then repeat that trio three or four times down the bed. Keep flowers pale so they read in low light.",
  care="No mulch once the groundcover knits. Cut deciduous material down in late winter and top-dress with leaf mould, never bark.",
  eco="Deep shade beds are where most caterpillars pupate. A closed herbaceous layer plus retained leaf litter completes a life cycle that a bare mulched bed interrupts."),
T(id="spring_ephemeral", name="Spring Ephemeral Woodland",
  tagline="An explosion in April and May while the canopy is still bare, then a quiet green floor for the rest of the year.",
  light=["H","P"], moist=["M"], regions=None,
  area={"FILLER":0.20,"MATRIX":0.45,"FERN":0.20,"SEASONAL":0.10,"STRUCT":0.05},
  counts={"FILLER":[2,3],"MATRIX":[3,4],"FERN":[1,2],"SEASONAL":[1,2],"STRUCT":[1,1]},
  max_height=60, palette="soft",
  design="The critical trick is planning for the gap: ephemerals vanish by July, so interplant them with ferns and sedges that expand to fill the space exactly as the ephemerals retreat. Plant ephemerals in generous sweeps, never as single specimens.",
  care="Mark ephemeral positions before they go dormant so you do not dig into them. Never clear the autumn leaf fall from this bed.",
  eco="Spring ephemerals are the first substantial pollen and nectar of the year and sustain early-emerging mining bees and bumblebee queens weeks before garden flowers open."),
T(id="evergreen_shade", name="Evergreen Winter Shade Garden",
  tagline="A bed that looks deliberate in February: evergreen leaves, persistent structure and winter fruit.",
  light=["H","P"], moist=["D","M"], regions=None,
  area={"SHRUB":0.30,"MATRIX":0.40,"FERN":0.20,"SEASONAL":0.10},
  counts={"SHRUB":[1,2],"MATRIX":[3,4],"FERN":[1,2],"SEASONAL":[1,2]},
  max_height=84, palette="restrained", require_tag="evergreen", min_tag_species=3,
  design="Choose for leaf persistence and then vary leaf size sharply, since an all-evergreen bed can read as flat. Set the evergreen shrubs where they will be seen from indoors in winter.",
  care="Shear evergreen sedges and hardy ferns to a few inches every second or third spring to refresh them. Water evergreens during winter dry spells in mild regions.",
  eco="Evergreen understory gives ground-foraging birds cover and foraging habitat through the hardest weeks of the year, and persistent fruit is critical late-winter food."),
T(id="wet_shade", name="Streamside & Wet Shade",
  tagline="Soggy shade \u2014 the site everyone gives up on \u2014 planted as a lush, deliberately tropical-looking sweep.",
  light=["H","P"], moist=["W"], regions=None,
  area={"FERN":0.30,"STRUCT":0.20,"MATRIX":0.30,"SEASONAL":0.20},
  counts={"FERN":[1,2],"STRUCT":[1,2],"MATRIX":[2,3],"SEASONAL":[2,3]},
  max_height=84, palette="any",
  design="Exaggerate the lushness: big ferns and broad-leaved structure in generous masses, with the flowering layer concentrated where it will catch what light reaches the ground. Let the planting follow the wet line rather than a drawn edge.",
  care="Do not attempt to drain the site. Keep the soil covered at all times; bare wet soil invites invasive wetland weeds.",
  eco="Moist shade supports amphibians, fireflies whose larvae need damp litter, and the wetland-specialist bees and flies that dry gardens cannot host."),
T(id="wet_meadow", name="Wet Meadow & Pond Edge",
  tagline="Full sun and permanently damp ground: the most productive habitat you can build, and the tallest and most theatrical.",
  light=["S","P"], moist=["W"], regions=None,
  area={"GRASS":0.30,"SEASONAL":0.35,"STRUCT":0.20,"MATRIX":0.12,"FILLER":0.03},
  counts={"GRASS":[1,2],"SEASONAL":[4,5],"STRUCT":[2,2],"MATRIX":[1,2],"FILLER":[1,1]},
  max_height=96, palette="any",
  design="Work with the height rather than against it: put the 6 to 8 foot species in a solid mass at the back or in the middle of an island bed, and use tussock-forming sedges to hold the transition to open water or lawn.",
  care="Cut in late winter and rake the material off, because wet meadows build thatch fast. Watch for cattail and reed canary grass invading from outside.",
  eco="Wet meadows carry the highest insect biomass of any temperate planting and are primary habitat for the Baltimore checkerspot, bog fritillaries and many specialist bees."),
T(id="shade_nectar_pocket", name="Shade Nectar Pocket",
  tagline="A shaded corner engineered for hummingbirds and long-tongued bees, where nectar is normally scarce.",
  light=["H","P"], moist=["D","M"], regions=None,
  area={"SEASONAL":0.35,"MATRIX":0.35,"FERN":0.15,"SHRUB":0.15},
  counts={"SEASONAL":[3,4],"MATRIX":[2,3],"FERN":[1,1],"SHRUB":[1,1]},
  max_height=72, palette="hot", require_tag="hummingbird", min_tag_species=2,
  design="Concentrate the tubular flowers in a few bold groups at the light edge of the shade rather than scattering them, so a hummingbird can defend the patch. Keep a clear flight line in and out.",
  care="Deadhead the salvias and monkeyflowers to extend bloom. Never spray: small insects are most of a hummingbird's actual diet.",
  eco="Shaded nectar is genuinely rare, so a shade pocket extends the foraging range of hummingbirds and bumblebees into part of the garden that otherwise offers them nothing."),
]
json.dump(templates, open(os.path.join(OUT,"templates.json"),"w"), indent=1)
print("templates.json    %d design templates" % len(templates))

# =========================================================================== SOURCES
sources = [
 {"id":"usda_phzm","name":"USDA Plant Hardiness Zone Map (2023)","org":"USDA-ARS with the PRISM Climate Group, Oregon State University",
  "url":"https://planthardiness.ars.usda.gov/","download":"https://prism.oregonstate.edu/projects/plant_hardiness_zones.php",
  "use":"The authoritative cold-hardiness zone. The 2023 revision uses 1991-2020 climate normals at 800 m resolution and offers both a ZIP-code lookup and a downloadable raster.",
  "format":"GeoTIFF raster and web ZIP lookup","license":"Public domain (US Government work)"},
 {"id":"epa_ecoregions","name":"Level III and IV Ecoregions of the Continental United States","org":"US Environmental Protection Agency (Omernik framework)",
  "url":"https://www.epa.gov/eco-research/level-iii-and-iv-ecoregions-continental-united-states",
  "download":"https://gaftp.epa.gov/EPADataCommons/ORD/Ecoregions/us/us_eco_l3.zip",
  "use":"The ecological zone framework itself. Level III and IV polygons delimit areas of similar geology, soils, hydrology and potential natural vegetation, which is far more biologically meaningful than a hardiness zone alone.",
  "format":"Shapefile and geodatabase","license":"Public domain"},
 {"id":"usda_plants","name":"USDA PLANTS Database","org":"USDA Natural Resources Conservation Service",
  "url":"https://plants.usda.gov/","download":"https://plants.usda.gov/csvdownload?plantLst=completePLANTSChecklist",
  "use":"Accepted nomenclature, native or introduced status by state, growth habit, duration and wetland indicator status. The naming backbone of the plant table.",
  "format":"CSV","license":"Public domain"},
 {"id":"bonap","name":"North American Plant Atlas","org":"Biota of North America Program (BONAP)",
  "url":"http://bonap.net/napa",
  "use":"County-level native distribution maps. The correct tool for confirming whether a species is genuinely native to the user's own county rather than merely to their state.",
  "format":"Web maps","license":"Free for non-commercial use; check terms before redistributing"},
 {"id":"nwf_npf","name":"Native Plant Finder and the Lepidoptera host dataset","org":"National Wildlife Federation with Douglas Tallamy, University of Delaware",
  "url":"https://nativeplantfinder.nwf.org/",
  "use":"County-level counts of butterfly and moth species hosted by each native plant genus. The source of the keystone-genus concept and of every Lepidoptera figure in this database.",
  "format":"Web lookup by ZIP code","license":"Free public tool; data derived from Tallamy's published host records"},
 {"id":"fowler_specialist_bees","name":"Pollen Specialist Bees of the Eastern, Central and Western United States","org":"Jarrod Fowler and Sam Droege",
  "url":"https://jarrodfowler.com/specialist_bees.html",
  "use":"Documented host-plant genera for pollen-specialist (oligolectic) native bees, which cannot substitute another plant. The source of the specialist-bee flags.",
  "format":"HTML and PDF tables","license":"Freely published research compilation"},
 {"id":"xerces","name":"Regional Pollinator Plant Lists and Habitat Guidelines","org":"Xerces Society for Invertebrate Conservation",
  "url":"https://www.xerces.org/pollinator-conservation/pollinator-friendly-plant-lists",
  "use":"Region-by-region plant lists vetted for pollinator value, plus nesting-habitat and pesticide guidance.",
  "format":"Regional PDF guides","license":"Free to download; cite Xerces"},
 {"id":"pollinator_partnership","name":"Ecoregional Planting Guides","org":"Pollinator Partnership and NAPPC",
  "url":"https://www.pollinator.org/guides",
  "use":"Planting guides keyed directly to ZIP code and to Bailey and Omernik ecoregions, with bloom-period charts. A direct precedent for the ZIP-to-ecoregion approach used here.",
  "format":"PDF by ecoregion","license":"Free to download"},
 {"id":"wildflower_center","name":"Native Plant Database and Recommended Species Lists","org":"Lady Bird Johnson Wildflower Center, University of Texas at Austin",
  "url":"https://www.wildflower.org/plants/",
  "use":"Detailed horticultural and ecological profiles for roughly 9,000 North American natives plus state-by-state recommended species lists. The primary source for cultural requirements.",
  "format":"Web database with downloadable state lists","license":"Free for personal and educational use"},
 {"id":"audubon","name":"Native Plants Database","org":"National Audubon Society",
  "url":"https://www.audubon.org/native-plants",
  "use":"A ZIP-searchable native plant database ranked by the bird species each plant supports, with listings of local native-plant nurseries.",
  "format":"Web lookup by ZIP code","license":"Free public tool"},
 {"id":"census_gazetteer","name":"Gazetteer Files: ZIP Code Tabulation Areas","org":"US Census Bureau",
  "url":"https://www.census.gov/geographies/reference-files/time-series/geo/gazetteer-files.html",
  "use":"ZCTA centroid latitude and longitude. Converts a ZIP code into a point that can be intersected with ecoregion polygons and sampled against the hardiness raster.",
  "format":"Pipe-delimited text","license":"Public domain"},
 {"id":"powo","name":"Plants of the World Online","org":"Royal Botanic Gardens, Kew",
  "url":"https://powo.science.kew.org/",
  "use":"The global nomenclatural authority used to resolve synonyms and recent genus transfers, such as Aster to Symphyotrichum, Eupatorium to Eutrochium and Mahonia to Berberis.",
  "format":"Web interface and API","license":"CC BY for data"},
 {"id":"rainer_west","name":"Planting in a Post-Wild World","org":"Thomas Rainer and Claudia West, Timber Press, 2015",
  "url":"https://www.timberpress.com/books/planting_post-wild_world/rainer/9781604695533",
  "use":"The layered design framework the generator implements: structural, seasonal-theme, groundcover and filler layers, and the principle of designed plant communities rather than object planting.",
  "format":"Book","license":"Copyrighted; the methodology is referenced, no text is reproduced"},
 {"id":"monarch_watch","name":"Monarch Waystation Program","org":"Monarch Watch, University of Kansas",
  "url":"https://monarchwatch.org/waystations/",
  "use":"The certification criteria applied by the Monarch Waystation template: minimum area, milkweed species count and continuous nectar requirements.",
  "format":"Web pages and PDF","license":"Free public program"},
 {"id":"invasive_check","name":"Invasive Plant Atlas of the United States","org":"USDA National Invasive Species Information Center and UGA EDDMapS",
  "url":"https://www.invasiveplantatlas.org/",
  "use":"Cross-checked before including any regionally aggressive species, and used to confirm that no recommended taxon is listed as invasive anywhere within its recommended range.",
  "format":"Web database","license":"Public domain and free to use"},
]
json.dump(sources, open(os.path.join(OUT,"sources.json"),"w"), indent=1)
print("sources.json      %d cited data sources" % len(sources))
