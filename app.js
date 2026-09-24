/* Botanical Bed Builder - recommendation engine and UI.
   No dependencies. Data comes from window.BB_DATA (data.js).
   Optional: zip_regions.json, written by fetch_authoritative.py, is loaded if present and
   overrides the prefix-based ZIP resolution with a true point-in-polygon result. */
(function () {
"use strict";

var D = window.BB_DATA;
if (!D) { document.getElementById("status").textContent =
  "Could not load data.js. Run: python3 build_reference_data.py && python3 build_data.py"; return; }

var PLANTS = D.plants, TEMPLATES = D.templates, REG = D.regions, SRC = D.sources;
var REGIONS = REG.regions, STATE_ZIPS = REG.state_zips, STATE_REGIONS = REG.state_regions,
    STATE_ZONES = REG.state_zone_range, ZIP3 = REG.zip3_overrides;
var ZIP_EXACT = null;

var MONTHS = ["J","F","M","A","M","J","J","A","S","O","N","D"];
var MONTHNAMES = ["January","February","March","April","May","June","July","August",
                  "September","October","November","December"];
var LAYER_NAME = {STRUCT:"Structural", SEASONAL:"Seasonal theme", MATRIX:"Groundcover matrix",
                  GRASS:"Matrix grass", FERN:"Fern layer", SHRUB:"Shrub backbone",
                  FILLER:"Dynamic filler"};
var LAYER_SHORT = {STRUCT:"Structural", SEASONAL:"Seasonal", MATRIX:"Groundcover",
                   GRASS:"Grass", FERN:"Fern", SHRUB:"Shrub", FILLER:"Filler"};
var FALLBACK = {FERN:["MATRIX","SHRUB"], GRASS:["MATRIX"], MATRIX:["GRASS","FILLER"],
                STRUCT:["SHRUB","SEASONAL"], SHRUB:["STRUCT"], FILLER:["SEASONAL","MATRIX"],
                SEASONAL:["FILLER","MATRIX"]};
var GROUND_LAYERS = {MATRIX:1, GRASS:1, FERN:1};

/* Plan fills come from the plant's FUNCTIONAL LAYER, so the drawing uses the same
   colour code as the Layer column in the plant table. Species sharing a layer share a
   hue and are separated by lightness and by their numbers, which is the intent: the
   colour tells you what a plant is for, the number tells you which plant it is. */
var LAYER_BASE = {
  STRUCT:  "#5c72a8",   /* slate blue   - matches .layerTag.STRUCT   */
  SEASONAL:"#cf9440",   /* amber        - matches .layerTag.SEASONAL */
  MATRIX:  "#5f9257",   /* leaf green   - matches .layerTag.MATRIX   */
  GRASS:   "#93a054",   /* olive        - matches .layerTag.GRASS    */
  FERN:    "#4c8f83",   /* teal         - matches .layerTag.FERN     */
  SHRUB:   "#8574ad",   /* violet       - matches .layerTag.SHRUB    */
  FILLER:  "#bd7186"    /* rose         - matches .layerTag.FILLER   */
};

function hexToRgb(h){
  var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(h);
  return m ? [parseInt(m[1],16), parseInt(m[2],16), parseInt(m[3],16)] : [150,160,140];
}
function rgbToHex(r,g,b){
  function c(v){ v = Math.max(0, Math.min(255, Math.round(v))); return ("0"+v.toString(16)).slice(-2); }
  return "#"+c(r)+c(g)+c(b);
}
/* Step a layer's base colour toward white or black. Used to separate species that
   share a layer while keeping them recognisably the same family. */
function tint(hex, amt){
  var c = hexToRgb(hex);
  if(amt >= 0) return rgbToHex(c[0]+(255-c[0])*amt, c[1]+(255-c[1])*amt, c[2]+(255-c[2])*amt);
  return rgbToHex(c[0]*(1+amt), c[1]*(1+amt), c[2]*(1+amt));
}
function rgbToHsl(r,g,b){
  r/=255; g/=255; b/=255;
  var mx = Math.max(r,g,b), mn = Math.min(r,g,b), h, sl, l = (mx+mn)/2, d = mx-mn;
  if(!d){ h = 0; sl = 0; }
  else {
    sl = l > 0.5 ? d/(2-mx-mn) : d/(mx+mn);
    if(mx === r)      h = ((g-b)/d + (g < b ? 6 : 0));
    else if(mx === g) h = ((b-r)/d + 2);
    else              h = ((r-g)/d + 4);
    h *= 60;
  }
  return [h, sl, l];
}
function hslToHex(h, sl, l){
  h = ((h%360)+360)%360; sl = Math.max(0, Math.min(1, sl)); l = Math.max(0, Math.min(1, l));
  var c = (1-Math.abs(2*l-1))*sl, x = c*(1-Math.abs((h/60)%2-1)), m = l-c/2, r, g, b;
  if(h < 60)       { r=c; g=x; b=0; }
  else if(h < 120) { r=x; g=c; b=0; }
  else if(h < 180) { r=0; g=c; b=x; }
  else if(h < 240) { r=0; g=x; b=c; }
  else if(h < 300) { r=x; g=0; b=c; }
  else             { r=c; g=0; b=x; }
  return rgbToHex((r+m)*255, (g+m)*255, (b+m)*255);
}
/* Spread the species of one layer along a ramp, darkest first, so the layer reads as a
   single family while its members stay tellable apart. Lightness does most of the work;
   a small hue and saturation drift widens the separation when a layer holds five or six
   species, where lightness alone would put neighbouring shades too close together. */
function layerShade(layer, idx, count){
  var base = LAYER_BASE[layer] || "#9aa48f";
  if(count <= 1) return base;
  var c = hexToRgb(base), hsl = rgbToHsl(c[0], c[1], c[2]);
  var t = idx/(count-1);                       /* 0 darkest .. 1 lightest */
  var l = 0.30 + 0.46*t;                       /* wide lightness ramp */
  var sat = hsl[1]*(1 - 0.30*t);               /* lighter shades a little softer */
  var hue = hsl[0] + (t-0.5)*16;               /* gentle hue drift, stays in family */
  return hslToHex(hue, sat, l);
}

function el(id){ return document.getElementById(id); }
function mk(t,c,txt){ var e=document.createElement(t); if(c)e.className=c;
  if(txt!==undefined)e.textContent=txt; return e; }
function esc(s){ return String(s).replace(/[&<>"']/g,function(m){
  return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]; }); }
function genus(p){ return p.sci.split(" ")[0]; }
function slug(s){ return s.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""); }
/* Flower colour, in words. Used in the legend and the plant notes so the colour
   information is not lost now that the plan is coded by function instead. */
function flowerWords(p){
  if(!p.colors.length || p.colors[0] === "none") return "";
  return p.colors.join(" and ").replace(/-/g, " ");
}

/* deterministic RNG: the same inputs always produce the same designs */
function rngFrom(str){
  var h=1779033703^str.length;
  for(var i=0;i<str.length;i++){ h=Math.imul(h^str.charCodeAt(i),3432918353); h=h<<13|h>>>19; }
  return function(){ h=Math.imul(h^h>>>16,2246822507); h=Math.imul(h^h>>>13,3266489909);
    return ((h^=h>>>16)>>>0)/4294967296; };
}

var SPREADY = /rhizomat|suckers|spreads|self-sow|reseed|stolon|coloni|runner|aggressiv|freely|runs /i;
PLANTS.forEach(function(p){
  p.spready   = SPREADY.test(p.notes);
  p.deerOK    = p.wildlife.indexOf("deer_resistant")>=0;
  p.winterInt = p.wildlife.indexOf("winter_seedhead")>=0 || p.wildlife.indexOf("winter_structure")>=0;
  p.hummer    = p.wildlife.indexOf("hummingbird")>=0;
  p.evergreen = p.wildlife.indexOf("evergreen")>=0;
});

/* ------------------------------------------------ ZIP resolution */
function resolveZip(zip){
  if(!/^\d{5}$/.test(zip)) return {error:"Enter a five-digit US ZIP code."};
  if(ZIP_EXACT && ZIP_EXACT[zip]){
    var x = ZIP_EXACT[zip];
    return {exact:true, state:x.state||"", place:x.place||x.epa_l3||"", regions:x.regions,
            zones:[x.zone_min||x.zone||5, x.zone_max||x.zone||9], epa:x.epa_l3||"",
            lat:x.lat, lon:x.lon};
  }
  var n = parseInt(zip,10), state=null;
  for(var s in STATE_ZIPS){
    var rr = STATE_ZIPS[s];
    for(var i=0;i<rr.length;i++){ if(n>=rr[i][0] && n<=rr[i][1]){ state=s; break; } }
    if(state) break;
  }
  if(!state) return {error:"ZIP "+zip+" is not inside any of the published United States ZIP "+
      "ranges. Check the digits."};
  var regs = (STATE_REGIONS[state]||[]).slice();
  var zones = (STATE_ZONES[state]||[5,8]).slice();
  var place = "", ov = ZIP3[zip.slice(0,3)];
  if(ov){ if(ov.regions&&ov.regions.length) regs = ov.regions.slice();
          if(ov.zones) zones = ov.zones.slice();
          if(ov.place) place = ov.place; }
  if(!regs.length) return {error:"ZIP "+zip+" is in "+state+", which this tool does not yet cover. "+
      "Alaska, Hawaii and the territories fall outside the ten continental ecoregions in the "+
      "database and need their own regional species lists."};
  return {state:state, place:place, regions:regs, zones:zones, refined:!!ov};
}

/* ------------------------------------------------ species pool */
function buildPool(c){
  return PLANTS.filter(function(p){
    if(p.regions.indexOf(c.region)<0) return false;
    if(c.zone < p.zmin) return false;              /* cold hardiness: hard limit */
    if(c.zone > p.zmax + 1) return false;          /* warm end: one zone of tolerance */
    if(p.light.indexOf(c.light)<0) return false;
    if(p.moist.indexOf(c.soil)<0) return false;
    if(p.hmax > c.maxh) return false;
    if(c.deer && !p.deerOK && p.layer!=="GRASS" && p.layer!=="FERN") return false;
    if(!c.spread && p.spready) return false;
    return true;
  });
}
function byLayer(pool){
  var m={}; Object.keys(LAYER_NAME).forEach(function(k){ m[k]=[]; });
  pool.forEach(function(p){ m[p.layer].push(p); }); return m;
}

var PAL = {
  warm:["yellow","gold","orange","red","scarlet","apricot","coral","bronze","rust","golden"],
  cool:["blue","violet","purple","lavender","white","silver","pale","greenish","sky"],
  hot:["red","scarlet","coral","orange","magenta","rose"],
  soft:["pink","lavender","white","cream","pale","rose","blue"],
  restrained:["white","cream","green","silver","tan","bronze","greenish","none"],
  any:null
};
function paletteBonus(p, pal){
  var want = PAL[pal||"any"]; if(!want) return 0;
  var txt = p.colors.join(" ").toLowerCase(), hit=0;
  want.forEach(function(w){ if(txt.indexOf(w)>=0) hit++; });
  return hit ? 9 : (p.colors[0]==="none" ? 3 : -4);
}

/* weighted draw without replacement, never two species of the same genus */
function pick(cands, n, rnd, scoreFn){
  var used={}, out=[], list=cands.slice();
  while(out.length<n && list.length){
    var scored = list.map(function(p){
      return {p:p, w: Math.pow(Math.max(1,scoreFn(p)),2.1) * (0.55+0.9*rnd())};
    });
    scored.sort(function(a,b){ return b.w-a.w; });
    var chosen=null;
    for(var i=0;i<scored.length;i++){ if(!used[genus(scored[i].p)]){ chosen=scored[i].p; break; } }
    if(!chosen) chosen = scored[0].p;
    used[genus(chosen)]=1; out.push(chosen);
    list = list.filter(function(p){ return p!==chosen; });
  }
  return out;
}
/* greedy bloom-coverage draw for the seasonal layer, so the flowering sequence has no gaps */
function pickSequenced(cands, n, rnd, scoreFn){
  var covered={}, out=[], used={}, list=cands.slice();
  while(out.length<n && list.length){
    var best=null, bestV=-1e9;
    list.forEach(function(p){
      if(used[genus(p)]) return;
      var gain=0; p.bloom_months.forEach(function(m){ if(!covered[m]) gain++; });
      var v = gain*14 + scoreFn(p)*0.7 + rnd()*13;
      if(v>bestV){ bestV=v; best=p; }
    });
    if(!best) best=list[0];
    used[genus(best)]=1; out.push(best);
    best.bloom_months.forEach(function(m){ covered[m]=1; });
    list = list.filter(function(p){ return p!==best; });
  }
  return out;
}

/* ------------------------------------------------ combination builder */
function templateFits(t, c, L){
  if(t.light.indexOf(c.light)<0) return false;
  if(t.moist.indexOf(c.soil)<0) return false;
  if(t.regions && t.regions.indexOf(c.region)<0) return false;
  var ok = true;
  Object.keys(t.counts).forEach(function(lay){
    var min = t.counts[lay][0], avail = (L[lay]||[]).length;
    (FALLBACK[lay]||[]).forEach(function(f){ avail += (L[f]||[]).length; });
    if(avail < min) ok = false;
  });
  if(t.require_host){
    var h = 0;
    Object.keys(L).forEach(function(k){ L[k].forEach(function(p){
      if(p.hosts.join(";").indexOf(t.require_host)>=0) h++; }); });
    if(h < (t.min_host_species||1)) ok = false;
  }
  if(t.require_tag && t.require_tag!=="winter_structure_or_seedhead"){
    var g=0;
    Object.keys(L).forEach(function(k){ L[k].forEach(function(p){
      if(p.wildlife.indexOf(t.require_tag)>=0) g++; }); });
    if(g < (t.min_tag_species||1)) ok = false;
  }
  return ok;
}
function qtyFor(p, sqft){
  var per = p.density_per_10sqft/10, q = Math.round(sqft*per);
  if(p.layer==="SHRUB" || p.hmax>=60) q = Math.max(1,q); else q = Math.max(3,q);
  if(q>2 && q<13 && q%2===0) q += 1;
  return q;
}
function buildCombo(t, c, L, seed, variant, usage){
  usage = usage || {};
  var rnd = rngFrom(c.key+"|"+t.id+"|"+seed+"|"+variant);
  var area = c.w*c.l, picks = [], rows = [];

  function scorer(lay){
    return function(p){
      var s = p.eco_score;
      if(t.rank_by==="lep") s += Math.min(35,(p.lep||0)*0.3);
      s += paletteBonus(p, t.palette);
      if(t.require_tag==="winter_structure_or_seedhead" && p.winterInt) s += 14;
      if(t.require_tag && p.wildlife.indexOf(t.require_tag)>=0) s += 16;
      if(t.require_host && p.hosts.join(";").indexOf(t.require_host)>=0) s += 26;
      if(t.max_height && p.hmax > t.max_height) s -= 28;
      if(lay==="STRUCT" && p.winterInt) s += 8;
      if(lay==="MATRIX" && p.evergreen) s += 6;
      if(c.deer && p.deerOK) s += 5;
      s -= (usage[p.id]||0)*7;               /* keep the designs from converging */
      return Math.max(1,s);
    };
  }
  function minSq(sq,p){ return Math.max(sq, (p.spacing*p.spacing*0.866)/144); }

  /* How many species the bed can carry. A small bed planted with a dozen species
     ends up as a row of single specimens, which reads as scattered rather than
     designed; a large one can hold more without losing its rhythm. Roughly one
     species per 13 square feet, so every species still gets a real drift. */
  var want = {}, wantSum = 0;
  Object.keys(t.counts).forEach(function(lay){
    var rangeN = t.counts[lay];
    want[lay] = rangeN[0] + Math.floor(rnd()*(rangeN[1]-rangeN[0]+1));
    wantSum += want[lay];
  });
  var budget = Math.max(5, Math.min(15, Math.round(area/13)));
  while(wantSum > budget){
    var biggest = null;
    Object.keys(want).forEach(function(l){
      if(want[l] > 1 && (biggest===null || want[l] > want[biggest])) biggest = l; });
    if(biggest === null) break;
    want[biggest]--; wantSum--;
  }

  Object.keys(t.counts).forEach(function(lay){
    var n = want[lay];
    var cands = (L[lay]||[]).slice();
    (FALLBACK[lay]||[]).forEach(function(f){
      if(cands.length < n) cands = cands.concat((L[f]||[]).filter(function(p){
        return cands.indexOf(p)<0; }));
    });
    cands = cands.filter(function(p){ return picks.indexOf(p)<0; });
    if(!cands.length) return;
    n = Math.min(n, cands.length);
    var chosen = (lay==="SEASONAL") ? pickSequenced(cands,n,rnd,scorer(lay))
                                    : pick(cands,n,rnd,scorer(lay));
    var layArea = area*(t.area[lay]||0.05);
    chosen.forEach(function(p,i){
      var wgt;
      if(chosen.length===1) wgt = 1;
      else if(lay==="MATRIX"||lay==="GRASS") wgt = i===0 ? 0.55 : 0.45/(chosen.length-1);
      else wgt = 1/chosen.length;
      var sq = layArea*wgt;
      picks.push(p);
      rows.push({p:p, layer:lay, sqft:Math.round(sq*10)/10, qty:qtyFor(p,minSq(sq,p))});
    });
  });
  if(rows.length < 5) return null;

  var months={}, monthCount={}, lepByGenus={}, sb=0, hosts={}, winter=0, ground=0, plants=0;
  rows.forEach(function(r){
    var p=r.p;
    p.bloom_months.forEach(function(m){ months[m]=1; monthCount[m]=(monthCount[m]||0)+1; });
    if(p.lep) lepByGenus[genus(p)] = Math.max(lepByGenus[genus(p)]||0, p.lep);
    if(p.sb) sb++;
    p.hosts.forEach(function(h){ hosts[h]=1; });
    if(p.winterInt) winter++;
    if(GROUND_LAYERS[r.layer]) ground += r.sqft;
    plants += r.qty;
  });
  var lepTotal = Object.keys(lepByGenus).reduce(function(a,k){ return a+lepByGenus[k]; },0);
  var ORD={STRUCT:0,SHRUB:1,SEASONAL:2,FERN:3,GRASS:4,MATRIX:5,FILLER:6};
  rows.sort(function(a,b){
    if(ORD[a.layer]!==ORD[b.layer]) return ORD[a.layer]-ORD[b.layer];
    return b.p.hmax-a.p.hmax;
  });
  return {t:t, rows:rows, area:area, variant:variant, m:{
    lep:lepTotal, sb:sb, hosts:Object.keys(hosts).sort(), winter:winter,
    bloomMonths:Object.keys(months).length,
    strongMonths:Object.keys(monthCount).filter(function(m){ return monthCount[m]>=3; }).length,
    groundPct:Math.round(100*ground/area), species:rows.length, plants:plants,
    monthCount:monthCount}};
}
function generate(c){
  var pool = buildPool(c), L = byLayer(pool), out = [], usage = {};
  function note(cb){ cb.rows.forEach(function(r){ usage[r.p.id]=(usage[r.p.id]||0)+1; }); }
  var fits = TEMPLATES.filter(function(t){ return templateFits(t,c,L); });
  fits.forEach(function(t){ var cb=buildCombo(t,c,L,c.seed,1,usage); if(cb){ out.push(cb); note(cb); } });
  var v = 2;
  while(out.length < 9 && v < 5){
    fits.forEach(function(t){
      if(out.length>=12) return;
      var cb=buildCombo(t,c,L,c.seed,v,usage);
      if(cb && !out.some(function(o){ return o.t.id===t.id &&
          o.rows.map(function(r){return r.p.id;}).join()===
          cb.rows.map(function(r){return r.p.id;}).join(); })){ out.push(cb); note(cb); }
    });
    v++;
  }
  return {combos: out.slice(0,12), pool: pool, fits: fits.length};
}

/* ------------------------------------------------ rendering */
function bloomClass(p){
  var c=p.colors.join(" ").toLowerCase();
  if(/pink|rose|magenta/.test(c)) return "p";
  if(/blue|violet|purple|lavender/.test(c)) return "b";
  if(/red|scarlet|coral/.test(c)) return "r";
  if(/orange|apricot/.test(c)) return "o";
  if(/white|cream|silver|green|tan|none/.test(c)) return "w";
  return "y";
}
function whyText(p){
  var bits=[];
  if(p.lep) bits.push("hosts ~"+p.lep+" caterpillar spp.");
  if(p.sb) bits.push("specialist-bee host");
  if(p.hosts.length) bits.push("larval host: "+p.hosts.slice(0,2).join(", "));
  if(p.hummer) bits.push("hummingbirds");
  if(p.wildlife.indexOf("birdseed")>=0) bits.push("bird seed");
  if(p.wildlife.indexOf("nfix")>=0) bits.push("fixes nitrogen");
  if(p.winterInt) bits.push("winter habitat");
  if(p.evergreen) bits.push("evergreen");
  return bits.slice(0,4).join(" \u00b7 ");
}
function bloomStr(p){
  if(!p.bloom_months.length) return "foliage only";
  var a=MONTHNAMES[p.bloom_start-1].slice(0,3), b=MONTHNAMES[p.bloom_end-1].slice(0,3);
  return a===b? a : a+"\u2013"+b;
}
function renderCalendar(combo){
  var wrap = mk("div","cal");
  wrap.appendChild(mk("h4",null,"Bloom sequence"));
  var tb = mk("table"), thead=mk("tr");
  var th0=mk("th","nm",""); thead.appendChild(th0);
  MONTHS.forEach(function(m,i){ var th=mk("th",null,m); th.title=MONTHNAMES[i]; thead.appendChild(th); });
  tb.appendChild(thead);
  combo.rows.filter(function(r){ return r.p.bloom_months.length; })
    .sort(function(a,b){ return a.p.bloom_start-b.p.bloom_start; })
    .forEach(function(r){
      var tr=mk("tr"), nm=mk("td","nm",r.p.common); nm.title=r.p.sci+" \u2014 "+bloomStr(r.p);
      tr.appendChild(nm);
      for(var m=1;m<=12;m++)
        tr.appendChild(mk("td","cell"+(r.p.bloom_months.indexOf(m)>=0?" on "+bloomClass(r.p):"")));
      tb.appendChild(tr);
    });
  var tot=mk("tr","total"), lbl=mk("td","nm");
  lbl.innerHTML="<b>species in bloom</b>"; tot.appendChild(lbl);
  for(var m=1;m<=12;m++){
    var n=combo.m.monthCount[m]||0;
    var td=mk("td","cell"+(n?" on":""));
    td.title=n+" species in flower in "+MONTHNAMES[m-1];
    if(n) td.style.opacity = String(Math.min(1, 0.35+n*0.18));
    tot.appendChild(td);
  }
  tb.appendChild(tot); wrap.appendChild(tb);
  var note = mk("div","muted small", combo.m.bloomMonths+" of 12 months carry bloom; "+
     combo.m.strongMonths+" month(s) have three or more species flowering at once.");
  note.style.marginTop="5px"; wrap.appendChild(note);
  return wrap;
}
function renderScore(combo){
  var s = mk("div","score");
  s.appendChild(mk("h4",null,"Habitat scorecard"));
  var g = mk("div","metrics");
  function metric(v,k,pct){
    var d=mk("div","metric"); d.appendChild(mk("div","v",v)); d.appendChild(mk("div","k",k));
    if(pct!==undefined){ var b=mk("div","bar"), i=mk("i");
      i.style.width=Math.max(3,Math.min(100,pct))+"%"; b.appendChild(i); d.appendChild(b); }
    return d;
  }
  g.appendChild(metric("~"+combo.m.lep,"butterfly & moth species whose caterpillars can feed here",combo.m.lep/6));
  g.appendChild(metric(combo.m.sb,"species that are documented pollen hosts for specialist bees",combo.m.sb*14));
  g.appendChild(metric(combo.m.bloomMonths+"/12","months with something in flower",combo.m.bloomMonths/12*100));
  g.appendChild(metric(combo.m.groundPct+"%","of the bed held by living groundcover",combo.m.groundPct));
  g.appendChild(metric(combo.m.winter,"species leaving standing winter habitat",combo.m.winter*18));
  g.appendChild(metric(combo.m.species+" / "+combo.m.plants,"species / plants to buy"));
  s.appendChild(g);
  if(combo.m.hosts.length){
    var h=mk("div","hostlist");
    h.innerHTML="<b>Named larval hosts in this bed:</b> "+esc(combo.m.hosts.join(", "))+".";
    s.appendChild(h);
  }
  return s;
}
/* =========================================================================
   BED LAYOUT
   A capacity-constrained, height-aware tiling of the entire bed.

   Every square foot is assigned to exactly one species, so there is no
   unexplained empty space: the groundcover layer genuinely fills the gaps
   between everything else, which is how these plantings actually work.
   Seeds are placed by mature height -- tallest toward the back edge, shortest
   at the front -- so a short plant is never buried behind a tall one.

   The algorithm is a weighted Voronoi diagram whose weights are iterated until
   each species occupies close to its designed share of the area (a
   capacity-constrained Voronoi tessellation). Vertical distance is scaled up
   so drifts elongate along the length of the bed, as drawn drifts should.
   ========================================================================= */
function layoutBed(combo, c){
  var L = c.l, Wd = c.w, aspect = L/Wd;
  var rows = Math.max(7,  Math.round(Math.sqrt(2200/aspect)));
  var cols = Math.max(12, Math.round(rows*aspect));
  while(cols*rows > 3000){ cols = Math.round(cols*0.9); rows = Math.max(6, Math.round(rows*0.9)); }
  var n = cols*rows, cellW = L/cols, cellH = Wd/rows, sqftPerCell = cellW*cellH;

  var minH = 1e9, maxH = 0;
  combo.rows.forEach(function(r){
    if(r.p.hmax < minH) minH = r.p.hmax;
    if(r.p.hmax > maxH) maxH = r.p.hmax; });
  var span = Math.max(6, maxH-minH);

  var ent = combo.rows.map(function(r,i){
    var ground   = !!GROUND_LAYERS[r.layer];
    var tallness = (r.p.hmax-minH)/span;                  /* 0 shortest .. 1 tallest */
    return {i:i, num:i+1, row:r, p:r.p, ground:ground, tallness:tallness,
            /* preferred depth: 0 = back edge, 1 = front edge */
            /* A tall matrix grass belongs mid-bed, a low sedge at the front, so the
               groundcover layer is graded by height as well, just more loosely. */
            pref: ground ? 0.78 - 0.48*tallness : 0.90 - 0.78*tallness,
            share: Math.max(0.6, r.sqft/sqftPerCell), quota:0, area:0, seeds:[]};
  });

  /* ---- quotas: whole cells summing to exactly n, so the bed is fully covered
          and every species is guaranteed a visible patch ---- */
  /* Colour by functional layer. Within a layer, species are ranked tallest first and
     spread along a lightness ramp, so a layer reads as one family on the plan while
     its members stay tellable apart. */
  var perLayer = {};
  ent.forEach(function(e){ (perLayer[e.row.layer] = perLayer[e.row.layer] || []).push(e); });
  Object.keys(perLayer).forEach(function(lay){
    var grp = perLayer[lay].slice().sort(function(a,b){ return b.p.hmax-a.p.hmax; });
    grp.forEach(function(e,k){ e.col = layerShade(lay, k, grp.length); });
  });

  var tot = 0; ent.forEach(function(e){ tot += e.share; });
  var MINQ = Math.max(4, Math.round(n*0.004));
  ent.forEach(function(e){ e.quota = Math.max(MINQ, Math.floor(e.share*n/tot)); });
  var used = 0; ent.forEach(function(e){ used += e.quota; });
  /* settle the difference against the largest quotas, never dropping below MINQ */
  var guard = 0;
  while(used !== n && guard++ < 20000){
    var pickE = null;
    if(used < n){
      ent.forEach(function(e){ if(!pickE || e.quota > pickE.quota) pickE = e; });
      pickE.quota++; used++;
    } else {
      ent.forEach(function(e){ if(e.quota > MINQ && (!pickE || e.quota > pickE.quota)) pickE = e; });
      if(!pickE) break;
      pickE.quota--; used--;
    }
  }

  ent.forEach(function(e){ e.share01 = e.quota/n; });      /* fraction of the bed it must cover */

  var rnd = rngFrom(combo.t.id+"|"+combo.variant+"|"+c.key+"|layout");

  /* ---- drift seeds, spread along the length so repeats do not line up ---- */
  ent.forEach(function(e){
    var want = Math.round(Math.sqrt(e.quota) / (e.ground ? 2.0 : 2.7));
    want = Math.max(1, Math.min(e.ground ? 6 : 4, want));
    if(!e.ground && e.p.hmax >= 60) want = Math.min(want, 3);   /* big plants read best in few masses */
    var phase = rnd();
    for(var j=0;j<want;j++){
      var fx = (j + 0.5 + (rnd()-0.5)*0.55 + phase)/want;  fx -= Math.floor(fx);
      var fy = e.pref + (rnd()-0.5)*(e.ground ? 0.5 : 0.2);
      e.seeds.push({x: fx*cols, y: Math.max(0.06, Math.min(0.94, fy))*rows});
    }
  });

  /* ---- cost of a cell to a species: distance to its nearest drift seed, plus a
          penalty for sitting at the wrong depth. Vertical distance counts for more,
          so drifts stretch along the length of the bed the way drawn drifts should. ---- */
  function cellCost(e, cx, cy){
    var best = 1e18, yS = e.ground ? 1.5 : 2.2;
    for(var s=0; s<e.seeds.length; s++){
      var dx = cx+0.5-e.seeds[s].x, dy = (cy+0.5-e.seeds[s].y)*yS;
      var d2 = dx*dx + dy*dy;
      if(d2 < best) best = d2;
    }
    var depth = (cy+0.5)/rows, err = depth - e.pref, aerr = Math.abs(err);
    /* A tall species creeping toward the front is penalised hard: that is what stops
       short plants being washed out behind tall ones. */
    var pen = e.ground ? (err > 0 ? 1.6 + 2.0*e.tallness : 0.6)
                       : (err > 0 ? 4.0 + 5.0*e.tallness : 1.8);
    var cost = Math.sqrt(best) + pen*aerr*rows*0.75;
    /* Outside its depth band the cost becomes prohibitive, so a species with a large
       quota spreads sideways along the bed instead of bleeding forward out of its tier.
       The band widens with the species' share, because a plant covering a third of the
       bed genuinely needs more depth than one covering a twentieth. */
    var halfBand = (e.ground ? 0.24 : 0.15) + (e.ground ? 0.45 : 0.5)*e.share01;
    if(e.ground && halfBand > 0.38) halfBand = 0.38;
    if(aerr > halfBand) cost += 600*(aerr-halfBand)*rows;
    /* The front few inches of the bed are reserved for genuinely low plants. Anything
       taller than about 18 inches pays to stand there, so the low edging species win it
       and nothing short ends up hidden behind something tall. */
    if(depth > 0.86){
      var over = (e.p.hmax - 18)/12;
      if(over > 0) cost += over*rows*1.1*(depth-0.86)/0.14;
    }
    return cost;
  }

  /* ---- grow every species outward from its seeds, cheapest cell first, until it
          has exactly its quota. Guarantees exact areas and no species squeezed out. ---- */
  var heap = [];                                     /* binary min-heap of {c,cell,e} */
  function hpush(c0, cell, ei){
    heap.push({c:c0, cell:cell, e:ei});
    var i = heap.length-1;
    while(i > 0){
      var par = (i-1)>>1;
      if(heap[par].c <= heap[i].c) break;
      var t = heap[par]; heap[par] = heap[i]; heap[i] = t; i = par;
    }
  }
  function hpop(){
    if(!heap.length) return null;
    var top = heap[0], last = heap.pop();
    if(heap.length){
      heap[0] = last;
      var i = 0;
      for(;;){
        var l = 2*i+1, r = l+1, m = i;
        if(l < heap.length && heap[l].c < heap[m].c) m = l;
        if(r < heap.length && heap[r].c < heap[m].c) m = r;
        if(m === i) break;
        var t = heap[m]; heap[m] = heap[i]; heap[i] = t; i = m;
      }
    }
    return top;
  }

  var owner = new Int16Array(n);
  for(var z=0; z<n; z++) owner[z] = -1;
  var claimed = 0;

  function frontier(e, cell){
    var cx = cell%cols, cy = (cell-cx)/cols;
    if(cx > 0)      { var a=cell-1;    if(owner[a]===-1) hpush(cellCost(e,cx-1,cy), a, e.i); }
    if(cx < cols-1) { var b=cell+1;    if(owner[b]===-1) hpush(cellCost(e,cx+1,cy), b, e.i); }
    if(cy > 0)      { var d=cell-cols; if(owner[d]===-1) hpush(cellCost(e,cx,cy-1), d, e.i); }
    if(cy < rows-1) { var f=cell+cols; if(owner[f]===-1) hpush(cellCost(e,cx,cy+1), f, e.i); }
  }
  function cheapestFree(e){
    var bc = -1, bcost = 1e18;
    for(var k=0; k<n; k++){
      if(owner[k] !== -1) continue;
      var kx = k%cols, cst = cellCost(e, kx, (k-kx)/cols);
      if(cst < bcost){ bcost = cst; bc = k; }
    }
    return bc;
  }

  /* Every species is given a guaranteed foothold before general growth starts.
     Without this, a species whose seed cell is taken by a cheaper neighbour can
     drop out of the frontier altogether and never appear in the plan at all. */
  ent.slice().sort(function(a,b){ return b.quota-a.quota; }).forEach(function(e){
    var cell = cheapestFree(e);
    if(cell < 0) return;
    owner[cell] = e.i; e.area++; claimed++;
    frontier(e, cell);
  });
  /* remaining seeds simply join the frontier */
  ent.forEach(function(e){
    e.seeds.forEach(function(sd){
      var cx = Math.max(0, Math.min(cols-1, Math.floor(sd.x)));
      var cy = Math.max(0, Math.min(rows-1, Math.floor(sd.y)));
      var cell = cy*cols+cx;
      if(owner[cell] === -1) hpush(cellCost(e, cx, cy), cell, e.i);
    });
  });

  var item;
  while(claimed < n && (item = hpop())){
    var cell = item.cell, e = ent[item.e];
    if(owner[cell] !== -1 || e.area >= e.quota) continue;
    owner[cell] = e.i; e.area++; claimed++;
    frontier(e, cell);

    /* a species boxed in before reaching its quota is re-seeded at the cheapest
       cell still free, so it can never be squeezed out of the plan */
    if(!heap.length && claimed < n){
      var need = null;
      ent.forEach(function(q){
        if(q.area < q.quota && (!need || q.quota-q.area > need.quota-need.area)) need = q; });
      if(need){
        var bc = cheapestFree(need);
        if(bc >= 0) hpush(cellCost(need, bc%cols, (bc-bc%cols)/cols), bc, need.i);
      }
    }
  }

  /* Any cell still unclaimed goes to whichever neighbouring species is furthest
     below its quota, so rounding never inflates one species at another's expense. */
  var pass = 0;
  while(claimed < n && pass++ < 40){
    var moved = false;
    for(var u=0; u<n; u++){
      if(owner[u] !== -1) continue;
      var ux = u%cols, uy = (u-ux)/cols, cands = [];
      if(ux > 0        && owner[u-1]    >= 0) cands.push(owner[u-1]);
      if(ux < cols-1   && owner[u+1]    >= 0) cands.push(owner[u+1]);
      if(uy > 0        && owner[u-cols] >= 0) cands.push(owner[u-cols]);
      if(uy < rows-1   && owner[u+cols] >= 0) cands.push(owner[u+cols]);
      if(!cands.length) continue;
      var pickI = cands[0];
      cands.forEach(function(ci){
        var a = ent[ci], b = ent[pickI];
        if((a.quota-a.area) > (b.quota-b.area)) pickI = ci; });
      owner[u] = pickI; ent[pickI].area++; claimed++; moved = true;
    }
    if(!moved) break;
  }
  for(var u2=0; u2<n; u2++) if(owner[u2] === -1){ owner[u2] = 0; ent[0].area++; }

  /* ---- connected components, so each separate drift can carry its number ---- */
  var seen = new Uint8Array(n), comps = [], stack = [];
  for(var i0=0;i0<n;i0++){
    if(seen[i0]) continue;
    var o = owner[i0], cells = [];
    stack.length = 0; stack.push(i0); seen[i0] = 1;
    while(stack.length){
      var q2 = stack.pop(); cells.push(q2);
      var qx = q2%cols, qy = (q2-qx)/cols;
      if(qx>0      && !seen[q2-1]    && owner[q2-1]===o)    { seen[q2-1]=1;    stack.push(q2-1); }
      if(qx<cols-1 && !seen[q2+1]    && owner[q2+1]===o)    { seen[q2+1]=1;    stack.push(q2+1); }
      if(qy>0      && !seen[q2-cols] && owner[q2-cols]===o) { seen[q2-cols]=1; stack.push(q2-cols); }
      if(qy<rows-1 && !seen[q2+cols] && owner[q2+cols]===o) { seen[q2+cols]=1; stack.push(q2+cols); }
    }
    var sx=0, sy=0;
    cells.forEach(function(q3){ var x=q3%cols; sx+=x+0.5; sy+=(q3-x)/cols+0.5; });
    var gx = sx/cells.length, gy = sy/cells.length, pick = cells[0], pd = 1e18;
    cells.forEach(function(q4){          /* the label must sit inside the shape, not on its hull */
      var x=q4%cols, y=(q4-x)/cols, dd=(x+0.5-gx)*(x+0.5-gx)+(y+0.5-gy)*(y+0.5-gy);
      if(dd<pd){ pd=dd; pick=q4; }
    });
    comps.push({owner:o, size:cells.length, cx:(pick%cols)+0.5, cy:((pick-pick%cols)/cols)+0.5});
  }
  comps.sort(function(a,b){ return b.size-a.size; });

  /* label every drift above a size floor, and always at least one per species */
  var floor = Math.max(5, n*0.012), labelled = {}, labels = [];
  comps.forEach(function(cp){
    if(cp.size >= floor){ labels.push(cp); labelled[cp.owner] = 1; }
  });
  ent.forEach(function(e){
    if(!labelled[e.i]){
      for(var j=0;j<comps.length;j++) if(comps[j].owner===e.i){ labels.push(comps[j]); break; }
    }
  });

  return {cols:cols, rows:rows, n:n, owner:owner, ent:ent, labels:labels,
          cellW:cellW, cellH:cellH, rnd:rnd};
}

/* individual plant positions on a triangular lattice at the species' own spacing */
function plantDots(e, geo){
  var stepX = (e.p.spacing/12)/geo.cellW;
  var stepY = stepX*0.866*(geo.cellW/geo.cellH);
  if(!(stepX > 0.9) || !(stepY > 0.9)) return [];     /* too fine to read: omit rather than clutter */
  var out = [], jitter = geo.rnd()*stepX, r = 0;
  for(var gy = stepY*0.5; gy < geo.rows; gy += stepY, r++){
    var x0 = jitter + (r%2 ? stepX*0.5 : 0);
    for(var gx = x0; gx < geo.cols; gx += stepX){
      var cx = Math.floor(gx), cy = Math.floor(gy);
      if(cx < 0 || cy < 0 || cx >= geo.cols || cy >= geo.rows) continue;
      if(geo.owner[cy*geo.cols+cx] === e.i) out.push([gx, gy]);
    }
  }
  if(out.length > e.row.qty*2) out.length = e.row.qty*2;
  return out;
}

function renderPlan(combo, c){
  var geo = layoutBed(combo, c);
  var NS = "http://www.w3.org/2000/svg";
  function n(tag, attrs){ var e = document.createElementNS(NS, tag);
    for(var k in attrs) e.setAttribute(k, attrs[k]); return e; }

  var PX = 920, pxPerFt = PX/c.l, Hpx = c.w*pxPerFt;
  if(Hpx > 400){ pxPerFt = 400/c.w; Hpx = 400; PX = c.l*pxPerFt; }
  if(Hpx < 130){ Hpx = 130; }
  var PAD_L = 46, PAD_B = 34, PAD_T = 6, PAD_R = 6;
  var cw = PX/geo.cols, ch = Hpx/geo.rows;
  var svg = n("svg", {viewBox:"0 0 "+(PX+PAD_L+PAD_R)+" "+(Hpx+PAD_T+PAD_B),
    role:"img", "aria-label":"Planting plan for a "+c.l+" by "+c.w+" foot bed. "+
      "Tallest species are placed along the back edge and the groundcover layer fills all "+
      "remaining ground. Each numbered area matches the plant table."});
  var g = n("g", {transform:"translate("+PAD_L+","+PAD_T+")"});
  svg.appendChild(g);

  /* ---- fills: run-length merged cells, one path per species ---- */
  geo.ent.forEach(function(e){
    var d = "";
    for(var cy=0; cy<geo.rows; cy++){
      var run = -1;
      for(var cx=0; cx<=geo.cols; cx++){
        var own = cx<geo.cols ? geo.owner[cy*geo.cols+cx] : -99;
        if(own === e.i && run < 0) run = cx;
        if(own !== e.i && run >= 0){
          d += "M"+(run*cw).toFixed(1)+","+(cy*ch).toFixed(1)+
               "h"+((cx-run)*cw).toFixed(1)+"v"+ch.toFixed(1)+
               "h"+(-(cx-run)*cw).toFixed(1)+"Z";
          run = -1;
        }
      }
    }
    if(d) g.appendChild(n("path", {d:d, fill:e.col, "fill-opacity":.86,
      "data-sp":e.num, "data-hmax":e.p.hmax, "data-cells":e.area,
      "data-ground":e.ground?1:0}));
  });

  /* ---- seams between different species ---- */
  var seams = "";
  for(var cy2=0; cy2<geo.rows; cy2++){
    for(var cx2=0; cx2<geo.cols; cx2++){
      var o = geo.owner[cy2*geo.cols+cx2];
      if(cx2 < geo.cols-1 && geo.owner[cy2*geo.cols+cx2+1] !== o)
        seams += "M"+((cx2+1)*cw).toFixed(1)+","+(cy2*ch).toFixed(1)+"v"+ch.toFixed(1);
      if(cy2 < geo.rows-1 && geo.owner[(cy2+1)*geo.cols+cx2] !== o)
        seams += "M"+(cx2*cw).toFixed(1)+","+((cy2+1)*ch).toFixed(1)+"h"+cw.toFixed(1);
    }
  }
  if(seams) g.appendChild(n("path", {d:seams, fill:"none", stroke:"#5f6b58",
    "stroke-width":.9, "stroke-opacity":.42}));

  /* ---- individual plants ---- */
  var dotTotal = 0;
  geo.ent.forEach(function(e){
    var dots = plantDots(e, geo);
    if(!dots.length) return;
    var col = tint(e.col, -0.45), d = "";
    dots.forEach(function(pt){
      var x = pt[0]*cw, y = pt[1]*ch;
      d += "M"+x.toFixed(1)+","+y.toFixed(1)+"m-1.9,0a1.9,1.9 0 1,0 3.8,0a1.9,1.9 0 1,0 -3.8,0";
    });
    dotTotal += dots.length;
    g.appendChild(n("path", {d:d, fill:col, "fill-opacity":.72,
      stroke:"#fff", "stroke-width":.5, "stroke-opacity":.5}));
  });

  /* ---- depth guides and the all-important front edge ---- */
  [[1/3,"MIDDLE"],[2/3,"FRONT"]].forEach(function(gd){
    g.appendChild(n("line", {x1:0, y1:(Hpx*gd[0]).toFixed(1), x2:PX, y2:(Hpx*gd[0]).toFixed(1),
      stroke:"#3d4838", "stroke-width":.7, "stroke-opacity":.22, "stroke-dasharray":"5 5"}));
  });
  [["BACK",1/6],["MIDDLE",1/2],["FRONT",5/6]].forEach(function(b){
    var t = n("text", {x:-8, y:(Hpx*b[1]+3).toFixed(1), "text-anchor":"end",
      "font-size":8.5, "font-family":"sans-serif", "letter-spacing":".08em",
      fill:"#6b7566"}); t.textContent = b[0]; g.appendChild(t);
  });
  g.appendChild(n("rect", {x:0, y:0, width:PX, height:Hpx, fill:"none",
    stroke:"#8d9685", "stroke-width":1.6, rx:3}));

  /* ---- numbers ---- */
  /* Numbers must stay legible in the smallest patch, so the size has a floor and only
     grows a little with area. A cramped number is useless, and slight overflow of a tiny
     drift is much less of a problem than a number nobody can read. */
  geo.labels.forEach(function(cp){
    var e = geo.ent[cp.owner], x = cp.cx*cw, y = cp.cy*ch;
    var frac = cp.size/geo.n;
    var fs = frac >= 0.06 ? 15 : frac >= 0.02 ? 13.5 : 12.5;
    var r = fs*0.76;
    g.appendChild(n("circle", {cx:x.toFixed(1), cy:y.toFixed(1), r:r,
      fill:"#fffdf7", "fill-opacity":.93, stroke:tint(e.col,-0.35), "stroke-width":1.1}));
    var t = n("text", {x:x.toFixed(1), y:(y+fs*0.35).toFixed(1), "text-anchor":"middle",
      "font-size": fs.toFixed(1), "font-weight":"700", "font-family":"sans-serif",
      fill:"#1b2017"});
    t.textContent = String(e.num);
    g.appendChild(t);
  });

  /* ---- front-edge caption, scale bar ---- */
  var fy = Hpx + 15;
  var arrow = n("path", {d:"M0,"+fy+"h"+(PX*0.30).toFixed(1), stroke:"#6b7566",
    "stroke-width":1, fill:"none"});
  g.appendChild(arrow);
  var ft = n("text", {x:(PX*0.31).toFixed(1), y:fy+3.5, "font-size":9.5,
    "font-family":"sans-serif", fill:"#4a5545", "font-weight":"600"});
  ft.textContent = "FRONT EDGE \u2014 the side you stand on to look at the bed";
  g.appendChild(ft);

  var barFt = c.l >= 24 ? 5 : (c.l >= 10 ? 2 : 1);
  var bx = PX - barFt*pxPerFt, by = Hpx + 27;
  g.appendChild(n("path", {d:"M"+bx.toFixed(1)+","+by+"h"+(barFt*pxPerFt).toFixed(1),
    stroke:"#4a5545", "stroke-width":1.6, fill:"none"}));
  g.appendChild(n("path", {d:"M"+bx.toFixed(1)+","+(by-3)+"v6M"+PX+","+(by-3)+"v6",
    stroke:"#4a5545", "stroke-width":1.2, fill:"none"}));
  var st = n("text", {x:(bx-6).toFixed(1), y:by+3.5, "text-anchor":"end",
    "font-size":9, "font-family":"sans-serif", fill:"#4a5545"});
  st.textContent = barFt+" "+(barFt===1?"foot":"feet");
  g.appendChild(st);

  /* ---- wrapper, legend ordered back to front ---- */
  var wrap = mk("div","plan");
  wrap.appendChild(mk("h4", null, "Planting plan \u2014 "+c.l+" feet \u00d7 "+c.w+
    " feet ("+(c.l*c.w)+" square feet)"));
  wrap.appendChild(svg);

  var lg = mk("div","legend");
  var ORD = {STRUCT:0,SHRUB:1,SEASONAL:2,FERN:3,GRASS:4,MATRIX:5,FILLER:6};
  geo.ent.slice().sort(function(a,b){
    if(ORD[a.row.layer] !== ORD[b.row.layer]) return ORD[a.row.layer]-ORD[b.row.layer];
    return b.p.hmax-a.p.hmax;
  }).forEach(function(e){
    var fw = flowerWords(e.p);
    var sp = mk("span");
    sp.innerHTML = "<i style='background:"+e.col+"'></i><b>"+e.num+".</b> "+esc(e.p.common)+
      " <span class='layerTag "+e.row.layer+"'>"+LAYER_SHORT[e.row.layer]+"</span>"+
      " <span class='lh'>"+heightPhrase(e.p)+(fw? ", "+esc(fw):"")+"</span>";
    lg.appendChild(sp);
  });
  wrap.appendChild(lg);
  var key = mk("div","plankey");
  key.innerHTML = "<b>Colours show what each plant is for</b>, and match the Layer column in the "+
    "table above. Plants doing the same job share a colour, so the numbers are what identify an "+
    "individual species.";
  wrap.appendChild(key);

  var note = mk("div","muted small");
  note.innerHTML = "Every part of the bed is assigned to a species, so there is no bare ground to "+
    "account for: the groundcover layer is drawn filling the gaps between the taller plants, which "+
    "is exactly how it should be planted. Tallest species sit along the back edge and the shortest "+
    "along the front. Numbers match the plant table"+
    (dotTotal ? ", and each dot is one plant at its recommended spacing" : "")+
    ". Treat the shapes as drifts to copy freehand, not as a survey.";
  note.style.marginTop = "7px";
  wrap.appendChild(note);
  return wrap;
}

/* =========================================================================
   WHAT THE PLANT LOOKS LIKE
   Two complementary answers, neither of which costs anything to load.

   1. A generated one-line description of habit, height, flower colour and season.
      This is instant, works offline, and is often more useful than a photograph
      for deciding whether a plant suits a position.
   2. Outbound links to two photo libraries. No images are stored or hot-linked by
      this site, so the page weight is unchanged: the Wildflower Center gives
      curated horticultural photographs alongside a full profile, and iNaturalist
      gives many photographs of the plant growing in the wild, which is a more
      honest picture of how it will actually look.
   ========================================================================= */
var FORM_TEXT = {
  mound:"a rounded, bushy mound", spike:"an upright plant carrying flower spikes",
  mat:"a flat, ground-hugging mat", upright:"a stiff, erect clump",
  daisy:"a bushy clump topped with daisy flowers",
  arching:"an arching, fountain-like clump",
  bold:"a big, coarse-textured plant with large leaves",
  airy:"an airy, see-through plant on fine stems",
  tuft:"a small grassy tuft", fountain:"a fountain of fine foliage",
  fine:"a finely textured, almost ferny plant",
  spreading:"a low, wide-spreading plant",
  umbel:"upright stems topped with flat clusters of tiny flowers",
  vase:"a vase-shaped clump of fronds",
  flat:"upright stems with flat-topped flower heads",
  strappy:"a fan of strap-like leaves", spiky:"a stiff, spiky architectural rosette",
  trailing:"a trailing plant that sprawls over the ground",
  rosette:"a symmetrical rosette", thimble:"slender stems with thimble-shaped flower heads",
  haze:"a low plant that flowers in a fine coloured haze",
  palm:"a fan-leaved palm", stiff:"a stiff, erect clump",
  panicle:"an upright clump with broad flower clusters",
  spire:"a tall flowering spire", tubular:"a clump carrying tubular flowers",
  coarse:"a coarse-textured, spreading plant", tussock:"a dense grassy tussock",
  mallow:"a low plant with open, cup-shaped flowers"
};
/* Bloom season in full words, because "Aug-Sep" reads as an abbreviation. */
function bloomWords(p){
  if(!p.bloom_months.length) return "";
  var a = MONTHNAMES[p.bloom_start-1], b = MONTHNAMES[p.bloom_end-1];
  if(a === b) return "in "+a;
  if(p.bloom_end - p.bloom_start === 1) return "in "+a+" and "+b;
  if(p.bloom_months.length >= 10) return "for most of the year";
  return "from "+a+" to "+b;
}
function appearance(p){
  var form = FORM_TEXT[p.form] || "a clump-forming plant";
  var out = heightPhrase(p)+" tall, "+form;
  var fw = flowerWords(p), when = bloomWords(p);
  /* grasses and sedges are grown for their seedheads, not for flowers */
  var grassy = (p.family === "Poaceae" || p.family === "Cyperaceae");
  if(fw && when) out += ", with "+fw+" "+(grassy ? "seedheads" : "flowers")+" "+when;
  else if(p.wildlife.indexOf("evergreen") >= 0) out += ", grown for its evergreen foliage";
  else out += ", grown for its foliage";
  return out+".";
}
function photoLinks(p){
  var q = encodeURIComponent(p.sci);
  return "<a href='https://www.wildflower.org/plants/search.php?search_field="+q+
    "' target='_blank' rel='noopener'>photos &amp; full profile</a> \u00b7 "+
    "<a href='https://www.inaturalist.org/search?q="+q+
    "' target='_blank' rel='noopener'>photos in the wild</a>";
}

/* Heights, always with the unit spelled out. Small plants stay in inches;
   anything reaching 2 feet or more is quoted in feet, which is how people think. */
function heightPhrase(p){
  function feet(inch){ var v = Math.round(inch/12*2)/2; return (v%1 ? v.toFixed(1) : v.toFixed(0)); }
  if(p.hmax < 24)
    return p.hmin===p.hmax ? p.hmax+" inches" : p.hmin+"\u2013"+p.hmax+" inches";
  if(p.hmin < 12)
    return p.hmin+" inches to "+feet(p.hmax)+" feet";
  return (feet(p.hmin)===feet(p.hmax) ? feet(p.hmax) : feet(p.hmin)+"\u2013"+feet(p.hmax))+" feet";
}

/* Spacing in plain language: inches, plus the feet equivalent once it gets large. */
function spacingPhrase(p){
  var s = p.spacing;
  if(s < 24) return s+" inches apart";
  var ft = Math.round(s/12*2)/2;
  return s+" inches apart (about "+(ft%1 ? ft.toFixed(1) : ft.toFixed(0))+" feet)";
}

/* =========================================================================
   ZONE CALENDAR
   Typical frost dates and the spring cut-back window, by USDA zone. These are
   broad regional averages: the interface always sends the user to a real
   frost-date lookup for their own ZIP code rather than relying on these.
   ========================================================================= */
var ZONE_CAL = {
 2:{cut:"early to mid May",          last:"late May to early June", first:"early September",
    fall:"late July to mid August",  spring:"late May to late June"},
 3:{cut:"late April to mid May",     last:"mid to late May",        first:"mid September",
    fall:"early to late August",     spring:"mid May to late June"},
 4:{cut:"mid to late April",         last:"mid May",                first:"late September",
    fall:"mid August to mid September", spring:"mid May to mid June"},
 5:{cut:"early to mid April",        last:"early May",              first:"early October",
    fall:"late August to early October", spring:"early May to early June"},
 6:{cut:"late March to mid April",   last:"late April",             first:"mid October",
    fall:"September to mid October", spring:"mid April to late May"},
 7:{cut:"mid to late March",         last:"mid April",              first:"late October",
    fall:"September to late October", spring:"early April to mid May"},
 8:{cut:"early to mid March",        last:"late March",             first:"mid November",
    fall:"October to late November", spring:"March to mid April"},
 9:{cut:"late February to early March", last:"late February",       first:"early December",
    fall:"October to December",      spring:"February to March"},
10:{cut:"February",                  last:"frost is rare",          first:"frost is rare",
    fall:"November to January",      spring:"January to February"},
11:{cut:"January to February",       last:"essentially frost-free", first:"essentially frost-free",
    fall:"November to February",     spring:"February"},
12:{cut:"January",                   last:"frost-free",             first:"frost-free",
    fall:"November to February",     spring:"February"},
13:{cut:"January",                   last:"frost-free",             first:"frost-free",
    fall:"November to February",     spring:"February"}
};

/* When to plant. Autumn beats spring nearly everywhere, because roots grow while the top
   is dormant and the plant meets its first summer already anchored. The exceptions are
   real, though, and they run in opposite directions: in the coldest zones an unrooted
   autumn planting gets heaved out of the ground by frost, while in the summer-dry West
   a spring planting commits you to irrigating all summer. */
function plantSeason(c){
  var cal = zoneCal(c.zone), z = c.zone || 6, reg = c.region;
  var medit = (reg === "CA" || reg === "PNW");
  var desert = (reg === "SW");
  var cold = z <= 4;

  if(medit) return {
    best:"Autumn, as soon as the first steady rains arrive \u2014 roughly "+cal.fall+".",
    alt:"Late winter is a workable second choice. Avoid spring and summer entirely.",
    why:"This is the single most important decision you will make with these plants. The "+
      "native flora here grows through the wet winter and sleeps through the dry summer, so "+
      "autumn planting lets the winter rains do the establishment watering for you. Plant in "+
      "spring and you commit yourself to irrigating all summer, which is what kills "+
      "drought-adapted natives more often than drought ever does."};
  if(desert) return {
    best:"Autumn, about "+cal.fall+", once the worst heat has broken.",
    alt:"The summer monsoon, if your area gets one, is the other good window: plant into moist "+
      "ground in July or August and the rains establish it for you.",
    why:"Autumn planting gives roots the whole cool season to grow before the first brutal "+
      "summer. Avoid planting from April to June, when a new plant cannot take up water fast "+
      "enough to replace what the heat pulls out of it."};
  if(cold) return {
    best:"Spring, after the last hard frost \u2014 roughly "+cal.spring+".",
    alt:"Late summer, around "+cal.fall+", also works, but it must be early enough that roots "+
      "grow in before the ground freezes.",
    why:"In a zone this cold, spring is the safer choice. A plant put in late in autumn has not "+
      "rooted enough to resist frost heave, and repeated freeze-and-thaw physically lifts the "+
      "crown out of the soil over winter. If you do plant in autumn, mulch after the ground "+
      "freezes, not before, to keep the soil temperature steady."};
  return {
    best:"Autumn, roughly "+cal.fall+" \u2014 about six weeks before your first hard frost, "+
      "which here is typically "+cal.first+".",
    alt:"Spring, around "+cal.spring+", is the good second choice and is when nurseries have "+
      "the widest selection.",
    why:"Autumn planting is better because the soil is still warm while the air is cooling, so "+
      "roots keep growing after the top has stopped, and the plant faces its first summer "+
      "already anchored. Avoid planting in midsummer heat unless you can commit to watering "+
      "every few days."};
}
function zoneCal(z){ return ZONE_CAL[Math.max(2, Math.min(13, z||6))]; }

/* --------------------------------------------------------------------------
   MAINTENANCE CLASSES
   Each class gets its own instruction, so the site never tells you to cut back
   a shrub or mow an agave. p.care is assigned in build_data.py.
   -------------------------------------------------------------------------- */
var CARE_TEXT = {
  perennial: function(cal){ return {
    title:"Herbaceous perennials \u2014 cut back in spring, never in autumn",
    body:"Leave every stem standing all winter. In "+cal.cut+", cut the dead stems down to "+
         "8\u201312 inches and leave those stubs in place: native bees nest inside hollow stems, "+
         "and the new growth hides them within a month. Rake the cut material into a loose pile "+
         "in a corner for a few weeks so anything still inside can get out, then compost it.",
    water:"Average. Through the first season give the equivalent of about an inch of water a week when "+
           "it has not rained. Once established most need nothing in an ordinary summer, and a deep soak "+
           "every two or three weeks carries them through a drought."}; },
  evergreen_perennial: function(cal){ return {
    title:"Evergreen perennials \u2014 tidy only, do not cut to the ground",
    body:"These hold living leaves through winter and will be slow to recover if sheared hard. "+
         "In "+cal.cut+", pull or snip out only the dead and blackened leaves. Cut the spent "+
         "flower stems off at the base. Every third year you can shear the top third to force "+
         "fresh growth from the crown.",
    water:"Average, but do not let them go bone dry in winter. Evergreen leaves keep losing water in "+
           "cold weather, so in a long dry winter spell give them one soak while the ground is unfrozen."}; },
  grass_warm: function(cal){ return {
    title:"Warm-season grasses \u2014 one hard cut a year",
    body:"These are the plants the phrase \u201ccut the bed back\u201d really applies to. Leave "+
         "them standing all winter for structure and seed, then in "+cal.cut+", before the new "+
         "shoots are more than an inch or two high, cut the whole clump to 4\u20136 inches. "+
         "Hedge shears or a string trimmer are fine. Cutting after growth starts leaves the "+
         "clump with brown tips all season.",
    water:"Low. Water weekly through the first summer only. After that these are among the most "+
           "drought-proof plants in the bed, and watering them does more harm than good: it makes the "+
           "clumps grow soft and flop open by late summer."}; },
  grass_cool: function(cal){ return {
    title:"Cool-season grasses \u2014 comb, do not cut hard",
    body:"These start growing while it is still cold and resent hard cutting. Do not shear them "+
         "to the ground. In late winter, rake your fingers up through the clump to comb out the "+
         "dead blades, and cut off the old flower stems. If a clump looks tired, take no more "+
         "than the top third.",
    water:"Low to average. These grow in the cool halves of the year, so water them in spring and "+
           "autumn dry spells rather than in midsummer, when many are naturally semi-dormant and resent "+
           "it."}; },
  sedge: function(cal){ return {
    title:"Sedges \u2014 leave alone most years",
    body:"The sedge carpet is the part of this planting that replaces mulch, so disturb it as "+
         "little as possible. Most years it needs nothing at all. If it accumulates brown "+
         "thatch, shear it to 3 inches in "+cal.cut+", or mow it on the highest mower setting, "+
         "once every second or third year only.",
    water:"Average. Sedges are shallow-rooted, so they show stress before anything else and make a "+
           "useful indicator for the whole bed. If the carpet starts to look dull or straw-tipped, the "+
           "bed wants water."}; },
  fern_deciduous: function(cal){ return {
    title:"Deciduous ferns \u2014 remove old fronds before the new ones uncurl",
    body:"The fronds collapse over winter and protect the crown, so leave them. Cut them off at "+
         "the base in "+cal.cut+", before the new fiddleheads unroll. Once the fiddleheads are "+
         "up, cutting anywhere near them damages the whole season's growth.",
    water:"The highest need in the bed. Ferns have little ability to hold water and crisp irreversibly "+
           "once they dry out. Keep the soil evenly damp but never waterlogged, and water in any dry "+
           "spell longer than about ten days, even years later."}; },
  fern_evergreen: function(cal){ return {
    title:"Evergreen ferns \u2014 remove only the fronds that have actually died",
    body:"Do not cut these to the ground; the old fronds are still feeding the plant. When the "+
         "new fiddleheads appear in "+cal.cut+", snip off just the fronds that are flattened, "+
         "brown or broken, cutting each one at the base.",
    water:"Moderate to high, and continuing into winter, because they keep their fronds all year and "+
           "still lose water in cold weather. A layer of leaf litter over the root zone does more for "+
           "them than extra watering."}; },
  shrub_spring: function(cal){ return {
    title:"Spring-flowering shrubs \u2014 prune right after they bloom, or not at all",
    body:"Never cut these back with the perennials: the flower buds for next spring form on this "+
         "year's wood over summer, so a late-winter cut removes the entire display. Most need no "+
         "pruning at all. When one outgrows its space, prune within a few weeks of the flowers "+
         "fading: remove whole stems at the base rather than shearing the outline.",
    water:"Deep and infrequent, for two full years. Give each shrub a long slow soak at the root ball "+
           "once a week through its first two summers rather than a light sprinkle, so the water reaches "+
           "the bottom of the roots. After that, only in real drought."}; },
  shrub_summer: function(cal){ return {
    title:"Summer and autumn-flowering shrubs \u2014 prune in late winter if at all",
    body:"These flower on growth they make in the same season, so any shaping is done in "+
         cal.cut+", before the buds break. Long-blooming subshrubs such as autumn sage can be "+
         "cut back by a third to a half then to keep them dense rather than woody and open. "+
         "Take out dead wood at the base whenever you see it.",
    water:"Deep and infrequent for two full years, then rarely. Water at the base, not over the "+
           "foliage. Shrubs are lost to shallow, frequent watering more often than to too little: the "+
           "roots stay in the top inch or two and never anchor."}; },
  rosette: function(cal){ return {
    title:"Agaves, yuccas and other rosettes \u2014 never cut back",
    body:"There is no cutting back, ever. Cutting the leaves destroys the shape permanently, "+
         "because each rosette grows from a single central point. Pull off only the dry, papery "+
         "lower leaves, and saw the spent flower stalk off near the base once it has dried. Keep "+
         "mulch and groundcover pulled back from the crown so water drains away from it.",
    water:"Almost none, and overwatering is the real danger. Water once a month in the first summer "+
           "only, then leave them to the rain. Never let water stand in the centre of a rosette, and "+
           "never run an irrigation line to one."}; },
  palm: function(cal){ return {
    title:"Palms and cycads \u2014 remove dead fronds only",
    body:"Never cut into the crown or remove green fronds; the plant cannot regrow a damaged "+
         "growing point. Cut off fully brown fronds close to the trunk at any time of year. Leave "+
         "the fruit for wildlife.",
    water:"Moderate while young, then low. Water weekly through the first two summers to establish "+
           "them, after which they are largely self-sufficient. Water the root zone, never into the "+
           "crown."}; },
  ephemeral: function(cal){ return {
    title:"Plants that go dormant \u2014 leave them alone and mark where they are",
    body:"These disappear completely for part of the year. That is normal and does not mean they "+
         "have died. Push a labelled stake in beside each one before it fades, so you do not "+
         "weed, dig or plant into the crown while it is invisible. Never water a summer-dormant "+
         "plant to try to revive it.",
    water:"Only while they are visibly in growth. Once the leaves yellow and the plant goes dormant, "+
           "stop completely, because watering a dormant crown rots it. This is why everything planted "+
           "around them has to tolerate the same dry rest."}; },
  subshrub: function(cal){ return {
    title:"Woody-based subshrubs \u2014 trim, never cut into the old wood",
    body:"These look like perennials but are built like tiny shrubs, and they regrow from their "+
         "woody stems rather than from the crown. Cutting them to the ground usually kills them. "+
         "In "+cal.cut+", shorten the previous year's growth by about a third, always leaving "+
         "green growth or live buds below your cut. Replace them every five to eight years as "+
         "they go woody and open at the base.",
    water:"Low, and sharp drainage matters more than water ever does. Soak once a week through the "+
           "first summer, then stop almost completely. These rot at the crown in soil that stays damp, "+
           "which is the usual way they are killed."}; },
  perennial_low: function(cal){ return {
    title:"Low perennials and mats \u2014 a light shear, not a cut-back",
    body:"These are too short to have stems worth leaving, so the stem-nesting advice does not "+
         "apply. In "+cal.cut+", run hand shears over them to take off the dead top growth, down "+
         "to roughly 2\u20133 inches, and pull out any flattened brown leaves by hand. Never cut "+
         "into the woody centre of a mat-former, and never bury the crown in mulch.",
    water:"Low to average, but check these first in hot weather. Small root systems near the surface "+
           "dry out before anything else in the bed. Water the soil rather than the foliage, and keep "+
           "mulch off the crowns so they do not rot."}; },
  selfsower: function(cal){ return {
    title:"Self-sowing fillers \u2014 decide where the seedlings go",
    body:"These are short-lived by design and carry the bed while the slower plants fill in. Let "+
         "the seedheads stand through winter for the birds. In "+cal.cut+", shake the stems over "+
         "any gap you want colonised, then cut them down. Through the season, pull seedlings out "+
         "of the places you do not want them while they are still small.",
    water:"Low. Water enough in the first few weeks to get them going, then leave them alone. Plants "+
           "kept slightly lean set more seed, which for this layer is the whole point."}; }
};
var CARE_ORDER = ["rosette","palm","shrub_spring","shrub_summer","subshrub","fern_evergreen",
  "fern_deciduous","sedge","grass_cool","grass_warm","evergreen_perennial","perennial",
  "perennial_low","ephemeral","selfsower"];

/* one-line jobs pulled from the notes, keyed by the flags build_data.py extracted */
var FLAG_JOBS = {
  chelsea: function(list){ return "<b>Cut by half in early June:</b> "+list+". This is the one "+
    "summer job that matters. Shortening these before they flower keeps them self-supporting, so "+
    "you never need stakes."; },
  pinch: function(list){ return "<b>Pinch out the growing tips twice before July:</b> "+list+
    ". Without this they grow tall and lean over by late summer."; },
  deadhead: function(list){ return "<b>Deadhead through the season to extend flowering:</b> "+list+
    ". Stop in late summer and let the last flush set seed for the birds."; },
  shear: function(list){ return "<b>Shear lightly after the first flush of flower:</b> "+list+
    ". Taking off the top few inches usually brings a second bloom."; },
  coppice: function(list){ return "<b>Cut a third of the oldest stems to the ground each spring:</b> "+
    list+". Only new wood colours well, so this is what keeps the winter stems bright."; },
  taproot: function(list){ return "<b>Plant once and never move:</b> "+list+". These make a deep "+
    "taproot and rarely survive being dug up and relocated. Buy them small."; },
  late_emerger: function(list){ return "<b>Slow to appear in spring:</b> "+list+". Mark the "+
    "position with a stake so the bare patch is not weeded, dug or replanted before it wakes up."; },
  cut_after_flower: function(list){ return "<b>Cut back to the basal leaves after flowering:</b> "+
    list+". The foliage goes shabby once the flowers finish, and it regrows cleanly."; },
  sharp_drainage: function(list){ return "<b>Must have sharp drainage \u2014 these rot in damp "+
    "soil:</b> "+list+". If your bed holds water after rain, plant these on a slight mound or mix "+
    "a few inches of grit into their planting holes. Keep mulch off their crowns entirely, and "+
    "water them less often than the rest of the bed."; },
  no_summer_water: function(list){ return "<b>Do not water in summer once established:</b> "+list+
    ". Summer irrigation causes root rot in these species. This is the single most common way "+
    "they are killed in gardens."; },
  acid_soil: function(list){ return "<b>Needs acid soil:</b> "+list+". Test the bed first. If "+
    "your pH is above about 6.0, substitute something else rather than fighting the soil."; },
  aggressive: function(list){ return "<b>Spreads and will need editing:</b> "+list+". Walk the "+
    "edges once each spring and pull back anything that has moved further than you want. This is "+
    "five minutes of work if done annually, and a rescue job if left for three years."; }
};

/* --------------------------------------------------------------------------
   STEP-BY-STEP LAYOUT
   -------------------------------------------------------------------------- */
function renderLayout(combo, c){
  var wrap = mk("div");
  var area = c.l*c.w, total = 0, byLayerMap = {};
  combo.rows.forEach(function(r){
    total += r.qty;
    (byLayerMap[r.layer] = byLayerMap[r.layer] || []).push(r);
  });

  wrap.appendChild(mk("h5", null, "Design intent"));
  wrap.appendChild(mk("p", null, combo.t.design));

  /* Timing comes first: it is the one decision that cannot be corrected later. */
  var ps = plantSeason(c), cal = zoneCal(c.zone);
  wrap.appendChild(mk("h5", null, "When to plant \u2014 zone "+c.zone+", "+
    REGIONS[c.region].name));
  var seasonBox = mk("div","seasonbox");
  seasonBox.innerHTML =
    "<div class='sb-row'><span class='sb-k'>Best window</span><span class='sb-v'>"+
      ps.best+"</span></div>"+
    "<div class='sb-row'><span class='sb-k'>Second choice</span><span class='sb-v'>"+
      ps.alt+"</span></div>"+
    "<div class='sb-row'><span class='sb-k'>Why it matters</span><span class='sb-v'>"+
      ps.why+"</span></div>"+
    "<div class='sb-row'><span class='sb-k'>Your frost dates</span><span class='sb-v'>"+
      "Last spring frost is typically <b>"+cal.last+"</b> and first autumn frost <b>"+cal.first+
      "</b> in zone "+c.zone+". These are regional averages \u2014 look up your own at "+
      "<a href='https://www.almanac.com/gardening/frostdates' target='_blank' rel='noopener'>"+
      "frost dates by ZIP code</a>, and treat your state Cooperative Extension planting "+
      "calendar as the final word.</span></div>"+
    "<div class='sb-row'><span class='sb-k'>Buying</span><span class='sb-v'>Order plugs or "+
      "quart pots in late winter for autumn delivery, since good native nurseries sell out of "+
      "the better species months ahead. Small plants establish faster than large ones and cost "+
      "a fraction as much \u2014 resist buying the biggest pot available.</span></div>";
  wrap.appendChild(seasonBox);

  wrap.appendChild(mk("h5", null, "Step by step"));
  var ol = mk("ol","steps"); ol.style.paddingLeft = "20px";
  function step(html){ var li = mk("li"); li.innerHTML = html; ol.appendChild(li); }

  var lean = (combo.t.id === "gravel_jewels" || combo.t.id === "hellstrip");
  var density = (total/area >= 1)
    ? "about "+(total/area).toFixed(1)+" plants per square foot"
    : "about one plant for every "+(area/total).toFixed(1)+" square feet";

  step("<b>Clear the ground and leave the soil alone.</b> Kill or strip the existing turf and "+
    "weeds completely \u2014 smother it under cardboard for a season, or lift the sod. Loosen only "+
    "the top 2\u20133 inches so you can get a trowel in. "+
    (lean ? "<b>Do not add compost, topsoil or fertiliser.</b> Every plant in this design needs "+
            "lean, sharp-draining ground, and enriching the soil is what kills them."
          : "Do not add fertiliser, and do not dig in compost deeper than a couple of inches. "+
            "These are species adapted to ordinary unimproved soil; rich beds make them grow soft "+
            "and flop.")+
    " This bed is "+c.l+" feet by "+c.w+" feet, which is "+area+" square feet and takes <b>"+
    total+" plants</b> of "+combo.rows.length+" species, "+density+".");

  step("<b>Look each plant up before you buy it.</b> Every species in the table above carries "+
    "two photo links \u2014 one to the Lady Bird Johnson Wildflower Center for curated "+
    "photographs and a full profile, one to iNaturalist for photographs of the plant growing "+
    "wild, which shows you honestly how it will look rather than how a catalogue stages it. "+
    "Check the habit and the mature size against the space you have, because the commonest "+
    "regret with a native bed is a plant that turns out twice the size the label implied.");

  step("<b>Mark the front edge.</b> Everything below depends on knowing which side you look at "+
    "the bed from. Lay a hose or string along that edge; the plan above is drawn with the front "+
    "edge along the bottom. If the bed is an island you can walk all the way around, treat the "+
    "long centre line as the \u201cback\u201d and mirror the tall plants out toward both faces.");

  step("<b>Mark out the drifts before you plant anything.</b> Copy the shapes from the plan onto "+
    "the ground freehand with a line of flour, sand or marking paint. Do not measure them: they "+
    "are meant to be irregular. Stand back and look from the front edge, and from a window if the "+
    "bed is seen from indoors, before you commit. <b>Every spacing given below is centre to "+
    "centre</b> \u2014 measured from the middle of one plant to the middle of the next, not from "+
    "leaf to leaf, and not the width of the gap between them.");

  var ORDER = [["STRUCT","the tall structure"],["SHRUB","the shrub backbone"],
               ["SEASONAL","the flowering drifts"],["FERN","the ferns"],
               ["GRASS","the matrix grass"],["MATRIX","the groundcover carpet"],
               ["FILLER","the self-sowing fillers"]];
  var placed = 0;
  ORDER.forEach(function(pair){
    var lay = pair[0], rowsIn = byLayerMap[lay];
    if(!rowsIn || !rowsIn.length) return;
    var ground = !!GROUND_LAYERS[lay];
    var items = rowsIn.map(function(r){
      var how;
      if(ground){
        how = ", planted continuously across the ground rather than in clumps";
      } else if(r.qty >= 5){
        var drifts = Math.max(1, Math.min(5, Math.round(r.qty/6)));
        var per = Math.max(1, Math.round(r.qty/drifts));
        how = drifts === 1 ? ", as one drift of about "+per+" plants"
                           : ", in "+drifts+" separate drifts of about "+per+" plants each";
      } else if(r.qty === 1){
        how = ", as a single specimen";
      } else {
        how = ", as "+r.qty+" individual plants, set well apart rather than in a clump";
      }
      return "<li style='margin:3px 0'><b>"+r.qty+" \u00d7 "+esc(r.p.common)+"</b> "+
        "<span class='muted'>(<em>"+esc(r.p.sci)+"</em>, "+heightPhrase(r.p)+")</span> \u2014 "+
        spacingPhrase(r.p)+how+".</li>";
    }).join("");

    var lead;
    if(lay === "STRUCT" || lay === "SHRUB"){
      lead = "<b>Set out "+pair[1]+" first, along the back third.</b> These are the biggest plants "+
        "and everything else is arranged around them, so position them before anything goes in the "+
        "ground. Space them so that at maturity their canopies just touch. Stand each pot in place, "+
        "look from the front, and adjust before you dig.";
    } else if(lay === "SEASONAL"){
      lead = "<b>Now place "+pair[1]+", working from tallest to shortest.</b> Each species goes in "+
        "as a long tapering drift rather than a round blob or a single dot, and the drift should "+
        "run along the length of the bed. Keep the shorter species toward the front so nothing is "+
        "hidden. Repeat at least one species in two or three separate places \u2014 that repetition "+
        "is what makes a planting read as deliberate.";
    } else if(lay === "FERN"){
      lead = "<b>Place "+pair[1]+" in loose groups of three to seven.</b> Tuck them where they will "+
        "be shaded in the afternoon, and against the base of taller plants rather than out in the "+
        "open.";
    } else if(lay === "GRASS"){
      lead = "<b>Plant "+pair[1]+" through and between everything you have already set out.</b> "+
        "This is the connective tissue of the planting: it should weave past the flowering drifts "+
        "rather than sit in a separate block of its own.";
    } else if(lay === "MATRIX"){
      lead = "<b>Carpet the remaining ground with "+pair[1]+" \u2014 this is the step that gets "+
        "skipped, and the one that decides whether the bed succeeds.</b> Plant it across the whole "+
        "bed, right up to the crowns of everything already planted and all the way to the front "+
        "edge, so that <b>no bare soil is left anywhere</b>. On the plan this is the layer filling "+
        "every gap between the taller drifts. A closed green carpet is what suppresses weeds and "+
        "means you never have to buy mulch again.";
    } else {
      lead = "<b>Finally, scatter "+pair[1]+" into the gaps.</b> Tuck them wherever there is still "+
        "a hole. They are short-lived on purpose: they cover bare ground for the first two seasons "+
        "while the permanent plants knit together, then fade out as the bed closes.";
    }
    rowsIn.forEach(function(r){ placed += r.qty; });
    step(lead + "<ul style='margin:7px 0 0;padding-left:18px;list-style:disc'>"+items+"</ul>");
  });

  step("<b>Plant, then water in hard.</b> Set every plant at exactly the depth it was in its pot "+
    "\u2014 burying the crown is the most common cause of losses. Firm the soil around each one and "+
    "water immediately and generously, enough to settle the soil right down through the root ball. "+
    "Autumn planting establishes better than spring almost everywhere, because the roots grow while "+
    "the top is dormant.");

  step("<b>Mulch thinly, once, and only this year.</b> "+
    (lean ? "Top the whole bed with 2\u20133 inches of clean gravel or coarse grit, keeping it "+
            "clear of the plant crowns. Never use bark or compost on this design."
          : "Put down no more than 1\u20132 inches of leaf mould or fine bark, only in the gaps "+
            "between the plants, and keep it off the crowns. This is a one-off to get you through "+
            "the first year; from the second year the groundcover layer is your mulch.")+
    " After that, resist the annual urge to re-mulch: a fresh layer every spring smothers the "+
    "self-sowers and the groundcover, and it is the reason many native beds never fill in.");

  wrap.appendChild(ol);
  return wrap;
}

/* --------------------------------------------------------------------------
   MAINTENANCE, GENERATED FROM WHAT IS ACTUALLY IN THE BED
   -------------------------------------------------------------------------- */
function renderCare(combo, c){
  var wrap = mk("div"), cal = zoneCal(c.zone);

  wrap.appendChild(mk("h5", null, "Maintenance philosophy"));
  wrap.appendChild(mk("p", null, combo.t.care));

  wrap.appendChild(mk("h5", null, "Your calendar \u2014 zone "+c.zone));
  var calBox = mk("div","calendarbox");
  calBox.innerHTML =
    "<ul style='margin:0;padding-left:18px'>"+
    "<li><b>Main cut-back window: "+cal.cut+".</b> Wait as late as you can bear. The signal is "+
      "several consecutive days near 50\u00b0F, when insects are leaving the old stems and the "+
      "first new shoots show at the base.</li>"+
    "<li>Typical last spring frost here: <b>"+cal.last+"</b>. Typical first autumn frost: <b>"+
      cal.first+"</b>.</li>"+
    "<li><b>Cut nothing in autumn.</b> The dead stems and seedheads are the winter habitat and "+
      "the bird food, and they are most of what this planting is for.</li>"+
    "<li>These are regional averages for zone "+c.zone+". Look up your own dates: "+
      "<a href='https://www.almanac.com/gardening/frostdates' target='_blank' rel='noopener'>"+
      "frost dates by ZIP code</a> \u00b7 "+
      "<a href='https://www.ncei.noaa.gov/products/land-based-station/us-climate-normals' "+
      "target='_blank' rel='noopener'>NOAA climate normals</a> \u00b7 or search for your state's "+
      "Cooperative Extension planting calendar, which is the most locally accurate of the three.</li>"+
    "</ul>";
  wrap.appendChild(calBox);

  /* --- group the actual plants by maintenance class --- */
  var groups = {};
  combo.rows.forEach(function(r){
    /* "cut to 8-12 inches" is nonsense for a plant that is only 6 inches tall, so
       short herbaceous perennials get their own, shorter instruction */
    var key = (r.p.care === "perennial" && r.p.hmax < 24) ? "perennial_low" : r.p.care;
    (groups[key] = groups[key] || []).push(r.p); });

  wrap.appendChild(mk("h5", null, "What to do with each kind of plant in this bed"));
  var dl = mk("div","caregroups");
  CARE_ORDER.forEach(function(cls){
    if(!groups[cls] || !CARE_TEXT[cls]) return;
    var t = CARE_TEXT[cls](cal), box = mk("div","caregroup");
    var names = groups[cls].map(function(p){ return esc(p.common); }).join(", ");
    box.innerHTML = "<div class='ct'>"+t.title+"</div>"+
      "<div class='cs'>"+names+"</div><p>"+t.body+"</p>"+
      (t.water ? "<p class='wt'><b>Watering:</b> "+t.water+"</p>" : "");
    dl.appendChild(box);
  });
  wrap.appendChild(dl);

  /* --- species-specific jobs --- */
  var flagMap = {};
  combo.rows.forEach(function(r){
    r.p.care_flags.forEach(function(f){
      if(!FLAG_JOBS[f]) return;
      (flagMap[f] = flagMap[f] || []).push(r.p.common);
    });
  });
  var flagKeys = Object.keys(FLAG_JOBS).filter(function(f){ return flagMap[f]; });
  if(flagKeys.length){
    wrap.appendChild(mk("h5", null, "Jobs that apply only to particular species here"));
    var ul = mk("ul"); ul.style.paddingLeft = "20px";
    flagKeys.forEach(function(f){
      var li = mk("li"); li.style.marginBottom = "5px";
      li.innerHTML = FLAG_JOBS[f](flagMap[f].map(esc).join(", "));
      ul.appendChild(li);
    });
    wrap.appendChild(ul);
  }

  /* --- watering: the question the maintenance notes cannot answer on their own --- */
  wrap.appendChild(mk("h5", null, "How much to water"));
  var area = c.l*c.w;
  var galPerInch = Math.round(area*0.623);
  var dry = (c.soil === "D"), wet = (c.soil === "W");
  var wbox = mk("div","waterbox");
  var noSummer = combo.rows.filter(function(r){
    return r.p.care_flags.indexOf("no_summer_water") >= 0; })
    .map(function(r){ return esc(r.p.common); });
  var thirsty = combo.rows.filter(function(r){
    return r.p.moist.indexOf("W") >= 0 && r.p.moist.indexOf("D") < 0; })
    .map(function(r){ return esc(r.p.common); });

  wbox.innerHTML =
    "<div class='wb-hd'>The rule of thumb, in real numbers</div>"+
    "<ul>"+
    "<li><b>\u201cAn inch of water\u201d for this bed is about "+galPerInch+" gallons.</b> "+
      "One inch over one square foot is 0.62 gallons, and your bed is "+area+" square feet. "+
      "That is the figure to aim at in a week with no rain during the first season.</li>"+
    "<li><b>Measure it, do not guess.</b> Stand a straight-sided tin \u2014 a tuna or cat-food "+
      "can is ideal \u2014 in the bed while you water, and stop when it has an inch in it. That "+
      "tells you how long your hose or sprinkler needs, and you only have to do it once. A $5 "+
      "rain gauge then tells you how much of the week's inch the weather already supplied.</li>"+
    "<li><b>Check before watering.</b> Push a finger two inches into the soil. Damp means wait. "+
      "This single habit prevents most of the losses in a new bed, because "+
      "<b>overwatering kills more native plants than drought does</b> \u2014 constantly damp "+
      "soil suffocates and rots the roots.</li>"+
    "<li><b>Water deeply and rarely, never lightly and often.</b> One long soak drives roots "+
      "down; daily sprinkling keeps them in the top inch, where they die the first time you go "+
      "away for a fortnight. Water early in the morning, at the soil, not over the leaves.</li>"+
    "</ul>"+
    "<div class='wb-hd'>Schedule for "+
      (dry?"a dry bed":wet?"a moist or wet bed":"average soil")+"</div>"+
    "<ul>"+
    "<li><b>Weeks 1 to 2:</b> water every second or third day, whatever the season. Nothing has "+
      "roots outside its own root ball yet.</li>"+
    "<li><b>Weeks 3 to 8:</b> twice a week if it has not rained.</li>"+
    "<li><b>Rest of year 1:</b> "+(dry
        ? "one deep soak a week in hot weather, and skip it whenever the soil is damp two inches "+
          "down. Err on the dry side from the start."
        : wet
        ? "only when the low spot actually dries out. If the site holds water naturally, you may "+
          "never need to water at all."
        : "roughly that inch a week, counting rainfall, tapering off as autumn cools.")+"</li>"+
    "<li><b>Year 2:</b> "+(dry
        ? "a deep soak every three or four weeks during a heat wave, and otherwise nothing."
        : "a deep soak every two or three weeks during drought only. The bed should be largely "+
          "self-sufficient by now.")+"</li>"+
    "<li><b>Year 3 onward:</b> "+(dry
        ? "<b>stop watering entirely.</b> Continued summer irrigation is the main way "+
          "established dry-soil plantings are lost."
        : "water only in an exceptional drought, and even then only the ferns and the "+
          "moisture-lovers. Everything else should be on its own.")+"</li>"+
    "<li><b>New plants added later</b> start this schedule again from week one, even if the rest "+
      "of the bed needs nothing.</li>"+
    "</ul>"+
    (noSummer.length
      ? "<div class='wb-warn'><b>Never water these in summer once established:</b> "+
        noSummer.join(", ")+". Summer irrigation causes root rot in these species. If they share "+
        "the bed with thirstier plants, water the others by hand at the base rather than running "+
        "a sprinkler over the whole bed.</div>"
      : "")+
    (thirsty.length
      ? "<div class='wb-note'><b>These will want water first and show it soonest:</b> "+
        thirsty.join(", ")+". Use them as your indicator plants \u2014 when they wilt in the "+
        "evening rather than perking back up, the bed needs a soak.</div>"
      : "")+
    "<div class='wb-note'><b>If you install irrigation,</b> use drip line or soaker hose under "+
      "the planting rather than overhead spray. Overhead watering wets foliage, encourages "+
      "mildew on beebalm and phlox, and wastes most of the water to evaporation. Put it on a "+
      "manual valve, not a timer: a timer waters during rain, which is how beds drown.</div>";
  wrap.appendChild(wbox);

  /* --- establishment and long run --- */
  wrap.appendChild(mk("h5", null, "The first three years"));
  var ul2 = mk("ul"); ul2.style.paddingLeft = "20px";
  var waterLine = (c.soil === "D")
    ? "Water deeply once a week for the first summer only, then stop. These species fail from too "+
      "much water far more often than too little."
    : (c.soil === "W")
      ? "Water only if the low spot dries out in the first summer. From the second year the site "+
        "should look after itself."
      : "Water deeply once or twice a week through the first growing season, then taper off. "+
        "A long soak twice a week beats a daily sprinkle: it drives roots downward.";
  [ "<b>Year 1 \u2014 water and weed.</b> "+waterLine+" Weed every two or three weeks; the bed is "+
      "open now and weeds will out-run your plants if you let them seed.",
    "<b>Year 1 \u2014 expect it to look sparse.</b> It is supposed to. The plants are spaced to "+
      "close up, not to look finished on day one. Do not fill the gaps with extra plants, and do "+
      "not widen the spacing to make it look full sooner.",
    "<b>Year 2 \u2014 the groundcover closes.</b> Weeding drops sharply once the carpet knits. "+
      "Keep going round the edges, which is where new weeds arrive.",
    "<b>Year 3 and on \u2014 edit rather than maintain.</b> Move or remove what has overstepped, "+
      "shift seedlings you like into gaps, replace anything that died. Divide clump-forming grasses "+
      "every four or five years, in "+cal.cut+", once the centre of the clump goes hollow.",
    "<b>Never fertilise.</b> It produces soft, floppy growth, shortens the life of most of these "+
      "species, and feeds weeds more than plants.",
    "<b>Never use insecticide, including organic ones.</b> Bt and spinosad kill caterpillars, which "+
      "are the point of the bed. Chewed leaves are the planting working, not failing."
  ].forEach(function(h){ var li = mk("li"); li.style.marginBottom="5px"; li.innerHTML=h; ul2.appendChild(li); });
  wrap.appendChild(ul2);

  return wrap;
}

function renderCombo(combo, idx, c){
  var card=mk("div","combo"), head=mk("div","head"), h3=mk("h3");
  h3.innerHTML="<span class='num'>"+("0"+(idx+1)).slice(-2)+"</span>"+esc(combo.t.name)+
    (combo.variant>1 ? " <span class='muted' style='font-size:.8rem;font-weight:400'>variation "+
      combo.variant+"</span>" : "");
  head.appendChild(h3);
  head.appendChild(mk("div","tag",combo.t.tagline));
  var chips=mk("div","chips");
  function chip(t,cl){ chips.appendChild(mk("span","chip"+(cl?" "+cl:""),t)); }
  chip({S:"Full sun",P:"Part shade",H:"Full shade"}[c.light]);
  chip({D:"Dry soil",M:"Average soil",W:"Moist to wet"}[c.soil]);
  chip("Zone "+c.zone);
  chip(REGIONS[c.region].name);
  chip(combo.m.species+" species","g");
  chip(combo.m.plants+" plants","g");
  chip("~"+combo.m.lep+" caterpillar spp.","g");
  if(combo.m.sb) chip(combo.m.sb+" specialist-bee hosts","b");
  chip(combo.m.bloomMonths+" months of bloom","o");
  head.appendChild(chips); card.appendChild(head);

  var body=mk("div","body"), cols=mk("div","cols"), left=mk("div"), right=mk("div");
  var tbl=mk("table","plants"), tr=mk("tr");
  ["#","Layer","Plant","Bloom","Mature height","Qty","Spacing (centre to centre)"]
    .forEach(function(x){ tr.appendChild(mk("th",null,x)); });
  tbl.appendChild(tr);
  combo.rows.forEach(function(r,i){
    var p=r.p, row=mk("tr"), c0=mk("td");
    c0.innerHTML="<span class='qty'>"+(i+1)+"</span>"; row.appendChild(c0);
    var c1=mk("td");
    c1.innerHTML="<span class='layerTag "+r.layer+"'>"+LAYER_SHORT[r.layer]+"</span>";
    row.appendChild(c1);
    var c2=mk("td");
    c2.innerHTML="<span class='cn'>"+esc(p.common)+"</span><br><span class='sci muted'>"+
      esc(p.sci)+"</span> <span class='plinks'>"+photoLinks(p)+"</span>"+
      "<div class='look'>"+esc(appearance(p))+"</div>"+
      "<div class='why'>"+esc(whyText(p))+"</div>";
    row.appendChild(c2);
    row.appendChild(mk("td",null,bloomStr(p)));
    row.appendChild(mk("td",null,heightPhrase(p)));
    var c5=mk("td"); c5.innerHTML="<span class='qty'>"+r.qty+"</span>"; row.appendChild(c5);
    row.appendChild(mk("td",null,p.spacing+" inches"));
    tbl.appendChild(row);
  });
  left.appendChild(tbl);
  left.appendChild(renderPlan(combo,c));
  right.appendChild(renderScore(combo));
  right.appendChild(renderCalendar(combo));
  cols.appendChild(left); cols.appendChild(right); body.appendChild(cols);

  var det=mk("details","notes");
  det.appendChild(mk("summary",null,
    "How to lay this bed out, plant it and look after it \u2014 step by step"));
  var inner=mk("div","inner");
  inner.appendChild(renderLayout(combo, c));
  inner.appendChild(renderCare(combo, c));
  inner.appendChild(mk("h5",null,"Why it works ecologically"));
  inner.appendChild(mk("p",null,combo.t.eco));
  inner.appendChild(mk("h5",null,"Plant-by-plant notes"));
  var ul=mk("ul"); ul.style.paddingLeft="20px";
  combo.rows.forEach(function(r){
    var li=mk("li"); li.style.marginBottom="6px";
    var edge = c.zone > r.p.zmax ? " <strong>Zone "+c.zone+" is one step above its published limit "+
      "of "+r.p.zmax+": workable in most cases, but site it in the coolest part of the bed.</strong>" : "";
    li.innerHTML="<em>"+esc(r.p.sci)+"</em> (<b>"+esc(r.p.common)+"</b>) \u2014 "+
      esc(r.p.notes)+" <span class='muted'>Looks like: "+esc(appearance(r.p))+
      " Hardy in zones "+r.p.zmin+"\u2013"+r.p.zmax+"; family "+esc(r.p.family)+".</span> "+
      "<span class='plinks'>"+photoLinks(r.p)+"</span>"+edge;
    ul.appendChild(li);
  });
  inner.appendChild(ul); det.appendChild(inner); body.appendChild(det);
  card.appendChild(body);

  var foot=mk("div","foot");
  var b1=mk("button","btn ghost sm","Copy plant list");
  b1.onclick=function(){ copyText(comboText(combo,c), b1); };
  var b2=mk("button","btn ghost sm","Download CSV");
  b2.onclick=function(){ downloadCSV(comboCSV(combo,c), slug(combo.t.name)+"-"+c.zip+".csv"); };
  var b3=mk("button","btn ghost sm","Verify these species at BONAP");
  b3.onclick=function(){ window.open("http://bonap.net/napa","_blank","noopener"); };
  foot.appendChild(b1); foot.appendChild(b2); foot.appendChild(b3);
  card.appendChild(foot);
  return card;
}

/* ------------------------------------------------ export */
function comboText(combo,c){
  var out = combo.t.name+"\n"+combo.t.tagline+"\n\n"+
    "Site: ZIP "+c.zip+" | "+REGIONS[c.region].name+" | USDA zone "+c.zone+" | "+
    {S:"full sun",P:"part shade",H:"full shade"}[c.light]+" | "+
    {D:"dry",M:"average",W:"moist to wet"}[c.soil]+" soil | "+
    c.l+" x "+c.w+" ft ("+combo.area+" sq ft)\n\n";
  combo.rows.forEach(function(r,i){
    out += (i+1)+". "+r.qty+" x "+r.p.sci+" ("+r.p.common+") - "+LAYER_NAME[r.layer]+
      ", "+r.p.spacing+'" o.c., '+bloomStr(r.p)+"\n";
  });
  out += "\nTotals: "+combo.m.species+" species, "+combo.m.plants+" plants. ~"+combo.m.lep+
    " Lepidoptera species supported; "+combo.m.sb+" specialist-bee host species; bloom in "+
    combo.m.bloomMonths+" of 12 months; "+combo.m.groundPct+"% living groundcover.\n";
  return out;
}
function comboCSV(combo,c){
  var rows=[["design","layer","qty","scientific_name","common_name","family","spacing_in",
    "height_in_min","height_in_max","bloom_start","bloom_end","flower_color","usda_zones",
    "lepidoptera_genus_approx","specialist_bee_host","larval_hosts","wildlife_value","notes"]];
  combo.rows.forEach(function(r){
    var p=r.p;
    rows.push([combo.t.name, LAYER_NAME[r.layer], r.qty, p.sci, p.common, p.family, p.spacing,
      p.hmin, p.hmax, p.bloom_start||"", p.bloom_end||"", p.colors.join(" "),
      p.zmin+"-"+p.zmax, p.lep||"", p.sb?"yes":"", p.hosts.join("; "),
      p.wildlife.join("; "), p.notes]);
  });
  return rows;
}
function csvString(rows){
  return rows.map(function(r){ return r.map(function(v){
    v=String(v==null?"":v);
    return /[",\n]/.test(v) ? '"'+v.replace(/"/g,'""')+'"' : v; }).join(","); }).join("\n");
}
function downloadCSV(rows,name){
  var blob=new Blob(["\ufeff"+csvString(rows)],{type:"text/csv;charset=utf-8"});
  var a=document.createElement("a");
  a.href=URL.createObjectURL(blob); a.download=name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function(){ URL.revokeObjectURL(a.href); },2000);
}
function copyText(txt, btn){
  var label=btn.textContent;
  function done(){ btn.textContent="Copied"; setTimeout(function(){ btn.textContent=label; },1400); }
  function fallback(){
    var ta=document.createElement("textarea"); ta.value=txt;
    document.body.appendChild(ta); ta.select();
    try{ document.execCommand("copy"); done(); }catch(e){}
    ta.remove();
  }
  if(navigator.clipboard&&navigator.clipboard.writeText)
    navigator.clipboard.writeText(txt).then(done,fallback);
  else fallback();
}

/* ------------------------------------------------ UI */
var LAST=null;
function readForm(){
  return {zip:el("zip").value.trim(), region:el("region").value,
    zone:parseInt(el("zone").value,10), soil:el("soil").value,
    light:(document.querySelector('input[name=light]:checked')||{}).value||"S",
    w:Math.max(2,parseInt(el("w").value,10)||6), l:Math.max(2,parseInt(el("l").value,10)||16),
    maxh:parseInt(el("maxh").value,10)||999, deer:el("deer").value==="1",
    spread:el("spread").value==="1", seed:(LAST&&LAST.seed)||1};
}
function updateZip(){
  var zip=el("zip").value.trim(), box=el("zipOut");
  if(zip.length<5){ box.className=""; box.innerHTML=""; return null; }
  var r=resolveZip(zip);
  box.className="show"+(r.error?" warn":"");
  if(r.error){
    box.innerHTML="<b>"+esc(r.error)+"</b>";
    el("region").innerHTML="<option value=''>\u2014</option>";
    el("zone").innerHTML="<option value=''>\u2014</option>";
    return null;
  }
  var rsel=el("region"); rsel.innerHTML="";
  r.regions.forEach(function(code,i){
    var o=mk("option",null,REGIONS[code].name+(i===0?"  (best match)":"")); o.value=code;
    rsel.appendChild(o);
  });
  Object.keys(REGIONS).forEach(function(code){
    if(r.regions.indexOf(code)<0){
      var o=mk("option",null,REGIONS[code].name+"  (other)"); o.value=code; rsel.appendChild(o);
    }
  });
  rsel.value = r.regions[0];
  var zsel=el("zone"); zsel.innerHTML="";
  var lo=r.zones[0], hi=r.zones[1];
  for(var z=Math.max(1,lo-1); z<=Math.min(13,hi+1); z++){
    var o=mk("option",null,"Zone "+z+(z>=lo&&z<=hi?"":"  (outside the usual range here)"));
    o.value=z; zsel.appendChild(o);
  }
  zsel.value = String(Math.floor((lo+hi)/2));
  var reg=REGIONS[r.regions[0]];
  box.innerHTML = "<b>"+esc(r.state)+(r.place? " \u2014 "+esc(r.place):"")+"</b>"+
    (r.exact? " <span class='small'>(exact ZIP lookup)</span>":"")+
    "<div class='small' style='margin-top:5px'><strong>"+esc(reg.name)+
    "</strong> &mdash; EPA Level I: "+esc(reg.epa_l1)+"<br>"+esc(reg.blurb)+"</div>"+
    "<div class='small' style='margin-top:6px'>Likely USDA hardiness zone "+
    (lo===hi? lo : lo+"\u2013"+hi)+". "+
    (r.exact? "Sampled from the USDA hardiness raster." :
      r.refined? "Refined using the three-digit ZIP prefix." :
      "Estimated from the state-wide range.")+
    " Confirm at <a href='https://planthardiness.ars.usda.gov/' target='_blank' "+
    "rel='noopener'>planthardiness.ars.usda.gov</a>.</div>";
  return r;
}
function run(){
  var c=readForm();
  if(!/^\d{5}$/.test(c.zip)){
    el("status").innerHTML="<span class='muted'>Enter a five-digit ZIP code to begin.</span>";
    return;
  }
  if(!c.region||!c.zone){
    var rz=updateZip(); c=readForm();
    if(!c.region && rz && rz.regions && rz.regions.length) c.region=rz.regions[0];
    if(!c.zone && rz && rz.zones) c.zone=Math.floor((rz.zones[0]+rz.zones[1])/2);
  }
  if(!c.region||!c.zone){
    el("status").innerHTML="<span class='muted'>That ZIP code could not be resolved to an "+
      "ecoregion. See the message above the button.</span>";
    return;
  }
  c.key=[c.zip,c.region,c.zone,c.soil,c.light,c.w,c.l,c.maxh,c.deer,c.spread].join("~");
  LAST=c;
  var res=generate(c), host=el("combos");
  host.innerHTML="";
  el("resultsHead").hidden = !res.combos.length;
  if(!res.combos.length){
    el("status").innerHTML="<div class='callout red'><strong>No combination could be assembled "+
      "from the "+res.pool.length+" eligible species.</strong> The filters are probably too tight. "+
      "Try removing the height limit, allowing spreading plants, turning off high deer pressure, "+
      "or choosing a neighbouring ecoregion. Full shade plus dry soil plus a low height cap is the "+
      "hardest combination in the database, and in the arid Southwest it is a real horticultural "+
      "constraint rather than a gap in the data.</div>";
    return;
  }
  el("status").innerHTML="";
  el("resultsSummary").innerHTML = res.combos.length+" combination"+
    (res.combos.length===1?"":"s")+" drawn from <b>"+res.pool.length+"</b> species native to "+
    esc(REGIONS[c.region].name)+" that tolerate "+
    {S:"full sun",P:"part shade",H:"full shade"}[c.light]+" and "+
    {D:"dry",M:"average",W:"moist to wet"}[c.soil]+" soil in zone "+c.zone+
    ". Bed area "+(c.w*c.l)+" sq ft.";
  res.combos.forEach(function(cb,i){ host.appendChild(renderCombo(cb,i,c)); });

  var q="?zip="+c.zip+"&region="+c.region+"&zone="+c.zone+"&soil="+c.soil+"&light="+c.light+
    "&w="+c.w+"&l="+c.l+"&maxh="+c.maxh+"&deer="+(c.deer?1:0)+"&spread="+(c.spread?1:0)+
    "&seed="+c.seed;
  var pl=el("permalink"); pl.href=q; el("permalinkWrap").hidden=false;
  pl.onclick=function(e){ e.preventDefault(); copyText(location.origin+location.pathname+q, pl); };
  LAST.res=res;
  if(el("results").scrollIntoView) el("results").scrollIntoView({behavior:"smooth",block:"start"});
}
el("zip").addEventListener("input",function(){ updateZip(); });
el("bed").addEventListener("submit",function(e){ e.preventDefault(); run(); });
el("shuffle").addEventListener("click",function(){
  if(!LAST){ run(); return; } LAST.seed=(LAST.seed||1)+1; run(); });
el("printBtn").addEventListener("click",function(){ window.print(); });
el("csvAll").addEventListener("click",function(){
  if(!LAST||!LAST.res) return;
  var rows=null;
  LAST.res.combos.forEach(function(cb){
    var r=comboCSV(cb,LAST);
    if(!rows) rows=r; else rows=rows.concat(r.slice(1));
  });
  downloadCSV(rows,"botanical-bed-combinations-"+LAST.zip+".csv");
});

/* ------------------------------------------------ plant database browser */
(function browse(){
  var breg=el("breg"), blay=el("blay");
  var o0=mk("option",null,"All regions"); o0.value=""; breg.appendChild(o0);
  Object.keys(REGIONS).forEach(function(k){
    var o=mk("option",null,REGIONS[k].name); o.value=k; breg.appendChild(o); });
  var o1=mk("option",null,"All layers"); o1.value=""; blay.appendChild(o1);
  Object.keys(LAYER_NAME).forEach(function(k){
    var o=mk("option",null,LAYER_NAME[k]); o.value=k; blay.appendChild(o); });

  function draw(){
    var q=el("bq").value.toLowerCase().trim(), rg=breg.value, ly=blay.value,
        lt=el("blight").value, sort=el("bsort").value;
    var rows=PLANTS.filter(function(p){
      if(rg && p.regions.indexOf(rg)<0) return false;
      if(ly && p.layer!==ly) return false;
      if(lt && p.light.indexOf(lt)<0) return false;
      if(q){
        var hay=(p.sci+" "+p.common+" "+p.family+" "+p.hosts.join(" ")+" "+
                 p.wildlife.join(" ")+" "+p.notes).toLowerCase();
        if(hay.indexOf(q)<0) return false;
      }
      return true;
    });
    rows.sort(function(a,b){
      if(sort==="eco") return b.eco_score-a.eco_score;
      if(sort==="lep") return (b.lep||0)-(a.lep||0);
      if(sort==="h")   return b.hmax-a.hmax;
      return a.sci.localeCompare(b.sci);
    });
    el("browseCount").textContent = rows.length+" of "+PLANTS.length+
      " species shown. Every entry is native to at least one United States ecoregion.";
    var t=el("browseTable"); t.innerHTML="";
    var hr=mk("tr");
    ["Plant","Family","Regions","Zones","Light","Soil","Mature height","Bloom","Caterpillars","Value"]
      .forEach(function(h){ hr.appendChild(mk("th",null,h)); });
    t.appendChild(hr);
    rows.slice(0,400).forEach(function(p){
      var tr=mk("tr"), c1=mk("td");
      c1.innerHTML="<span class='cn'>"+esc(p.common)+"</span><br><span class='sci muted'>"+
        esc(p.sci)+"</span> <span class='layerTag "+p.layer+"'>"+LAYER_SHORT[p.layer]+"</span>"+
        "<div class='plinks'>"+photoLinks(p)+"</div>";
      tr.appendChild(c1);
      tr.appendChild(mk("td",null,p.family));
      tr.appendChild(mk("td",null,p.regions.join(" ")));
      tr.appendChild(mk("td",null,p.zmin+"\u2013"+p.zmax));
      tr.appendChild(mk("td",null,p.light.join("")));
      tr.appendChild(mk("td",null,p.moist.join("")));
      tr.appendChild(mk("td",null,heightPhrase(p)));
      tr.appendChild(mk("td",null,bloomStr(p)));
      tr.appendChild(mk("td",null,p.lep? "~"+p.lep : "\u2014"));
      var c2=mk("td","small",whyText(p)||"\u2014"); tr.appendChild(c2);
      t.appendChild(tr);
    });
    if(rows.length>400){
      var tr2=mk("tr"), td=mk("td","muted small",
        "Showing the first 400 matches \u2014 narrow the filters to see more.");
      td.colSpan=10; tr2.appendChild(td); t.appendChild(tr2);
    }
  }
  ["bq","breg","blay","blight","bsort"].forEach(function(id){
    el(id).addEventListener("input",draw); el(id).addEventListener("change",draw); });
  draw();
})();

/* ------------------------------------------------ sources */
(function sources(){
  var host=el("srcCards");
  SRC.forEach(function(s){
    var d=mk("div","src");
    d.innerHTML="<h4><a href='"+esc(s.url)+"' target='_blank' rel='noopener'>"+esc(s.name)+
      "</a></h4><div class='org'>"+esc(s.org)+"</div><p>"+esc(s.use)+
      "</p><div class='meta'><strong>Format:</strong> "+esc(s.format)+
      "<br><strong>Terms:</strong> "+esc(s.license)+
      (s.download? "<br><a href='"+esc(s.download)+"' target='_blank' rel='noopener'>Direct "+
        "download</a>":"")+"</div>";
    host.appendChild(d);
  });
  el("footStats").textContent = PLANTS.length+" species \u00b7 "+TEMPLATES.length+
    " design templates \u00b7 "+Object.keys(REGIONS).length+" ecoregions \u00b7 "+SRC.length+
    " cited data sources. Lepidoptera figures are approximate genus-level values; verify locally.";
})();

/* ------------------------------------------------ exact ZIP lookup + deep links */
function applyQuery(){
  var p;
  try { p = new URLSearchParams(location.search); } catch(e){ p = null; }
  if(!p || !p.get("zip")){
    el("status").innerHTML="<span class='muted'>Enter a ZIP code and shade level above, then "+
      "press <strong>Generate combinations</strong>.</span>";
    return;
  }
  el("zip").value=p.get("zip"); updateZip();
  ["region","zone","soil","w","l","maxh","deer","spread"].forEach(function(k){
    var v=p.get(k); if(v!==null && el(k)) el(k).value=v; });
  var lt=p.get("light");
  if(lt){ var r=document.querySelector('input[name=light][value="'+lt+'"]'); if(r) r.checked=true; }
  LAST={seed:parseInt(p.get("seed"),10)||1};
  run();
}
if(typeof fetch === "function"){
  fetch("zip_regions.json").then(function(r){ return r.ok? r.json():null; })
    .then(function(j){
      if(j){
        ZIP_EXACT=j.zips||j;
        var n=Object.keys(ZIP_EXACT).length;
        el("regionHint").innerHTML="Resolved from an exact per-ZIP lookup ("+
          n.toLocaleString()+" ZIP codes built from Census ZCTA centroids intersected with EPA "+
          "ecoregion polygons and the USDA hardiness raster).";
        if(el("zip").value.length===5) updateZip();
      }
    })
    .catch(function(){})
    .then(applyQuery, applyQuery);
} else { applyQuery(); }

})();
